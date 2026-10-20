import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MatchmakingPool from '../MatchmakingPool';
import { getMatchmakingPool } from '@/services/teamDebateService';

vi.mock('@/services/teamDebateService', () => ({ getMatchmakingPool: vi.fn() }));
const getPool = vi.mocked(getMatchmakingPool);

describe('MatchmakingPool', () => {
  it('shows the empty state when no teams are waiting', async () => {
    getPool.mockResolvedValue({ poolSize: 0, teams: [] });
    render(<MatchmakingPool />);
    expect(await screen.findByText('No teams currently in matchmaking')).toBeInTheDocument();
    expect(screen.getByText('0 teams')).toBeInTheDocument();
  });

  it('lists waiting teams with Elo, size and wait time', async () => {
    getPool.mockResolvedValue({
      poolSize: 1,
      teams: [
        {
          teamId: 'team-0000000000001',
          teamName: 'Logic Lords',
          captainId: 'captain-12345678',
          maxSize: 2,
          averageElo: 1250.6,
          membersCount: 2,
          timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
        },
      ],
    });
    render(<MatchmakingPool />);
    expect(await screen.findByText('Logic Lords')).toBeInTheDocument();
    expect(screen.getByText('1 teams')).toBeInTheDocument();
    expect(screen.getByText('1251')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('3m ago')).toBeInTheDocument();
    expect(screen.getByText('12345678')).toBeInTheDocument();
  });

  it('shows an error when the pool request fails', async () => {
    getPool.mockRejectedValue(new Error('Network down'));
    render(<MatchmakingPool />);
    expect(await screen.findByText('Error: Network down')).toBeInTheDocument();
  });
});
