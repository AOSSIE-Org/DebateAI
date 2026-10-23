/**
 * BotVoiceControls.test.tsx
 *
 * Unit-tests for the <BotVoiceControls /> component.
 *
 * We do NOT test actual audio — we only verify the component's
 * rendered state (buttons, labels) and that it delegates correctly
 * to the TTS hook methods.
 *
 * Coverage:
 *  ✓ Renders nothing when TTS is unsupported
 *  ✓ Renders play button when idle
 *  ✓ Play button has correct accessible label
 *  ✓ Clicking play calls tts.play() with correct args
 *  ✓ Shows pause button while THIS message is playing
 *  ✓ Clicking pause calls tts.pause()
 *  ✓ Shows resume (play) button while THIS message is paused
 *  ✓ Clicking resume calls tts.resume()
 *  ✓ Shows stop button when this message is active
 *  ✓ Clicking stop calls tts.stop()
 *  ✓ Does NOT show stop button when another message is active
 *  ✓ Shows play button (not pause) when a different message is playing
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BotVoiceControls from "@/components/BotVoiceControls";
import type { UseSpeechSynthesisReturn } from "@/hooks/useSpeechSynthesis";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTts(overrides: Partial<UseSpeechSynthesisReturn> = {}): UseSpeechSynthesisReturn {
  return {
    isSupported: true,
    playbackState: "idle",
    activeMessageId: null,
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  messageId: "bot-Opening Statements-0",
  text: "Hello, this is a bot message.",
  botName: "Moderate Mike",
};

function renderControls(tts: UseSpeechSynthesisReturn) {
  return render(<BotVoiceControls {...DEFAULT_PROPS} tts={tts} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BotVoiceControls – unsupported", () => {
  it("renders nothing when TTS is not supported", () => {
    const tts = makeTts({ isSupported: false });
    const { container } = renderControls(tts);
    expect(container.firstChild).toBeNull();
  });
});

describe("BotVoiceControls – idle state", () => {
  it("renders a play button with accessible label", () => {
    const tts = makeTts();
    renderControls(tts);
    expect(
      screen.getByRole("button", { name: /listen to moderate mike/i })
    ).toBeInTheDocument();
  });

  it("does NOT render a stop button when idle", () => {
    const tts = makeTts();
    renderControls(tts);
    expect(
      screen.queryByRole("button", { name: /stop/i })
    ).not.toBeInTheDocument();
  });

  it("calls tts.play() with correct args when play is clicked", async () => {
    const tts = makeTts();
    renderControls(tts);
    await userEvent.click(
      screen.getByRole("button", { name: /listen to moderate mike/i })
    );
    expect(tts.play).toHaveBeenCalledOnce();
    expect(tts.play).toHaveBeenCalledWith(
      DEFAULT_PROPS.messageId,
      DEFAULT_PROPS.text,
      DEFAULT_PROPS.botName
    );
  });
});

describe("BotVoiceControls – playing state (this message)", () => {
  function makePlaying() {
    return makeTts({
      playbackState: "playing",
      activeMessageId: DEFAULT_PROPS.messageId,
    });
  }

  it("shows a pause button with accessible label", () => {
    renderControls(makePlaying());
    expect(
      screen.getByRole("button", { name: /pause moderate mike/i })
    ).toBeInTheDocument();
  });

  it("shows a stop button", () => {
    renderControls(makePlaying());
    expect(
      screen.getByRole("button", { name: /stop listening/i })
    ).toBeInTheDocument();
  });

  it("calls tts.pause() when pause is clicked", async () => {
    const tts = makePlaying();
    renderControls(tts);
    await userEvent.click(
      screen.getByRole("button", { name: /pause moderate mike/i })
    );
    expect(tts.pause).toHaveBeenCalledOnce();
  });

  it("calls tts.stop() when stop is clicked", async () => {
    const tts = makePlaying();
    renderControls(tts);
    await userEvent.click(
      screen.getByRole("button", { name: /stop listening/i })
    );
    expect(tts.stop).toHaveBeenCalledOnce();
  });
});

describe("BotVoiceControls – paused state (this message)", () => {
  function makePaused() {
    return makeTts({
      playbackState: "paused",
      activeMessageId: DEFAULT_PROPS.messageId,
    });
  }

  it("shows a resume (play) button with accessible label", () => {
    renderControls(makePaused());
    expect(
      screen.getByRole("button", { name: /resume moderate mike/i })
    ).toBeInTheDocument();
  });

  it("shows a stop button", () => {
    renderControls(makePaused());
    expect(
      screen.getByRole("button", { name: /stop listening/i })
    ).toBeInTheDocument();
  });

  it("calls tts.resume() when play/resume is clicked", async () => {
    const tts = makePaused();
    renderControls(tts);
    await userEvent.click(
      screen.getByRole("button", { name: /resume moderate mike/i })
    );
    expect(tts.resume).toHaveBeenCalledOnce();
  });
});

describe("BotVoiceControls – different message is active", () => {
  it("shows play (not pause) button when another message is playing", () => {
    const tts = makeTts({
      playbackState: "playing",
      activeMessageId: "bot-Closing-99", // different message
    });
    renderControls(tts);
    // This message should show "listen" (play) because it's not active.
    expect(
      screen.getByRole("button", { name: /listen to moderate mike/i })
    ).toBeInTheDocument();
  });

  it("does NOT show stop button when a different message is active", () => {
    const tts = makeTts({
      playbackState: "playing",
      activeMessageId: "bot-Closing-99",
    });
    renderControls(tts);
    expect(
      screen.queryByRole("button", { name: /stop listening/i })
    ).not.toBeInTheDocument();
  });

  it("calls tts.play() (not tts.pause()) when play is clicked while another message is active", async () => {
    const tts = makeTts({
      playbackState: "playing",
      activeMessageId: "bot-Closing-99",
    });
    renderControls(tts);
    await userEvent.click(
      screen.getByRole("button", { name: /listen to moderate mike/i })
    );
    expect(tts.play).toHaveBeenCalledOnce();
    expect(tts.pause).not.toHaveBeenCalled();
  });
});
