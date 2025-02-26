import { useEffect, useState } from 'react';
import axios from "axios";
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, Trophy, ArrowLeft, ThumbsUp, ThumbsDown, Award, Sparkles,Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import SubmitButton from '../Utils/SubmitButton';
import Header from '../Utils/Header';
import SettingsModal from '@/components/Settings';


export default function DebateAI() {
  const navigate = useNavigate();
  const [userArgument, setUserArgument] = useState<string>("");
  const [debateLog, setDebateLog] = useState<{ user: string; ai: string }[]>([]);
  const [userScore, setUserScore] = useState<number>(0);
  const [analysis, setAnalysis] = useState<{
    userAnalysis: string;
    userPoints : string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [debateDuration, setDebateDuration] = useState(60); // Default duration

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };



useEffect(() => {
  setIsSettingsOpen(true);
},[]);

useEffect(() => {
  if (debateDuration <= 0) return; 

  const timer = setInterval(() => {
    setDebateDuration((prevTime) => prevTime - 1);
  }, 1000); 

  return () => clearInterval(timer);
}, [debateDuration]);

  const handleDebate = async () => {
    if (!userArgument.trim()) return;

    // Add user's argument to the debate log immediately
    setDebateLog((prevLog) => [...prevLog, { user: userArgument, ai: "" }]);
    setUserArgument("");
    setIsLoading(true);

    try {
      // Send the user's argument to the backend and receive AI's response
      const response = await axios.post("http://localhost:5000/debate", {
        argument: userArgument,
      });
      const aiResponse = response.data.counter_argument;

      // Update the last log entry with AI's response
      setDebateLog((prevLog) => {
        const updatedLog = [...prevLog];
        updatedLog[updatedLog.length - 1].ai = aiResponse;
        return updatedLog;
      });

      // Fetch analysis for both user and AI arguments
        const analysisresponse = await axios.post("http://localhost:5000/analyse", {
          user_argument: userArgument,
          
        });
        console.log(analysisresponse);

        if (analysisresponse.data) {
          setAnalysis({
            userAnalysis: analysisresponse.data.user_analysis_content,
            userPoints: analysisresponse.data.user_analysis_points,
          });
          
        // console.log(analysis);

        setUserScore((prev) => prev + parseInt(analysisresponse.data.user_analysis_points|| "0"));
        }else{
          console.error("No analysis data received from the backend");
        }
    } catch (error) {
      console.error("Error debating with AI or fetching analysis:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
         
      {/* settings */}
      <SettingsModal
        duration={debateDuration}
        rounds={null} // Not used
        aiJudge={null} // Not used
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(settings) => setDebateDuration(settings.duration)} // Only Save Duration
      />

      {/* background */}
      {!isSettingsOpen && (
        <>
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full">
          {Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full blur-3xl opacity-5"
              style={{
                background: 'linear-gradient(to right, #ffffff, #fb923c)',
                width: '40vw',
                height: '40vw',
                left: `${i * 30}%`,
                top: `${(i * 40) % 100}%`,
              }}
              animate={{
                x: mousePosition.x * 0.02,
                y: mousePosition.y * 0.02,
                scale: [1, 1.1, 1],
              }}
              transition={{
                x: { type: "spring", stiffness: 100, damping: 30 },
                y: { type: "spring", stiffness: 100, damping: 30 },
                scale: { duration: 10 + i * 2, repeat: Infinity, repeatType: "reverse" }
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
  <div className="flex justify-between items-center mb-8">
    
    {/* Back Button on the Left */}
    <Button 
      variant="ghost" 
      className="text-white hover:text-orange-400 hover:bg-white/5 backdrop-blur-xl border-white/10"
      onClick={() => navigate('/')}
    >
      <ArrowLeft className="mr-2" /> Back to Home
    </Button>

    {/* Centered Header */}
    <div className="flex-1 flex justify-center">
      <Header />
    </div>

    {/* Right Section - Timer & Score Cards */}
    <div className="flex space-x-4">
      {/* Timer */}
      <Card className="p-4 bg-white/5 backdrop-blur-xl border-white/10">
        <div className="flex items-center space-x-4">
          <Timer className="w-6 h-6 text-orange-400" />
          <div>
            <p className="text-zinc-400 text-sm">Timer</p>
            <p className="text-2xl font-bold text-white">{debateDuration}</p>
          </div>
        </div>
      </Card>

      {/* Score Card */}
      <Card className="p-4 bg-white/5 backdrop-blur-xl border-white/10">
        <div className="flex items-center space-x-4">
          <Trophy className="w-6 h-6 text-orange-400" />
          <div>
            <p className="text-zinc-400 text-sm">Score</p>
            <p className="text-2xl font-bold text-white">{userScore}</p>
          </div>
          {userScore >= 100 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-2"
            >
              <Award className="w-8 h-8 text-orange-400" />
            </motion.div>
          )}
        </div>
      </Card>
    </div>
  </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Analysis Panel */}
          <Card className="p-6 bg-white/5 backdrop-blur-xl border-white/10 h-fit">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center">
              <Brain className="w-6 h-6 mr-2 text-orange-400" /> Analysis
            </h2>
            {analysis ? (
      <div className="mb-4">
        <p className='text-zinc-400'>{analysis.userAnalysis}</p>
      </div>
    ) : !isLoading ? (
      <p className='text-zinc-400'>No analysis available yet. Submit an argument to get started.</p>
    ) : (
      <p className='text-zinc-400'>Loading...</p>
    )}
          </Card>

          {/* Debate Area */}
          <div className="md:col-span-2 space-y-6">
  <div className="p-6 bg-white/5 backdrop-blur-xl border-white/10 min-h-[400px] max-h-[430px] overflow-y-auto">
    {debateLog.map((entry, index) => (
      <div key={index} className="flex flex-col mb-6">
        
        {/* User's Argument */}
        <div className="flex justify-start">
          <div className="bg-orange-400 text-black p-4 rounded-lg max-w-md shadow-lg">
            <p className="font-bold">You:</p>
            <p>{entry.user}</p>
          </div>
        </div>

        {/* AI's Response */}
        {isLoading && index === debateLog.length - 1 && entry.ai === "" ? (
          <div className="flex justify-end mt-2 animate-pulse">
            <div className="bg-zinc-800 text-zinc-300 p-4 rounded-lg max-w-md shadow-lg">
              <p className="font-bold">AI:</p>
              <span className="flex items-center">
                <Brain className="w-5 h-5 animate-spin text-orange-400 mr-2" />
                AI is thinking...
              </span>
            </div>
          </div>
        ) : (
          entry.ai && (
            <div className="flex justify-end mt-2">
              <div className="bg-zinc-800 text-zinc-300 p-4 rounded-lg max-w-md shadow-lg">
                <p className="font-bold">AI:</p>
                <p>{entry.ai}</p>
              </div>
            </div>
          )
        )}
      </div>
    ))}
  </div>

            {/* Input Area */}
            <div className="flex space-x-2">
              <Textarea
                value={userArgument}
                onChange={(e) => setUserArgument(e.target.value)}
                placeholder="Present your argument..."
                className="bg-white/5 backdrop-blur-xl border-white/10 text-white placeholder:text-zinc-500"
                rows={3}
              />
              <div
                onClick={handleDebate}
                className=" w-24 h-12 bg-orange-500 hover:bg-orange-600 rounded-lg text-black p-0 cursor-pointer"
              >
                <SubmitButton/>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}