/**
 * DebateRoom — one instance per live debate (id = debateID).
 *
 * Replaces the Go WebSocket layer that Workers genuinely cannot host on plain
 * fetch:
 *   websocket/websocket.go       (hub, broadcast, turn state)
 *   websocket/debate_spectator.go (spectator join, polls, reactions)
 *   internal/debate/*            (phase timers, poll store, rate limiting)
 *   services/team_turn_service.go (turn clock)
 *
 * Why a DO and not KV: a debate needs a single authoritative in-memory copy of
 * "whose turn is it, how many seconds are left, who has voted" plus a real
 * timer. DOs give you exactly one instance, transactional `state.storage`, and
 * `state.storage.setAlarm()` for the clock.
 *
 * Client: `new WebSocket("wss://<host>/ws/debate/<debateID>?token=<jwt>")`.
 * The Worker (src/worker/index.ts) authenticates, then forwards the upgrade here.
 */

type Role = "debater" | "spectator";
type Phase = "lobby" | "opening" | "cross" | "closing" | "voting" | "ended";

interface Session {
  ws: WebSocket;
  userId: string;
  role: Role;
}

interface RoomState {
  phase: Phase;
  turnUserId: string | null;
  turnEndsAt: number | null; // epoch ms
  debaters: string[]; // userIds, in speaking order
  format: string;
}

const PHASE_SECONDS: Record<Phase, number> = {
  lobby: 0,
  opening: 120,
  cross: 90,
  closing: 90,
  voting: 60,
  ended: 0,
};

export class DebateRoom implements DurableObject {
  private sessions = new Set<Session>();
  private room: RoomState = {
    phase: "lobby",
    turnUserId: null,
    turnEndsAt: null,
    debaters: [],
    format: "standard",
  };

  constructor(
    private state: DurableObjectState,
    private env: CloudflareEnv,
  ) {
    this.state.blockConcurrencyWhile(async () => {
      const saved = await this.state.storage.get<RoomState>("room");
      if (saved) this.room = saved;
    });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // REST sub-endpoints used by the cron sweep / route handlers.
    if (url.pathname.endsWith("/init") && req.method === "POST") {
      const body = (await req.json()) as { debaters: string[]; format?: string };
      this.room.debaters = body.debaters;
      this.room.format = body.format ?? "standard";
      await this.persist();
      return Response.json({ ok: true });
    }
    if (url.pathname.endsWith("/state")) {
      return Response.json(this.room);
    }

    // WebSocket upgrade.
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const userId = url.searchParams.get("uid") ?? "";
    const role: Role = this.room.debaters.includes(userId) ? "debater" : "spectator";

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.accept(server, userId, role);
    return new Response(null, { status: 101, webSocket: client });
  }

  private accept(ws: WebSocket, userId: string, role: Role) {
    ws.accept();
    const session: Session = { ws, userId, role };
    this.sessions.add(session);

    ws.send(JSON.stringify({ type: "welcome", role, room: this.room }));
    this.broadcast({ type: "presence", count: this.sessions.size }, session);

    ws.addEventListener("message", (evt) => this.onMessage(session, evt));
    const bye = () => {
      this.sessions.delete(session);
      this.broadcast({ type: "presence", count: this.sessions.size });
    };
    ws.addEventListener("close", bye);
    ws.addEventListener("error", bye);
  }

  private async onMessage(session: Session, evt: MessageEvent) {
    let msg: { type: string; [k: string]: unknown };
    try {
      msg = JSON.parse(typeof evt.data === "string" ? evt.data : "");
    } catch {
      return;
    }

    switch (msg.type) {
      // A debater submits their argument for the current turn.
      case "argument": {
        if (session.role !== "debater" || session.userId !== this.room.turnUserId) {
          return session.ws.send(JSON.stringify({ type: "error", error: "not your turn" }));
        }
        this.broadcast({
          type: "argument",
          userId: session.userId,
          text: String(msg.text ?? ""),
          phase: this.room.phase,
        });
        await this.advanceTurn();
        break;
      }

      // Host starts the debate / moves to the next phase.
      case "start":
      case "next-phase": {
        if (session.role !== "debater") return;
        await this.nextPhase();
        break;
      }

      // Spectator reaction / chat — relayed, rate limiting handled at the edge.
      case "reaction":
      case "chat": {
        this.broadcast({
          type: msg.type,
          userId: session.userId,
          value: msg.value ?? msg.text ?? "",
        });
        break;
      }
    }
  }

  // --- phase / turn machine ------------------------------------------------
  private async nextPhase() {
    const order: Phase[] = ["lobby", "opening", "cross", "closing", "voting", "ended"];
    const idx = order.indexOf(this.room.phase);
    this.room.phase = order[Math.min(idx + 1, order.length - 1)];
    this.room.turnUserId = this.room.debaters[0] ?? null;
    await this.startTurnTimer();
    this.broadcast({ type: "phase", room: this.room });
    if (this.room.phase === "ended") await this.finish();
  }

  private async advanceTurn() {
    const i = this.room.debaters.indexOf(this.room.turnUserId ?? "");
    const next = this.room.debaters[i + 1];
    if (next) {
      this.room.turnUserId = next;
      await this.startTurnTimer();
      this.broadcast({ type: "turn", room: this.room });
    } else {
      await this.nextPhase();
    }
  }

  private async startTurnTimer() {
    const secs = PHASE_SECONDS[this.room.phase];
    this.room.turnEndsAt = secs ? Date.now() + secs * 1000 : null;
    await this.persist();
    if (this.room.turnEndsAt) await this.state.storage.setAlarm(this.room.turnEndsAt);
  }

  // Fired by the DO runtime when the turn clock runs out.
  async alarm() {
    if (!this.room.turnEndsAt || Date.now() < this.room.turnEndsAt - 500) return;
    this.broadcast({ type: "timeout", userId: this.room.turnUserId });
    await this.advanceTurn();
  }

  private async finish() {
    this.broadcast({ type: "ended", room: this.room });
    // TODO: POST results to /debate/result equivalent, persist transcript,
    // trigger rating update (services.RatingService).
  }

  // --- helpers ----------------------------------------------------------
  private persist() {
    return this.state.storage.put("room", this.room);
  }

  private broadcast(data: unknown, except?: Session) {
    const payload = JSON.stringify(data);
    for (const s of this.sessions) {
      if (s === except) continue;
      try {
        s.ws.send(payload);
      } catch {
        this.sessions.delete(s);
      }
    }
  }
}
