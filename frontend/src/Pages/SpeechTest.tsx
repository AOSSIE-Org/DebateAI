import React, { useEffect, useRef, useState } from "react";

// Add a type for the SpeechRecognition constructor
type SpeechRecognitionConstructor = new () => SpeechRecognition;

const SpeechTest: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognitionCtor = (window.SpeechRecognition ||
        window.webkitSpeechRecognition) as
        | SpeechRecognitionConstructor
        | undefined;

      if (!SpeechRecognitionCtor) return;

      recognitionRef.current = new SpeechRecognitionCtor();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setStatus("Listening...");
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
          setStatus(`Final: ${finalTranscript}`);
        }
        if (interimTranscript) {
          setStatus(`Interim: ${interimTranscript}`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setStatus("Stopped listening");
      };

      recognitionRef.current.onerror = (event) => {
        const errorEvent = event as SpeechRecognitionErrorEvent;
        setIsListening(false);
        setStatus(`Error: ${errorEvent.error}`);
      };

    } else {
      setStatus("Speech recognition not supported");
    }

    // Cleanup on unmount
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
      }
      recognitionRef.current = null;
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        setStatus("Error starting recognition");
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
      }
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setStatus("");
  };

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setStatus("Microphone permission granted");
      return true;
    } catch (error) {
      setStatus("Microphone permission denied");
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-8">
          Speech Recognition Test
        </h1>

        <div className="space-y-6">
          <div className="text-center">
            <div
              className={`text-2xl font-semibold mb-2 ${
                isListening ? "text-green-600" : "text-gray-600"
              }`}
            >
              {isListening ? "🎤 Listening..." : "🎤 Not Listening"}
            </div>
            <div className="text-sm text-gray-500 mb-4">{status}</div>

            <div className="space-x-4">
              <button
                onClick={startListening}
                disabled={isListening}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg"
              >
                Start Listening
              </button>
              <button
                onClick={stopListening}
                disabled={!isListening}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg"
              >
                Stop Listening
              </button>
              <button
                onClick={clearTranscript}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
              >
                Clear Transcript
              </button>
              <button
                onClick={checkMicrophonePermission}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg"
              >
                Check Microphone
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Transcript:</h2>
            <div className="bg-white p-3 rounded border min-h-[200px] whitespace-pre-wrap">
              {transcript || "No speech detected yet..."}
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <ul className="text-sm space-y-1">
              <li>1. Click "Check Microphone" to ensure microphone access</li>
              <li>2. Click "Start Listening" to begin speech recognition</li>
              <li>3. Speak clearly into your microphone</li>
              <li>4. Watch the transcript appear in real-time</li>
              <li>5. Click "Stop Listening" when done</li>
            </ul>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Troubleshooting:</h3>
            <ul className="text-sm space-y-1">
              <li>
                • Make sure your browser supports speech recognition
                (Chrome/Edge recommended)
              </li>
              <li>• Allow microphone permissions when prompted</li>
              <li>• Speak clearly and avoid background noise</li>
              <li>• Check browser console for error messages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechTest;
