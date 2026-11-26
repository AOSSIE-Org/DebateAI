import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerCard from '../PlayerCard';

describe('PlayerCard', () => {
  it('shows the player name and rating', () => {
    render(<PlayerCard isUser={false} isTurn={false} />);
    expect(screen.getByText('Sofia Dev')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('hides camera and mic controls for the opponent', () => {
    render(<PlayerCard isUser={false} isTurn={false} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('toggles camera and mic for the local user', async () => {
    const setCameraOn = vi.fn();
    const setMicOn = vi.fn();
    render(<PlayerCard isUser isTurn={false} setCameraOn={setCameraOn} setMicOn={setMicOn} />);
    const [cameraButton, micButton] = screen.getAllByRole('button');
    await userEvent.click(cameraButton);
    await userEvent.click(micButton);
    expect(setCameraOn).toHaveBeenCalledTimes(1);
    expect(setMicOn).toHaveBeenCalledTimes(1);
    // The setters receive an updater that flips the previous value.
    const flip = setCameraOn.mock.calls[0][0] as (prev: boolean) => boolean;
    expect(flip(true)).toBe(false);
  });

  it('shows the turn duration on the timer only during the player\'s turn', () => {
    const { rerender } = render(<PlayerCard isUser={false} isTurn turnDuration={90} />);
    expect(screen.getByText('01:30')).toBeInTheDocument();
    rerender(<PlayerCard isUser={false} isTurn={false} turnDuration={90} />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});
