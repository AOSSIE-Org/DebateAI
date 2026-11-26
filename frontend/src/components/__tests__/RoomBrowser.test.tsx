import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomBrowser from '../RoomBrowser';

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

function renderBrowser() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path='/' element={<RoomBrowser />} />
        <Route path='/debate-room/:id' element={<p>debate room page</p>} />
        <Route path='/view-debate/:id' element={<p>spectator page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

const rooms = [
  { id: 'room-a', type: 'public', participants: [{ id: '1', username: 'a', elo: 1200 }, { id: '2', username: 'b', elo: 1301 }] },
  { id: 'room-b', type: 'private', participants: null },
];

describe('RoomBrowser', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the empty state when there are no rooms', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));
    renderBrowser();
    expect(await screen.findByText('No rooms available at the moment.')).toBeInTheDocument();
  });

  it('lists rooms with member count and average Elo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(rooms)));
    renderBrowser();
    expect(await screen.findByText('room-a')).toBeInTheDocument();
    expect(screen.getByText('PUBLIC')).toBeInTheDocument();
    expect(screen.getByText('1251')).toBeInTheDocument();
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('joins a room and navigates to it', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(rooms)).mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    renderBrowser();
    await screen.findByText('room-a');
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Match' })[0]);
    expect(await screen.findByText('debate room page')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toContain('/rooms/room-a/join');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });

  it('alerts and stays put when joining fails', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(rooms)).mockResolvedValueOnce(jsonResponse({}, false)));
    renderBrowser();
    await screen.findByText('room-a');
    await userEvent.click(screen.getAllByRole('button', { name: 'Join Match' })[0]);
    expect(alertMock).toHaveBeenCalledWith('Failed to join room room-a.');
    expect(screen.queryByText('debate room page')).toBeNull();
  });

  it('opens spectator mode with View Debate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(rooms)));
    renderBrowser();
    await screen.findByText('room-a');
    await userEvent.click(screen.getAllByRole('button', { name: 'View Debate' })[1]);
    expect(await screen.findByText('spectator page')).toBeInTheDocument();
  });
});
