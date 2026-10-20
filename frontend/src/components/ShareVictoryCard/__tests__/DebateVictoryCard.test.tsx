import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DebateVictoryCard } from '../DebateVictoryCard';
import type { DebateVictoryCardData } from '../types';

const data = (overrides: Partial<DebateVictoryCardData> = {}): DebateVictoryCardData => ({
  topic: 'Should AI be regulated?',
  matchType: 'Online 1v1',
  winner: { name: 'Rounak', stance: 'For', score: 32, eloChange: 16 },
  opponent: { name: 'Asha', stance: 'Against', score: 24, eloChange: -16 },
  ...overrides,
});

describe('DebateVictoryCard', () => {
  it('shows the motion, match type, both players and scores', () => {
    render(<DebateVictoryCard data={data()} />);
    expect(screen.getByText('"Should AI be regulated?"')).toBeInTheDocument();
    expect(screen.getByText('Online 1v1')).toBeInTheDocument();
    expect(screen.getByText('WINNER')).toBeInTheDocument();
    expect(screen.getByText('Rounak')).toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('shows stances and Elo changes with the right sign', () => {
    render(<DebateVictoryCard data={data()} />);
    expect(screen.getByText('For')).toBeInTheDocument();
    expect(screen.getByText('Against')).toBeInTheDocument();
    expect(screen.getByText('+16 Elo')).toBeInTheDocument();
    expect(screen.getByText('-16 Elo')).toBeInTheDocument();
  });

  it('omits optional stance, Elo and verdict when not provided', () => {
    render(
      <DebateVictoryCard
        data={data({ winner: { name: 'Rounak' }, opponent: { name: 'Asha' } })}
      />
    );
    expect(screen.queryByText(/Elo$/)).toBeNull();
    expect(screen.queryByText('For')).toBeNull();
    // Missing scores default to 0.
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('truncates a long verdict reason to 120 characters', () => {
    const long = 'x'.repeat(200);
    render(<DebateVictoryCard data={data({ verdictReason: long })} />);
    expect(screen.getByText(`"${'x'.repeat(120)}…"`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp('x{121}'))).toBeNull();
  });

  it('shows a short verdict reason in full', () => {
    render(<DebateVictoryCard data={data({ verdictReason: 'Stronger evidence' })} />);
    expect(screen.getByText('"Stronger evidence"')).toBeInTheDocument();
  });

  it('falls back to a generated avatar and forwards the ref to the card root', () => {
    const ref = createRef<HTMLDivElement>();
    render(<DebateVictoryCard ref={ref} data={data()} />);
    expect(screen.getByRole('img', { name: 'Rounak' })).toHaveAttribute(
      'src',
      expect.stringContaining('api.dicebear.com')
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveStyle({ width: '1200px', height: '630px' });
  });

  it('uses the provided avatar when there is one', () => {
    render(
      <DebateVictoryCard
        data={data({ winner: { name: 'Rounak', avatarUrl: 'https://img.example/me.png' } })}
      />
    );
    expect(screen.getByRole('img', { name: 'Rounak' })).toHaveAttribute('src', 'https://img.example/me.png');
  });
});
