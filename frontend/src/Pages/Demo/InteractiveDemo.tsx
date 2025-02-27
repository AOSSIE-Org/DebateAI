import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button"; 
import { Send } from "lucide-react";
import Lottie from "lottie-react";


// Sample conversation data
const demoConversation = [
  { role: "AI", message: "Welcome to the debate on climate change. What's your stance on renewable energy?" },
  { role: "User", message: "I believe renewable energy is crucial for combating climate change." },
  {
    role: "AI",
    message:
      "Interesting point. However, some argue that the intermittent nature of renewable sources like solar and wind makes them unreliable. How would you address this concern?",
  },
  {
    role: "User",
    message:
      "While it's true that solar and wind are intermittent, advances in energy storage technologies are addressing this issue.",
  },
  {
    role: "AI",
    message:
      "Good point about energy storage. But what about the environmental impact of manufacturing solar panels and wind turbines? Doesn't this offset some of the benefits?",
  },
];

export default function InteractiveDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [conversation, setConversation] = useState(demoConversation);
  const [isThinking, setIsThinking] = useState(false);

  const handleNext = () => {
    if (currentStep < demoConversation.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInput.trim()) {
      setConversation([...conversation, { role: "User", message: userInput }]);
      setUserInput("");
      setIsThinking(true);

      // Simulate AI thinking process
      setTimeout(() => {
        setIsThinking(false);
        handleNext();
      }, 1500);
    }
  };

  return (
    <section className="py-20">
      <div className="container mx-auto px-11">
        <h2 className="text-4xl font-bold text-center mb-12">Experience A Quick Debate</h2>
        <div className="max-w-2xl mx-auto rounded-lg shadow-lg p-6 bg-white dark:bg-[#121212]">
          <div className="h-80 overflow-y-auto mb-4 custom-scrollbar">
            <AnimatePresence>
              {conversation.slice(0, currentStep + 1).map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} // Ensures animation happens only once when entering the viewport
                  transition={{ duration: 0.5 }}
                  className={`mb-4 ${item.role === "AI" ? "text-left" : "text-right"}`}
                >
                  <span
                    className={`inline-block px-4 py-2 rounded-lg ${item.role === "AI" ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-blue-600"}`}
                  >
                    {item.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {isThinking && (
            <div className="mb-4 text-center text-gray-500 dark:text-gray-300">AI is thinking...</div>
          )}

          <form onSubmit={handleSubmit} className="flex items-center mt-6">
            <motion.input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response..."
              className="flex-grow px-4 py-2 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#121212] dark:text-white dark:border-gray-600"
              whileFocus={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
            <Button
              type="submit"
              className="rounded-l-none bg-blue-900 text-white hover:bg-blue-700 focus:outline-none transition-all duration-300 ease-in-out dark:bg-blue-800 dark:hover:bg-blue-900"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </form>
        </div>
        
      </div>
    </section>
  );
}
