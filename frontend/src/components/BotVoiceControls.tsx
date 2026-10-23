/**
 * BotVoiceControls
 *
 * A compact, accessible Play / Pause / Stop control strip for a single
 * bot message in DebateAI's DebateRoom.
 *
 * Props:
 *  messageId       – stable unique ID for this message (used to identify
 *                    which message is currently active in the hook).
 *  text            – the bot message text to speak.
 *  botName         – the bot's display name (used for voice-personality lookup).
 *  tts             – the UseSpeechSynthesisReturn object from useSpeechSynthesis(),
 *                    passed in from the parent so a single hook instance manages
 *                    all messages (single-active-playback guarantee).
 *
 * Behaviour:
 *  - If TTS is unsupported, renders nothing.
 *  - Shows a play button when idle (or when another message is active).
 *  - When THIS message is active:
 *      • Shows pause button while playing.
 *      • Shows play (resume) button while paused.
 *      • Always shows stop button when active.
 *  - Clicking play on a different message stops any existing playback first
 *    (handled inside useSpeechSynthesis.play()).
 */

import React from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UseSpeechSynthesisReturn } from "@/hooks/useSpeechSynthesis";

interface BotVoiceControlsProps {
  messageId: string;
  text: string;
  botName: string;
  tts: UseSpeechSynthesisReturn;
}

const BotVoiceControls: React.FC<BotVoiceControlsProps> = ({
  messageId,
  text,
  botName,
  tts,
}) => {
  if (!tts.isSupported) return null;

  const isThisActive = tts.activeMessageId === messageId;
  const isPlaying = isThisActive && tts.playbackState === "playing";
  const isPaused = isThisActive && tts.playbackState === "paused";

  const handlePlayPause = () => {
    if (isPlaying) {
      tts.pause();
    } else if (isPaused) {
      tts.resume();
    } else {
      // Either idle or a different message is active — start this one.
      tts.play(messageId, text, botName);
    }
  };

  const handleStop = () => {
    tts.stop();
  };

  return (
    <span
      className="inline-flex items-center gap-1 ml-2"
      aria-label={`Voice controls for ${botName}'s message`}
    >
      {/* Speaker icon — decorative, indicates TTS feature */}
      <Volume2
        className={`w-3.5 h-3.5 ${
          isThisActive
            ? "text-primary animate-pulse"
            : "text-muted-foreground opacity-60"
        }`}
        aria-hidden="true"
      />

      {/* Play / Pause toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-full hover:bg-primary/10 transition-colors"
        onClick={handlePlayPause}
        aria-label={
          isPlaying
            ? `Pause ${botName}'s message`
            : isPaused
            ? `Resume ${botName}'s message`
            : `Listen to ${botName}'s message`
        }
        title={isPlaying ? "Pause" : isPaused ? "Resume" : "Listen"}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 text-primary" />
        ) : (
          <Play
            className={`w-3.5 h-3.5 ${
              isPaused ? "text-primary" : "text-muted-foreground"
            }`}
          />
        )}
      </Button>

      {/* Stop button — only visible when this message is active */}
      {isThisActive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full hover:bg-destructive/10 transition-colors"
          onClick={handleStop}
          aria-label={`Stop listening to ${botName}'s message`}
          title="Stop"
        >
          <Square className="w-3 h-3 text-destructive" />
        </Button>
      )}
    </span>
  );
};

export default BotVoiceControls;
