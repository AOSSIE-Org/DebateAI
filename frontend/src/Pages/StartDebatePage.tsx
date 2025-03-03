import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";

interface TopicCategory {
  category: string;
  items: string[];
}

interface DebateBot {
  id: string;
  name: string;
  expertise: string;
  description: string;
  avatar: string;
  // difficulty: string;
}

const topics: TopicCategory[] = [
  {
    category: "Technology",
    items: [
      "Artificial Intelligence Ethics",
      "Cryptocurrency Regulation",
      "Social Media Impact",
      "Space Exploration",
      "Quantum Computing",
    ],
  },
  {
    category: "Politics",
    items: [
      "Universal Basic Income",
      "Electoral Reform",
      "Climate Change Policy",
      "Immigration Reform",
      "Healthcare Systems",
    ],
  },
  {
    category: "Philosophy",
    items: [
      "Existence of Free Will",
      "Morality of Veganism",
      "Meaning of Life",
      "Nature vs Nurture",
      "Ethical Implications of AI",
    ],
  },
  {
    category: "Science",
    items: [
      "Gene Editing Ethics",
      "Dark Matter Theories",
      "Renewable Energy Future",
      "Extraterrestrial Life",
      "Consciousness and the Brain",
    ],
  },
];

const debateBots: DebateBot[] = [
  {
    id: "tech-1",
    name: "AI Thinker",
    expertise: "Technology",
    description: "Specialist in emerging technologies and digital ethics",
    avatar: "🤖"
    // difficulty: "Expert",
  },
  {
    id: "politics-1",
    name: "Policy Master",
    expertise: "Politics",
    description: "Government policy analyst with 10+ years experience",
    avatar: "🎩"
    // difficulty: "Challenging",
  },
  {
    id: "philo-1",
    name: "Socrates 2.0",
    expertise: "Philosophy",
    description: "Ancient wisdom meets modern ethics",
    avatar: "📜"
    // difficulty: "Moderate",
  },
  {
    id: "science-1",
    name: "Dr. Hypothesis",
    expertise: "Science",
    description: "Cutting-edge scientific debate specialist",
    avatar: "🔬"
    // difficulty: "Technical",
  },
  {
    id: "general-1",
    name: "Debate Pro",
    expertise: "General",
    description: "Versatile debater for any topic",
    avatar: "🌐"
    // difficulty: "Adaptive",
  },
];

const AnimatedUnderline: React.FC<{ isVisible: boolean }> = ({ isVisible }) => (
  <motion.div
    className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"
    initial={{ scaleX: 0 }}
    animate={{ scaleX: isVisible ? 1 : 0 }}
    transition={{ duration: 0.5 }}
  />
);

const StartDebatePage: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isHovering, setIsHovering] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(topics[0].category);
  const [selectedBot, setSelectedBot] = useState<DebateBot | null>(null);
  const [showBotModal, setShowBotModal] = useState(false);
  const navigate = useNavigate();

  const filteredTopics = topics.map((category) => ({
    ...category,
    items: category.items.filter((item) =>
      item.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  }));

  const handleStartDebate = () => {
    const topic = selectedTopic === "custom" ? customTopic : selectedTopic;
    if (!topic) return;

    const category = topics.find((c) => c.items.includes(topic))?.category || "General";
    const bot = debateBots.find((b) => b.expertise === category) || debateBots[4];
    setSelectedBot(bot);
    setShowBotModal(true);
  };

  const confirmDebate = () => {
    if (!selectedBot) return;
    const topic = selectedTopic === "custom" ? customTopic : selectedTopic;
    navigate(`/debatewithai?topic=${encodeURIComponent(topic)}&bot=${selectedBot.id}`);
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (selectedTopic || customTopic)) {
        handleStartDebate();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedTopic, customTopic]);

  const BotModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50"
      onClick={() => setShowBotModal(false)}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white dark:bg-black rounded-xl p-8 max-w-md w-full space-y-6 text-center text-black dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">{selectedBot?.avatar}</div>
        <h2 className="text-2xl font-bold">{selectedBot?.name}</h2>
        {/* <div className="text-blue-500 font-semibold">{selectedBot?.difficulty} Level</div> */}
        <p>{selectedBot?.description}</p>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={() => setShowBotModal(false)}>
            Cancel
          </Button>
          <Button onClick={confirmDebate} className="bg-blue-500 hover:bg-blue-700">
            Start Debate
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );

  return (
    <>
    <Navbar/>
    <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-black p-4 text-black dark:text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-gray-50 dark:bg-black rounded-xl shadow-2xl p-8"
      >
        <h1
          className="text-4xl font-bold mb-8 text-center relative inline-block"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          Choose Your Debate Arena
          <AnimatedUnderline isVisible={isHovering} />
        </h1>

        <div className="mb-8 relative">
          <Input
            placeholder="Search debate topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-700"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

        <div className="mb-8 grid grid-cols-4 gap-3">
          {topics.map((category) => (
            <button
              key={category.category}
              onClick={() => setActiveTab(category.category)}
              className={`px-4 py-3 rounded-lg transition-colors ${
                activeTab === category.category
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
              }`}
            >
              {category.category}
            </button>
          ))}
        </div>

        {topics.map((category) => (
          <div
            key={category.category}
            className={`${activeTab === category.category ? "block" : "hidden"}`}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTopics
                .find((c) => c.category === category.category)
                ?.items.map((topic) => (
                  <div
                    key={topic}
                    onClick={() => setSelectedTopic(topic)}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${
                      selectedTopic === topic
                        ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-gray-900"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="text-blue-500" />
                      <span>{topic}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="mt-8">
          <Label>Create Custom Topic:</Label>
          <div className="flex gap-3 mt-2">
            <Input
              value={customTopic}
              onChange={(e) => {
                setCustomTopic(e.target.value);
                setSelectedTopic("custom");
              }}
              placeholder="Enter custom debate topic..."
              className="flex-1 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-700"
            />
            <Button
              onClick={() => setSelectedTopic("custom")}
              variant="outline"
              className="px-6"
            >
              <Plus className="mr-2" /> Custom
            </Button>
          </div>
        </div>

        <Button
          onClick={handleStartDebate}
          disabled={!selectedTopic && !customTopic}
          className="w-full mt-8 py-6 rounded-xl bg-blue-600 hover:bg-blue-700"
        >
          🗣️ Start Intellectual Debate
        </Button>
      </motion.div>

      {showBotModal && <BotModal />}
    </div>
    </>
  );
};

export default StartDebatePage;