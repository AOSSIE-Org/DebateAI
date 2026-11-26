import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Matchmaking from '../Matchmaking';
import { FakeWebSocket } from '../../test/fakeWebSocket';

const userState = vi.hoisted(() => ({
  value: { user: { id: 'me', displayName: 'Rounak', rating: 1350 } as unknown, isLoading: false },
}));
vi.mock('../../hooks/useUser', () => ({ useUser: () => userState.value }));

function renderMatchmaking() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path='/' element={<Matchmaking />} />
        <Route path='/login' element={<p>login page</p>} />
        <Route path='/debate-room/:id' element={<p>debate room page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const poolEntry = (overrides = {}) => ({
  userId: 'other',
  username: 'Asha',
  elo: 1300,
  minElo: 1100,
  maxElo: 1500,
  joinedAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
  startedMatchmaking: true,
  ...overrides,
});

describe('Matchmaking', () => {
  beforeEach(() => {
    FakeWebSocket.install();
    userState.value = { user: { id: 'me', displayName: 'Rounak', rating: 1350 }, isLoading: false };
    localStorage.setItem('token', 'tok');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('redirects to login without a token', () => {
    localStorage.removeItem('token');
    renderMatchmaking();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('redirects to login without a user', () => {
    userState.value = { user: null, isLoading: false };
    renderMatchmaking();
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('connects with the token and enables matchmaking once open', () => {
    renderMatchmaking();
    const ws = FakeWebSocket.latest();
    expect(ws.url).toMatch(/^ws.*\/ws\/matchmaking\?token=tok$/);
    expect(screen.getByRole('button', { name: 'Waiting for connection...' })).toBeDisabled();
    act(() => ws.open());
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('1350')).toBeInTheDocument();
  });

  it('joins and leaves the pool', async () => {
    renderMatchmaking();
    const ws = FakeWebSocket.latest();
    act(() => ws.open());
    await userEvent.click(screen.getByRole('button', { name: 'Start Matchmaking' }));
    expect(ws.sent).toContainEqual({ type: 'join_pool' });

    act(() => ws.receive({ type: 'matchmaking_started' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Search' }));
    expect(ws.sent).toContainEqual({ type: 'leave_pool' });

    act(() => ws.receive({ type: 'matchmaking_stopped' }));
    expect(screen.getByRole('button', { name: 'Start Matchmaking' })).toBeInTheDocument();
  });

  it('shows players from pool updates, including string payloads', () => {
    renderMatchmaking();
    const ws = FakeWebSocket.latest();
    act(() => ws.open());
    expect(screen.getByText('No players currently searching for matches')).toBeInTheDocument();
    act(() => ws.receive({ type: 'pool_update', pool: JSON.stringify([poolEntry()]) }));
    expect(screen.getByText('Players in Queue (1)')).toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('Elo: 1300 (Range: 1100-1500)')).toBeInTheDocument();
  });

  it('marks the user as searching when they appear in the pool', () => {
    renderMatchmaking();
    const ws = FakeWebSocket.latest();
    act(() => ws.open());
    act(() => ws.receive({ type: 'pool_update', pool: [poolEntry({ userId: 'me', username: 'Rounak' })] }));
    expect(screen.getByRole('button', { name: 'Cancel Search' })).toBeInTheDocument();
  });

  it('navigates to the room when a match is made', () => {
    renderMatchmaking();
    const ws = FakeWebSocket.latest();
    act(() => ws.open());
    act(() => ws.receive({ type: 'room_created', roomId: 'room-9' }));
    expect(ws.close).toHaveBeenCalled();
    expect(screen.getByText('debate room page')).toBeInTheDocument();
  });

  it('alerts on server errors', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderMatchmaking();
    const ws = FakeWebSocket.latest();
    act(() => ws.open());
    act(() => ws.receive({ type: 'error', error: 'Already in a room' }));
    expect(alertMock).toHaveBeenCalledWith('Matchmaking error: Already in a room');
  });

  it('counts wait time while searching', () => {
    vi.useFakeTimers();
    try {
      renderMatchmaking();
      const ws = FakeWebSocket.latest();
      act(() => ws.open());
      act(() => ws.receive({ type: 'matchmaking_started' }));
      for (let i = 0; i < 3; i++) act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByText('0:03')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
