/**
 * useSpeechSynthesis
 *
 * A custom React hook that wraps the browser's Web Speech API
 * (window.speechSynthesis + SpeechSynthesisUtterance) to provide
 * per-message play / pause / resume / stop controls for DebateAI's
 * bot messages.
 *
 * Design decisions:
 * - Text is split into sentence-level chunks so long responses never
 *   cause the browser's internal speech queue to stall (a known Chrome
 *   bug where utterances > ~200 words stop mid-way).
 * - A single "active message ID" is tracked externally so that callers
 *   can enforce single-active-playback at the page level.
 * - Voices are loaded lazily; the hook re-resolves the preferred voice
 *   whenever the browser fires "voiceschanged".
 * - No external dependencies, no API keys.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlaybackState = "idle" | "playing" | "paused";

export interface BotVoiceProfile {
  /** Preferred voice name substrings to match (case-insensitive, tried in order). */
  preferredVoiceNames: string[];
  /** Speech rate (0.1 – 10, default 1). */
  rate: number;
  /** Pitch (0 – 2, default 1). */
  pitch: number;
  /** Volume (0 – 1, default 1). */
  volume: number;
}

export interface UseSpeechSynthesisReturn {
  /** Whether the Web Speech API is available in this browser. */
  isSupported: boolean;
  /** Current playback state for the *active* message. */
  playbackState: PlaybackState;
  /** The message ID that is currently active (playing or paused). */
  activeMessageId: string | null;
  /** Start (or resume) speaking the given message. */
  play: (messageId: string, text: string, botName: string) => void;
  /** Pause the current utterance. */
  pause: () => void;
  /** Resume a paused utterance. */
  resume: () => void;
  /** Fully stop the current utterance and reset state. */
  stop: () => void;
}

// ---------------------------------------------------------------------------
// Voice personality profiles
// ---------------------------------------------------------------------------

/**
 * Maps bot names to voice characteristics.
 * Voice names are substrings to match against SpeechSynthesisVoice.name
 * (case-insensitive). Tried in order; falls back to browser default.
 *
 * Tuning rationale:
 *  - Yoda    → slow, high-pitched to mimic an elderly wise voice.
 *  - Vader   → deep, slow, "UK Male" or similar baritone.
 *  - Stark   → fast, confident, American male.
 *  - Dumbledore → measured, slightly British, deliberate.
 *  - Rafiki  → bright, lively, fast.
 *  - Others  → neutral adjustments by difficulty level.
 */
const BOT_VOICE_PROFILES: Record<string, BotVoiceProfile> = {
  "Yoda": {
    preferredVoiceNames: ["Google UK English Male", "en-GB", "Daniel", "Fred"],
    rate: 0.75,
    pitch: 1.3,
    volume: 1,
  },
  "Darth Vader": {
    preferredVoiceNames: ["Google UK English Male", "Daniel", "en-GB", "Alex"],
    rate: 0.8,
    pitch: 0.5,
    volume: 1,
  },
  "Tony Stark": {
    preferredVoiceNames: [
      "Google US English",
      "en-US",
      "Alex",
      "Samantha",
      "Microsoft David",
    ],
    rate: 1.15,
    pitch: 1.05,
    volume: 1,
  },
  "Professor Dumbledore": {
    preferredVoiceNames: ["Google UK English Male", "Daniel", "en-GB", "Arthur"],
    rate: 0.88,
    pitch: 0.9,
    volume: 1,
  },
  "Rafiki": {
    preferredVoiceNames: [
      "Google US English",
      "en-US",
      "Samantha",
      "Karen",
      "Victoria",
    ],
    rate: 1.1,
    pitch: 1.4,
    volume: 1,
  },
  "Grand Greg": {
    preferredVoiceNames: ["Google UK English Male", "Daniel", "en-GB"],
    rate: 0.95,
    pitch: 0.85,
    volume: 1,
  },
  "Expert Emma": {
    preferredVoiceNames: [
      "Google UK English Female",
      "en-GB",
      "Fiona",
      "Samantha",
    ],
    rate: 1.0,
    pitch: 1.0,
    volume: 1,
  },
  "Sassy Sarah": {
    preferredVoiceNames: [
      "Google US English",
      "Samantha",
      "en-US",
      "Victoria",
    ],
    rate: 1.1,
    pitch: 1.2,
    volume: 1,
  },
  "Innovative Iris": {
    preferredVoiceNames: ["Samantha", "Karen", "Google US English", "en-US"],
    rate: 1.05,
    pitch: 1.1,
    volume: 1,
  },
  "Tough Tony": {
    preferredVoiceNames: ["Google US English", "Alex", "en-US", "Daniel"],
    rate: 0.95,
    pitch: 0.85,
    volume: 1,
  },
  "Moderate Mike": {
    preferredVoiceNames: ["Google US English", "Alex", "en-US"],
    rate: 1.0,
    pitch: 1.0,
    volume: 1,
  },
  "Casual Casey": {
    preferredVoiceNames: ["Samantha", "Google US English", "en-US", "Karen"],
    rate: 1.05,
    pitch: 1.05,
    volume: 1,
  },
  "Rookie Rick": {
    preferredVoiceNames: ["Google US English", "Alex", "en-US"],
    rate: 0.92,
    pitch: 1.1,
    volume: 1,
  },
};

