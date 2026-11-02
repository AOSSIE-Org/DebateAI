import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "../components/ui/separator";
import { createDebate } from "@/services/vsbot";
import { useAtom } from "jotai";
import { userAtom } from "@/state/userAtom";

// Bot type definition
interface Bot {
  name: string;
  level: string;
  desc: string;
  avatar: string;
  quote: string;
  rating: number;
  specialMessage: string;
}

// Bot definitions
const allBots: Bot[] = [
  // Classic bots
  {
    name: "Rookie Rick",
    level: "Easy",
    desc: "A beginner who stumbles over logic.",
    avatar: `${import.meta.env.BASE_URL}images/rookie_rick.jpg`,
    quote: "Uh, wait, what's your point again?",
    rating: 1200,
    specialMessage: "Get ready for a charming, underdog performance!",
  },
  {
    name: "Casual Casey",
    level: "Easy",
    desc: "Friendly but not too sharp.",
    avatar: `${import.meta.env.BASE_URL}images/casual_casey.jpg`,
    quote: "Let's just chill and chat, okay?",
    rating: 1300,
    specialMessage: "Relax and enjoy the laid-back debate vibe!",
  },
  {
    name: "Moderate Mike",
    level: "Medium",
    desc: "Balanced and reasonable.",
    avatar: `${import.meta.env.BASE_URL}images/moderate_mike.jpg`,
    quote: "I see your side, but here's mine.",
    rating: 1500,
    specialMessage: "A balanced challenge awaits you!",
  },
  {
    name: "Sassy Sarah",
    level: "Medium",
    desc: "Witty with decent arguments.",
    avatar: `${import.meta.env.BASE_URL}images/sassy_sarah.jpg`,
    quote: "Oh honey, you're in for it now!",
    rating: 1600,
    specialMessage: "Prepare for sass and a bit of spice in the debate!",
  },
  {
    name: "Innovative Iris",
    level: "Medium",
    desc: "A creative thinker",
    avatar: `${import.meta.env.BASE_URL}images/innovative_iris.jpg`,
    quote: "Fresh ideas fuel productive debates.",
    rating: 1550,
    specialMessage: "Expect creative insights and fresh ideas!",
  },
  {
    name: "Tough Tony",
    level: "Hard",
    desc: "Logical and relentless.",
    avatar: `${import.meta.env.BASE_URL}images/tough_tony.jpg`,
    quote: "Prove it or step aside.",
    rating: 1700,
    specialMessage: "Brace yourself for a no-nonsense, hard-hitting debate!",
  },
  {
    name: "Expert Emma",
    level: "Hard",
    desc: "Master of evidence and rhetoric.",
    avatar: `${import.meta.env.BASE_URL}images/expert_emma.jpg`,
    quote: "Facts don't care about your feelings.",
    rating: 1800,
    specialMessage: "Expert-level debate incoming – sharpen your wit!",
  },
  {
    name: "Grand Greg",
    level: "Expert",
    desc: "Unbeatable debate titan.",
    avatar: `${import.meta.env.BASE_URL}images/grand_greg.jpg`,
    quote: "Checkmate. Your move.",
    rating: 2000,
    specialMessage: "A legendary showdown is about to begin!",
  },
  // Cinematic bots
  {
    name: "Yoda",
    level: "Legends",
    desc: "Wise, cryptic, and patient. Speaks in riddles.",
    avatar: `${import.meta.env.BASE_URL}images/yoda.jpeg`,
    quote:
      "Hmm, strong your point is. But ask yourself, does the tree fall because it wills, or because the wind commands?",
    rating: 2400,
    specialMessage: "Prepare for wisdom wrapped in riddles!",
  },
  {
    name: "Tony Stark",
    level: "Legends",
    desc: "Witty, arrogant, and clever. Loves quick comebacks.",
    avatar: `${import.meta.env.BASE_URL}images/tony.webp`,
    quote:
      "Nice try, but your logic's running on fumes. Step aside, I'll show you how a genius does it.",
    rating: 2200,
    specialMessage: "Get ready for sharp wit and genius banter!",
  },
  {
    name: "Professor Dumbledore",
    level: "Legends",
    desc: "Calm, strategic, and insightful. Sees the bigger picture.",
    avatar: `${import.meta.env.BASE_URL}images/dumbledore.avif`,
    quote:
      "A valid point, but have you considered its ripple effects? Let us explore the deeper truth.",
    rating: 2500,
    specialMessage: "A strategic and insightful debate awaits!",
  },
  {
    name: "Rafiki",
    level: "Legends",
    desc: "Quirky, playful, and humorous. Teaches through stories.",
    avatar: `${import.meta.env.BASE_URL}images/rafiki.jpeg`,
    quote:
      "Haha! You think too hard, my friend! The answer's right there, like a monkey on a branch!",
    rating: 1800,
    specialMessage: "Expect laughter and surprising wisdom!",
  },
  {
    name: "Darth Vader",
    level: "Legends",
    desc: "Powerful, stern, and intimidating. Uses forceful logic.",
    avatar: `${import.meta.env.BASE_URL}images/darthvader.jpg`,
    quote:
      "Your reasoning falters. Submit to the strength of my argument, or be crushed.",
    rating: 2300,
    specialMessage: "Brace for an intense, commanding debate!",
  },
];

