import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BadgeUnlocked from '../BadgeUnlocked';

// Confetti draws on a canvas, which jsdom does not support.
vi.mock('react-confetti', () => ({ default: () => <div data-testid='confetti' /> }));

describe('BadgeUnlocked', () => {
  it('shows the badge name and its description when open', () => {
    render(<BadgeUnlocked badgeName='FirstWin' isOpen onClose={vi.fn()} />);
    expect(screen.getByText('🎉 Badge Unlocked! 🎉')).toBeInTheDocument();
    expect(screen.getByText('FirstWin')).toBeInTheDocument();
    expect(screen.getByText('Congratulations on your first victory!')).toBeInTheDocument();
    expect(screen.getByTestId('confetti')).toBeInTheDocument();
  });

  it('renders valid HTML (no block elements inside the description <p>)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<BadgeUnlocked badgeName='FirstWin' isOpen onClose={vi.fn()} />);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/Congratulations on your first victory!/);
  });

  it('uses a generic description for unknown badges', () => {
    render(<BadgeUnlocked badgeName='MysteryBadge' isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Congratulations on earning this badge!')).toBeInTheDocument();
  });

  it('renders nothing visible when closed', () => {
    render(<BadgeUnlocked badgeName='Novice' isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('🎉 Badge Unlocked! 🎉')).toBeNull();
  });

  it('calls onClose from the Awesome button', async () => {
    const onClose = vi.fn();
    render(<BadgeUnlocked badgeName='Novice' isOpen onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Awesome!' }));
    expect(onClose).toHaveBeenCalled();
  });
});
