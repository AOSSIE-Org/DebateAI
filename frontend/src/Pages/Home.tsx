import React, { useState, useEffect, useRef, useContext } from "react";
import { motion, useAnimation } from "framer-motion";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-image1.png";
import { useNavigate } from "react-router-dom";
import { ScrollParallax } from "react-just-parallax";
import  {ScrollProgress}  from "@/components/ui/ScrollProgress";
import { cn } from "@/lib/utils";
import { Sparkles, Users, Bot } from "lucide-react";
import Lottie from "lottie-react";
import animationData from "@/assets/Animation - 1738790352354.json";
import animationData2 from "@/assets/Animation - 1738791717114.json";
import { AuthContext } from "@/context/authContext";
import Navbar from "./Navbar";

interface MousePosition {
  x: number;
  y: number;
}

const AnimatedBackground: React.FC = () => {
  const controls = useAnimation();
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    controls.start({
      opacity: [0.3, 1, 0.3],
      scale: [1, 1.2, 1],
      rotate: [0, 180, 360],
      transition: {
        duration: 20,
        repeat: Infinity,
        ease: "linear",
      },
    });
  }, [controls]);

  return (
    <svg className="absolute inset-0 w-full h-full text-gray-800 dark:text-gray-200">
      <defs>
        <pattern id="backgroundGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.05"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#backgroundGrid)" />
      <defs>
        <pattern id="sGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            strokeWidth="0.5"
            stroke="currentColor"
            strokeOpacity="0.05"
            transform={`translate(${mousePosition.x * 5}px, ${mousePosition.y * 5}px)`}
          />
        </pattern>
        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#sGrid)" />
          <path
            d="M 100 0 L 0 0 0 100"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <motion.circle
        cx="50%"
        cy="29%"
        r="19%"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="1"
        animate={controls}
      />
      <motion.path
        d={`M0,${100 + mousePosition.y * 50} Q250,${mousePosition.y * 100} 500,100 T1000,${100 + mousePosition.y * 50}`}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.1"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.circle
          key={i}
          cx={Math.random() * 100 + "%"}
          cy={Math.random() * 100 + "%"}
          r={Math.random() * 2}
          fill="currentColor"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.3, 0],
            y: [0, -100],
          }}
          transition={{
            duration: 2 + Math.random() * 5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </svg>
  );
};

interface TextAnimationProps {
  text: string;
}

