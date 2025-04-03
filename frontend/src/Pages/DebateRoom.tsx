import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { sendDebateMessage, judgeDebate } from "@/services/vsbot";
import JudgmentPopup from "@/components/JudgementPopup";
import { Mic, MicOff } from "lucide-react";

type Message = { sender: "User" | "Bot" | "Judge"; text: string; phase: string };

type DebateProps = {
  userId: string;
  botName: string;
  botLevel: string;
  topic: string;
  stance: string;
  phaseTimings: { name: string; time: number }[];
  debateId: string;
};

type DebateState = {
  messages: Message[];
  currentPhase: number;
  phaseStep: number;
  isBotTurn: boolean;
  userStance: string;
  botStance: string;
  timer: number;
  isDebateEnded: boolean;
};

type JudgmentData = {
  opening_statement: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  cross_examination: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  answers: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  closing: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  total: { user: number; bot: number };
  verdict: { winner: string; reason: string; congratulations: string; opponent_analysis: string };
};

const bots = [
  { name: "Rookie Rick", level: "Easy", desc: "A beginner who stumbles over logic.", avatar: "https://avatar.iran.liara.run/public/26" },
  { name: "Casual Casey", level: "Easy", desc: "Friendly but not too sharp.", avatar: "https://avatar.iran.liara.run/public/22" },
  { name: "Moderate Mike", level: "Medium", desc: "Balanced and reasonable.", avatar: "https://avatar.iran.liara.run/public/38" },
  { name: "Sassy Sarah", level: "Medium", desc: "Witty with decent arguments.", avatar: "https://avatar.iran.liara.run/public/78" },
  { name: "Innovative Iris", level: "Medium", desc: "A creative thinker", avatar: "https://avatar.iran.liara.run/public/72" },
  { name: "Tough Tony", level: "Hard", desc: "Logical and relentless.", avatar: "https://avatar.iran.liara.run/public/37" },
  { name: "Expert Emma", level: "Hard", desc: "Master of evidence and rhetoric.", avatar: "https://avatar.iran.liara.run/public/90" },
  { name: "Grand Greg", level: "Expert", desc: "Unbeatable debate titan.", avatar: "https://avatar.iran.liara.run/public/45" },
];

const phaseSequences = [["For", "Against"], ["For", "Against", "Against", "For"], ["For", "Against"]];
const turnTypes = [["statement", "statement"], ["question", "answer", "question", "answer"], ["statement", "statement"]];

const extractJSON = (response: string): string => {
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = fenceRegex.exec(response);
  if (match && match[1]) return match[1].trim();
  return response;
};

