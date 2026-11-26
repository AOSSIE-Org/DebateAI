import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ServerBadge from '../ServerBadge';

const SERVER_KEY = 'debateai:server';

describe('ServerBadge', () => {
  it('renders nothing when using the official server', () => {
    const { container } = render(<ServerBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the custom server host', () => {
    localStorage.setItem(SERVER_KEY, 'https://my-backend.example.com');
    render(<ServerBadge />);
    expect(screen.getByText('Custom server: my-backend.example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use official server' })).toBeInTheDocument();
  });

  it('warns when the stored custom server is invalid', () => {
    localStorage.setItem(SERVER_KEY, 'not a url');
    render(<ServerBadge />);
    expect(screen.getByText('Invalid server URL')).toBeInTheDocument();
  });
});
