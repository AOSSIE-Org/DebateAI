import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import Timer from '../Timer';

describe('Timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('formats the initial time as mm:ss', () => {
    render(<Timer initialTime={125} />);
    expect(screen.getByText('02:05')).toBeInTheDocument();
    expect(screen.getByText('Time Remaining')).toBeInTheDocument();
  });

  it('counts down once per second', () => {
    render(<Timer initialTime={3} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('00:02')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('stops at zero instead of going negative', () => {
    render(<Timer initialTime={1} />);
    // Advance one tick at a time so React re-renders between ticks, as in a browser.
    for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('restarts from a new initialTime prop', () => {
    const { rerender } = render(<Timer initialTime={10} />);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('00:07')).toBeInTheDocument();
    rerender(<Timer initialTime={60} />);
    expect(screen.getByText('01:00')).toBeInTheDocument();
  });
});
