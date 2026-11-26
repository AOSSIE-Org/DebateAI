import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

const renderAt = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  );

describe('Sidebar', () => {
  it.each([
    ['Start Debate', '/startDebate'],
    ['Tournaments', '/tournaments'],
    ['Team Debates', '/team-builder'],
    ['Leaderboard', '/leaderboard'],
    ['Community', '/community'],
    ['Profile', '/profile'],
    ['About', '/about'],
    ['Support DebateAI', '/support-os'],
  ])('links %s to %s', (label, href) => {
    renderAt();
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
  });

});
