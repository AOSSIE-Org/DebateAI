import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChatRoom from '../ChatRoom';
import { FakeWebSocket } from '../../test/fakeWebSocket';

function renderRoom() {
  return render(
    <MemoryRouter initialEntries={['/chat/room-1']}>
      <Routes>
        <Route path='/chat/:roomId' element={<ChatRoom />} />
      </Routes>
    </MemoryRouter>
  );
}

async function join(name = 'Rounak') {
  await userEvent.type(screen.getByPlaceholderText('Enter username'), name);
  await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
  const ws = FakeWebSocket.latest();
  act(() => ws.open());
  return ws;
}

describe('ChatRoom', () => {
  beforeEach(() => {
    FakeWebSocket.install();
    localStorage.setItem('token', 'tok');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does not connect without a username or token', async () => {
    renderRoom();
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(FakeWebSocket.instances).toHaveLength(0);

    localStorage.removeItem('token');
    await userEvent.type(screen.getByPlaceholderText('Enter username'), 'Rounak');
    await userEvent.click(screen.getByRole('button', { name: 'Join Room' }));
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('joins the room over the chat socket', async () => {
    renderRoom();
    const ws = await join();
    expect(ws.url).toMatch(/\/chat\/room-1\?token=tok$/);
    expect(ws.sent[0]).toEqual({ type: 'join', room: 'room-1', username: 'Rounak' });
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('shows presence, chat and system messages', async () => {
    renderRoom();
    const ws = await join();
    act(() => {
      ws.receive({ type: 'presence', count: 4 });
      ws.receive({ type: 'chatMessage', username: 'Asha', content: 'Great point', timestamp: 1700000000 });
      ws.receive({ type: 'notification', content: 'Asha joined' });
    });
    expect(screen.getByText('4 users watching...')).toBeInTheDocument();
    expect(screen.getByText('Great point')).toBeInTheDocument();
    expect(screen.getByText('Asha joined')).toBeInTheDocument();
  });

  it('sends a chat message and shows it locally', async () => {
    renderRoom();
    const ws = await join();
    await userEvent.type(screen.getByPlaceholderText('Type a message...'), 'Hello all');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(ws.sent).toContainEqual({ type: 'chatMessage', content: 'Hello all' });
    expect(screen.getByText('Hello all')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message...')).toHaveValue('');
  });

  it('renders each reaction once without React key warnings', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderRoom();
    await join();
    for (const emoji of ['😂', '❤️', '👍']) {
      expect(screen.getAllByRole('button', { name: emoji })).toHaveLength(1);
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('sends reactions and animates incoming ones', async () => {
    renderRoom();
    const ws = await join();
    await userEvent.click(screen.getByRole('button', { name: '👍' }));
    expect(ws.sent).toContainEqual({ type: 'reaction', extra: { reaction: '👍' } });
    act(() => ws.receive({ type: 'reaction', extra: { reaction: '😂' } }));
    expect(screen.getAllByText('😂')).toHaveLength(2);
  });

  it('allows only one vote per user and counts others', async () => {
    renderRoom();
    const ws = await join();
    const voteFor = screen.getByRole('button', { name: /Vote FOR/ });
    await userEvent.click(voteFor);
    expect(ws.sent).toContainEqual({ type: 'vote', extra: { option: 'FOR' } });
    expect(voteFor).toBeDisabled();
    expect(screen.getByRole('button', { name: /Vote AGAINST/ })).toBeDisabled();
    act(() => ws.receive({ type: 'vote', extra: { option: 'AGAINST' } }));
    expect(screen.getByRole('button', { name: /Vote AGAINST/ })).toHaveTextContent('1');
    expect(voteFor).toHaveTextContent('1');
  });

  it('returns to the join form when the socket closes', async () => {
    renderRoom();
    const ws = await join();
    act(() => ws.onclose!({ code: 1000, reason: '' }));
    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
  });
});
