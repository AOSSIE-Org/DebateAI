import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopicSelector from '../TopicSelector';

describe('TopicSelector', () => {
  it('shows the heading, every topic, and the Play button', () => {
    render(<TopicSelector />);
    expect(screen.getByText('Choose topic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Can money really buy happiness?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Winter vs. summer: Best season ever?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    // 5 topics + Play
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });
});
