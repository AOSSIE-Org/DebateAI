
import { useCallback, useEffect, useRef, useState } from "react";

export type PlaybackState = "idle" | "playing" | "paused";

export interface BotVoiceProfile {
  preferredVoiceNames: string[];
  rate: number;
  pitch: number;
  volume: number;
}

export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  playbackState: PlaybackState;
  activeMessageId: string | null;
  play: (messageId: string, text: string, botName: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const BOT_VOICE_PROFILES: Record<string, BotVoiceProfile> = {
  Yoda: {
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
  Rafiki: {
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
    rate: 1,
    pitch: 1,
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
    rate: 1,
    pitch: 1,
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
  rate: 1,
  pitch: 1,
  volume: 1,
};

const LONG_SENTENCE_THRESHOLD = 220;
const UTTERANCE_GAP_MS = 50;

function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredNames: string[],
): SpeechSynthesisVoice | null {
  for (const preference of preferredNames) {
    const normalizedPreference = preference.toLowerCase().replace(/_/g, "-");

    const match = voices.find((voice) => {
      const name = voice.name.toLowerCase();
      const language = voice.lang.toLowerCase().replace(/_/g, "-");

      return (
        name.includes(normalizedPreference) ||
        language === normalizedPreference ||
        (normalizedPreference.length === 2 &&
          language.startsWith(`${normalizedPreference}-`))
      );
    });

    if (match) return match;
  }

  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    voices.find((voice) => voice.default) ??
    voices[0] ??
    null
  );
}

/**
 * Splits unusually long sentences at natural clause boundaries.
 * Ordinary sentences are never split just to meet a character limit.
 */
function splitLongSentence(sentence: string): string[] {
  const text = sentence.trim();

  if (text.length <= LONG_SENTENCE_THRESHOLD) {
    return text ? [text] : [];
  }

  // Prefer strong clause boundaries, keeping punctuation with each clause.
  const parts = text.match(/[^;:—–]+[;:—–]?/g);

  if (!parts || parts.length < 2) {
    // Preserve an unusually long sentence if no natural boundary exists.
    return [text];
  }

  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    const next = `${current}${part}`.trim();

    if (
      current.trim() &&
      next.length > LONG_SENTENCE_THRESHOLD
    ) {
      chunks.push(current.trim());
      current = part.trimStart();
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // A single oversized clause is preferable to an arbitrary sentence split.
  return chunks.length > 1 ? chunks : [text];
}

function splitIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();

  if (!normalized) return [];

  // Split at sentence punctuation followed by whitespace.
  // Decimal numbers such as 3.14 are not split by this expression.
  const sentences =
  normalized.match(/[\s\S]+?(?:[.!?]+(?=\s|$)|$)/g) ?? [normalized];

  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .flatMap(splitLongSentence);
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const isSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";

  const [playbackState, setPlaybackState] =
    useState<PlaybackState>("idle");
  const [activeMessageId, setActiveMessageId] =
    useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const sessionRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const currentUtteranceRef =
    useRef<SpeechSynthesisUtterance | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);
  const pausedRef = useRef(false);
  const stoppedRef = useRef(true);
  const nextChunkTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNextChunkRef = useRef(false);
  const activeProfileRef = useRef<BotVoiceProfile>(DEFAULT_PROFILE);
  const activeVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const clearNextChunkTimer = useCallback(() => {
    if (nextChunkTimerRef.current !== null) {
      clearTimeout(nextChunkTimerRef.current);
      nextChunkTimerRef.current = null;
    }
  }, []);

  const resetPlayback = useCallback((session: number) => {
    if (session !== sessionRef.current) return;

    stoppedRef.current = true;
    pausedRef.current = false;
    pendingNextChunkRef.current = false;
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    currentUtteranceRef.current = null;
    activeMessageIdRef.current = null;

    setPlaybackState("idle");
    setActiveMessageId(null);
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const synthesis = window.speechSynthesis;

    const loadVoices = () => {
      setVoices(synthesis.getVoices());
    };

    loadVoices();
    synthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      synthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [isSupported]);

  const speakChunkRef = useRef<(session: number) => void>(() => {});

  const scheduleNextChunk = useCallback(
    (session: number) => {
      clearNextChunkTimer();

      if (session !== sessionRef.current || stoppedRef.current) return;

      if (pausedRef.current) {
        pendingNextChunkRef.current = true;
        return;
      }

      nextChunkTimerRef.current = setTimeout(() => {
        nextChunkTimerRef.current = null;

        if (
          session !== sessionRef.current ||
          stoppedRef.current ||
          pausedRef.current
        ) {
          if (
            session === sessionRef.current &&
            !stoppedRef.current &&
            pausedRef.current
          ) {
            pendingNextChunkRef.current = true;
          }
          return;
        }

        speakChunkRef.current(session);
      }, UTTERANCE_GAP_MS);
    },
    [clearNextChunkTimer],
  );

  const speakChunk = useCallback(
    (session: number) => {
      if (
        !isSupported ||
        session !== sessionRef.current ||
        stoppedRef.current ||
        pausedRef.current
      ) {
        return;
      }

      if (chunkIndexRef.current >= chunksRef.current.length) {
        resetPlayback(session);
        return;
      }

      const chunk = chunksRef.current[chunkIndexRef.current];
      const utterance = new window.SpeechSynthesisUtterance(chunk);

      const messageBotProfile = activeProfileRef.current;
      utterance.rate = messageBotProfile.rate;
      utterance.pitch = messageBotProfile.pitch;
      utterance.volume = messageBotProfile.volume;

      if (activeVoiceRef.current) {
        utterance.voice = activeVoiceRef.current;
      }

      currentUtteranceRef.current = utterance;

      utterance.onend = () => {
        if (
          session !== sessionRef.current ||
          stoppedRef.current
        ) {
          return;
        }

        currentUtteranceRef.current = null;
        chunkIndexRef.current += 1;

        if (chunkIndexRef.current >= chunksRef.current.length) {
          resetPlayback(session);
          return;
        }

        scheduleNextChunk(session);
      };

      utterance.onerror = (event) => {
        if (
          session !== sessionRef.current ||
          stoppedRef.current
        ) {
          return;
        }

        // A current-session error must not leave the controls stuck.
        // Errors caused by replacing/stopping speech are rejected by the
        // session guard above.
        console.warn("[TTS] Speech synthesis error:", event.error);
        clearNextChunkTimer();
        resetPlayback(session);
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        if (session !== sessionRef.current) return;

        console.warn("[TTS] Unable to start speech:", error);
        clearNextChunkTimer();
        resetPlayback(session);
      }
    },
    [
      clearNextChunkTimer,
      isSupported,
      resetPlayback,
      scheduleNextChunk,
    ],
  );

  useEffect(() => {
    speakChunkRef.current = speakChunk;
  }, [speakChunk]);
  const play = useCallback(
    (messageId: string, text: string, botName: string) => {
      if (!isSupported) return;

    const chunks = splitIntoChunks(text);
      if (chunks.length === 0) return;

      // Invalidate old utterance callbacks before cancelling the old speech.
      const session = ++sessionRef.current;

      clearNextChunkTimer();
      stoppedRef.current = true;
      pausedRef.current = false;
      pendingNextChunkRef.current = false;

      try {
        window.speechSynthesis.cancel();
        // cancel() clears the queue but may leave the synthesizer paused.
        window.speechSynthesis.resume();
      } catch {
        // A browser cancellation failure must not revive the previous session.
      }

      chunksRef.current = chunks;
      chunkIndexRef.current = 0;
      currentUtteranceRef.current = null;
      activeMessageIdRef.current = messageId;
      stoppedRef.current = false;

      const profile = BOT_VOICE_PROFILES[botName] ?? DEFAULT_PROFILE;
      activeProfileRef.current = profile;
      activeVoiceRef.current = pickVoice(
        voices,
        profile.preferredVoiceNames,
      );

      setActiveMessageId(messageId);
      setPlaybackState("playing");

      // Start the first utterance immediately; only later utterances have a gap.
      speakChunkRef.current(session);
    },
    [clearNextChunkTimer, isSupported, voices],
  );


  const pause = useCallback(() => {
    if (!isSupported || playbackState !== "playing") return;

    pausedRef.current = true;

    try {
      window.speechSynthesis.pause();
    } catch {
      // State remains paused; the user can attempt to resume or stop.
    }

    setPlaybackState("paused");
  }, [isSupported, playbackState]);

  const resume = useCallback(() => {
    if (!isSupported || playbackState !== "paused") return;

    pausedRef.current = false;

    try {
      window.speechSynthesis.resume();
    } catch {
      // Continue through our own queue if the browser resume call fails.
    }

    setPlaybackState("playing");

    if (pendingNextChunkRef.current) {
      pendingNextChunkRef.current = false;
      scheduleNextChunk(sessionRef.current);
    }
  }, [isSupported, playbackState, scheduleNextChunk]);

  const stop = useCallback(() => {
    if (!isSupported) return;

    // Invalidates all callbacks/timers belonging to the stopped playback.
    sessionRef.current += 1;
    clearNextChunkTimer();

    stoppedRef.current = true;
    pausedRef.current = false;
    pendingNextChunkRef.current = false;
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    currentUtteranceRef.current = null;
    activeMessageIdRef.current = null;

    try {
      window.speechSynthesis.cancel();
    } catch {
      // The UI still resets even if cancellation throws.
    }

    setPlaybackState("idle");
    setActiveMessageId(null);
  }, [clearNextChunkTimer, isSupported]);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      clearNextChunkTimer();

      stoppedRef.current = true;
      pausedRef.current = false;
      pendingNextChunkRef.current = false;

      if (isSupported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore cleanup errors during unmount.
        }
      }
    };
  }, [clearNextChunkTimer, isSupported]);

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