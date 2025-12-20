import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,
  createTeamDebate,
  getActiveTeamDebate,
  ActiveDebateSummary,
} from '@/services/teamDebateService';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaUsers, FaClock, FaCheckCircle } from 'react-icons/fa';
import type { User as AppUser } from '@/types/user';

interface Team {
  id: string;
  name: string;
  captainId: string;
  captainEmail: string;
  members: Array<{
    userId: string;
    displayName: string;
    elo: number;
  }>;
  maxSize: number;
  averageElo: number;
}

type BasicUser = Pick<AppUser, 'id' | 'email' | 'displayName'>;

interface TeamMatchmakingProps {
  team: Team;
  user: BasicUser | null;
}

const TeamMatchmaking: React.FC<TeamMatchmakingProps> = ({ team, user }) => {
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [matchedTeam, setMatchedTeam] = useState<Team | null>(null);
  const [activeDebateId, setActiveDebateId] = useState<string | null>(null);
  const [showDebateNotification, setShowDebateNotification] = useState(false);

  // Check if current user is captain
  // Handle both string comparison and potential ObjectID structures
  const isCaptain = React.useMemo(() => {
    if (!user?.id || !team) return false;
    
    // Convert captainId to string if it's an object (for backwards compatibility)
    const captainIdStr = typeof team.captainId === 'string' 
      ? team.captainId 
      : (team.captainId as any)?.$oid || String(team.captainId);
    
    // Convert user.id to string if needed
    const rawUserId = user.id;
    const userIdStr = typeof rawUserId === 'string'
      ? rawUserId
      : (rawUserId as any)?.$oid || '';

    if (!userIdStr) return false;
    
    // Check both ID and email
    return captainIdStr === userIdStr || team.captainEmail === user?.email;
  }, [team, user]);

  // Check if team is full
  const isTeamFull = team.members.length >= team.maxSize;

  // Poll for active debates - THIS RUNS FOR ALL TEAM MEMBERS
  useEffect(() => {
    const checkActiveDebate = async () => {
      try {
        const result: ActiveDebateSummary = await getActiveTeamDebate(team.id);
        if (result.hasActiveDebate && result.debateId) {
          // Store debate ID and show notification instead of auto-redirecting
          if (activeDebateId !== result.debateId) {
            setActiveDebateId(result.debateId);
            setShowDebateNotification(true);
          }
        } else {
          // No active debate - clear notification if debate ended
          if (activeDebateId) {
            setActiveDebateId(null);
            setShowDebateNotification(false);
          }
        }
      } catch (error) {
        // No active debate or error - this is normal
        if (activeDebateId) {
          setActiveDebateId(null);
          setShowDebateNotification(false);
        }
      }
    };

    // Check immediately on mount
    checkActiveDebate();

    // Then poll every 2 seconds
    const debateCheckInterval = setInterval(checkActiveDebate, 2000);

    return () => clearInterval(debateCheckInterval);
  }, [team.id, activeDebateId]);

  // Poll for matchmaking status - ONLY WHEN IN MATCHMAKING
  useEffect(() => {
    if (hasJoined) {
      const interval = setInterval(async () => {
        try {
          const status = await getMatchmakingStatus(team.id);
          if (status.matched) {
            setMatchedTeam(status.team ?? null);
          }
        } catch (error) {
        }
      }, 3000); // Check every 3 seconds

      return () => clearInterval(interval);
    }
  }, [hasJoined, team.id]);

  const handleJoinMatchmaking = async () => {
    if (!isTeamFull) {
      alert('Team must be full to join matchmaking!');
      return;
    }

    try {
      setIsSearching(true);
      await joinMatchmaking(team.id);
      setHasJoined(true);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to join matchmaking';
      alert(errorMessage);
      setIsSearching(false);
    }
  };

  const handleLeaveMatchmaking = async () => {
    try {
      await leaveMatchmaking(team.id);
      setHasJoined(false);
      setMatchedTeam(null);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to leave matchmaking';
      alert(errorMessage);
    }
  };

  const handleCreateDebate = async () => {
    if (!matchedTeam) return;

    try {
      const topic = 'Should AI be regulated?'; // Could be dynamic
      const debate = await createTeamDebate(team.id, matchedTeam.id, topic);

      
      // Set the active debate ID - notification will show for all team members
      setActiveDebateId(debate.id);
      setShowDebateNotification(true);
      setMatchedTeam(null);
      setHasJoined(false);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create debate';
      alert(errorMessage);
    }
  };

  const handleJoinDebate = () => {
    if (activeDebateId) {
      navigate(`/team-debate/${activeDebateId}`);
    }
  };

  const handleDismissDebateNotification = () => {
    setShowDebateNotification(false);
  };

  // Show debate notification for ALL team members (not just captain)
  const debateNotification = showDebateNotification && activeDebateId ? (
    <Card className='mb-6 border-green-500 bg-green-50'>
      <CardContent className='pt-6'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <FaCheckCircle className='text-green-500 text-2xl' />
            <div>
              <h3 className='font-bold text-lg text-green-900'>
                Debate Ready!
              </h3>
              <p className='text-sm text-green-700'>
                Your team has an active debate. Click to join the debate room.
              </p>
            </div>
          </div>
          <div className='flex gap-2'>
            <Button onClick={handleJoinDebate} className='bg-green-600 hover:bg-green-700'>
              Join Debate
            </Button>
            <Button
              onClick={handleDismissDebateNotification}
              variant='outline'
              className='border-green-300 text-green-700 hover:bg-green-100'
            >
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  // Only show matchmaking controls to captain
  if (!isCaptain) {
    return debateNotification;
  }

  return (
    <>
      {debateNotification}
      <Card className='mb-6 border-primary'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FaSearch className='text-primary' />
            Team Matchmaking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {!hasJoined && !matchedTeam && (
            <div>
              <p className='text-sm text-muted-foreground mb-3'>
                {isTeamFull
                  ? 'Your team is ready! Join matchmaking to find an opponent.'
                  : `Your team needs ${
                      team.maxSize - team.members.length
                    } more member(s).`}
              </p>
              <Button
                onClick={handleJoinMatchmaking}
                disabled={isSearching || !isTeamFull}
                className='w-full'
              >
                <FaSearch className='mr-2' />
                {isSearching ? 'Joining...' : 'Find Match'}
              </Button>
            </div>
          )}

          {hasJoined && !matchedTeam && (
            <div>
              <div className='flex items-center gap-2 mb-3'>
                <FaClock className='animate-spin text-primary' />
                <Badge variant='secondary'>Searching for opponent...</Badge>
              </div>
              <p className='text-sm text-muted-foreground mb-3'>
                Looking for a team of similar skill level...
              </p>
              <Button
                onClick={handleLeaveMatchmaking}
                variant='outline'
                className='w-full'
              >
                Cancel Search
              </Button>
            </div>
          )}

          {matchedTeam && (
            <div>
              <div className='flex items-center gap-2 mb-3'>
                <FaCheckCircle className='text-green-500' />
                <Badge
                  variant='secondary'
                  className='bg-green-100 text-green-700'
                >
                  Match Found!
                </Badge>
              </div>
              <div className='p-4 bg-muted rounded-lg mb-3'>
                <h4 className='font-bold mb-2'>Opponent Team:</h4>
                <p className='font-medium'>{matchedTeam.name}</p>
                <div className='flex items-center gap-4 text-sm text-muted-foreground mt-2'>
                  <span>
                    <FaUsers className='inline mr-1' />
                    {matchedTeam.members.length} members
                  </span>
                  <span>Elo: {Math.round(matchedTeam.averageElo || 0)}</span>
                </div>
              </div>
              <Button onClick={handleCreateDebate} className='w-full'>
                <FaCheckCircle className='mr-2' />
                Start Debate
              </Button>
              <Button
                onClick={handleLeaveMatchmaking}
                variant='outline'
                className='w-full mt-2'
              >
                Cancel
              </Button>
            </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default TeamMatchmaking;
