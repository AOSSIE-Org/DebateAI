import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageTitle from '../PageTitle';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PageTitle />
    </MemoryRouter>
  );

describe('PageTitle', () => {
  it.each([
    ['/', 'DebateAI | AI-Powered Real-Time Debate Platform'],
    ['/leaderboard', 'Leaderboard | DebateAI'],
    ['/tournaments', 'Tournaments | DebateAI'],
    ['/auth', 'Authentication | DebateAI'],
  ])('sets the document title for %s', (path, title) => {
    renderAt(path);
    expect(document.title).toBe(title);
  });

  it('falls back to the default title for unknown routes', () => {
    renderAt('/some/unknown/page');
    expect(document.title).toBe('DebateAI | AI-Powered Real-Time Debate Platform');
  });

  it('renders nothing', () => {
    const { container } = renderAt('/about');
    expect(container).toBeEmptyDOMElement();
  });
});