const TextAnimation: React.FC<TextAnimationProps> = ({ text }) => {
  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const charVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300 },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="font-sans relative"
    >
      {text.split("").map((char, index) => (
        <motion.span
          key={`${char}-${index}`}
          variants={charVariants}
          className="inline-block text-black dark:text-white relative text-8xl"
        >
          {char}
        </motion.span>
      ))}
    </motion.div>
  );
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);

  

  const signupHandler = () => {
    navigate('/auth', { state: { isSignUp: true } });
  };

  const loginHandler = () => {
    navigate('/auth', { state: { isSignUp: false } });
  };
  const handlePlayDebateClick = () => {
    if (authContext?.isAuthenticated) {
      navigate('/game');  
    } else {
      navigate('/auth', { state: { isSignUp: false } });
    }
  };

  const handlePlayBotClick = () => {
     if (authContext?.isAuthenticated) {
      navigate('/startdebate');  
    } else {
       navigate('/auth', { state: { isSignUp: false } });
     }
  };

  const logoutHandler = () =>{
    authContext?.logout()
    navigate("/")
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-white dark:bg-black text-black dark:text-white p-4 overflow-hidden font-sans-serif">
      <Navbar />
      <ScrollProgress />
      <AnimatedBackground />

      <div className="flex flex-col items-center justify-center flex-grow z-10 w-full mt-60">
        <motion.div
          initial={{ opacity: 0, y: "-50%" }}
          animate={{ opacity: 1, y: "0" }}
          transition={{ duration: 0.5 }}
          className="text-center w-full flex flex-col items-center justify-center"
        >
          <motion.div
            className="inline-block mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-widest">
              Welcome to the Future of Debate
            </span>
          </motion.div>

          <h1 className="text-7xl font-bold mb-1 font-sans text-center">
            <TextAnimation text="Debate AI" />
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xl mb-5 max-w-md mx-auto text-gray-600 dark:text-gray-400 font-light leading-relaxed text-center"
          >
            Challenge your ideas and sharpen your arguments with our AI-powered debate platform
          </motion.p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block relative group"
          >
            <Button
              size="lg"
              className={cn(
                "text-lg bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
                "transition-all duration-300 relative overflow-hidden px-8 py-6",
                "rounded-lg font-sans border-0 shadow-[0_0_20px_5px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_0_30px_10px_rgba(0,0,0,0.5)]"
              )}
              onClick={() => handlePlayBotClick()}
            >
              User vs AI
              <Bot className="ml-2 inline-block" />
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block relative group"
          >
            <Button
              size="lg"
              className={cn(
                "text-lg bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
                "transition-all duration-300 relative overflow-hidden px-8 py-6",
                "rounded-lg font-sans border-0 shadow-[0_0_20px_5px_rgba(0,0,0,0.3)]",
                "hover:shadow-[0_0_30px_10px_rgba(0,0,0,0.5)]"
              )}
              onClick={() => handlePlayDebateClick()}
            >
              User vs User
              <Users className="ml-2 inline-block" />
            </Button>
          </motion.div>
        </div>

        {/* Lottie Animation */}
        <div className="absolute left-1 top-1/3 transform -translate-y-1/3 w-[500px] h-[500px] z-23">
          <Lottie animationData={animationData} loop={true} />
        </div>

        <div className="absolute right-1 bottom-1/6 w-[600px] h-[600px]">
          <Lottie animationData={animationData2} loop={true} />
        </div>
      </div>

      <div className="relative max-w-[30rem] mx-auto md:max-w-5xl mt-60 z-20">
        <div className="relative z-10 px-0.1 rounded-1xl">
          <motion.div
            className="relative bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="p-3">
              <div className="aspect-video rounded-lg flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 overflow-hidden relative">
                <img
                  src={heroImage || "/placeholder.svg"}
                  alt="Hero"
                  className="w-full h-auto rounded-lg object-cover transform scale-105 grayscale"
                />

                <ScrollParallax isAbsolutelyPositioned strength={0.3}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute bottom-10 left-10 px-4 py-4 bg-black/60 backdrop-blur-lg rounded-2xl border border-white/20"
                  >
                    <h3 className="text-xl text-white font-bold">AI Debates</h3>
                    <p className="text-sm text-white/80 mt-1">
                      Ready to start your next debate?
                    </p>
                  </motion.div>
                </ScrollParallax>

                <ScrollParallax isAbsolutelyPositioned strength={0.2}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="absolute top-10 left-1/3 px-6 py-3 bg-black/50 backdrop-blur-lg rounded-2xl border border-white/20"
                  >
                    <h3 className="text-xl text-white font-bold">Engage with AI</h3>
                    <p className="text-sm text-white/70 mt-1">
                      Engage with our AI and enhance your debating skills.
                    </p>
                  </motion.div>
                </ScrollParallax>

                <ScrollParallax isAbsolutelyPositioned strength={0.4}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0 }}
                    className="absolute bottom-10 right-10 px-4 py-4 bg-black/60 backdrop-blur-lg rounded-2xl border border-white/20"
                  >
                    <h3 className="text-xl text-white font-bold">Debate Now</h3>
                    <p className="text-sm text-white/80 mt-1">
                      It's time to put your thoughts to the test.
                    </p>
                  </motion.div>
                </ScrollParallax>

                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-black/20 to-black/20"
                  animate={{
                    opacity: [0.1, 0.2, 0.1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: Math.random() * 100 + "%",
            top: Math.random() * 100 + "%",
          }}
          animate={{
            y: [0, -40, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: 5 + Math.random() * 5,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <svg
            className="w-8 h-8 text-gray-200 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </motion.div>
      ))}
      
    </div>
  );
};

export default Home;
