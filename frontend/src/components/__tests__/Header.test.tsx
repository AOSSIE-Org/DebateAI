import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Header from '../Header';
import { userAtom } from '@/state/userAtom';
import { AuthContext } from '@/context/authContext';
import * as notifications from '@/services/notificationService';

vi.mock('@/services/notificationService', () => ({
  getNotifications: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => <button type='button'>theme</button> }));
vi.mock('../ServerBadge', () => ({ default: () => <span>server badge</span> }));
const api = vi.mocked(notifications);

const note = (id: string, isRead: boolean, link?: string) => ({
  id,
  userId: 'me',
  type: 'system' as const,
  title: `Title ${id}`,
  message: `Message ${id}`,
  link,
  isRead,
  createdAt: '2026-10-01T00:00:00Z',
});

function renderHeader(path = '/', { loggedIn = true } = {}) {
  const store = createStore();
  if (loggedIn) {
    store.set(userAtom, { id: 'user-42', displayName: 'Rounak', email: 'r@example.com', rating: 1612.6 } as never);
  }
  const logout = vi.fn();
  render(
    <Provider store={store}>
      <AuthContext.Provider value={{ logout } as never}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path='*' element={<Header />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </Provider>
  );
  return { logout };
}

describe('Header', () => {
  beforeEach(() => {
    api.getNotifications.mockResolvedValue([]);
    api.markNotificationAsRead.mockResolvedValue(undefined as never);
    api.markAllNotificationsAsRead.mockResolvedValue(undefined as never);
    api.deleteNotification.mockResolvedValue(undefined as never);
  });

  it('builds breadcrumbs from the path with friendly labels', () => {
    renderHeader('/tournament/bot-selection');
    const crumbs = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByRole('link', { name: 'tournament' })).toHaveAttribute('href', '/tournaments');
    expect(within(crumbs).getByText('Bot Selection')).toBeInTheDocument();
  });

  it('labels the support page as Support DebateAI', () => {
    renderHeader('/support-os');
    expect(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByText('Support DebateAI')).toBeInTheDocument();
  });

  it('does not fetch notifications when logged out', () => {
    renderHeader('/', { loggedIn: false });
    expect(api.getNotifications).not.toHaveBeenCalled();
  });

  it('shows an empty notifications state', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });

  it('marks a notification read and follows its link', async () => {
    api.getNotifications.mockResolvedValue([note('n1', false, '/leaderboard')]);
    renderHeader();
    await vi.waitFor(() => expect(api.getNotifications).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    await userEvent.click(await screen.findByText('Title n1'));
    expect(api.markNotificationAsRead).toHaveBeenCalledWith('n1');
    expect(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByText('leaderboard')).toBeInTheDocument();
  });

  it('marks all notifications read', async () => {
    api.getNotifications.mockResolvedValue([note('n1', false), note('n2', false)]);
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
    expect(api.markAllNotificationsAsRead).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).toBeNull();
  });

  it('deletes a notification without opening it', async () => {
    api.getNotifications.mockResolvedValue([note('n1', true, '/leaderboard')]);
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    await screen.findByText('Title n1');
    await userEvent.click(screen.getByRole('button', { name: 'Delete notification' }));
    expect(api.deleteNotification).toHaveBeenCalledWith('n1');
    expect(screen.queryByText('Title n1')).toBeNull();
    expect(api.markNotificationAsRead).not.toHaveBeenCalled();
  });

  it('shows the user menu and signs out', async () => {
    const { logout } = renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Open user menu' }));
    expect(await screen.findByText('Rounak')).toBeInTheDocument();
    expect(screen.getByText('r@example.com')).toBeInTheDocument();
    expect(screen.getByText('1613')).toBeInTheDocument();
    expect(screen.getByText('user-42')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalled();
  });

  it('opens and closes the mobile drawer', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('link', { name: 'Team Debates' })).toHaveAttribute('href', '/team-builder');
    await userEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('link', { name: 'Team Debates' })).toBeNull();
  });

  it('closes the drawer after picking a link', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('link', { name: 'Leaderboard' }));
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
  });
});
