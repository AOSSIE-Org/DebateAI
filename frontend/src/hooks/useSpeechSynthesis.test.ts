/**
 * useSpeechSynthesis.test.ts
 *
 * Unit tests for the useSpeechSynthesis hook.
 *
 * Strategy
 * --------
 * jsdom does not provide the Web Speech API, so each test installs a
 * minimal mock of window.speechSynthesis.
 *
 * The mock stores utterances passed to speak(), allowing tests to
 * simulate onend and onerror callbacks.
 *
 * Coverage
 * --------
 * - Reports whether the Web Speech API is supported.
 * - Starts playback immediately.
 * - Cancels previous speech when switching messages.
 * - Ignores callbacks from previous playback sessions.
 * - Supports pause, resume, and stop.
 * - Handles completion and errors.
 * - Splits long messages into multiple utterances.
 * - Waits 50 ms between utterances.
 * - Handles voice loading and cleanup on unmount.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type VoicesChangedListener = () => void;

interface MockSpeechSynthesis {
  _voices: SpeechSynthesisVoice[];
  _listeners: VoicesChangedListener[];
  _utterances: SpeechSynthesisUtterance[];
  _paused: boolean;
  _cancelled: boolean;
  getVoices: () => SpeechSynthesisVoice[];
  speak: (utterance: SpeechSynthesisUtterance) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  addEventListener: (event: string, cb: VoicesChangedListener) => void;
  removeEventListener: (event: string, cb: VoicesChangedListener) => void;
  _fireVoicesChanged: () => void;
  _latestUtterance: () => SpeechSynthesisUtterance | undefined;
}

function makeMockSpeechSynthesis(): MockSpeechSynthesis {
  const mock: MockSpeechSynthesis = {
    _voices: [],
    _listeners: [],
    _utterances: [],
    _paused: false,
    _cancelled: false,

    getVoices() {
      return this._voices;
    },

    speak(utterance) {
      this._utterances.push(utterance);
    },

    cancel() {
      this._cancelled = true;
    },

    pause() {
      this._paused = true;
    },

    resume() {
      this._paused = false;
    },

    addEventListener(_event, cb) {
      this._listeners.push(cb);
    },

    removeEventListener(_event, cb) {
      this._listeners = this._listeners.filter(
        (listener) => listener !== cb,
      );
    },

    _fireVoicesChanged() {
      this._listeners.forEach((listener) => listener());
    },

    _latestUtterance() {
      return this._utterances[this._utterances.length - 1];
    },
  };

  return mock;
}

// ---------------------------------------------------------------------------
// Setup and teardown
// ---------------------------------------------------------------------------

let mockSS: MockSpeechSynthesis;

let originalSpeechSynthesisDescriptor:
  | PropertyDescriptor
  | undefined;

let originalUtteranceDescriptor:
  | PropertyDescriptor
  | undefined;

beforeEach(() => {
  vi.useFakeTimers();

  originalSpeechSynthesisDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "speechSynthesis",
  );

  originalUtteranceDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "SpeechSynthesisUtterance",
  );

  mockSS = makeMockSpeechSynthesis();

  Object.defineProperty(window, "speechSynthesis", {
    value: mockSS,
    writable: true,
    configurable: true,
  });

  // jsdom may not provide SpeechSynthesisUtterance.
  Object.defineProperty(window, "SpeechSynthesisUtterance", {
    value: class {
      text: string;
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror:
        | ((event: SpeechSynthesisErrorEvent) => void)
        | null = null;

      constructor(text: string) {
        this.text = text;
      }
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();

  if (originalSpeechSynthesisDescriptor) {
    Object.defineProperty(
      window,
      "speechSynthesis",
      originalSpeechSynthesisDescriptor,
    );
  } else {
    Reflect.deleteProperty(window, "speechSynthesis");
  }

  if (originalUtteranceDescriptor) {
    Object.defineProperty(
      window,
      "SpeechSynthesisUtterance",
      originalUtteranceDescriptor,
    );
  } else {
    Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
  }

  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// API availability
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – API availability", () => {
  it("reports isSupported=true when the API is present", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isSupported).toBe(true);
  });

  it("reports isSupported=false when speechSynthesis is absent", () => {
    const getVoices = vi.spyOn(mockSS, "getVoices");

    Reflect.deleteProperty(window, "speechSynthesis");

    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isSupported).toBe(false);
    expect(getVoices).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – initial state", () => {
  it("starts idle with no active message", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.playbackState).toBe("idle");
    expect(result.current.activeMessageId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – play()", () => {
  it("starts speaking immediately and transitions to playing", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play("msg-1", "Hello world.", "Moderate Mike");
    });

    expect(result.current.playbackState).toBe("playing");
    expect(result.current.activeMessageId).toBe("msg-1");
    expect(mockSS._utterances).toHaveLength(1);
  });

  it("cancels previous speech when a new message is played", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play("msg-1", "First message.", "Yoda");
    });

    expect(mockSS._utterances).toHaveLength(1);

    mockSS._cancelled = false;

    act(() => {
      result.current.play("msg-2", "Second message.", "Darth Vader");
    });

    expect(mockSS._cancelled).toBe(true);
    expect(result.current.playbackState).toBe("playing");
    expect(result.current.activeMessageId).toBe("msg-2");
    expect(mockSS._utterances).toHaveLength(2);
  });

  it("does not start the next chunk after stop", async () => {
    const { result } = renderHook(() => useSpeechSynthesis());

  act(() => {
    result.current.play(
      "msg-1",
      "First sentence. Second sentence.",
      "Yoda",
    );
  });

  const first = mockSS._latestUtterance();

  // The first utterance starts immediately.
  expect(mockSS._utterances).toHaveLength(1);

  act(() => {
    // Simulate the first utterance finishing.
    // The next utterance is scheduled after 50 ms.
      first?.onend?.(new Event("end") as SpeechSynthesisEvent);

      // Stop before the next utterance can start.
      result.current.stop();
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Only the first utterance should have been created.
    expect(mockSS._utterances).toHaveLength(1);
    expect(result.current.playbackState).toBe("idle");
    expect(result.current.activeMessageId).toBeNull();
  });


  it("ignores completion and errors from a previous playback session", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play("msg-1", "First message.", "Yoda");
    });

    const firstUtterance = mockSS._latestUtterance();

    act(() => {
      result.current.play("msg-2", "Second message.", "Darth Vader");
    });

    const currentUtterance = mockSS._latestUtterance();

    expect(currentUtterance).toBeDefined();
    expect(result.current.activeMessageId).toBe("msg-2");

    act(() => {
      firstUtterance?.onend?.(
        new Event("end") as SpeechSynthesisEvent,
      );

      firstUtterance?.onerror?.(
        { error: "network" } as SpeechSynthesisErrorEvent,
      );
    });

    expect(result.current.playbackState).toBe("playing");
    expect(result.current.activeMessageId).toBe("msg-2");
  });
});

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – pause()", () => {
  it("calls speechSynthesis.pause() and transitions to paused", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play("msg-1", "Testing pause.", "Tony Stark");
    });

    act(() => {
      result.current.pause();
    });

    expect(mockSS._paused).toBe(true);
    expect(result.current.playbackState).toBe("paused");
  });

  it("does not pause when already idle", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.pause();
    });

    expect(mockSS._paused).toBe(false);
    expect(result.current.playbackState).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – resume()", () => {
  it("calls speechSynthesis.resume() and transitions to playing", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play("msg-1", "Resume test.", "Rafiki");
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.playbackState).toBe("paused");

    act(() => {
      result.current.resume();
    });

    expect(mockSS._paused).toBe(false);
    expect(result.current.playbackState).toBe("playing");
  });

  it("continues with the next chunk when the current chunk ends while paused", async () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    const longText = Array(10)
      .fill("This is a sentence that is moderately long.")
      .join(" ");

    act(() => {
      result.current.play(
        "msg-long",
        longText,
        "Professor Dumbledore",
      );
    });

    const first = mockSS._latestUtterance();
    const utteranceCount = mockSS._utterances.length;

    expect(first).toBeDefined();
    expect(utteranceCount).toBeGreaterThan(0);

    act(() => {
      result.current.pause();

      first?.onend?.(
        new Event("end") as SpeechSynthesisEvent,
      );
    });

    expect(mockSS._utterances).toHaveLength(utteranceCount);

    act(() => {
      result.current.resume();
    });

    expect(result.current.playbackState).toBe("playing");

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(mockSS._utterances).toHaveLength(utteranceCount + 1);
  });
});

// ---------------------------------------------------------------------------
// Stop
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – stop()", () => {
  it("calls cancel() and resets playback to idle", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play("msg-1", "Stop test.", "Expert Emma");
    });

    mockSS._cancelled = false;

    act(() => {
      result.current.stop();
    });

    expect(mockSS._cancelled).toBe(true);
    expect(result.current.playbackState).toBe("idle");
    expect(result.current.activeMessageId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Natural completion
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – natural completion", () => {
  it("resets to idle when the last utterance finishes", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play(
        "msg-1",
        "Short sentence.",
        "Casual Casey",
      );
    });

    const utterance = mockSS._latestUtterance();

    act(() => {
      utterance?.onend?.call(
        utterance,
        new Event("end") as SpeechSynthesisEvent,
      );
    });

    expect(result.current.playbackState).toBe("idle");
    expect(result.current.activeMessageId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – error handling", () => {
  it("resets playback when the current utterance reports an interruption", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play(
        "msg-1",
        "Error test.",
        "Tough Tony",
      );
    });

    const utterance = mockSS._latestUtterance();

    act(() => {
      utterance?.onerror?.(
        { error: "interrupted" } as SpeechSynthesisErrorEvent,
      );
    });

    expect(result.current.playbackState).toBe("idle");
    expect(result.current.activeMessageId).toBeNull();
  });

  it("resets to idle on an unexpected error", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play(
        "msg-1",
        "Error test.",
        "Grand Greg",
      );
    });

    const utterance = mockSS._latestUtterance();

    act(() => {
      utterance?.onerror?.(
        { error: "network" } as SpeechSynthesisErrorEvent,
      );
    });

    expect(result.current.playbackState).toBe("idle");
    expect(result.current.activeMessageId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chunk splitting and inter-utterance delay
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – chunk splitting", () => {
  const makeLongText = () =>
    Array(10)
      .fill("This is a sentence that is moderately long.")
      .join(" ");

  it("splits long messages into multiple utterances", async () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play(
        "msg-long",
        makeLongText(),
        "Professor Dumbledore",
      );
    });

    const firstCount = mockSS._utterances.length;

    expect(firstCount).toBe(1);

    const first = mockSS._latestUtterance();

    act(() => {
      first?.onend?.call(
        first,
        new Event("end") as SpeechSynthesisEvent,
      );
    });

    // The next utterance should not be spoken before the 50 ms gap ends.
    await act(async () => {
      vi.advanceTimersByTime(49);
    });

    expect(mockSS._utterances).toHaveLength(firstCount);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(mockSS._utterances).toHaveLength(firstCount + 1);
  });

  it("does not enqueue another utterance before 50 ms have elapsed", async () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play(
        "msg-gap",
        makeLongText(),
        "Moderate Mike",
      );
    });

    const first = mockSS._latestUtterance();

    expect(mockSS._utterances).toHaveLength(1);

    act(() => {
      first?.onend?.(
        new Event("end") as SpeechSynthesisEvent,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(49);
    });

    expect(mockSS._utterances).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(mockSS._utterances).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Voice loading
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – voice loading", () => {
  it("handles voices becoming available after initial empty results", () => {
    mockSS._voices = [];

    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isSupported).toBe(true);

    const fakeVoice = {
      name: "Google US English",
      lang: "en-US",
      default: true,
      localService: false,
      voiceURI: "Google US English",
    } as SpeechSynthesisVoice;

    mockSS._voices = [fakeVoice];

    act(() => {
      mockSS._fireVoicesChanged();
    });

    expect(result.current.playbackState).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – cleanup on unmount", () => {
  it("does not start delayed playback after unmount", () => {
  const { result, unmount } = renderHook(() => useSpeechSynthesis());

  act(() => {
    result.current.play(
      "msg-1",
      "First sentence. Second sentence.",
      "Rookie Rick",
    );
  });

  // The first utterance should start immediately.
  expect(mockSS._utterances).toHaveLength(1);

  act(() => {
    mockSS._utterances[0].onend?.(
      new Event("end") as SpeechSynthesisEvent,
    );
  });

  unmount();

  act(() => {
    vi.advanceTimersByTime(100);
  });

  // No second utterance should start after unmount.
  expect(mockSS._utterances).toHaveLength(1);
  expect(mockSS._cancelled).toBe(true);
});

  it("calls cancel() when the hook unmounts", () => {
    const { result, unmount } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play(
        "msg-1",
        "Cleanup test.",
        "Rookie Rick",
      );
    });

    mockSS._cancelled = false;

    act(() => {
      unmount();
    });

    expect(mockSS._cancelled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Switching messages
// ---------------------------------------------------------------------------

describe("useSpeechSynthesis – switching messages", () => {
  it("stops message A when message B starts playing", () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.play(
        "msg-A",
        "Message A text.",
        "Sassy Sarah",
      );
    });

    expect(result.current.activeMessageId).toBe("msg-A");

    mockSS._cancelled = false;

    act(() => {
      result.current.play(
        "msg-B",
        "Message B text.",
        "Innovative Iris",
      );
    });

    expect(mockSS._cancelled).toBe(true);
    expect(result.current.activeMessageId).toBe("msg-B");
    expect(result.current.playbackState).toBe("playing");
  });
});
