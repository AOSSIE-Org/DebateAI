import { io, Socket } from 'socket.io-client';
import { getServer } from './server';

// ".invalid" never resolves, so a blocked state can never reach a real server.
const BLOCKED_URL = 'https://blocked.invalid';

export const socket: Socket = io(getServer() ?? BLOCKED_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('token') }), // TODO(confirm): use the repo's real auth token key
});

// Connects only when a valid server is active. Returns false when blocked.
export function connectSocket(): boolean {
  if (!getServer()) return false;
  if (!socket.connected) socket.connect();
  return true;
}

export function disconnectSocket(): void {
  socket.disconnect();
}

// For the existing native WebSocket / ReconnectingWebSocket code.
// Returns null when the server URL is invalid, so the caller must not connect.
export function getWebSocketUrl(path: string): string | null {
  const base = getServer();
  if (!base) return null;
  try {
    const u = new URL(path, base);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.toString();
  } catch {
    return null;
  }
}