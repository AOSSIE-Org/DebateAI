import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TeamMatchmaking from '../TeamMatchmaking';
import * as service from '@/services/teamDebateService';

vi.mock('@/services/teamDebateService', () => ({
  joinMatchmaking: vi.fn(),
  leaveMatchmaking: vi.fn(),
  getMatchmakingStatus: vi.fn(),
  createTeamDebate: vi.fn(),
  getActiveTeamDebate: vi.fn(),
}));
const api = vi.mocked(service);

const member = (id: string) => ({ userId: id, displayName: id, elo: 1200 });
const fullTeam = {
  id: 'team-1',
  name: 'Logic Lords',
  captainId: 'captain',
  captainEmail: 'cap@example.com',
  members: [member('captain'), member('m2')],
  maxSize: 2,
  averageElo: 1200,
};
const captain = { id: 'captain', email: 'cap@example.com', displayName: 'Cap' };

function renderTM(team = fullTeam, user: typeof captain | null = captain) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path='/' element={<TeamMatchmaking team={team} user={user} />} />
        <Route path='/team-debate/:id' element={<p>team debate page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const flush = () => act(async () => {});

describe('TeamMatchmaking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.getActiveTeamDebate.mockResolvedValue({ hasActiveDebate: false } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('hides the controls from non-captains', async () => {
    renderTM(fullTeam, { id: 'm2', email: 'm2@example.com', displayName: 'M2' });
    await flush();
    expect(screen.queryByText('Team Matchmaking')).toBeNull();
  });

  it('recognises the captain by email too', async () => {
    renderTM(fullTeam, { id: 'other-id', email: 'cap@example.com', displayName: 'Cap' });
    await flush();
    expect(screen.getByText('Team Matchmaking')).toBeInTheDocument();
  });

  it('blocks matchmaking until the team is full', async () => {
    renderTM({ ...fullTeam, members: [member('captain')] });
    await flush();
    expect(screen.getByText('Your team needs 1 more member(s).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find Match' })).toBeDisabled();
  });

  it('searches, finds a match and starts the debate', async () => {
    api.joinMatchmaking.mockResolvedValue(undefined as never);
    api.getMatchmakingStatus.mockResolvedValue({ matched: true, team: { ...fullTeam, id: 'team-2', averageElo: 1234.4 } } as never);
    api.createTeamDebate.mockResolvedValue({ id: 'debate-7' } as never);
    renderTM();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'Find Match' }));
    await flush();
    expect(api.joinMatchmaking).toHaveBeenCalledWith('team-1');
    expect(screen.getByText('Searching for opponent...')).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText('Match Found!')).toBeInTheDocument();
    expect(screen.getByText('Elo: 1234')).toBeInTheDocument();

    // Once created, the backend reports the debate as active for the team.
    api.getActiveTeamDebate.mockResolvedValue({ hasActiveDebate: true, debateId: 'debate-7' } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Start Debate' }));
    await flush();
    await flush();
    expect(api.createTeamDebate).toHaveBeenCalledWith('team-1', 'team-2', expect.any(String));
    expect(screen.getByText('Debate Ready!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Join Debate' }));
    expect(screen.getByText('team debate page')).toBeInTheDocument();
  });

  it('cancels a search', async () => {
    api.joinMatchmaking.mockResolvedValue(undefined as never);
    api.leaveMatchmaking.mockResolvedValue(undefined as never);
    renderTM();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Find Match' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Search' }));
    await flush();
    expect(api.leaveMatchmaking).toHaveBeenCalledWith('team-1');
    expect(screen.queryByText('Searching for opponent...')).toBeNull();
    // Regression: the button used to stay stuck on "Joining..." after cancelling.
    expect(screen.getByRole('button', { name: 'Find Match' })).toBeEnabled();
  });

  it('alerts when joining matchmaking fails', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    api.joinMatchmaking.mockRejectedValue(new Error('Already searching'));
    renderTM();
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Find Match' }));
    await flush();
    expect(alertMock).toHaveBeenCalledWith('Already searching');
    expect(screen.getByRole('button', { name: 'Find Match' })).toBeEnabled();
  });

  it('notifies every member about an active debate and allows dismissing', async () => {
    api.getActiveTeamDebate.mockResolvedValue({ hasActiveDebate: true, debateId: 'debate-3' } as never);
    renderTM(fullTeam, { id: 'm2', email: 'm2@example.com', displayName: 'M2' });
    await flush();
    expect(screen.getByText('Debate Ready!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Debate Ready!')).toBeNull();
  });
});
