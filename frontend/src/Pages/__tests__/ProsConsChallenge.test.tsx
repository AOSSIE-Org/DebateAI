import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProsConsChallenge from '../ProsConsChallenge';
import { mockFetch } from '../../test/mockFetch';

const argument = (score: number) => ({ score, feedback: 'Good point.', counter: 'A counterpoint.' });

/**
 * Fills `submitted.pros` pros and `submitted.cons` cons, then submits.
 * `returned` is what the evaluation endpoint answers with (defaults to one
 * entry per submitted argument).
 */
async function submit(
  submitted: { pros: number; cons: number },
  returned: { pros: number[]; cons: number[] },
) {
  mockFetch([
    { match: '/coach/pros-cons/topic', body: { topic: 'Should homework be banned?' } },
    {
      match: '/coach/pros-cons/submit',
      method: 'POST',
      body: {
        pros: returned.pros.map(argument),
        cons: returned.cons.map(argument),
        score: [...returned.pros, ...returned.cons].reduce((sum, s) => sum + s, 0),
      },
    },
  ]);

  const user = userEvent.setup();
  render(<ProsConsChallenge />);
  await user.click(screen.getByRole('button', { name: 'Get Topic' }));
  for (let i = 0; i < submitted.pros; i++) {
    await user.type(screen.getByPlaceholderText(`Pro ${i + 1}`), `pro ${i + 1}`);
  }
  for (let i = 0; i < submitted.cons; i++) {
    await user.type(screen.getByPlaceholderText(`Con ${i + 1}`), `con ${i + 1}`);
  }
  await user.click(screen.getByRole('button', { name: 'Submit Arguments' }));
  return user;
}

describe('ProsConsChallenge final score', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
  });

  it('shows the score out of 10 per submitted argument', async () => {
    await submit({ pros: 1, cons: 1 }, { pros: [10], cons: [9] });
    expect(await screen.findByRole('heading', { name: 'Final Score: 19/20' })).toBeInTheDocument();
    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
  });

  it('shows /100 when all 5 pros and 5 cons are submitted', async () => {
    await submit({ pros: 5, cons: 5 }, { pros: [8, 7, 9, 6, 8], cons: [7, 8, 9, 7, 6] });
    expect(await screen.findByRole('heading', { name: 'Final Score: 75/100' })).toBeInTheDocument();
  });

  it('bases the maximum on what was submitted, not on how many entries the response has', async () => {
    await submit({ pros: 5, cons: 5 }, { pros: [10], cons: [9] });
    expect(await screen.findByRole('heading', { name: 'Final Score: 19/100' })).toBeInTheDocument();
  });

  it('starts a new challenge without keeping the previous maximum', async () => {
    const user = await submit({ pros: 5, cons: 5 }, { pros: [8, 7, 9, 6, 8], cons: [7, 8, 9, 7, 6] });
    await screen.findByRole('heading', { name: 'Final Score: 75/100' });
    await user.click(screen.getByRole('button', { name: 'Try Another Challenge' }));
    expect(screen.getByRole('button', { name: 'Get Topic' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Final Score/ })).not.toBeInTheDocument();
  });
});
