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
