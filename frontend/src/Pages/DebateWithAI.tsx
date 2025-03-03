import { useEffect, useState } from 'react';
import { Brain, Trophy, ArrowLeft, Timer, Send, Mic, Volume2, VolumeX } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export default function DebateAI() {
  const navigate = useNavigate();
  const [userArgument, setUserArgument] = useState<string>('');
  const [debateLog, setDebateLog] = useState<{ user: string; ai: string }[]>([]);
  const [userScore, setUserScore] = useState<number>(0);
  const [analysis, setAnalysis] = useState<{ userAnalysis: string; userPoints: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [debateDuration, setDebateDuration] = useState(60);
  const [currentRound, setCurrentRound] = useState("Opening Round");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("topic");


  useEffect(() => {
    // Initialize WebSocket
    const ws = new WebSocket('ws://localhost:1818/debate/ws');

    ws.onopen = () => console.log('Connected to WebSocket');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
      if (data.type === 'debate_response') {
        setDebateLog((prevLog) => {
          const updatedLog = [...prevLog];
          updatedLog[updatedLog.length - 1].ai = data.response;
          return updatedLog;
        });
        setIsLoading(false);

      } else if (data.type === 'analysis_response') {
        setAnalysis({
          userAnalysis: data.user_analysis_content,
          userPoints: data.user_analysis_points,
        });
        setUserScore((prev) => prev + parseInt(data.user_analysis_points || '0'));
      } else if (data.type === 'state_update') {
        setDebateDuration(data.time_remaining);
        setCurrentRound(data.current_section);
      }
    };

    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket closed');

    setSocket(ws);
    return () => ws.close();
  }, []);

  
  useEffect(() => {
    if (debateDuration <= 0) return;
    const timer = setInterval(() => setDebateDuration((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [debateDuration]);

  const handleDebate = () => {
    if (!userArgument.trim() || !socket) return;

    setDebateLog((prevLog) => [...prevLog, { user: userArgument, ai: '' }]);
    setUserArgument('');
    setIsLoading(true);

    socket.send(JSON.stringify({ type: 'debate', argument: userArgument }));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
          <Button
            variant="ghost"
            className="text-black dark:text-white hover:bg-gray-200 dark:hover:bg-gray-800"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2" /> Back
          </Button>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-black dark:text-white">{topic}</h1>
            <p className="text-gray-600 dark:text-gray-400">{currentRound}</p>
          </div>

          <div className="flex space-x-4">
            <Card className="bg-white dark:bg-gray-800">
              <div className="flex items-center space-x-3 p-3">
                <Timer className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Time Left</p>
                  <p className="text-xl font-bold text-black dark:text-white">{debateDuration}s</p>
                </div>
              </div>
            </Card>

            <Card className="bg-white dark:bg-gray-800">
              <div className="flex items-center space-x-3 p-3">
                <Trophy className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Points</p>
                  <p className="text-xl font-bold text-black dark:text-white">{userScore}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Analysis Panel */}
          <Card className="lg:col-span-1 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-xl font-bold text-black dark:text-white flex items-center mb-4">
              <Brain className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
              Analysis
            </h2>
            <div className="text-gray-700 dark:text-gray-300">
              {analysis ? (
                <p>{analysis.userAnalysis}</p>
              ) : !isLoading ? (
                <p className="text-gray-500 dark:text-gray-400">Present your argument to receive analysis.</p>
              ) : (
                <div className="flex items-center space-x-2">
                  <Brain className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" />
                  <p>Analyzing...</p>
                </div>
              )}
            </div>
          </Card>

          {/* Debate Area */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-white dark:bg-gray-800 p-6 min-h-[500px] max-h-[500px] overflow-y-auto">
              {debateLog.map((entry, index) => (
                <div key={index} className="space-y-4 mb-6">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="bg-blue-500 dark:bg-blue-600 rounded-2xl rounded-tr-none p-4 max-w-[70%]">
                      <p className="text-white/80 text-sm mb-1">You</p>
                      <p className="text-white">{entry.user}</p>
                    </div>
                  </div>

                  {/* AI Response */}
                  {entry.ai && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tl-none p-4 max-w-[70%]">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-gray-700 dark:text-gray-300 text-sm">AI Assistant</p>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">{entry.ai}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading State */}
              {isLoading && (
                <div className="flex justify-start mt-4">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tl-none p-4 max-w-[70%]">
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-1">AI Assistant</p>
                    <div className="flex items-center space-x-2">
                      <Brain className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" />
                      <p className="text-gray-700 dark:text-gray-300">Thinking...</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Input Area */}
            <div className="flex space-x-4">
              <Textarea
                value={userArgument} // Show interim results in the textarea
                onChange={(e) => setUserArgument(e.target.value)}
                placeholder="Present your argument..."
                className="flex-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                rows={3}
              />
              <div className="flex flex-col space-y-2">
                <Button
                  onClick={handleDebate}
                  className="h-12 w-12 rounded-full bg-blue-500 hover:bg-blue-600"
                >
                  <Send className="w-5 h-5 text-white" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

