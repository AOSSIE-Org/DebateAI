import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMatchmakingPool } from '@/services/teamDebateService';
import { FaUsers, FaClock, FaRedo, FaEye } from 'react-icons/fa';

interface TeamInPool {
  teamId: string;
  teamName: string;
  captainId: string;
  maxSize: number;
  averageElo: number;
  membersCount: number;
  timestamp: string;
}

interface PoolData {
  poolSize: number;
  teams?: TeamInPool[];
}

const MatchmakingPool: React.FC = () => {
  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPoolData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMatchmakingPool();
      setPoolData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pool data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchPoolData, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  const getEloColor = (elo: number) => {
    if (elo >= 1400) return 'text-green-600';
    if (elo >= 1200) return 'text-blue-600';
    if (elo >= 1000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSizeBadgeColor = (maxSize: number) => {
    return maxSize === 2
      ? 'bg-blue-100 text-blue-700'
      : 'bg-purple-100 text-purple-700';
  };

  return (
    <Card className='mb-6 border-orange-200'>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <FaUsers className='text-orange-500' />
            Matchmaking Pool
          </div>
          <div className='flex items-center gap-2'>
            <Badge
              variant='secondary'
              className='bg-orange-100 text-orange-700'
            >
              {poolData?.poolSize || 0} teams
            </Badge>
            <Button
              onClick={fetchPoolData}
              disabled={loading}
              size='sm'
              variant='outline'
            >
              <FaRedo className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className='text-red-600 text-sm mb-4 p-2 bg-red-50 rounded'>
            Error: {error}
          </div>
        )}

        {!poolData || !poolData.teams || poolData.teams.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            <FaEye className='w-8 h-8 mx-auto mb-2 opacity-50' />
            <p>No teams currently in matchmaking</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {poolData.teams.map((team) => (
              <div
                key={team.teamId}
                className='p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors'
              >
                <div className='flex items-center justify-between mb-2'>
                  <h4 className='font-semibold text-gray-900'>
                    {team.teamName}
                  </h4>
                  <div className='flex items-center gap-2 text-sm text-gray-500'>
                    <FaClock className='w-3 h-3' />
                    {formatTimeAgo(team.timestamp)}
                  </div>
                </div>

                <div className='flex items-center gap-4 text-sm'>
                  <div className='flex items-center gap-1'>
                    <span className='text-gray-600'>Elo:</span>
                    <span
                      className={`font-semibold ${getEloColor(
                        team.averageElo
                      )}`}
                    >
                      {Math.round(team.averageElo)}
                    </span>
                  </div>

                  <div className='flex items-center gap-1'>
                    <span className='text-gray-600'>Size:</span>
                    <Badge className={getSizeBadgeColor(team.maxSize)}>
                      {team.membersCount}/{team.maxSize}
                    </Badge>
                  </div>

                  <div className='flex items-center gap-1'>
                    <span className='text-gray-600'>Captain:</span>
                    <span className='font-mono text-xs bg-gray-200 px-1 rounded'>
                      {team.captainId.slice(-8)}
                    </span>
                  </div>
                </div>

                <div className='mt-2 text-xs text-gray-500'>
                  Team ID:{' '}
                  <span className='font-mono'>{team.teamId.slice(-12)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className='mt-4 pt-3 border-t text-xs text-gray-500'>
          <p>
            • Teams match when they have the same size and Elo difference ≤ 200
          </p>
          <p>• Pool updates every 5 seconds</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MatchmakingPool;
