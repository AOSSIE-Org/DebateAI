import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import CommentTree from '../CommentTree';
import { mockFetch } from '../../test/mockFetch';

const userState = vi.hoisted(() => ({ value: { user: { id: 'me' } as { id: string } | null } }));
vi.mock('../../hooks/useUser', () => ({ useUser: () => userState.value }));
vi.mock('../UserProfileModal', () => ({
  default: ({ userId, isOpen }: { userId: string; isOpen: boolean }) =>
    isOpen ? <div>profile modal for {userId}</div> : null,
}));

const comment = (id: string, userId: string, content: string, createdAt: string, parentId?: string) => ({
  id,
  transcriptId: 't1',
  userId,
  content,
  parentId,
  createdAt,
});

const profiles: Record<string, string> = { me: 'Rounak', other: 'Asha' };

function routes(getComments: () => unknown[], extra: Parameters<typeof mockFetch>[0] = []) {
  return mockFetch([
    ...extra,
    { match: '/comments/t1', method: 'GET', body: () => ({ comments: getComments() }) },
    ...Object.entries(profiles).map(([id, name]) => ({
      match: `/user/fetchprofile?userId=${id}`,
      body: { profile: { id, displayName: name } },
    })),
  ]);
}

function renderTree() {
  render(
    <Provider store={createStore()}>
      <CommentTree transcriptId='t1' />
    </Provider>
  );
}

describe('CommentTree', () => {
  beforeEach(() => {
    userState.value = { user: { id: 'me' } };
    localStorage.setItem('token', 'tok');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the empty state', async () => {
    routes(() => []);
    renderTree();
    expect(await screen.findByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
  });

  it('shows an error with a retry when loading fails', async () => {
    mockFetch([{ match: '/comments/t1', status: 500 }]);
    renderTree();
    expect(await screen.findByText('Failed to load comments')).toBeInTheDocument();
    routes(() => []);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
  });

  it('asks logged-out users to sign in', async () => {
    userState.value = { user: null };
    routes(() => []);
    renderTree();
    expect(await screen.findByText('Please log in to post comments')).toBeInTheDocument();
  });

  it('nests replies under their parent with author names', async () => {
    routes(() => [
      comment('c1', 'other', 'Root comment', '2026-10-01T10:00:00Z'),
      comment('c2', 'me', 'A reply', '2026-10-01T11:00:00Z', 'c1'),
    ]);
    renderTree();
    const root = await screen.findByText('Root comment');
    const reply = screen.getByText('A reply');
    // The reply is rendered inside the root comment's block.
    expect(root.closest('[style]')).toContainElement(reply);
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    expect(await screen.findByText('Rounak')).toBeInTheDocument();
  });

  it('only lets authors delete their own comments', async () => {
    routes(() => [
      comment('c1', 'other', 'Not mine', '2026-10-01T10:00:00Z'),
      comment('c2', 'me', 'Mine', '2026-10-01T11:00:00Z'),
    ]);
    renderTree();
    await screen.findByText('Mine');
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it('posts a new comment and reloads the list', async () => {
    let stored = [] as ReturnType<typeof comment>[];
    const fetchMock = routes(() => stored, [
      { match: /\/comments$/, method: 'POST', body: () => {
        stored = [comment('c9', 'me', 'Fresh take', '2026-10-02T10:00:00Z')];
        return {};
      } },
    ]);
    renderTree();
    const box = await screen.findByPlaceholderText('Write a comment...');
    expect(screen.getByRole('button', { name: 'Post Comment' })).toBeDisabled();
    await userEvent.type(box, '  Fresh take  ');
    await userEvent.click(screen.getByRole('button', { name: 'Post Comment' }));
    expect(await screen.findByText('Fresh take')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post![1]!.body as string)).toEqual({ transcriptId: 't1', content: 'Fresh take' });
    expect(box).toHaveValue('');
  });

  it('replies to a comment with its parent id', async () => {
    const fetchMock = routes(() => [comment('c1', 'other', 'Root comment', '2026-10-01T10:00:00Z')], [
      { match: /\/comments$/, method: 'POST', body: {} },
    ]);
    renderTree();
    await screen.findByText('Root comment');
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    await userEvent.type(screen.getByPlaceholderText('Write a reply...'), 'Counterpoint');
    await userEvent.click(screen.getByRole('button', { name: 'Post Reply' }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(JSON.parse(post![1]!.body as string)).toEqual({ transcriptId: 't1', parentId: 'c1', content: 'Counterpoint' });
    });
  });

  it('deletes a comment after confirmation', async () => {
    let stored = [comment('c2', 'me', 'Mine', '2026-10-01T11:00:00Z')];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    routes(() => stored, [
      { match: '/comments/c2', method: 'DELETE', body: () => {
        stored = [];
        return {};
      } },
    ]);
    renderTree();
    await screen.findByText('Mine');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
  });

  it('opens the author profile when the name is clicked', async () => {
    routes(() => [comment('c1', 'other', 'Root comment', '2026-10-01T10:00:00Z')]);
    renderTree();
    await userEvent.click(await screen.findByText('Asha'));
    expect(await screen.findByText('profile modal for other')).toBeInTheDocument();
  });
});
