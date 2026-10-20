import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import DebateCoverIllustration from '../DebateCoverIllustration';

describe('DebateCoverIllustration', () => {
  it('renders an svg and forwards props', () => {
    const { container } = render(<DebateCoverIllustration className='cover' data-testid='art' />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass('cover');
    expect(svg).toHaveAttribute('data-testid', 'art');
  });
});
