import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    question: "What is Debate AI?",
    answer:
      "Debate AI is an innovative platform that uses artificial intelligence to engage users in debates on various topics. It's designed to help improve critical thinking and argumentation skills.",
  },
  {
    question: "How does the AI debate system work?",
    answer:
      "Our AI system is trained on a vast array of debate topics and argumentation techniques. It analyzes your arguments, provides counterpoints, and adapts its responses based on the flow of the debate.",
  },
  {
    question: "Is Debate AI suitable for beginners?",
    answer:
      "Debate AI is designed for users of all skill levels. Beginners can start with simpler topics and gradually progress to more complex debates as they improve their skills.",
  },
  {
    question: "Can I use Debate AI for educational purposes?",
    answer:
      "Yes, Debate AI is an excellent tool for educational purposes. Many teachers and students use our platform to practice debate skills, explore different perspectives on various topics, and enhance critical thinking abilities.",
  },
];

export default function FAQ() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem("darkMode") === "true" ||
      (!("darkMode" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  // Apply dark mode class to <html> and save in localStorage
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", darkMode.toString());
  }, [darkMode]);

  return (
    <section className="py-20 min-h-screen transition-colors duration-300 bg-gray-50 text-black dark:bg-black dark:text-white">
      <div className="container mx-auto px-8">
        <h2 className="text-4xl font-bold text-center mb-20">Frequently Asked Questions</h2>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={activeIndex === index}
              onClick={() => setActiveIndex(activeIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      className="rounded-lg overflow-hidden shadow-sm transition-all duration-300 bg-white dark:bg-[#0a0a0a]"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <button
        className="flex justify-between items-center w-full text-left p-6 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors duration-300"
        onClick={onClick}
      >
        <span className="font-semibold text-lg">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: contentRef.current?.scrollHeight || "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div ref={contentRef} className="px-6 pb-6 text-gray-700 dark:text-gray-300">
              <p>{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}