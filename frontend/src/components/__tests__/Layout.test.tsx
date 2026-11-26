import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from '../Layout';

vi.mock('../Sidebar', () => ({ default: () => <nav>sidebar</nav> }));
vi.mock('../Header', () => ({ default: () => <header>header</header> }));
vi.mock('../Footer', () => ({ default: () => <footer>footer</footer> }));

describe('Layout', () => {
  it('renders the shell around the routed page', () => {
    render(
      <MemoryRouter initialEntries={['/leaderboard']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path='/leaderboard' element={<p>leaderboard page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('sidebar')).toBeInTheDocument();
    expect(screen.getByText('header')).toBeInTheDocument();
    expect(screen.getByText('footer')).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByText('leaderboard page'));
  });
});
