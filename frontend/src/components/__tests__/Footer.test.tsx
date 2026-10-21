import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );

describe('Footer', () => {
  it('renders the explore and legal navigation links', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Start Debate' })).toHaveAttribute('href', '/startDebate');
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute('href', '/leaderboard');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service');
  });

  it('opens social links in a new tab, except email', () => {
    renderFooter();
    const github = screen.getByRole('link', { name: 'Visit our GitHub' });
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');
    const email = screen.getByRole('link', { name: 'Visit our Email' });
    expect(email).toHaveAttribute('href', 'mailto:aossie.oss@gmail.com');
    expect(email).not.toHaveAttribute('target');
  });

  it('shows the current year in the copyright line', () => {
    renderFooter();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} DebateAI`))).toBeInTheDocument();
  });
});
