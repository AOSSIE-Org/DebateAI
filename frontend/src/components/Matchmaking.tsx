import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from 'react-avatar';
import { useUser } from '../hooks/useUser';
import { useToast } from '@/hooks/use-toast';

interface MatchmakingPool {
  userId: string;
  username: string;
  elo: number;
  minElo: number;
  maxElo: number;
  joinedAt: string;
  lastActivity: string;
  startedMatchmaking: boolean;
}

interface MatchmakingMessage {
  type: string;
  userId?: string;
  username?: string;
  elo?: number;
  roomId?: string;
  pool?: MatchmakingPool[] | string;
  error?: string;
}

const Matchmaking: React.FC = () => {
  const [pool, setPool] = useState<MatchmakingPool[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isInPool, setIsInPool] = useState(false);
  const [waitTime, setWaitTime] = useState(0);
  const { user, isLoading } = useUser();
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // If still loading, wait
    if (isLoading) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }


    // Connect to WebSocket with authentication token
    const ws = new WebSocket(
      `ws://localhost:1313/ws/matchmaking?token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: MatchmakingMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'pool_update':
            if (message.pool) {
              const poolData: MatchmakingPool[] = Array.isArray(message.pool)
                ? message.pool
                : JSON.parse(message.pool as string);
              setPool(poolData);

              // Check if current user is in pool (only if they've started matchmaking)
              const currentUser = poolData.find(
                (p) => p.userId === user.id || p.username === user.displayName
              );
              const shouldBeInPool =
                !!currentUser && currentUser.startedMatchmaking;
              setIsInPool(shouldBeInPool);
            }
            break;

          case 'room_created':
            if (message.roomId) {
              // Navigate to the created room
              ws.close(); // Close connection before navigating
              navigate(`/debate-room/${message.roomId}`);
            }
            break;

          case 'matchmaking_started':
            setIsInPool(true);
            setWaitTime(0);
            break;

          case 'matchmaking_stopped':
            setIsInPool(false);
            setWaitTime(0);
            break;

          case 'error':
            toast({
              variant: "destructive",
              title: "Matchmaking Error",
              description: message.error,
            });
            break;

          default:
        }
      } catch (error) {
      }
    };

    ws.onclose = (event) => {
      console.warn(
        '🔌 Disconnected from matchmaking WebSocket:',
        event.code,
        event.reason
      );
      setIsConnected(false);
      setIsInPool(false);
      // Don't set wsRef.current = null here, let the cleanup handle it
    };

    ws.onerror = (error) => {
      console.error('Matchmaking WebSocket error', error);
      setIsConnected(false);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [navigate, user?.id, user?.displayName, isLoading]);

  const joinPool = () => {

    // Try to send regardless of state tracking, since state might be delayed
    if (!wsRef.current) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Connection not available. Please refresh the page and try again.",
      });
      return;
    }

    const readyState = wsRef.current.readyState;

    if (readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({ type: 'join_pool' });
        wsRef.current.send(message);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send matchmaking request. Please try again.",
        });
      }
    } else if (readyState === WebSocket.CONNECTING) {
      // Wait a bit and try again
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'join_pool' }));
        } else {
          toast({
            variant: "destructive",
            title: "Connection Timeout",
            description: "Connection is taking too long. Please check your internet connection and try again.",
          });
        }
      }, 1000);
    } else {
      toast({
        variant: "destructive",
        title: "Connection Not Ready",
        description: "Connection is not ready. Please ensure the green indicator is showing.",
      });
    }
  };

  const leavePool = () => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || isConnected)
    ) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'leave_pool' }));
      } catch (error) {
      }
    }
  };

  const updateActivity = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update_activity' }));
    }
  };

  // Update activity every 30 seconds
  useEffect(() => {
    if (isInPool) {
      const interval = setInterval(updateActivity, 30000);
      return () => clearInterval(interval);
    }
  }, [isInPool]);

  // Update wait time
  useEffect(() => {
    if (isInPool) {
      const interval = setInterval(() => {
        setWaitTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setWaitTime(0);
    }
  }, [isInPool]);

  const formatWaitTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading state while auth is loading
  if (isLoading || !user) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h2 className='text-2xl font-bold text-foreground'>
          Online Matchmaking
        </h2>
        <div className='flex items-center gap-4'>
          <div className='text-sm text-muted-foreground'>
            Your Elo:{' '}
            <span className='font-semibold text-foreground'>
              {user?.rating || 1200}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <div
              className={`w-3 h-3 rounded-full animate-pulse ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
              title={isConnected ? 'Connected' : 'Not connected'}
            ></div>
            <span className='text-xs text-muted-foreground'>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Matchmaking Controls */}
      <div className='bg-popover p-4 rounded-lg mb-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-semibold text-foreground mb-2'>
              Find a Debate Partner
            </h3>
            <p className='text-sm text-muted-foreground'>
              Join the matchmaking pool to find opponents with similar Elo
              ratings
            </p>
          </div>

          {isInPool ? (
            <div className='text-center'>
              <div className='text-2xl font-bold text-primary mb-1'>
                {formatWaitTime(waitTime)}
              </div>
              <div className='text-sm text-muted-foreground'>Searching...</div>
              <button
                onClick={leavePool}
                className='mt-2 bg-destructive text-destructive-foreground px-4 py-2 rounded hover:bg-destructive/90 transition'
              >
                Cancel Search
              </button>
            </div>
          ) : (
            <button
              onClick={joinPool}
              disabled={!isConnected}
              className='bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isConnected ? 'Start Matchmaking' : 'Waiting for connection...'}
            </button>
          )}
        </div>
      </div>

      {/* Matchmaking Pool */}
      <div className='bg-popover p-4 rounded-lg'>
        <h3 className='text-lg font-semibold text-foreground mb-4'>
          Players in Queue ({pool.length})
        </h3>

        {pool.length === 0 ? (
          <p className='text-center text-muted-foreground py-8'>
            No players currently searching for matches
          </p>
        ) : (
          <div className='grid gap-3'>
            {pool.map((player) => (
              <div
                key={player.userId}
                className='flex items-center justify-between p-3 bg-background rounded-lg border'
              >
                <div className='flex items-center gap-3'>
                  <Avatar
                    name={player.username}
                    size='40'
                    round
                    className='border-2 border-border'
                  />
                  <div>
                    <div className='font-medium text-foreground'>
                      {player.username}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Elo: {player.elo} (Range: {player.minElo}-{player.maxElo})
                    </div>
                  </div>
                </div>

                <div className='text-right'>
                  <div className='text-sm text-muted-foreground'>
                    Searching:{' '}
                    {formatWaitTime(
                      Math.floor(
                        (Date.now() - new Date(player.joinedAt).getTime()) /
                          1000
                      )
                    )}
                  </div>
                  {player.userId === user?.id && (
                    <div className='text-xs text-primary font-medium'>You</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matchmaking Info */}
      <div className='mt-6 p-4 bg-muted rounded-lg'>
        <h4 className='font-semibold text-foreground mb-2'>
          How Matchmaking Works
        </h4>
        <ul className='text-sm text-muted-foreground space-y-1'>
          <li>• Click "Start Matchmaking" to join the search queue</li>
          <li>
            • Players are matched based on Elo rating similarity (±200 points by
            default)
          </li>
          <li>
            • Wait time is considered to prioritize players who have been
            searching longer
          </li>
          <li>
            • Matches are created automatically when compatible opponents are
            found
          </li>
          <li>
            • You'll be automatically redirected to the debate room when matched
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Matchmaking;
