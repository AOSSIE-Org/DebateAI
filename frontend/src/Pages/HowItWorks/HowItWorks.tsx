import { motion } from "framer-motion"
import { useState } from "react"

const steps = [
  {
    title: "Choose a Topic",
    description: "Select from a wide range of debate topics or propose your own.",
    details:
      "Browse through categories like politics, science, philosophy, or current events. Can't find what you're looking for? Suggest a custom topic!",
    icon: "🎯"
  },
  {
    title: "Prepare Your Arguments",
    description: "Research and organize your thoughts to build a strong case.",
    details: "Use our integrated research tool to find credible sources and structure your arguments effectively.",
    icon: "📚"
  },
  {
    title: "Engage in Debate",
    description: "Present your arguments and respond to counterpoints from the AI.",
    details:
      "Experience a real-time debate simulation with our AI, which adapts its responses based on your arguments and debating style.",
    icon: "💭"
  },
  {
    title: "Receive Feedback",
    description: "Get personalized feedback and suggestions for improvement.",
    details:
      "After each debate, receive a detailed analysis of your performance, including strengths, areas for improvement, and suggested resources for further learning.",
    icon: "📊"
  },
]

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState<number | null>(null)

  return (
    <section className="py-20 bg-gray-50 dark:bg-black transition-colors duration-300">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }} // This will trigger the animation once when the component enters the viewport
              whileHover={{ y: -5 }}
            >
              <div 
                className={`
                  bg-white dark:bg-[#121212]  /* Off-Black Card */
                  rounded-xl border border-gray-200 dark:border-gray-800
                  shadow-md hover:shadow-lg 
                  p-6 cursor-pointer h-full 
                  transition-all duration-300 
                  relative
                  ${activeStep === index ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}
                `}
                onClick={() => setActiveStep(activeStep === index ? null : index)}
              >
                
                <div className="absolute -top-4 left-4 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
                  {index + 1}
                </div>
                
                
                <div className="absolute -top-4 right-4 text-2xl">
                  {step.icon}
                </div>

                <div className="pt-4">
                  <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {step.description}
                  </p>

                  
                  {activeStep === index && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4"
                    >
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {step.details}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
