import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProsConsChallenge from '../ProsConsChallenge';
import { mockFetch } from '../../test/mockFetch';

const argument = (score: number) => ({ score, feedback: 'Good point.', counter: 'A counterpoint.' });

async function submit(pros: number[], cons: number[]) {
  mockFetch([
    { match: '/coach/pros-cons/topic', body: { topic: 'Should homework be banned?' } },
    {
      match: '/coach/pros-cons/submit',
      method: 'POST',
      body: {
        pros: pros.map(argument),
        cons: cons.map(argument),
        score: [...pros, ...cons].reduce((sum, s) => sum + s, 0),
      },
    },
  ]);

  const user = userEvent.setup();
  render(<ProsConsChallenge />);
  await user.click(screen.getByRole('button', { name: 'Get Topic' }));
  for (let i = 0; i < pros.length; i++) {
    await user.type(screen.getByPlaceholderText(`Pro ${i + 1}`), `pro ${i + 1}`);
  }
  for (let i = 0; i < cons.length; i++) {
    await user.type(screen.getByPlaceholderText(`Con ${i + 1}`), `con ${i + 1}`);
  }
  await user.click(screen.getByRole('button', { name: 'Submit Arguments' }));
}

describe('ProsConsChallenge final score', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
  });

  it('shows the score out of 10 per submitted argument', async () => {
    await submit([10], [9]);
    expect(await screen.findByRole('heading', { name: 'Final Score: 19/20' })).toBeInTheDocument();
    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
  });

  it('shows /100 only when all 5 pros and 5 cons are submitted', async () => {
    await submit([8, 7, 9, 6, 8], [7, 8, 9, 7, 6]);
    expect(await screen.findByRole('heading', { name: 'Final Score: 75/100' })).toBeInTheDocument();
  });
});