// Predefined debate topics
const predefinedTopics: string[] = [
  "Should AI rule the world?",
  "Is space exploration worth the cost?",
  "Should social media be regulated?",
  "Is climate change humanity's fault?",
  "Should college education be free?",
];

// Default phase timings (in seconds, same for user and bot)
const defaultPhaseTimings: { name: string; time: number }[] = [
  { name: "Opening Statements", time: 240 },
  { name: "Cross-Examination", time: 180 },
  { name: "Closing Statements", time: 180 },
];

// Maximum length for custom topics
const MAX_TOPIC_LENGTH = 200;

// Loader component
const Loader: React.FC = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-50">
    <div className="bg-white rounded-lg p-8 flex flex-col items-center shadow-lg">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-4"></div>
      <h2 className="text-xl font-semibold text-gray-800">
        Creating your room...
      </h2>
      <p className="text-gray-600 mt-2">Getting your bot ready, please wait.</p>
    </div>
  </div>
);

const isValidPhaseTimings = (
  value: unknown
): value is { name: string; time: number }[] =>
  Array.isArray(value) &&
  value.every(
    (p) =>
      p &&
      typeof p === "object" &&
      typeof (p as { name?: unknown }).name === "string" &&
      Number.isFinite((p as { time?: unknown }).time)
  );

