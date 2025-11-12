import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { FaTrophy, FaMedal, FaAward } from "react-icons/fa";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BadgeUnlockedProps {
  badgeName: string;
  isOpen: boolean;
  onClose: () => void;
}

const badgeIcons: Record<string, React.ReactNode> = {
  Novice: <FaAward className="w-16 h-16 text-blue-500" />,
  Streak5: <FaMedal className="w-16 h-16 text-yellow-500" />,
  FactMaster: <FaTrophy className="w-16 h-16 text-purple-500" />,
  FirstWin: <FaTrophy className="w-16 h-16 text-green-500" />,
  Debater10: <FaMedal className="w-16 h-16 text-orange-500" />,
};

const badgeDescriptions: Record<string, string> = {
  Novice: "You've completed your first debate! Welcome to DebateAI!",
  Streak5: "Incredible! You've maintained a 5-day streak!",
  FactMaster: "You're a master of facts! Keep up the great work!",
  FirstWin: "Congratulations on your first victory!",
  Debater10: "You've completed 10 debates! You're becoming a pro!",
};

const BadgeUnlocked: React.FC<BadgeUnlockedProps> = ({ badgeName, isOpen, onClose }) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      
      // Hide confetti after 5 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const badgeIcon = badgeIcons[badgeName] || <FaAward className="w-16 h-16 text-primary" />;
  const badgeDescription = badgeDescriptions[badgeName] || "Congratulations on earning this badge!";

  return (
    <>
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-2xl font-bold text-center mb-4">
            🎉 Badge Unlocked! 🎉
          </DialogTitle>
          <DialogDescription className="text-center">
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <div className="animate-bounce">{badgeIcon}</div>
              <h3 className="text-xl font-semibold text-foreground">{badgeName}</h3>
              <p className="text-muted-foreground">{badgeDescription}</p>
            </div>
          </DialogDescription>
          <div className="flex justify-center mt-4">
            <Button onClick={onClose} className="px-6">
              Awesome!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BadgeUnlocked;

