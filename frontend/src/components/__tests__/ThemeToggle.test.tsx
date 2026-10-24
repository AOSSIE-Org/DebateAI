import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';
import { ThemeContext, ThemeOptions } from '../../context/theme-provider';

function renderWithTheme(theme: ThemeOptions, toggleTheme = vi.fn()) {
  render(
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ThemeToggle />
    </ThemeContext.Provider>
  );
  return toggleTheme;
}

describe('ThemeToggle', () => {
  it('shows the current theme', () => {
    renderWithTheme(ThemeOptions.Dark);
    expect(screen.getByRole('button', { name: /Theme:\s*Dark/ })).toBeInTheDocument();
  });

  it('opens the options list and closes on an outside click', async () => {
    renderWithTheme(ThemeOptions.Light);
    expect(screen.queryByRole('button', { name: 'High Contrast' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Theme:/ }));
    expect(screen.getByRole('button', { name: 'High Contrast' })).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole('button', { name: 'High Contrast' })).toBeNull();
  });

  it('keeps the trigger and option labels on a single line', async () => {
    renderWithTheme(ThemeOptions.Contrast);
    const trigger = screen.getByRole('button', { name: /Theme:\s*High Contrast/ });
    expect(trigger).toHaveClass('whitespace-nowrap');
    await userEvent.click(trigger);
    const option = screen.getByRole('button', { name: 'High Contrast' });
    expect(option).toHaveClass('whitespace-nowrap');
    expect(option.parentElement).toHaveClass('min-w-max');
  });

  it('applies hover styles that use the theme tokens', async () => {
    renderWithTheme(ThemeOptions.Contrast);
    const trigger = screen.getByRole('button', { name: /Theme:/ });
    expect(trigger).toHaveClass('hover:bg-muted');
    await userEvent.click(trigger);
    for (const name of ['Light', 'Dark', 'High Contrast']) {
      expect(screen.getByRole('button', { name })).toHaveClass(
        'hover:bg-accent',
        'hover:text-accent-foreground'
      );
    }
  });

  it.each([
    [ThemeOptions.Light, 'Dark', 1],
    [ThemeOptions.Light, 'High Contrast', 2],
    [ThemeOptions.Contrast, 'Light', 1],
    [ThemeOptions.Dark, 'Dark', 0],
  ])('from theme %s, choosing %s cycles toggleTheme %i time(s)', async (current, target, clicks) => {
    const toggleTheme = renderWithTheme(current);
    await userEvent.click(screen.getByRole('button', { name: /Theme:/ }));
    await userEvent.click(screen.getByRole('button', { name: target }));
    expect(toggleTheme).toHaveBeenCalledTimes(clicks);
  });
});
