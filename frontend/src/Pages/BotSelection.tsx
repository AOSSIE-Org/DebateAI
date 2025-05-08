import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "../components/ui/separator";
import { createDebate } from "@/services/vsbot"; // Adjust the import path as necessary

// Bot definitions with avatars, hover quotes, and ratings
const bots = [
  { name: "Rookie Rick", level: "Easy", desc: "A beginner who stumbles over logic.", avatar: "https://avatar.iran.liara.run/public/26", quote: "Uh, wait, what’s your point again?", rating: 1200 },
  { name: "Casual Casey", level: "Easy", desc: "Friendly but not too sharp.", avatar: "https://avatar.iran.liara.run/public/22", quote: "Let’s just chill and chat, okay?", rating: 1300 },
  { name: "Moderate Mike", level: "Medium", desc: "Balanced and reasonable.", avatar: "https://avatar.iran.liara.run/public/38", quote: "I see your side, but here’s mine.", rating: 1500 },
  { name: "Sassy Sarah", level: "Medium", desc: "Witty with decent arguments.", avatar: "https://avatar.iran.liara.run/public/78", quote: "Oh honey, you’re in for it now!", rating: 1600 },
  { name: "Innovative Iris", level: "Medium", desc: "A creative thinker", avatar: "https://avatar.iran.liara.run/public/72", quote: "Fresh ideas fuel productive debates.", rating: 1550 },
  { name: "Tough Tony", level: "Hard", desc: "Logical and relentless.", avatar: "https://avatar.iran.liara.run/public/37", quote: "Prove it or step aside.", rating: 1700 },
  { name: "Expert Emma", level: "Hard", desc: "Master of evidence and rhetoric.", avatar: "https://avatar.iran.liara.run/public/90", quote: "Facts don’t care about your feelings.", rating: 1800 },
  { name: "Grand Greg", level: "Expert", desc: "Unbeatable debate titan.", avatar: "https://avatar.iran.liara.run/public/45", quote: "Checkmate. Your move.", rating: 2000 },
];

// Predefined debate topics
const predefinedTopics = [
  "Should AI rule the world?",
  "Is space exploration worth the cost?",
  "Should social media be regulated?",
  "Is climate change humanity’s fault?",
  "Should college education be free?",
];

// Default phase timings (in seconds, same for user and bot)
const defaultPhaseTimings = [
  { name: "Opening Statements", time: 240 },
  { name: "Cross-Examination", time: 180 },
  { name: "Closing Statements", time: 180 },
];

// Loader component
const Loader: React.FC = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-50">
    <div className="bg-white rounded-lg p-8 flex flex-col items-center shadow-lg">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-4"></div>
      <h2 className="text-xl font-semibold text-gray-800">Creating your room...</h2>
      <p className="text-gray-600 mt-2">Getting your bot ready, please wait.</p>
    </div>
  </div>
);

// Returns a custom special message for each bot
const getBotSpecialMessage = (botName: string | null) => {
  switch (botName) {
    case "Rookie Rick":
      return "Get ready for a charming, underdog performance!";
    case "Casual Casey":
      return "Relax and enjoy the laid-back debate vibe!";
    case "Moderate Mike":
      return "A balanced challenge awaits you!";
    case "Sassy Sarah":
      return "Prepare for sass and a bit of spice in the debate!";
    case "Innovative Iris":
      return "Expect creative insights and fresh ideas!";
    case "Tough Tony":
      return "Brace yourself for a no-nonsense, hard-hitting debate!";
    case "Expert Emma":
      return "Expert-level debate incoming – sharpen your wit!";
    case "Grand Greg":
      return "A legendary showdown is about to begin!";
    default:
      return "";
  }
};