const DEFAULT_PROFILE: BotVoiceProfile = {
  preferredVoiceNames: [],
  rate: 1.0,
  pitch: 1.0,
  volume: 1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split text into sentence-level chunks (<=~200 chars each) to avoid
 *  the Chrome long-utterance stall bug. */
function splitIntoChunks(text: string, maxLen = 200): string[] {
  const raw = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of raw) {
    if ((current + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trimEnd());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trimEnd());
  return chunks.length > 0 ? chunks : [text];
}

/** Find the best matching SpeechSynthesisVoice for the preferred name list. */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredNames: string[]
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  for (const pref of preferredNames) {
    const lower = pref.toLowerCase();
    const found = voices.find((v) => v.name.toLowerCase().includes(lower));
    if (found) return found;
  }

  return (
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0] ??
    null
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef<number>(0);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeProfileRef = useRef<BotVoiceProfile>(DEFAULT_PROFILE);
  const activeVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const stoppedRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);
  const chunkCompletedWhilePausedRef = useRef<boolean>(false);
  const playbackSessionRef = useRef<number>(0);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice loading
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) setVoices(available);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playbackSessionRef.current += 1;
      if (startTimerRef.current !== null) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      if (isSupported) {
        stoppedRef.current = true;
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  const speakNextChunk = useCallback(() => {
    if (stoppedRef.current || pausedRef.current) return;
    const session = playbackSessionRef.current;
    if (chunkIndexRef.current >= chunksRef.current.length) {
      setPlaybackState("idle");
      setActiveMessageId(null);
      return;
    }

    const text = chunksRef.current[chunkIndexRef.current];
    const profile = activeProfileRef.current;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;
    if (activeVoiceRef.current) utterance.voice = activeVoiceRef.current;

    utterance.onend = () => {
      if (session !== playbackSessionRef.current || stoppedRef.current) return;
      chunkIndexRef.current += 1;
      if (pausedRef.current) {
        chunkCompletedWhilePausedRef.current = true;
        return;
      }
      speakNextChunk();
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (session !== playbackSessionRef.current || stoppedRef.current) return;
      if (e.error === "interrupted" || e.error === "canceled") return;
      console.warn("[TTS] SpeechSynthesisUtterance error:", e.error);
      setPlaybackState("idle");
      setActiveMessageId(null);
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const play = useCallback(
    (messageId: string, text: string, botName: string) => {
      if (!isSupported) return;

      playbackSessionRef.current += 1;
      const session = playbackSessionRef.current;
      if (startTimerRef.current !== null) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      stoppedRef.current = true;
      window.speechSynthesis.cancel();

      startTimerRef.current = setTimeout(() => {
        startTimerRef.current = null;
        if (session !== playbackSessionRef.current) return;

        stoppedRef.current = false;
        pausedRef.current = false;
        chunkCompletedWhilePausedRef.current = false;
        window.speechSynthesis.resume();

        const profile = BOT_VOICE_PROFILES[botName] ?? DEFAULT_PROFILE;
        activeProfileRef.current = profile;
        activeVoiceRef.current = pickVoice(voices, profile.preferredVoiceNames);

        chunksRef.current = splitIntoChunks(text);
        chunkIndexRef.current = 0;

        setActiveMessageId(messageId);
        setPlaybackState("playing");
        speakNextChunk();
      }, 50);
    },
    [isSupported, voices, speakNextChunk]
  );

  const pause = useCallback(() => {
    if (!isSupported || playbackState !== "playing") return;
    pausedRef.current = true;
    window.speechSynthesis.pause();
    setPlaybackState("paused");
  }, [isSupported, playbackState]);

  const resume = useCallback(() => {
    if (!isSupported || playbackState !== "paused") return;
    pausedRef.current = false;
    window.speechSynthesis.resume();
    setPlaybackState("playing");
    if (chunkCompletedWhilePausedRef.current) {
      chunkCompletedWhilePausedRef.current = false;
      speakNextChunk();
    }
  }, [isSupported, playbackState, speakNextChunk]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    playbackSessionRef.current += 1;
    if (startTimerRef.current !== null) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    stoppedRef.current = true;
    pausedRef.current = false;
    window.speechSynthesis.cancel();
    setPlaybackState("idle");
    setActiveMessageId(null);
  }, [isSupported]);

  return {
    isSupported,
    playbackState,
    activeMessageId,
    play,
    pause,
    resume,
    stop,
  };
}