const BotSelection: React.FC = () => {
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>("custom");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [stance, setStance] = useState<string>("random");
  const [phaseTimings, setPhaseTimings] = useState<
    { name: string; time: number }[]
  >(() => defaultPhaseTimings.map((p) => ({ ...p })));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [user] = useAtom(userAtom);

  const recommendedDifficulty = (() => {
    const rating = user?.rating ?? 0;

    if (rating < 1100) return "Easy";
    if (rating < 1300) return "Medium";
    if (rating < 1500) return "Hard";
    if (rating < 2000) return "Expert";
    return "Legends";
  })();

  const [fieldErrors, setFieldErrors] = useState<{
    bot?: string;
    topic?: string;
    timings?: string;
  }>({});
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipInitialPersistRef = useRef(true);
  const preventPersistRef = useRef(false);

  useEffect(() => {
    const savedState = localStorage.getItem("botSelectionState");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setSelectedBot(
          typeof parsed.selectedBot === "string" ? parsed.selectedBot : null
        );
        setTopic(typeof parsed.topic === "string" ? parsed.topic : "custom");
        setCustomTopic(
          typeof parsed.customTopic === "string" ? parsed.customTopic : ""
        );
        setStance(typeof parsed.stance === "string" ? parsed.stance : "random");
        setPhaseTimings(
          isValidPhaseTimings(parsed.phaseTimings)
            ? parsed.phaseTimings.map((p: any) => ({ ...p }))
            : defaultPhaseTimings.map((p) => ({ ...p }))
        );
      } catch (error) {
        console.error("Failed to load saved state:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (skipInitialPersistRef.current) {
      skipInitialPersistRef.current = false;
      return;
    }
    if (preventPersistRef.current) return;
    const stateToSave = {
      selectedBot,
      topic,
      customTopic,
      stance,
      phaseTimings,
    };
    localStorage.setItem("botSelectionState", JSON.stringify(stateToSave));
  }, [selectedBot, topic, customTopic, stance, phaseTimings]);

  useEffect(() => {
    return () => {
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
      }
      setShowSuccess(false);
    };
  }, []);

  const effectiveTopic = topic === "custom" ? customTopic : topic;
  const selectedBotObj = selectedBot
    ? allBots.find((b) => b.name === selectedBot)
    : null;

  // Difficulty levels with counts, sorted by difficulty
  const levels = [
    {
      name: "Easy",
      count: allBots.filter((bot) => bot.level === "Easy").length,
    },
    {
      name: "Medium",
      count: allBots.filter((bot) => bot.level === "Medium").length,
    },
    {
      name: "Hard",
      count: allBots.filter((bot) => bot.level === "Hard").length,
    },
    {
      name: "Expert",
      count: allBots.filter((bot) => bot.level === "Expert").length,
    },
    {
      name: "Legends",
      count: allBots.filter((bot) => bot.level === "Legends").length,
    },
  ].filter((level) => level.count > 0);

  // Update phase timing ensuring the value is within the allowed range
  const updatePhaseTiming = (phaseIndex: number, value: string) => {
    // Allow typing freely; validation happens on submit or via inline warnings
    const parsedValue = value === "" ? 0 : parseInt(value, 10);
    const timeInSeconds = isNaN(parsedValue) ? 0 : parsedValue;

    setPhaseTimings((prev) =>
      prev.map((phase, idx) =>
        idx === phaseIndex ? { ...phase, time: timeInSeconds } : phase
      )
    );
    if (fieldErrors.timings)
      setFieldErrors((prev) => ({ ...prev, timings: undefined }));
  };

  const toggleLevel = (level: string) => {
    setExpandedLevel(expandedLevel === level ? null : level);
  };

  const startDebate = async () => {
    if (isLoading || isCreating) return;
    const newErrors: typeof fieldErrors = {};
    let isValid = true;

    if (!selectedBot) {
      newErrors.bot = "Please select a bot";
      isValid = false;
    }

    if (!effectiveTopic.trim()) {
      newErrors.topic = "Please select or enter a topic";
      isValid = false;
    } else if (effectiveTopic.trim().length > MAX_TOPIC_LENGTH) {
      newErrors.topic = `Topic must be ${MAX_TOPIC_LENGTH} characters or fewer`;
      isValid = false;
    }

    const invalidTiming = phaseTimings.some((p) => p.time < 60 || p.time > 600);
    if (invalidTiming) {
      newErrors.timings = "Phases must be between 60s and 600s";
      isValid = false;
    }

    setFieldErrors(newErrors);
    if (!isValid) return;

    const bot = allBots.find((b) => b.name === selectedBot);
    if (!bot) {
      setFieldErrors({ bot: "Selected bot not found" });
      return;
    }

    const finalStance =
      stance === "random" ? (Math.random() < 0.5 ? "for" : "against") : stance;

    // Build payload
    const debatePayload = {
      botName: bot.name,
      botLevel: bot.level,
      topic: effectiveTopic.trim(),
      stance: finalStance,
      history: [],
      phaseTimings,
    };

    try {
      setIsLoading(true);
      setIsCreating(true);
      const data = await createDebate(debatePayload);
      setShowSuccess(true);
      localStorage.removeItem("botSelectionState");
      preventPersistRef.current = true;
      const state = {
        ...data,
        phaseTimings,
        stance: finalStance,
        userId: user?.email || "guest@example.com",
        botName: bot.name,
        botLevel: bot.level,
        topic: effectiveTopic.trim(),
      };
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => {
        navigate(`/debate/${data.debateId}`, { state });
        setIsCreating(false);
      }, 1500);
    } catch (error) {
      setFieldErrors({ bot: "Failed to start debate. Please try again." });
      setShowSuccess(false);
      setIsCreating(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && <Loader />}
      {showSuccess && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse"
        >
          Debate created successfully! Topic: "{effectiveTopic}"
        </div>
      )}
      <div className="bg-gradient-to-br from-background via-accent/10 to-background p-4">
        {/* Header Section */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-wide">
            Pick Your <span className="text-primary">Debate</span> Rival!
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Select a bot and set up your debate challenge.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bot Selection Section */}
          <div className="bg-card border-2 border-border/80 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">
                Pick Your <span className="text-primary">Bot</span>
              </h2>
              <span className="text-xs text-muted-foreground">
                {allBots.length} Rivals Available
              </span>
            </div>

            {fieldErrors.bot && (
              <p className="text-destructive text-sm mb-3 bg-destructive/10 p-2 rounded-lg border-1 border-destructive/20">{fieldErrors.bot}</p>
            )}

            {/* Selected Bot Preview */}
            {selectedBotObj && (
              <div className="border-2 border-primary/30 rounded-xl mb-4 p-4 bg-muted/40 shadow-sm transition-all duration-200">
                <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block mb-2">
                  Active Challenger
                </span>
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-primary ring-offset-2 ring-offset-card flex-shrink-0 shadow-sm">
                    <img
                      src={selectedBotObj.avatar}
                      alt={selectedBotObj.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground text-base truncate">
                      {selectedBotObj.name}
                    </h4>
                    <p className="text-xs text-muted-foreground italic line-clamp-1 mt-0.5">
                      "{selectedBotObj.quote}"
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md border border-border/60">
                        {selectedBotObj.level}
                      </span>
                      <span className="text-[11px] font-semibold bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-md">
                        {selectedBotObj.rating} Elo
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Difficulty Cards (Scrollable List) */}
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 debate-scrollbar">
              {levels.map((level) => (
                <div
                  key={level.name}
                  className={`border-2 rounded-xl transition-all duration-200 overflow-hidden ${
                    expandedLevel === level.name
                      ? "border-primary/60 shadow-sm"
                      : "border-border/80 hover:border-muted-foreground/60"
                  }`}
                >
                  <div
                    className={`flex justify-between items-center p-3.5 cursor-pointer select-none transition-colors ${
                      expandedLevel === level.name
                        ? "bg-muted/70 rounded-t-xl"
                        : "bg-muted/40 hover:bg-muted/60 rounded-xl"
                    }`}
                    onClick={() => toggleLevel(level.name)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">
                        {level.name}
                      </span>
                      <span className="bg-primary/15 text-primary font-medium rounded-full px-2 py-0.5 text-[11px] border-2 border-primary/20">
                        {level.count} bots
                      </span>
                      {recommendedDifficulty === level.name && (
                        <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                          ⭐ Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground transform transition-transform duration-200">
                      {expandedLevel === level.name ? "▲" : "▼"}
                    </span>
                  </div>

                  {expandedLevel === level.name && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-card border-t border-border/80 rounded-b-xl">
                      {allBots
                        .filter((bot) => bot.level === level.name)
                        .map((bot) => (
                          <div
                            key={bot.name}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selectedBot === bot.name}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedBot(bot.name);
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  bot: undefined,
                                }));
                              }
                            }}
                            onClick={() => {
                              setSelectedBot(bot.name);
                              setFieldErrors((prev) => ({
                                ...prev,
                                bot: undefined,
                              }));
                            }}
                            className={`relative flex flex-col items-center p-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                              selectedBot === bot.name
                                ? "border-2 border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30 scale-[1.02]"
                                : "border-2 border-border/70 hover:border-primary/40 hover:bg-muted/40 hover:scale-[1.01]"
                            }`}
                          >
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border/80 shadow-sm mb-1.5 flex-shrink-0">
                              <img
                                src={bot.avatar}
                                alt={bot.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-xs font-semibold text-foreground truncate max-w-full text-center">
                              {bot.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {bot.rating} Elo
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Debate Setup Section */}
          <div className="bg-card border border-border/80 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col p-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Debate <span className="text-primary">Setup</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Configure your topic, stance, and phase timings.
              </p>
              {selectedBotObj && selectedBotObj.specialMessage && (
                <div className="mt-3 p-3 bg-primary/10 border border-primary/25 rounded-xl text-foreground text-xs sm:text-sm font-medium leading-relaxed">
                  <span className="italic">{selectedBotObj.specialMessage}</span>
                </div>
              )}
            </div>

            <Separator className="my-4 bg-border/80" />

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Topic Selection */}
                <div className="flex flex-col">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Debate Topic
                  </label>
                  <Select
                    value={topic}
                    onValueChange={(val) => {
                      setTopic(val);
                      setFieldErrors((prev) => ({ ...prev, topic: undefined }));
                    }}
                  >
                    <SelectTrigger className="w-full rounded-xl bg-background border-border/80 hover:border-border text-foreground transition-colors">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/80">
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
                      onChange={(e) => {
                        setCustomTopic(e.target.value);
                        setFieldErrors((prev) => ({
                          ...prev,
                          topic: undefined,
                        }));
                      }}
                      maxLength={MAX_TOPIC_LENGTH}
                      placeholder="Enter your custom topic"
                      className="mt-2.5 rounded-xl bg-background border-border/80 text-foreground focus:border-primary text-sm"
                    />
                  )}
                  {fieldErrors.topic && (
                    <p className="text-destructive text-xs mt-1">
                      {fieldErrors.topic}
                    </p>
                  )}
                </div>

                {/* Stance Selection */}
                <div className="flex flex-col">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Your Stance
                  </label>
                  <Select value={stance} onValueChange={setStance}>
                    <SelectTrigger className="w-full rounded-xl bg-background border-border/80 hover:border-border text-foreground transition-colors">
                      <SelectValue placeholder="Choose your stance" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/80">
                      <SelectItem value="for">Affirmative (For)</SelectItem>
                      <SelectItem value="against">Negative (Against)</SelectItem>
                      <SelectItem value="random">Random Stance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Responsive Timer Section */}
              <div className="flex flex-col mt-1">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Phase Timings (seconds)
                </label>
                {fieldErrors.timings && (
                  <p className="text-destructive text-xs mb-2">
                    {fieldErrors.timings}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {phaseTimings.map((phase, index) => (
                    <div
                      key={phase.name}
                      className="flex flex-col p-3 rounded-xl border border-border/80 bg-muted/20 hover:border-primary/40 transition-colors"
                    >
                      <span className="text-xs font-semibold text-foreground mb-1.5 truncate">
                        {phase.name}
                      </span>
                      <Input
                        type="number"
                        value={phase.time.toString()}
                        onChange={(e) =>
                          updatePhaseTiming(index, e.target.value)
                        }
                        className="text-xs rounded-lg bg-background border-border/80 text-foreground font-mono"
                      />
                      {(phase.time < 60 || phase.time > 600) && (
                        <span className="text-[10px] text-destructive mt-1 font-medium">
                          Min 60s, Max 600s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={startDebate}
                disabled={
                  isLoading ||
                  isCreating ||
                  !selectedBot ||
                  !effectiveTopic.trim() ||
                  effectiveTopic.trim().length > MAX_TOPIC_LENGTH ||
                  phaseTimings.some((p) => p.time < 60 || p.time > 600)
                }
                className="w-full font-bold py-3 mt-2 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.99] text-base"
              >
                {isLoading || isCreating
                  ? "Creating Debate..."
                  : "Start Debate 🚀"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BotSelection;