const BotSelection: React.FC = () => {
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("custom");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [stance, setStance] = useState<string>("random");
  const [phaseTimings, setPhaseTimings] = useState(defaultPhaseTimings);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const effectiveTopic = topic === "custom" ? customTopic : topic;

  // Update phase timing ensuring the value is within the allowed range.
  const updatePhaseTiming = (phaseIndex: number, value: string) => {
    const newTimings = [...phaseTimings];
    const timeInSeconds = Math.max(60, Math.min(600, parseInt(value) || 0));
    newTimings[phaseIndex].time = timeInSeconds;
    setPhaseTimings(newTimings);
  };

  const startDebate = async () => {
    if (selectedBot && effectiveTopic) {
      const bot = bots.find((b) => b.name === selectedBot);

      // Determine the final stance. If the user selected "random", pick one randomly.
      const finalStance = stance === "random" ? (Math.random() < 0.5 ? "for" : "against") : stance;

      // Build payload
      const debatePayload = {
        botName: bot!.name,
        botLevel: bot!.level,
        topic: effectiveTopic,
        stance: finalStance,
        history: [],
        phaseTimings, // Already in correct format
      };

      try {
        setIsLoading(true);
        const data = await createDebate(debatePayload);
        const state = { ...data, phaseTimings, stance: finalStance };
        console.log("Navigation state:", state);
        navigate(`/debate/${data.debateId}`, { state });
      } catch (error) {
        console.error("Error starting debate:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      {isLoading && <Loader />}
      <div className="bg-gradient-to-br from-background via-accent/10 to-background p-4">
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-wide">
            Pick Your <span className="text-primary">Debate</span> Rival!
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Select a bot and set up your debate challenge.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bot Selection Section */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {bots.map((bot) => (
              <div
              key={bot.name}
              onClick={() => setSelectedBot(bot.name)}
              className={`z-20 relative cursor-pointer transition-transform duration-300 hover:scale-105 rounded-md border ${
                selectedBot === bot.name ? "border-2 border-primary" : "border border-gray-300"
              } bg-white shadow-sm group overflow-visible`} // Added overflow-visible
              style={{ height: "200px" }}
            >
              <div className="flex flex-col items-center justify-center h-full p-2 relative">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden mb-1 border-2 border-primary shadow-md">
                  <img src={bot.avatar} alt={bot.name} className="object-cover w-full h-full" />
                </div>
            
                {/* Chat Bubble - Moved outside avatar container */}
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50">
  <div className="relative bg-black text-white text-[0.75rem] rounded-lg shadow-lg px-4 py-2 w-48 text-center">
    {bot.quote}
    <div className="absolute bottom-0 left-1/2 transform translate-y-full -translate-x-1/2">
      <svg 
        width="12" 
        height="8" 
        viewBox="0 0 12 8" 
        fill="black" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6 8L0 0H12L6 8Z" />
      </svg>
    </div>
  </div>
</div>
            
                {/* Bot Info */}
                <h3 className="text-xs md:text-sm font-semibold text-gray-800 text-center">{bot.name}</h3>
                <p className="text-[0.65rem] md:text-[0.75rem] text-gray-600">{bot.level}</p>
                <p className="text-xl font-extrabold text-primary opacity-50">{bot.rating}</p>
                <p className="text-[0.55rem] md:text-[0.65rem] text-gray-500 mt-1 text-center line-clamp-2 px-1">
                  {bot.desc}
                </p>
              </div>
            </div>
            
            ))}
          </div>

          {/* Debate Setup Section */}
          <div className="bg-white border border-gray-300 rounded-md shadow-md flex flex-col">
            <div className="p-3">
              <h2 className="text-xl font-light text-gray-800">Debate Setup</h2>
              <p className="text-sm text-gray-500">
                Configure your topic, stance, and phase timings.
              </p>
              {selectedBot && (
  <div className="mt-2 p-2 bg-card border border-border rounded-md text-foreground text-sm font-medium">
    {getBotSpecialMessage(selectedBot)}
  </div>
)}

            </div>
            <Separator />
            <div className="p-3 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Topic Selection */}
                <div className="flex flex-col">
                  <label className="block text-sm text-gray-500 mb-1">Debate Topic</label>
                  <Select onValueChange={setTopic} defaultValue="custom">
                    <SelectTrigger className="w-full bg-white text-gray-800">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom Topic</SelectItem>
                      {predefinedTopics.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {topic === "custom" && (
                    <Input
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="Enter your custom topic"
                      className="mt-2 bg-white text-gray-800"
                    />
                  )}
                </div>

                {/* Stance Selection */}
                <div className="flex flex-col">
                  <label className="block text-sm text-gray-500 mb-1">Your Stance</label>
                  <Select onValueChange={setStance} defaultValue="random">
                    <SelectTrigger className="w-full bg-white text-gray-800">
                      <SelectValue placeholder="Choose your stance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="for">For</SelectItem>
                      <SelectItem value="against">Against</SelectItem>
                      <SelectItem value="random">Let System Decide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Responsive Timer Section */}
              <div className="flex flex-col">
                <label className="block text-sm text-gray-500 mb-2">Phase Timings (seconds)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {phaseTimings.map((phase, index) => (
                    <div key={phase.name} className="flex flex-col p-2 rounded-md border border-gray-200">
                      <span className="text-xs font-medium text-gray-700 mb-1">{phase.name}</span>
                      <Input
                        type="number"
                        value={phase.time}
                        onChange={(e) => updatePhaseTiming(index, e.target.value)}
                        className="text-xs bg-white text-gray-800"
                        min="60"
                        max="600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={startDebate}
                disabled={!selectedBot || !effectiveTopic}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-md transition-colors shadow-md"
              >
                Start Debate 🚀
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BotSelection;
