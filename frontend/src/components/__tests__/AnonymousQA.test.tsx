import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { AnonymousQA } from '../AnonymousQA';
import { debateIdAtom, questionsAtom, transcriptAtom } from '../../atoms/debateAtoms';

const sendMessage = vi.fn();
vi.mock('../../hooks/useDebateWS', () => ({
  useDebateWS: () => ({ sendMessage }),
}));

type Question = { qId: string; text: string; spectatorHash: string; timestamp: number };

function renderQA({
  debateId = 'debate-1' as string | null,
  transcript = '',
  questions = [] as Question[],
} = {}) {
  const store = createStore();
  store.set(debateIdAtom, debateId);
  store.set(transcriptAtom, transcript);
  store.set(questionsAtom, questions as never);
  return render(
    <Provider store={store}>
      <AnonymousQA />
    </Provider>
  );
}

describe('AnonymousQA', () => {
  beforeEach(() => sendMessage.mockReset());

  it('renders nothing outside a debate', () => {
    const { container } = renderQA({ debateId: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an empty state and disables Send for blank input', () => {
    renderQA();
    expect(screen.getByText('No questions yet. Be the first to ask!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('sends the question and clears the input', async () => {
    localStorage.setItem('spectatorHash', 'hash-1');
    renderQA();
    const input = screen.getByPlaceholderText('Type your question...');
    await userEvent.type(input, '  Why regulate AI?  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(sendMessage).toHaveBeenCalledWith(
      'question',
      expect.objectContaining({ text: 'Why regulate AI?', spectatorHash: 'hash-1' })
    );
    expect(input).toHaveValue('');
  });

  it('lists recent questions with the newest first', () => {
    renderQA({
      questions: [
        { qId: 'q1', text: 'First question', spectatorHash: 'a', timestamp: 1 },
        { qId: 'q2', text: 'Second question', spectatorHash: 'b', timestamp: 2 },
      ],
    });
    expect(screen.getByText('Recent Questions (2)')).toBeInTheDocument();
    const texts = screen.getAllByText(/question$/).map((el) => el.textContent);
    expect(texts).toEqual(['Second question', 'First question']);
  });

  it('suggests matching transcript sentences and fills the input on click', async () => {
    renderQA({
      transcript: 'Regulation protects user privacy online. Cricket is a team sport played worldwide.',
    });
    const input = screen.getByPlaceholderText('Type your question...');
    await userEvent.type(input, 'privacy');
    const suggestion = await screen.findByRole('button', { name: 'Regulation protects user privacy online.' });
    await userEvent.click(suggestion);
    expect(input).toHaveValue('Regulation protects user privacy online.');
  });
});
