import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Radio,
  Sliders,
  HelpCircle,
} from "lucide-react";

// Add a type for the SpeechRecognition constructor
type SpeechRecognitionConstructor = new () => SpeechRecognition;

const TEST_PHRASE = "DebateAI is the premier platform for real-time intellectual debates.";

export const SpeechTest: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Location state passed when coming from debate entry
  const returnUrl = location.state?.returnUrl as string | undefined;
  const roomId = location.state?.roomId as string | undefined;
  const debateState = location.state?.debateState;

  // Speech Recognition state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognitionStatus, setRecognitionStatus] = useState<string>("Ready to test");
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Microphone audio meter state
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied">("prompt");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMonitoringMic, setIsMonitoringMic] = useState<boolean>(false);
  const [micTested, setMicTested] = useState<boolean>(false); // true only after user actively runs mic test
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isRequestingMicRef = useRef<boolean>(false);
  const chimeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Speaker test state
  const [isPlayingChime, setIsPlayingChime] = useState<boolean>(false);
  const [speakerVerified, setSpeakerVerified] = useState<boolean | null>(null);
  const [showChimePrompt, setShowChimePrompt] = useState<boolean>(false);

  // Initialize Speech Recognition & Mount Lifecycle
  useEffect(() => {
    isMountedRef.current = true;

    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognitionCtor = (window.SpeechRecognition ||
        window.webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined;

      if (!SpeechRecognitionCtor) {
        setIsSupported(false);
        setRecognitionStatus("Speech recognition not supported in this browser");
        return;
      }

      setIsSupported(true);
      recognitionRef.current = new SpeechRecognitionCtor();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setRecognitionStatus("Listening... Please speak clearly");
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " ";
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
          setRecognitionStatus("Speech detected!");
        } else if (interimTranscript) {
          setRecognitionStatus(`Transcribing: "${interimTranscript}"`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setRecognitionStatus("Stopped listening");
      };

      recognitionRef.current.onerror = (event) => {
        const errorEvent = event as SpeechRecognitionErrorEvent;
        setIsListening(false);
        if (errorEvent.error === "not-allowed") {
          setRecognitionStatus("Microphone access denied. Please grant permission in browser settings.");
          setMicPermission("denied");
        } else {
          setRecognitionStatus(`Recognition error: ${errorEvent.error}`);
        }
      };
    } else {
      setIsSupported(false);
      setRecognitionStatus("Speech recognition not supported in this browser. You can debate via text typing.");
    }

    // Check existing permissions if supported by browser Permissions API
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === "granted") {
            setMicPermission("granted");
          } else if (permissionStatus.state === "denied") {
            setMicPermission("denied");
          }
        })
        .catch(() => {});
    }

    return () => {
      isMountedRef.current = false;
      if (chimeTimeoutRef.current) {
        clearTimeout(chimeTimeoutRef.current);
        chimeTimeoutRef.current = null;
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
      stopAudioMonitoring();
    };
  }, []);

  // Web Audio API Microphone Monitoring & Volume Meter
  const startAudioMonitoring = useCallback(async () => {
    // In-flight guard to prevent concurrent getUserMedia requests
    if (isRequestingMicRef.current) return;
    isRequestingMicRef.current = true;

    try {
      if (micStreamRef.current) {
        stopAudioMonitoring();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("MediaDevicesUnavailable");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If stream resolves after component unmounted, stop tracks instead of storing or updating state
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      micStreamRef.current = stream;
      setMicPermission("granted");
      setIsMonitoringMic(true);
      setMicTested(true); // user actively ran the test

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average RMS audio volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // Normalize to percentage 0 - 100 with boosted sensitivity for speech
        const normalized = Math.min(100, Math.round((average / 128) * 100 * 1.5));
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      setIsMonitoringMic(false);
      setAudioLevel(0);

      const error = err as Error;
      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        setMicPermission("denied");
        setRecognitionStatus("Microphone access denied. Please grant permission in browser settings.");
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        setRecognitionStatus("No microphone device found on your system.");
      } else if (error?.message === "MediaDevicesUnavailable" || !navigator.mediaDevices) {
        setRecognitionStatus("Microphone access is not supported by your browser environment.");
      } else {
        setRecognitionStatus(`Microphone error: ${error?.message || "Unable to access microphone"}`);
      }
    } finally {
      isRequestingMicRef.current = false;
    }
  }, []);

  const stopAudioMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (isMountedRef.current) {
      setAudioLevel(0);
      setIsMonitoringMic(false);
    }
  };

  // Web Audio API Synthesized Speaker Chime
  const playSpeakerChime = () => {
    try {
      setIsPlayingChime(true);
      setShowChimePrompt(false);
      setSpeakerVerified(null);

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Pleasant 3-tone arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz)
      const notes = [523.25, 659.25, 783.99];
      const noteDuration = 0.15;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * noteDuration);

        // Smooth attack and release envelope
        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * noteDuration);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + idx * noteDuration + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (idx + 1) * noteDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * noteDuration);
        osc.stop(ctx.currentTime + (idx + 1) * noteDuration);
      });

      if (chimeTimeoutRef.current) {
        clearTimeout(chimeTimeoutRef.current);
      }

      chimeTimeoutRef.current = setTimeout(() => {
        chimeTimeoutRef.current = null;
        if (!isMountedRef.current) {
          ctx.close().catch(() => {});
          return;
        }
        setIsPlayingChime(false);
        setShowChimePrompt(true);
        // keep speakerVerified as null until user answers
        ctx.close().catch(() => {});
      }, (notes.length * noteDuration + 0.1) * 1000);
    } catch {
      setIsPlayingChime(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    } else {
      if (!isMonitoringMic) {
        startAudioMonitoring();
      }
      try {
        recognitionRef.current?.start();
      } catch {
        setRecognitionStatus("Speech recognition is already running or resetting.");
      }
    }
  };

  const handleClearTranscript = () => {
    setTranscript("");
    setRecognitionStatus("Transcript cleared.");
  };

  const handleProceedToDebate = () => {
    if (returnUrl) {
      navigate(returnUrl, { state: debateState });
    } else if (roomId) {
      navigate(`/debate-room/${roomId}`);
    } else {
      navigate("/startDebate");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 sm:px-6 lg:px-8 py-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-primary border-primary/40 gap-1.5 px-3 py-1">
                <Sliders className="h-3.5 w-3.5" /> Hardware Calibration
              </Badge>
              {isSupported ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Speech API Active
                </Badge>
              ) : (
                <Badge variant="destructive">Speech API Unsupported</Badge>
              )}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Audio & Microphone Calibration
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Verify your microphone sensitivity, test audio playback, and confirm speech recognition accuracy.
            </p>
          </div>

          {/* Quick Action: Start Debate from top header */}
          {(roomId || returnUrl) && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={handleProceedToDebate}
                className="text-muted-foreground hover:text-foreground text-sm whitespace-nowrap"
              >
                Skip & Enter Directly
              </Button>
              <Button
                onClick={handleProceedToDebate}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2 whitespace-nowrap"
              >
                Start Debate 🚀
              </Button>
            </div>
          )}
        </div>

        {/* Pre-Debate Context Banner if routed from a debate room */}
        {(roomId || returnUrl) && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="p-2 bg-primary/20 text-primary rounded-lg shrink-0">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Pre-Debate Check Active {roomId ? `for Room #${roomId}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Confirm your hardware is working to prevent accidental forfeits during timed live debate rounds.
              </p>
            </div>
          </div>
        )}

        {/* Diagnostic Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Card 1: Microphone & Live Volume Meter */}
          <Card className="bg-card text-card-foreground border-border shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Mic className="h-5 w-5 text-primary" /> Microphone Level
                </CardTitle>
                {/* Show Ready badge only after user actively tested mic AND audio is detected */}
                {micTested && micPermission === "granted" && audioLevel > 0 && (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready
                  </Badge>
                )}
                {micTested && micPermission === "granted" && audioLevel === 0 && isMonitoringMic && (
                  <Badge variant="outline" className="text-amber-500 border-amber-400/40 gap-1">
                    <AlertTriangle className="h-3 w-3" /> No Audio
                  </Badge>
                )}
                {micPermission === "denied" && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Blocked
                  </Badge>
                )}
                {!micTested && micPermission !== "denied" && (
                  <Badge variant="outline" className="text-muted-foreground">Not Tested</Badge>
                )}
              </div>
              <CardDescription>
                Check live input sensitivity and ensure your voice is loud and clear.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Volume Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Input Volume</span>
                  <span className={audioLevel > 15 ? "text-primary font-bold" : "text-muted-foreground"}>
                    {audioLevel}% {audioLevel > 60 ? "(Loud)" : audioLevel > 15 ? "(Optimal)" : "(Silent)"}
                  </span>
                </div>
                <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 rounded-full ${
                      audioLevel > 75
                        ? "bg-amber-500"
                        : audioLevel > 15
                        ? "bg-emerald-500"
                        : "bg-primary/40"
                    }`}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {!isMonitoringMic ? (
                  <Button
                    onClick={startAudioMonitoring}
                    variant="outline"
                    className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Mic className="h-4 w-4" /> Start Mic Test
                  </Button>
                ) : (
                  <Button
                    onClick={stopAudioMonitoring}
                    variant="destructive"
                    className="w-full gap-2"
                  >
                    <MicOff className="h-4 w-4" /> Stop Mic Test
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Speaker & Audio Output Test */}
          <Card className="bg-card text-card-foreground border-border shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-primary" /> Speaker & Output
                </CardTitle>
                {speakerVerified === true && (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Audio Verified
                  </Badge>
                )}
                {speakerVerified === false && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Audio Not Heard
                  </Badge>
                )}
                {speakerVerified === null && !isPlayingChime && !showChimePrompt && (
                  <Badge variant="outline" className="text-muted-foreground">Not Tested</Badge>
                )}
              </div>
              <CardDescription>
                Ensure you can hear speeches, opponent rebuttals, and round transition bells.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Click below to play a short test chime through your current default sound output device.
              </p>

              {/* Did you hear the chime? Prompt with Yes and No buttons */}
              {showChimePrompt && (
                <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">Did you hear the chime?</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSpeakerVerified(true);
                        setShowChimePrompt(false);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSpeakerVerified(false);
                        setShowChimePrompt(false);
                      }}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5" /> No
                    </Button>
                  </div>
                </div>
              )}

              {speakerVerified === false && !showChimePrompt && (
                <p className="text-xs text-amber-500 dark:text-amber-400">
                  ⚠️ If you couldn't hear the sound, please check your device volume or speaker connection and try again.
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={playSpeakerChime}
                  disabled={isPlayingChime}
                  variant="outline"
                  className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Volume2 className={`h-4 w-4 ${isPlayingChime ? "animate-bounce" : ""}`} />
                  {isPlayingChime ? "Playing Chime..." : "Play Test Chime"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card 3: Speech-to-Text Transcription Test */}
        <Card className="bg-card text-card-foreground border-border shadow-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Speech-to-Text Recognition Test
                </CardTitle>
                <CardDescription>
                  Speak out loud to verify your browser's speech transcription speed and accuracy.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={isListening ? "default" : "secondary"}
                  className={isListening ? "bg-emerald-600 text-white animate-pulse" : "bg-muted text-muted-foreground"}
                >
                  {isListening ? "● Live Transcribing" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Suggested practice phrase */}
            <div className="bg-muted/50 border border-border/70 rounded-lg p-3 text-xs sm:text-sm">
              <span className="font-semibold text-primary block mb-1">💡 Suggested Test Phrase:</span>
              <p className="italic text-foreground select-all">"{TEST_PHRASE}"</p>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={toggleListening}
                disabled={!isSupported}
                className={isListening ? "bg-red-600 hover:bg-red-700 text-white gap-2" : "bg-primary hover:bg-primary/90 text-primary-foreground gap-2"}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4" /> Stop Transcription
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" /> Start Speech Test
                  </>
                )}
              </Button>
              <Button
                onClick={handleClearTranscript}
                disabled={!transcript}
                variant="outline"
                className="gap-2 border-border"
              >
                <RotateCcw className="h-4 w-4" /> Clear Transcript
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                Status: {recognitionStatus}
              </span>
            </div>

            {/* Real-time Transcript Output Box */}
            <div className="relative">
              <div
                className="w-full min-h-[140px] max-h-[260px] overflow-y-auto p-4 rounded-xl border border-border bg-background/80 text-foreground font-mono text-sm whitespace-pre-wrap focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
              >
                {transcript ? (
                  <span className="text-foreground">{transcript}</span>
                ) : (
                  <span className="text-muted-foreground/60 select-none">
                    {isListening
                      ? "Listening... Say something into your microphone now."
                      : "Click 'Start Speech Test' and speak into your microphone. Your transcribed speech will appear here in real-time."}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Instructions & Browser Compatibility */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card text-card-foreground border border-border/80 rounded-xl p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <HelpCircle className="h-4 w-4 text-primary" /> Setup Checklist
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Allow browser microphone permissions when prompted.</li>
              <li>Speak at a comfortable volume about 6–12 inches from your mic.</li>
              <li>Avoid excessive ambient noise or loud background audio.</li>
              <li>Ensure your default OS microphone is not muted via a physical switch.</li>
            </ul>
          </div>

          <div className="bg-card text-card-foreground border border-border/80 rounded-xl p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Browser Compatibility
            </h3>
            <p className="text-xs text-muted-foreground">
              The Web Speech API provides optimal native support in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, and modern Chromium-based browsers.
            </p>
            <p className="text-xs text-muted-foreground">
              On Firefox or unsupported environments, speech-to-text can be complemented with standard text typing during your debate rounds.
            </p>
          </div>
        </div>

        {/* Bottom Action Bar — Start Debate / Skip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Back to Previous Page
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Skip button — for experienced users who don't need audio calibration */}
            {(roomId || returnUrl) && (
              <Button
                variant="outline"
                onClick={handleProceedToDebate}
                className="flex-1 sm:flex-none gap-2 border-border text-muted-foreground hover:text-foreground"
              >
                Skip & Enter Directly
              </Button>
            )}

            {/* Primary CTA — Start Debate */}
            <Button
              onClick={handleProceedToDebate}
              size="lg"
              className="flex-1 sm:flex-none font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md"
            >
              {roomId
                ? "Start Debate 🚀"
                : returnUrl
                ? "Start Debate 🚀"
                : "Proceed to Start Debate"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SpeechTest;
