import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div>ok</div>;
}

function Host() {
  const [shouldThrow, setShouldThrow] = useState(true);
  return (
    <ErrorBoundary onReset={() => setShouldThrow(false)}>
      <Bomb shouldThrow={shouldThrow} />
    </ErrorBoundary>
  );
}

describe('ErrorBoundary', () => {
  it('shows fallback when child throws and resets on retry', async () => {
    render(<Host />);
    // Fallback content
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();

    const button = screen.getByRole('button', { name: /try again/i });
    await userEvent.click(button);

    // After clicking retry host sets shouldThrow=false and child renders
    expect(screen.getByText('ok')).toBeTruthy();
  });
});
