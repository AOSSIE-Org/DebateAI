import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

const spinner = (container: HTMLElement) => container.querySelector('svg.animate-spin');

describe('LoadingSpinner', () => {
  it('renders a medium spinner by default', () => {
    const { container } = render(<LoadingSpinner />);
    expect(spinner(container)).toHaveClass('h-10', 'w-10');
    expect(container.querySelector('.min-h-screen')).toBeNull();
  });

  it('applies the requested size', () => {
    const { container } = render(<LoadingSpinner size='xl' />);
    expect(spinner(container)).toHaveClass('h-24', 'w-24');
  });

  it('renders a full-screen wrapper with a large spinner by default when fullScreen is set', () => {
    const { container } = render(<LoadingSpinner fullScreen />);
    expect(container.querySelector('.min-h-screen')).not.toBeNull();
    expect(spinner(container)).toHaveClass('h-16', 'w-16');
  });

  it('lets an explicit size override the full-screen default', () => {
    const { container } = render(<LoadingSpinner fullScreen size='sm' />);
    expect(spinner(container)).toHaveClass('h-6', 'w-6');
  });
});
