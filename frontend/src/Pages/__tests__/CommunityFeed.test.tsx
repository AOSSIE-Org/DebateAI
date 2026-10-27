import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommunityFeed from '../CommunityFeed';
import { mockFetch } from '../../test/mockFetch';

const userState = vi.hoisted(() => ({
  value: { user: { id: 'me' } as { id: string } | null },
}));
vi.mock('../../hooks/useUser', () => ({ useUser: () => userState.value }));

const post = {
  id: 'p1',
  transcriptId: 't1',
  userId: 'other',
  email: 'other@debateai.dev',
  displayName: 'Asha Menon',
  topic: 'Should AI debates be ranked?',
  debateType: 'Competitive',
  opponent: 'Ava (Bot)',
  result: 'win',
  commentCount: 1,
  createdAt: '2026-10-20T09:30:00.000Z',
};

describe('CommunityFeed', () => {
  it('renders the comment form with theme-aware colours', async () => {
    localStorage.setItem('token', 'tok');
    mockFetch([
      { match: '/posts/feed', body: { posts: [post] } },
      { match: '/comments/t1', body: { comments: [] } },
      { match: '/following', body: { following: [] } },
      { match: '/user/fetchprofile', body: { profile: { id: 'other', displayName: 'Asha Menon' } } },
    ]);

    render(<CommunityFeed />);
    expect(await screen.findByText('Community Feed')).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: '1' }));

    const textarea = await screen.findByPlaceholderText('Write a comment...');
    expect(textarea).toHaveClass('bg-background', 'text-foreground', 'border-input');
    expect(textarea).not.toHaveClass('bg-white', 'text-gray-900');

    const form = textarea.closest('div.mb-6');
    expect(form).toHaveClass('bg-background', 'border-border');
    expect(form).not.toHaveClass('bg-white', 'border-gray-200');
  });
});
