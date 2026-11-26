import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SpeechTranscripts from '../SpeechTranscripts';

const phaseCard = (title: string) => screen.getByText(title).closest('div.rounded-lg') as HTMLElement;

describe('SpeechTranscripts', () => {
  it('lists all eight debate phases with readable names', () => {
    render(<SpeechTranscripts transcripts={{}} currentPhase='setup' />);
    expect(screen.getByText('Opening Statement (For)')).toBeInTheDocument();
    expect(screen.getByText('Cross Examination - Answer (Against)')).toBeInTheDocument();
    expect(screen.getByText('Closing Statement (Against)')).toBeInTheDocument();
    expect(screen.getAllByText('No transcript available yet')).toHaveLength(8);
  });

  it('shows saved transcripts for each phase', () => {
    render(
      <SpeechTranscripts
        transcripts={{ openingFor: 'AI should be regulated.' }}
        currentPhase='closingFor'
      />
    );
    expect(within(phaseCard('Opening Statement (For)')).getByText('AI should be regulated.')).toBeInTheDocument();
  });

  it('marks the current phase and prefers the live transcript there', () => {
    render(
      <SpeechTranscripts
        transcripts={{ openingAgainst: 'old saved text' }}
        currentPhase='openingAgainst'
        liveTranscript='speaking right now'
      />
    );
    const card = phaseCard('Opening Statement (Against)');
    expect(within(card).getByText('Current')).toBeInTheDocument();
    expect(within(card).getByText('speaking right now')).toBeInTheDocument();
    expect(screen.queryByText('old saved text')).toBeNull();
    expect(screen.getAllByText('Current')).toHaveLength(1);
  });
});
