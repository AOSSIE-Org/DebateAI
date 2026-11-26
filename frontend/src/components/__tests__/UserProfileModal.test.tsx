import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserProfileModal from '../UserProfileModal';
import { mockFetch } from '../../test/mockFetch';

const userState = vi.hoisted(() => ({ value: { user: { id: 'me' } as { id: string } | null } }));
vi.mock('../../hooks/useUser', () => ({ useUser: () => userState.value }));

const profile = { id: 'target', displayName: 'Asha', email: 'asha@example.com', bio: 'Loves policy debates', rating: 1488.7 };

function defaultRoutes(overrides: Parameters<typeof mockFetch>[0] = []) {
  return mockFetch([
    ...overrides,
    { match: '/user/fetchprofile?userId=target', body: { profile } },
    { match: '/users/target/followers', body: { followers: [{ id: 'f1', displayName: 'Follower One' }] } },
    { match: '/users/target/following', body: { following: [] } },
    { match: '/users/me/following', body: { following: [] } },
  ]);
}

const renderModal = (props: Partial<React.ComponentProps<typeof UserProfileModal>> = {}) =>
  render(<UserProfileModal userId='target' isOpen onClose={vi.fn()} {...props} />);

describe('UserProfileModal', () => {
  beforeEach(() => {
    userState.value = { user: { id: 'me' } };
    localStorage.setItem('token', 'tok');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing when closed', () => {
    const fetchMock = defaultRoutes();
    const { container } = renderModal({ isOpen: false });
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the profile, followers and following', async () => {
    defaultRoutes();
    renderModal();
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('Loves policy debates')).toBeInTheDocument();
    expect(screen.getByText('Rating: 1489')).toBeInTheDocument();
    expect(await screen.findByText('Follower One')).toBeInTheDocument();
    expect(screen.getByText('Followers (1)')).toBeInTheDocument();
    expect(screen.getByText('Not following anyone yet')).toBeInTheDocument();
  });

  it('shows an error when the profile cannot be loaded', async () => {
    mockFetch([{ match: '/user/fetchprofile', status: 500, body: { error: 'boom' } }]);
    renderModal();
    expect(await screen.findByText('Failed to load profile')).toBeInTheDocument();
  });

  it('follows a user and refreshes followers', async () => {
    const fetchMock = defaultRoutes([{ match: '/users/target/follow', method: 'POST', body: {} }]);
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    expect(await screen.findByRole('button', { name: 'Following' })).toBeInTheDocument();
    const followCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/users/target/follow'));
    expect(followCall?.[1]?.method).toBe('POST');
  });

  it('shows Following when already following and unfollows with DELETE', async () => {
    const fetchMock = defaultRoutes([
      { match: '/users/me/following', body: { following: [{ id: 'target' }] } },
      { match: '/users/target/follow', method: 'DELETE', body: {} },
    ]);
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: 'Following' }));
    expect(await screen.findByRole('button', { name: 'Follow' })).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/users/target/follow'));
    expect(call?.[1]?.method).toBe('DELETE');
  });

  it('alerts with the server error when following fails', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    defaultRoutes([{ match: '/users/target/follow', method: 'POST', status: 400, body: { error: 'Cannot follow' } }]);
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Cannot follow'));
  });

  it('hides the follow button on your own profile', async () => {
    userState.value = { user: { id: 'target' } };
    defaultRoutes();
    renderModal();
    await screen.findByText('Asha');
    expect(screen.queryByRole('button', { name: /Follow/ })).toBeNull();
  });
});
