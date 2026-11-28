import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../Profile';
import { getProfile } from '@/services/profileService';
import { transcriptService } from '@/services/transcriptService';

vi.mock('@/services/profileService', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  checkDisplayNameAvailability: vi.fn(),
}));
vi.mock('@/services/transcriptService', () => ({
  transcriptService: { getTranscriptById: vi.fn() },
}));
vi.mock('../../hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('../../components/SavedTranscripts', () => ({ default: () => null }));
vi.mock('../../components/AvatarModal', () => ({ default: () => null }));

const recentDebate = (eloChange: number) => ({
  id: 't1',
  topic: 'Should social media be regulated?',
  result: 'win',
  opponent: 'Socrates Bot',
  debateType: 'user_vs_bot',
  date: '2026-11-24T10:00:00Z',
  eloChange,
});

function mockProfile(eloChange: number) {
  vi.mocked(getProfile).mockResolvedValue({
    profile: { id: 'u1', displayName: 'Demo', email: 'demo@example.com', bio: '', rating: 1500, avatarUrl: '' },
    leaderboard: [],
    stats: {
      wins: 1, losses: 0, draws: 0, winRate: 100, totalDebates: 1,
      eloHistory: [], debateHistory: [], recentDebates: [recentDebate(eloChange)],
    },
  });
  vi.mocked(transcriptService.getTranscriptById).mockResolvedValue({
    id: 't1', userId: 'u1', email: 'demo@example.com', debateType: 'user_vs_bot',
    topic: 'Should social media be regulated?', opponent: 'Socrates Bot', result: 'win',
    messages: [], createdAt: '2026-11-24T10:00:00Z', updatedAt: '2026-11-24T10:00:00Z',
  });
}

async function openDebateDetails() {
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );
  await userEvent.click(await screen.findByText('Should social media be regulated?'));
  return screen.findByRole('dialog');
}

describe('Profile Debate Details dialog', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
  });

  it('shows a readable debate type and no stray 0 when the Elo change is 0', async () => {
    mockProfile(0);
    const dialog = await openDebateDetails();

    expect(within(dialog).getByText('User vs Bot')).toBeInTheDocument();
    expect(within(dialog).queryByText(/vs_bot/i)).not.toBeInTheDocument();

    const summary = within(dialog).getByText(/This debate was a/);
    expect(summary).toHaveTextContent(
      'This debate was a User vs Bot debate about "Should social media be regulated?" against Socrates Bot. The result was a win.'
    );
    expect(summary.textContent?.trim().endsWith('win.')).toBe(true);
  });

  it('still shows the Elo sentence when the change is non-zero', async () => {
    mockProfile(12);
    const dialog = await openDebateDetails();
    expect(within(dialog).getByText(/This debate was a/)).toHaveTextContent('Your Elo rating changed by +12.');
  });
});
