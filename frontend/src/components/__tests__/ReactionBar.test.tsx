import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { ReactionBar } from '../ReactionBar';
import { debateIdAtom } from '../../atoms/debateAtoms';

const sendMessage = vi.fn();
vi.mock('../../hooks/useDebateWS', () => ({
  useDebateWS: () => ({ sendMessage }),
}));

// spectatorHashAtom is derived from localStorage, so tests control it there.
function renderBar(debateId: string | null) {
  const store = createStore();
  store.set(debateIdAtom, debateId);
  return render(
    <Provider store={store}>
      <ReactionBar />
    </Provider>
  );
}

describe('ReactionBar', () => {
  beforeEach(() => sendMessage.mockReset());

  it('renders nothing outside a debate', () => {
    const { container } = renderBar(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows all reaction buttons in a debate', () => {
    renderBar('debate-1');
    expect(screen.getAllByRole('button', { name: /React with/ })).toHaveLength(8);
  });

  it('sends the reaction with the stored spectator hash', async () => {
    localStorage.setItem('spectatorHash', 'stored-hash');
    renderBar('debate-1');
    await userEvent.click(screen.getByRole('button', { name: 'React with 🔥' }));
    expect(sendMessage).toHaveBeenCalledWith(
      'reaction',
      expect.objectContaining({ reaction: '🔥', spectatorHash: 'stored-hash' })
    );
  });

  it('generates a spectator identity when none is stored', async () => {
    renderBar('debate-1');
    await userEvent.click(screen.getByRole('button', { name: 'React with 👍' }));
    expect(sendMessage).toHaveBeenCalledWith(
      'reaction',
      expect.objectContaining({ reaction: '👍', spectatorHash: expect.stringMatching(/^sp_/) })
    );
    expect(localStorage.getItem('spectatorHash')).toMatch(/^sp_/);
  });
});
