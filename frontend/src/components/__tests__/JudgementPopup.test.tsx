import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JudgmentPopup from '../JudgementPopup';

const s = (score: number, reason: string) => ({ score, reason });

const verdict = {
  winner: 'For',
  reason: 'Stronger evidence',
  congratulations: 'Well done',
  opponent_analysis: 'Against relied on anecdotes',
};

const userBotJudgment = (userScore = 8, userReason = 'clear and structured') => ({
  opening_statement: { user: s(userScore, `Opening ${userReason}`), bot: s(7, 'Bot opening fine') },
  cross_examination: { user: s(8, 'Good questions'), bot: s(6, 'Bot questions ok') },
  answers: { user: s(8, 'Direct answers'), bot: s(5, 'Bot answers vague') },
  closing: { user: s(8, 'Strong close'), bot: s(6, 'Bot close ok') },
  total: { user: 32, bot: 24 },
  verdict: { ...verdict, winner: 'You' },
});

const forAgainstJudgment = {
  opening_statement: { for: s(9, 'For opening'), against: s(6, 'Against opening') },
  cross_examination_questions: { for: s(8, 'For questions'), against: s(6, 'Against questions') },
  cross_examination_answers: { for: s(8, 'For answers'), against: s(7, 'Against answers') },
  closing: { for: s(9, 'For closing'), against: s(6, 'Against closing') },
  total: { for: 34, against: 25 },
  verdict,
};

function renderPopup(props: Partial<React.ComponentProps<typeof JudgmentPopup>> = {}) {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={['/debate']}>
      <Routes>
        <Route
          path='/debate'
          element={<JudgmentPopup judgment={userBotJudgment()} onClose={onClose} {...props} />}
        />
        <Route path='/startdebate' element={<p>start debate page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return onClose;
}

describe('JudgmentPopup', () => {
  it('renders a user-vs-bot judgment with each phase', () => {
    renderPopup({ botName: 'Socrates', userStance: 'For', botStance: 'Against' });
    expect(screen.getByRole('img', { name: 'You' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Socrates' })).toBeInTheDocument();
    expect(screen.getByText('Cross Examination')).toBeInTheDocument();
    expect(screen.queryByText('Cross Examination Questions')).toBeNull();
    expect(screen.getByText('Bot answers vague')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('You Wins!')).toBeInTheDocument();
    expect(screen.queryByText('Rating Impact')).toBeNull();
  });

  it('falls back to Bot / AI Opponent when no bot details are given', () => {
    renderPopup();
    expect(screen.getByRole('img', { name: 'Bot' })).toBeInTheDocument();
    expect(screen.getByText('AI Opponent')).toBeInTheDocument();
  });

  it('renders a for-vs-against judgment using the local player names', () => {
    renderPopup({
      judgment: forAgainstJudgment,
      localRole: 'against',
      localDisplayName: 'Rounak',
      opponentDisplayName: 'Asha',
    });
    expect(screen.getByRole('img', { name: 'Asha' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rounak' })).toBeInTheDocument();
    expect(screen.getByText('Cross Examination Questions')).toBeInTheDocument();
    expect(screen.getByText('Cross Examination Answers')).toBeInTheDocument();
    expect(screen.getByText('Against closing')).toBeInTheDocument();
    expect(screen.getByText('For Wins!')).toBeInTheDocument();
  });

  it('shows rating changes with signs for online debates', () => {
    renderPopup({
      judgment: forAgainstJudgment,
      forRole: 'Alice',
      againstRole: 'Bob',
      ratingSummary: { for: { rating: 1216.456, change: 16.4 }, against: { rating: 1183.5, change: -16.4 } },
    });
    expect(screen.getByText('Rating Impact')).toBeInTheDocument();
    expect(screen.getByText('1216.46')).toBeInTheDocument();
    expect(screen.getByText('Change: +16.40')).toBeInTheDocument();
    expect(screen.getByText('Change: -16.40')).toHaveClass('text-red-600');
  });

  it('recommends only the argument skill for a weak opening', () => {
    renderPopup({ judgment: userBotJudgment(4, 'weak') });
    expect(screen.getByText('Strengthen Argument')).toBeInTheDocument();
    expect(screen.queryByText('Pros and Cons Challenge')).toBeNull();
  });

  it('recommends both skills when nothing stands out', () => {
    renderPopup();
    expect(screen.getByText('Strengthen Argument')).toBeInTheDocument();
    expect(screen.getByText('Pros and Cons Challenge')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Start Now' });
    expect(links[0]).toHaveAttribute('target', '_blank');
    // Regression: these used to point at http://localhost:5173 in production.
    expect(links[0]).toHaveAttribute('href', '/coach/strengthen-argument');
    expect(links[1]).toHaveAttribute('href', '/coach/pros-cons');
  });

  it('closes and navigates home', async () => {
    const onClose = renderPopup();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(screen.getByText('start debate page')).toBeInTheDocument();
  });
});
