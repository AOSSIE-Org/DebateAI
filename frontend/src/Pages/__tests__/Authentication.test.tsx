import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Authentication from '../Authentication';
import { AuthProvider } from '../../context/authContext';

const renderAuthentication = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Authentication />
      </AuthProvider>
    </MemoryRouter>
  );

describe('Authentication brand', () => {
  it('shows the DebateAI wordmark in the left panel', () => {
    renderAuthentication();

    const brandLink = screen.getByRole('link', { name: 'DebateAI home' });
    expect(brandLink).toHaveTextContent('DebateAI');
  });

  it('renders the real DebateAI logo next to the wordmark', () => {
    renderAuthentication();

    const brandLink = screen.getByRole('link', { name: 'DebateAI home' });
    const logo = brandLink.querySelector('svg');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('viewBox', '502 386 1046 969');
  });

  it('never renders the legacy ArgueHub brand name', () => {
    renderAuthentication();

    expect(screen.queryByText(/arguehub/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/arguehub/i);
  });
});
