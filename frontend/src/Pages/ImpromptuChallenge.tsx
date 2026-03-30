import { useState, useEffect, useRef } from 'react';
import Timer from '@/components/Timer';
import UserCamera from '@/components/UserCamera';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import JudgmentPopup from '@/components/JudgementPopup';
import { useAtom } from 'jotai';
import { userAtom } from '@/state/userAtom';

type Phase = 'IDLE' | 'PREP' | 'RECORDING' | 'EVALUATING' | 'RESULT';

type JudgmentData = {
  opening_statement: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  cross_examination: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  answers: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  closing: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  total: { user: number; bot: number };
  verdict: { winner: string; reason: string; congratulations: string; opponent_analysis: string };
};

export default function ImpromptuChallenge() {
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [topic, setTopic] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const transcriptRef = useRef<string>('');
  const [timerValue, setTimerValue] = useState<number>(0);
  const [judgmentData, setJudgmentData] = useState<JudgmentData | null>(null);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  
  const [user] = useAtom(userAtom);
  const userAvatar = user?.avatarUrl || "https://avatar.iran.liara.run/public/10";
  
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);
  const dummyWs = useRef<WebSocket>({ send: () => {} } as unknown as WebSocket);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const startRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsRecognizing(true);
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + ' ' + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecognizing(false);
      };

      recognition.onend = () => setIsRecognizing(false);

      recognition.start();
      recognitionRef.current = recognition;
    } else {
      toast({ title: "Speech recognition not supported in this browser.", variant: "destructive" });
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (phase === 'PREP') {
      setTimerValue(30); 
      timeout = setTimeout(() => {
        setPhase('RECORDING');
      }, 30000);
    } else if (phase === 'RECORDING') {
      setTimerValue(60); 
      startRecognition();
      
      timeout = setTimeout(() => {
        handleStopRecording();
      }, 60000);
    }

    return () => {
      clearTimeout(timeout);
      if (phase !== 'RECORDING') {
        stopRecognition();
      }
    };
  }, [phase]);

  const fetchTopic = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/impromptu/topic`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTopic(data.topic);
      setTranscript('');
      transcriptRef.current = '';
      setPhase('PREP');
    } catch {
      toast({ title: "Failed to fetch topic", variant: "destructive" });
    }
  };

  const handleStopRecording = async () => {
    setPhase('EVALUATING');
    stopRecognition();
    
    const currentText = transcriptRef.current;
    const finalText = currentText.trim() !== '' ? currentText : "I do not have any arguments for this topic.";

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/impromptu/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic, transcript: finalText }),
      });
      const resJson = await res.json();
      
      const safeJudgmentData: JudgmentData = {
        opening_statement: {
          user: { score: resJson.data?.opening_statement?.user?.score || 0, reason: resJson.data?.opening_statement?.user?.reason || "N/A" },
          bot: { score: resJson.data?.opening_statement?.bot?.score || 0, reason: resJson.data?.opening_statement?.bot?.reason || "N/A" }
        },
        cross_examination: {
          user: { score: resJson.data?.cross_examination?.user?.score || 0, reason: resJson.data?.cross_examination?.user?.reason || "N/A" },
          bot: { score: resJson.data?.cross_examination?.bot?.score || 0, reason: resJson.data?.cross_examination?.bot?.reason || "N/A" }
        },
        answers: {
          user: { score: resJson.data?.answers?.user?.score || 0, reason: resJson.data?.answers?.user?.reason || "N/A" },
          bot: { score: resJson.data?.answers?.bot?.score || 0, reason: resJson.data?.answers?.bot?.reason || "N/A" }
        },
        closing: {
           user: { score: resJson.data?.closing?.user?.score || 0, reason: resJson.data?.closing?.user?.reason || "N/A" },
           bot: { score: resJson.data?.closing?.bot?.score || 0, reason: resJson.data?.closing?.bot?.reason || "N/A" }
        },
        total: {
          user: resJson.data?.total?.user || 0,
          bot: resJson.data?.total?.bot || 0
        },
        verdict: {
          winner: resJson.data?.verdict?.winner || "Unknown",
          reason: resJson.data?.verdict?.reason || "Evaluation failed to process completely.",
          congratulations: resJson.data?.verdict?.congratulations || "",
          opponent_analysis: resJson.data?.verdict?.opponent_analysis || ""
        }
      };

      setJudgmentData(safeJudgmentData); 
      setPhase('RESULT');
    } catch {
      toast({ title: "Failed to evaluate speech", variant: "destructive" });
      setPhase('IDLE');
    }
  };

  return (
    <>
      <div id="stream-container" className="flex-grow p-4 md:p-6 lg:p-8 space-y-8">
        <h1 className="text-3xl font-extrabold mb-6 tracking-tight text-primary">Daily Impromptu Challenge</h1>

        {phase === 'IDLE' && (
          <div className="flex flex-col items-center justify-center space-y-6 mt-16 p-12 bg-card border rounded-3xl shadow-lg">
            <p className="text-xl text-muted-foreground text-center">
              Get a random topic. You have 30 seconds to prepare and 60 seconds to speak!
            </p>
            <Button size="lg" onClick={fetchTopic} className="px-10 h-14 rounded-full text-lg shadow-xl hover:scale-105 transition-transform">
              Start Challenge
            </Button>
          </div>
        )}

        {(phase === 'PREP' || phase === 'RECORDING') && (
          <div className="flex flex-col gap-8">
            <div id="topic-container" className="p-6 bg-card border border-primary/20 rounded-2xl shadow-inner text-center">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-2">Debate Topic</h2>
              <p className="text-2xl font-bold">{topic}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              <div id="remote-stream" className="col-span-2 aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl relative border-4 border-black">
                <UserCamera 
                  cameraOn={true} 
                  micOn={phase === 'RECORDING'} 
                  sendData={false} 
                  websocket={dummyWs.current} 
                />
                {isRecognizing && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-red-600/50">
                    <div className="bg-red-600 animate-pulse w-3.5 h-3.5 rounded-full" />
                    <span className="text-xs text-white font-bold tracking-wider">LIVE RECORDING</span>
                  </div>
                )}
              </div>

              <div id="game-status-panel" className="bg-card border p-8 rounded-3xl space-y-8 shadow-lg">
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-4">
                    {phase === 'PREP' ? 'Preparation Time' : 'Speaking Time'}
                  </h3>
                  <Timer initialTime={timerValue} />
                </div>
                
                {phase === 'RECORDING' && (
                  <Button variant="destructive" onClick={handleStopRecording} className="w-full h-14 rounded-xl text-lg font-bold shadow-lg shadow-destructive/20 hover:scale-105 transition-transform">
                    Finish & Evaluate
                  </Button>
                )}
              </div>
            </div>

            {phase === 'RECORDING' && transcript && (
              <div id="live-transcript" className="w-full bg-secondary/30 p-5 rounded-2xl border italic shadow-inner">
                <p className="text-muted-foreground leading-relaxed">"{transcript}..."</p>
              </div>
            )}
          </div>
        )}

        {phase === 'EVALUATING' && (
          <div className="flex flex-col items-center justify-center space-y-6 mt-32">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-orange-500"></div>
            <p className="text-2xl font-medium animate-pulse">AI Judge is evaluating...</p>
          </div>
        )}
      </div>

      {phase === 'RESULT' && judgmentData && (
        <JudgmentPopup
          judgment={judgmentData}
          userAvatar={userAvatar}
          botAvatar="/images/expert_emma.jpg"
          botName="AI Judge"
          userStance="For"
          botStance="Against"
          botDesc="Evaluator for Impromptu"
          onClose={() => {
            setPhase('IDLE');
            setJudgmentData(null);
          }}
        />
      )}
    </>
  );
}