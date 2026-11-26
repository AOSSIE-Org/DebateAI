import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileHover from '../ProfileHover';

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

function renderHover(userId = 'user-1') {
  render(
    <ProfileHover userId={userId}>
      <button type='button'>Open profile</button>
    </ProfileHover>
  );
}

describe('ProfileHover', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches and shows the profile when opened', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ profile: { id: 'user-1', displayName: 'Rounak', email: 'r@example.com', rating: 1612.4, bio: 'Debater' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('token', 'tok');
    renderHover();

    await userEvent.click(screen.getByRole('button', { name: 'Open profile' }));

    expect(await screen.findByText('Rounak')).toBeInTheDocument();
    expect(screen.getByText('r@example.com')).toBeInTheDocument();
    expect(screen.getByText('Rating: 1612')).toBeInTheDocument();
    expect(screen.getByText('Debater')).toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/user/fetchprofile?userId=user-1');
    expect(options.headers.Authorization).toBe('Bearer tok');
  });

  it('shows an error when the profile belongs to a different user', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ profile: { id: 'someone-else', displayName: 'Wrong' } })));
    renderHover();
    await userEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(await screen.findByText('Failed to load profile')).toBeInTheDocument();
    expect(screen.queryByText('Wrong')).toBeNull();
  });

  it('shows an error when the request fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, false)));
    renderHover();
    await userEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(await screen.findByText('Failed to load profile')).toBeInTheDocument();
  });
});
