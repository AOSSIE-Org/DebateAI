import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { FaTrophy, FaStar } from "react-icons/fa";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Top10CelebrationProps {
    rank: number;
    isOpen: boolean;
    onClose: () => void;
}

const Top10Celebration: React.FC<Top10CelebrationProps> = ({ rank, isOpen, onClose }) => {
    const [showConfetti, setShowConfetti] = useState(false);
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });

            // Hide confetti after 6 seconds
            const timer = setTimeout(() => {
                setShowConfetti(false);
            }, 6000);

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

    const getRankContent = () => {
        if (rank === 1) {
            return {
                icon: <FaTrophy className="w-20 h-20 text-amber-500" />,
                title: "🥇 You're #1!",
                message: "You've reached the top of the leaderboard! You're the champion!",
                confettiColors: ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'],
            };
        } else if (rank === 2) {
            return {
                icon: <FaTrophy className="w-20 h-20 text-slate-400" />,
                title: "🥈 Silver Position!",
                message: "Amazing! You're in 2nd place on the leaderboard!",
                confettiColors: ['#C0C0C0', '#A8A8A8', '#909090', '#B8B8B8'],
            };
        } else if (rank === 3) {
            return {
                icon: <FaTrophy className="w-20 h-20 text-orange-500" />,
                title: "🥉 Bronze Achievement!",
                message: "Fantastic! You've claimed 3rd place on the leaderboard!",
                confettiColors: ['#CD7F32', '#B87333', '#A0522D', '#D2691E'],
            };
        } else {
            return {
                icon: <FaStar className="w-20 h-20 text-primary" />,
                title: `🌟 Top 10! Rank #${rank}`,
                message: "Congratulations! You've made it to the Top 10!",
                confettiColors: ['#6366F1', '#8B5CF6', '#A855F7', '#D946EF'],
            };
        }
    };

    const content = getRankContent();

    return (
        <>
            {showConfetti && (
                <Confetti
                    width={windowSize.width}
                    height={windowSize.height}
                    recycle={false}
                    numberOfPieces={600}
                    gravity={0.25}
                    colors={content.confettiColors}
                />
            )}
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogTitle className="text-2xl font-bold text-center mb-4">
                        {content.title}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        <div className="flex flex-col items-center justify-center space-y-4 py-4">
                            <div className="animate-bounce">{content.icon}</div>
                            <p className="text-muted-foreground text-lg">{content.message}</p>
                        </div>
                    </DialogDescription>
                    <div className="flex justify-center mt-4">
                        <Button onClick={onClose} className="px-8 py-2">
                            Keep Going! 🚀
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Top10Celebration;
