import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DebatePopup from '../DebatePopup';

vi.mock('../RoomBrowser', () => ({ default: () => <div>room browser</div> }));
vi.mock('../Matchmaking', () => ({ default: () => <div>matchmaking panel</div> }));

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 400, json: async () => body }) as Response;

function renderPopup(onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path='/' element={<DebatePopup onClose={onClose} />} />
        <Route path='/debate-room/:id' element={<p>debate room page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return onClose;
}

describe('DebatePopup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('switches between the create, join and matchmaking tabs', async () => {
    renderPopup();
    expect(screen.getByText('Create a Debate')).toBeInTheDocument();
    expect(screen.getByText('room browser')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Join Room' })[0]);
    expect(screen.getByPlaceholderText('Enter Room Code')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Matchmaking/ }));
    expect(screen.getByText('matchmaking panel')).toBeInTheDocument();
    expect(screen.queryByText('room browser')).toBeNull();
  });

  it('creates a room, navigates to it and closes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'new-room' }));
    vi.stubGlobal('fetch', fetchMock);
    const onClose = renderPopup();
    await userEvent.click(screen.getAllByRole('button', { name: 'Create Room' })[1]);
    expect(await screen.findByText('debate room page')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: 'public' });
  });

  it('joins a room by trimmed code', async () => {
    localStorage.setItem('token', 'tok');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    renderPopup();
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Room' })[0]);
    await userEvent.type(screen.getByPlaceholderText('Enter Room Code'), '  abc123  ');
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Room' })[1]);
    expect(await screen.findByText('debate room page')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toContain('/rooms/abc123/join');
  });

  it('asks the user to sign in when there is no token', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderPopup();
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Room' })[0]);
    await userEvent.type(screen.getByPlaceholderText('Enter Room Code'), 'abc');
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Room' })[1]);
    expect(alertMock).toHaveBeenCalledWith('Please sign in again.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the server error when joining fails', async () => {
    localStorage.setItem('token', 'tok');
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Room is full' }, false)));
    renderPopup();
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Room' })[0]);
    await userEvent.type(screen.getByPlaceholderText('Enter Room Code'), 'abc');
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Room' })[1]);
    expect(alertMock).toHaveBeenCalledWith('Room is full');
  });
});