const DebateRoom: React.FC = () => {
  const location = useLocation();
  const debateData = location.state as DebateProps;
  const phases = debateData.phaseTimings;
  const debateKey = `debate_${debateData.userId}_${debateData.topic}_${debateData.debateId}`;

  const [state, setState] = useState<DebateState>(() => {
    const savedState = localStorage.getItem(debateKey);
    return savedState
      ? JSON.parse(savedState)
      : {
          messages: [],
          currentPhase: 0,
          phaseStep: 0,
          isBotTurn: false,
          userStance: "",
          botStance: "",
          timer: phases[0].time,
          isDebateEnded: false,
        };
  });
  const [finalInput, setFinalInput] = useState("");
  const [interimInput, setInterimInput] = useState("");
  const [popup, setPopup] = useState<{ show: boolean; message: string; isJudging?: boolean }>({ show: false, message: "" });
  const [judgmentData, setJudgmentData] = useState<JudgmentData | null>(null);
  const [showJudgment, setShowJudgment] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const botTurnRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const bot = bots.find((b) => b.name === debateData.botName) || bots[0];
  const userAvatar = "https://avatar.iran.liara.run/public/10";

  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (!isMuted) {
      window.speechSynthesis.cancel(); // Stop ongoing speech when muting
    }
  };

  // Initialize SpeechRecognition with debug logging
  useEffect(() => {
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        console.log("Speech recognition result received:", event.results);
        let newFinalTranscript = "";
        let newInterimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            newFinalTranscript += result[0].transcript + " ";
          } else {
            newInterimTranscript = result[0].transcript;
          }
        }
        console.log("Final Transcript:", newFinalTranscript);
        console.log("Interim Transcript:", newInterimTranscript);

        if (newFinalTranscript) {
          setFinalInput((prev) => (prev ? prev + " " + newFinalTranscript.trim() : newFinalTranscript.trim()));
          setInterimInput("");
        } else {
          setInterimInput(newInterimTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended");
        setIsRecognizing(false);
      };
      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecognizing(false);
      };
    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Start/Stop Speech Recognition
  const startRecognition = () => {
    if (recognitionRef.current && !isRecognizing) {
      console.log("Starting speech recognition...");
      recognitionRef.current.start();
      setIsRecognizing(true);
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current && isRecognizing) {
      console.log("Stopping speech recognition...");
      recognitionRef.current.stop();
      setIsRecognizing(false);
    }
  };

  // Text-to-Speech Function with Promise
  const speak = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if ("speechSynthesis" in window && !isMuted) {
        window.speechSynthesis.cancel(); // Clear any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  };

  // Cleanup Speech Synthesis on Unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(debateKey, JSON.stringify(state));
  }, [state, debateKey]);

  useEffect(() => {
    return () => {
      localStorage.removeItem(debateKey);
    };
  }, [debateKey]);

  useEffect(() => {
    if (!state.userStance) {
      const stanceNormalized =
        debateData.stance.toLowerCase() === "for" || debateData.stance.toLowerCase() === "against"
          ? debateData.stance.toLowerCase() === "for"
            ? "For"
            : "Against"
          : "For";
      setState((prev) => ({
        ...prev,
        userStance: stanceNormalized,
        botStance: stanceNormalized === "For" ? "Against" : "For",
        isBotTurn: stanceNormalized === "Against",
      }));
    }
  }, [state.userStance, debateData.stance]);

  useEffect(() => {
    if (state.timer > 0 && !state.isDebateEnded) {
      timerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.timer <= 1) {
            clearInterval(timerRef.current!);
            if (!prev.isBotTurn) {
              // User's turn is up, send the message
              sendMessage();
            } else {
              // Bot's turn is up, just advance
              advanceTurn(prev);
            }
            return { ...prev, timer: 0 };
          }
          return { ...prev, timer: prev.timer - 1 };
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.timer, state.isDebateEnded, state.isBotTurn, finalInput]);

  useEffect(() => {
    if (state.isBotTurn && !state.isDebateEnded && !botTurnRef.current) {
      botTurnRef.current = true;
      handleBotTurn();
    }
  }, [state.isBotTurn, state.currentPhase, state.phaseStep, state.isDebateEnded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  const getPhaseInstructions = (phaseIndex: number) => {
    switch (phaseIndex) {
      case 0:
        return "Each side presents an opening statement.";
      case 1:
        return "Cross Examination: one side questions and the other answers, then vice versa.";
      case 2:
        return "Both sides deliver their closing statements.";
      default:
        return "";
    }
  };

  const advanceTurn = (currentState: DebateState) => {
    const currentSequence = phaseSequences[currentState.currentPhase];
    if (currentState.phaseStep + 1 < currentSequence.length) {
      const nextStep = currentState.phaseStep + 1;
      const nextStance = currentSequence[nextStep];
      const nextEntity = currentState.userStance === nextStance ? "User" : "Bot";
      setState((prev) => ({
        ...prev,
        phaseStep: nextStep,
        isBotTurn: nextEntity === "Bot",
        timer: phases[currentState.currentPhase].time,
      }));
    } else if (currentState.currentPhase < phases.length - 1) {
      const newPhase = currentState.currentPhase + 1;
      setPopup({
        show: true,
        message: `${phases[currentState.currentPhase].name} completed. Next: ${phases[newPhase].name} - ${getPhaseInstructions(newPhase)}`,
      });
      setTimeout(() => {
        setPopup({ show: false, message: "" });
        setState((prevState) => ({
          ...prevState,
          currentPhase: newPhase,
          phaseStep: 0,
          isBotTurn: prevState.userStance === phaseSequences[newPhase][0] ? false : true,
          timer: phases[newPhase].time,
        }));
      }, 4000);
    } else {
      setPopup({
        show: true,
        message: "Calculating scores and judging results...",
        isJudging: true,
      });
      setState((prev) => ({ ...prev, isDebateEnded: true }));
      judgeDebateResult(currentState.messages);
    }
  };

  const sendMessage = async () => {
    if (!finalInput.trim() || state.isBotTurn || state.timer === 0) return;

    const newMessage: Message = {
      sender: "User",
      text: finalInput,
      phase: phases[state.currentPhase].name,
    };

    setState((prev) => {
      const updatedState = {
        ...prev,
        messages: [...prev.messages, newMessage],
        timer: phases[prev.currentPhase].time,
      };
      clearInterval(timerRef.current!);
      advanceTurn(updatedState);
      return updatedState;
    });

    setFinalInput("");
    setInterimInput("");
    if (isRecognizing) stopRecognition();
  };

  const handleBotTurn = async () => {
    try {
      const turnType = turnTypes[state.currentPhase][state.phaseStep];
      let context = "";
      if (turnType === "statement") {
        context = "Make your statement";
      } else if (turnType === "question") {
        context = "Ask a clear and concise question challenging your opponent.";
      } else if (turnType === "answer") {
        const lastMessage = state.messages[state.messages.length - 1];
        context = lastMessage ? `Answer this question: ${lastMessage.text}` : "Provide your answer";
      }

      const { response } = await sendDebateMessage({
        botLevel: debateData.botLevel,
        topic: debateData.topic,
        history: state.messages,
        botName: debateData.botName,
        stance: state.botStance,
        context,
      });

      const botMessage: Message = {
        sender: "Bot",
        text: response || "I need to think about that...",
        phase: phases[state.currentPhase].name,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, botMessage],
      }));

      await speak(botMessage.text);

      setState((prev) => {
        const updatedState = {
          ...prev,
          timer: phases[prev.currentPhase].time,
        };
        clearInterval(timerRef.current!);
        advanceTurn(updatedState);
        return updatedState;
      });
    } catch (error) {
      console.error("Bot error:", error);
      setState((prev) => {
        advanceTurn(prev);
        return prev;
      });
    } finally {
      botTurnRef.current = false;
    }
  };

  const judgeDebateResult = async (messages: Message[]) => {
    try {
      const { result } = await judgeDebate({
        history: messages,
        userId: debateData.userId,
      });
      const jsonString = extractJSON(result);
      const judgment: JudgmentData = JSON.parse(jsonString);
      setJudgmentData(judgment);
      setPopup({ show: false, message: "" });
      setShowJudgment(true);
    } catch (error) {
      console.error("Judging error:", error);
      setJudgmentData({
        opening_statement: { user: { score: 0, reason: "Error" }, bot: { score: 0, reason: "Error" } },
        cross_examination: { user: { score: 0, reason: "Error" }, bot: { score: 0, reason: "Error" } },
        answers: { user: { score: 0, reason: "Error" }, bot: { score: 0, reason: "Error" } },
        closing: { user: { score: 0, reason: "Error" }, bot: { score: 0, reason: "Error" } },
        total: { user: 0, bot: 0 },
        verdict: { winner: "None", reason: "Judgment failed", congratulations: "", opponent_analysis: "" },
      });
      setPopup({ show: false, message: "" });
      setShowJudgment(true);
    }
  };

  const formatTime = (seconds: number) => {
    const timeStr = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
    return (
      <span className={`font-mono ${seconds <= 5 ? "text-red-500 animate-pulse" : "text-gray-600"}`}>
        {timeStr}
      </span>
    );
  };

  const renderPhaseMessages = (sender: "User" | "Bot") => {
    const phaseMessages = state.messages.filter((msg) => msg.sender === sender);
    return (
      <div className="space-y-4">
        {phaseMessages.map((msg, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded-lg shadow-sm text-gray-800 break-words">
            <span className="text-xs text-gray-500 block mb-1">{msg.phase}</span>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  const currentStance = phaseSequences[state.currentPhase][state.phaseStep];
  const currentEntity = state.userStance === currentStance ? "User" : "Bot";
  const currentTurnType = turnTypes[state.currentPhase][state.phaseStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4">
      <div className="w-full max-w-5xl mx-auto py-2">
  <div className="bg-gradient-to-r from-orange-100 via-white to-orange-100 rounded-xl p-4 text-center transition-all duration-300 hover:shadow-lg">
    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
      Debate: {debateData.topic}
    </h1>
    <p className="mt-2 text-sm text-gray-700">
      Phase: <span className="font-medium">{phases[state.currentPhase]?.name || "Finished"}</span> | Current Turn:{" "}
      <span className="font-semibold text-orange-600">
        {currentEntity === "User" ? "You" : debateData.botName} to{" "}
        {currentTurnType === "statement" ? "make a statement" : currentTurnType === "question" ? "ask a question" : "answer"}
      </span>
  </p>
  </div>
</div>

      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full transform transition-all duration-300 scale-105 border border-orange-200">
            {popup.isJudging ? (
              <div className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="bg-white rounded-lg p-8 flex flex-col items-center shadow-lg">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-800">{popup.message}</h2>
              </div>
            </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-orange-600 mb-2">Phase Transition</h3>
                <p className="text-gray-700 text-center text-sm">{popup.message}</p>
              </>
            )}
          </div>
        </div>
      )}

      {showJudgment && judgmentData && (
        <JudgmentPopup
          judgment={judgmentData}
          userAvatar={userAvatar}
          botAvatar={bot.avatar}
          botName={debateData.botName}
          userStance={state.userStance}
          botStance={state.botStance}
          botDesc={bot.desc}
          onClose={() => setShowJudgment(false)}
        />
      )}

      <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-3">
        {/* Bot Section */}
        <div
          className={`relative w-full md:w-1/2 ${state.isBotTurn ? "animate-glow" : ""} bg-white border border-gray-200 shadow-md h-[540px] flex flex-col`}
        >
          <div className="p-2 bg-gray-50 flex items-center gap-2">
            <div className="w-12 h-12 flex-shrink-0">
              <img src={bot.avatar} alt={debateData.botName} className="w-full h-full rounded-full border border-orange-400 object-cover" />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-800">{debateData.botName}</div>
              <div className="text-xs text-gray-500">{bot.level}</div>
              <div className="text-xs text-gray-500">{bot.desc}</div>
            </div>
            <Button
              onClick={toggleMute}
              className={`ml-auto ${isMuted ? "bg-red-500" : "bg-green-500"} text-white rounded-md px-2 py-1 text-xs`}
            >
              {isMuted ? "Unmute" : "Mute"}
            </Button>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-sm font-semibold text-orange-600 mb-1">Stance: {state.botStance}</p>
            <p className="text-xs mb-1">
              Time: {formatTime(state.isBotTurn ? state.timer : phases[state.currentPhase]?.time || 0)}
            </p>
            {renderPhaseMessages("Bot")}
          </div>
        </div>

        {/* User Section */}
        <div
          className={`relative w-full md:w-1/2 ${!state.isBotTurn && !state.isDebateEnded ? "animate-glow" : ""} bg-white border border-gray-200 shadow-md h-[540px] flex flex-col`}
        >
          <div className="p-2 bg-gray-50 flex items-center gap-2">
            <div className="w-12 h-12 flex-shrink-0">
              <img src={userAvatar} alt="You" className="w-full h-full rounded-full border border-orange-400 object-cover" />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-800">You</div>
              <div className="text-xs text-gray-500">Debater</div>
              <div className="text-xs text-gray-500">Ready to argue!</div>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-sm font-semibold text-orange-600 mb-1">Stance: {state.userStance}</p>
            <p className="text-xs mb-1">
              Time: {formatTime(!state.isBotTurn ? state.timer : phases[state.currentPhase]?.time || 0)}
            </p>
            <div className="flex-1 overflow-y-auto">{renderPhaseMessages("User")}</div>
            {!state.isDebateEnded && (
              <div className="mt-3 flex gap-2 items-center">
                <Input
                  value={isRecognizing ? finalInput + (interimInput ? " " + interimInput : "") : finalInput}
                  onChange={(e) => !isRecognizing && setFinalInput(e.target.value)}
                  readOnly={isRecognizing}
                  disabled={state.isBotTurn || state.timer === 0}
                  placeholder={
                    currentTurnType === "statement"
                      ? "Make your statement"
                      : currentTurnType === "question"
                      ? "Ask your question"
                      : "Provide your answer"
                  }
                  className="flex-1 border-gray-300 focus:border-orange-400 rounded-md text-sm"
                />
                <Button
                  onClick={isRecognizing ? stopRecognition : startRecognition}
                  disabled={state.isBotTurn || state.timer === 0}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md p-2"
                >
                  {isRecognizing ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  onClick={sendMessage}
                  disabled={state.isBotTurn || state.timer === 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-md px-3 text-sm"
                >
                  Send
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes glow {
          0% {
            box-shadow: 0 0 5px rgba(255, 149, 0, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 149, 0, 0.8);
          }
          100% {
            box-shadow: 0 0 5px rgba(255, 149, 0, 0.5);
          }
        }
        .animate-glow {
          animation: glow 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default DebateRoom;