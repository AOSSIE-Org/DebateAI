import React, { useState } from 'react';
import { ShareVictoryCardModal } from '@/components/ShareVictoryCard/ShareVictoryCardModal';
import { DebateVictoryCardData } from '@/components/ShareVictoryCard/types';

const sampleData: DebateVictoryCardData = {
  topic: 'AI will replace most human jobs within 20 years',
  matchType: 'AI Bot Arena',
  winner: {
    name: 'You',
    avatarUrl: 'https://api.dicebear.com/9.x/big-ears/svg?seed=Felix',
    stance: 'For',
    score: 34,
  },
  opponent: {
    name: 'GPT Debater',
    avatarUrl: 'https://api.dicebear.com/9.x/big-ears/svg?seed=Nolan',
    stance: 'Against',
    score: 28,
  },
  verdictReason: 'Stronger arguments with better evidence and logical reasoning throughout.',
};

const TestVictoryCard: React.FC = () => {
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
      <button
        onClick={() => setShowModal(true)}
        className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-3 rounded-lg text-lg"
      >
        🏆 Open Victory Card
      </button>

      <ShareVictoryCardModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        data={sampleData}
      />
    </div>
  );
};

export default TestVictoryCard;
