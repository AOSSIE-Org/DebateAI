import React from 'react';
import { useSpring, animated, config } from 'react-spring';
import { useDebateWS } from '../hooks/useDebateWS';
import { useAtom } from 'jotai';
import { debateIdAtom, spectatorHashAtom } from '../atoms/debateAtoms';

const REACTIONS = ['👍', '❤️', '😂', '🔥', '🎉', '💯', '👏', '🤔'];

interface ReactionProps {
  emoji: string;
  onClick: () => void;
}

const Reaction: React.FC<ReactionProps> = ({ emoji, onClick }) => {
  const [props, api] = useSpring(() => ({
    transform: 'translateY(0px) scale(1)',
    opacity: 1,
    config: config.default,
  }));

  const handleClick = () => {
    onClick();
    
    // Animate floating up
    api.start({
      to: async (next) => {
        await next({
          transform: 'translateY(-120px) scale(1.6)',
          opacity: 0,
        });
        // Reset after animation
        await next({
          transform: 'translateY(0px) scale(1)',
          opacity: 1,
        });
      },
      config: { duration: 700 },
    });
  };

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-2xl focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={`React with ${emoji}`}
    >
      <animated.div style={props}>{emoji}</animated.div>
    </button>
  );
};

export const ReactionBar: React.FC = () => {
  const [debateId] = useAtom(debateIdAtom);
  const [spectatorHash] = useAtom(spectatorHashAtom);
  const { sendMessage } = useDebateWS(debateId);

  const handleReaction = (emoji: string) => {
    const storedHash =
      spectatorHash || localStorage.getItem('spectatorHash') || '';
    if (!debateId || !storedHash) return;

    const payload = {
      reaction: emoji,
      spectatorHash: storedHash,
      timestamp: Date.now(),
    };

    sendMessage('reaction', payload);
  };

  if (!debateId) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2">
        {REACTIONS.map((emoji) => (
          <Reaction
            key={emoji}
            emoji={emoji}
            onClick={() => handleReaction(emoji)}
          />
        ))}
      </div>
    </div>
  );
};


