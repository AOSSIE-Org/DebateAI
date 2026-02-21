export class SpeechRecognitionTest {
  private recognition: SpeechRecognition | null = null;
  private supported: boolean;
  private shouldRestart = false;
  private isListening = false;
  private restartTimeout: number | null = null;

  constructor() {
    this.supported =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

    if (this.supported) {
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionCtor) {
        this.recognition = new SpeechRecognitionCtor();
        this.setupRecognition();
      }
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    // START EVENT
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log("Speech recognition started");
    };

    // RESULT EVENT
    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        console.log("✅ Final:", finalTranscript.trim());
      }

      if (interimTranscript) {
        console.log("⌛ Interim:", interimTranscript);
      }
    };

    // SAFE AUTO RESTART
    this.recognition.onend = () => {
      this.isListening = false;
      console.log("Speech recognition ended");

      if (!this.shouldRestart) return;

      console.log("Restarting recognition...");

      this.restartTimeout = window.setTimeout(() => {
        this.restartTimeout = null;

        if (!this.shouldRestart || this.isListening) return;

        try {
          this.recognition?.start();
        } catch (error) {
          console.error("Restart failed:", error);
        }
      }, 500);
    };

    // ERROR HANDLING
    this.recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error, event.message);

      // stop restart loop on fatal errors
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture" ||
        event.error === "aborted"
      ) {
        this.shouldRestart = false;
      }
    };
  }

  // START LISTENING
  public async start(): Promise<boolean> {
    if (!this.supported || !this.recognition || this.isListening) {
      return false;
    }

    const allowed = await this.checkMicrophonePermission();
    if (!allowed) {
      console.warn("Microphone permission denied");
      return false;
    }

    this.shouldRestart = true;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error("Start failed:", error);

      // IMPORTANT: prevent unwanted restart
      this.shouldRestart = false;
      this.isListening = false;

      return false;
    }
  }

  // STOP LISTENING
  public stop() {
    this.shouldRestart = false;

    // cancel pending restart
    if (this.restartTimeout !== null) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error("Stop failed:", error);
      }
    }
  }

  public isSpeechRecognitionSupported(): boolean {
    return this.supported;
  }

  // CHECK MICROPHONE PERMISSION
  public async checkMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }
}

// TEST HELPER
export const testSpeechRecognition = async () => {
  const test = new SpeechRecognitionTest();

  if (!test.isSpeechRecognitionSupported()) {
    console.log("Speech recognition not supported in this browser");
    return;
  }

  const started = await test.start();
  if (!started) return;

  // stop after 10 seconds
  setTimeout(() => {
    test.stop();
    console.log("⏹ Manually stopped");
  }, 10000);
};