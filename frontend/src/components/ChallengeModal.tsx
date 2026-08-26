import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAuthToken } from '@/utils/auth';
import { useUser } from '@/hooks/useUser';

interface ChallengeModalProps {
  onClose: () => void;
}

type ChallengeRoom = {
  id: string;
  inviteToken: string;
  topic: string;
};

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';

const ChallengeModal: React.FC<ChallengeModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [opponentUsername, setOpponentUsername] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<ChallengeRoom | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  const inviteLink = challenge
    ? `${window.location.origin}/debate-room/${challenge.id}?invite=${challenge.inviteToken}`
    : '';

  const handleCreate = async () => {
    if (!topic.trim()) {
      setError('Please enter a debate topic');
      return;
    }

    setLoading(true);
    setError('');

    const trimmedOpponent = opponentUsername.trim();
    const currentName = user?.displayName?.trim() ?? '';
    const resolvedOpponent =
      trimmedOpponent &&
      currentName &&
      trimmedOpponent.localeCompare(currentName, undefined, {
        sensitivity: 'accent',
      }) === 0
        ? ''
        : trimmedOpponent;

    try {
      const token = getAuthToken();
      const response = await fetch(`${BASE_URL}/rooms/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          opponentUsername: resolvedOpponent,
          topic: topic.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to create challenge');
        return;
      }

      setChallenge({
        id: data.id,
        inviteToken: data.inviteToken,
        topic: data.topic,
      });
    } catch {
      setError('Failed to create challenge');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyError('');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Could not copy link. Please copy it manually from the field above.');
    }
  };

  const handleEnterRoom = () => {
    if (!challenge) return;
    navigate(`/debate-room/${challenge.id}?invite=${challenge.inviteToken}`);
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
      <div className='relative bg-card text-foreground p-6 rounded-lg shadow-lg w-full max-w-md'>
        <button
          onClick={onClose}
          className='absolute top-3 right-3 text-muted-foreground hover:text-foreground'
        >
          <X size={20} />
        </button>

        {!challenge ? (
          <>
            <h2 className='text-xl font-semibold mb-4'>Challenge a Friend</h2>
            <div className='space-y-4'>
              <div>
                <Label htmlFor='opponent'>Opponent username (optional)</Label>
                <Input
                  id='opponent'
                  value={opponentUsername}
                  onChange={(e) => setOpponentUsername(e.target.value)}
                  placeholder='e.g. LogicLord (or leave blank)'
                  className='mt-1'
                />
                <p className='text-xs text-muted-foreground mt-1'>
                  Leave blank to share the invite link with anyone.
                </p>
              </div>
              <div>
                <Label htmlFor='topic'>Debate topic</Label>
                <Input
                  id='topic'
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder='e.g. Should AI replace teachers?'
                  className='mt-1'
                />
              </div>
              {error && (
                <p className='text-sm text-red-600'>{error}</p>
              )}
              <Button
                onClick={handleCreate}
                disabled={loading}
                className='w-full'
              >
                {loading ? 'Creating...' : 'Create Challenge'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className='text-xl font-semibold mb-2'>Challenge Created</h2>
            <p className='text-sm text-muted-foreground mb-4'>
              Share this link with your opponent. Topic: {challenge.topic}
            </p>
            <div className='flex gap-2 mb-4'>
              <Input value={inviteLink} readOnly className='text-xs' />
              <Button variant='outline' size='icon' onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
            {copyError && (
              <p className='text-sm text-red-600 mb-3'>{copyError}</p>
            )}
            <div className='flex gap-2'>
              <Button onClick={handleCopy} variant='outline' className='flex-1'>
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button onClick={handleEnterRoom} className='flex-1'>
                Enter Room
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChallengeModal;
