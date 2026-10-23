import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvatarModal from '../AvatarModal';

const BASE = 'https://api.dicebear.com/9.x/big-ears/svg?seed=';

function renderModal(currentAvatar?: string) {
  const onClose = vi.fn();
  const onSelectAvatar = vi.fn();
  render(<AvatarModal isOpen onClose={onClose} onSelectAvatar={onSelectAvatar} currentAvatar={currentAvatar} />);
  return { onClose, onSelectAvatar };
}

const preview = () => screen.getByRole('img', { name: 'Avatar Preview' });

describe('AvatarModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AvatarModal isOpen={false} onClose={vi.fn()} onSelectAvatar={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts from the seed in the current avatar', () => {
    renderModal(`${BASE}Nolan`);
    expect(preview()).toHaveAttribute('src', `${BASE}Nolan`);
  });

  it('defaults to Jude without a current avatar', () => {
    renderModal();
    expect(preview()).toHaveAttribute('src', `${BASE}Jude`);
  });

  it('switches character and saves a seed-only url', async () => {
    const { onSelectAvatar, onClose } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Felix' }));
    expect(preview()).toHaveAttribute('src', `${BASE}Felix`);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSelectAvatar).toHaveBeenCalledWith(`${BASE}Felix`);
    expect(onClose).toHaveBeenCalled();
  });

  it('adds only the skin colour when that is the only change', async () => {
    const { onSelectAvatar } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'a66637' }));
    expect(preview()).toHaveAttribute('src', `${BASE}Jude&skinColor=a66637`);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSelectAvatar).toHaveBeenCalledWith(`${BASE}Jude&skinColor=a66637`);
  });

  it('includes every style once a style option is changed', async () => {
    const { onSelectAvatar } = renderModal();
    // The first "variant02" button belongs to the Ear Style row.
    await userEvent.click(screen.getAllByRole('button', { name: 'variant02' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'short05' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const url: string = onSelectAvatar.mock.calls[0][0];
    expect(url.startsWith(`${BASE}Jude`)).toBe(true);
    expect(url).toContain('&ear=variant02');
    expect(url).toContain('&hair=short05');
    expect(url).toContain('&backgroundColor=b6e3f4');
  });

  it('resets styles when a new character is picked', async () => {
    renderModal();
    await userEvent.click(screen.getAllByRole('button', { name: 'variant02' })[0]);
    expect(preview().getAttribute('src')).toContain('&ear=variant02');
    await userEvent.click(screen.getByRole('button', { name: 'Sadie' }));
    expect(preview()).toHaveAttribute('src', `${BASE}Sadie`);
  });

  it('shows the rotation and scale values', () => {
    renderModal();
    expect(screen.getByText('Rotation (0°)')).toBeInTheDocument();
    expect(screen.getByText('Scale (100%)')).toBeInTheDocument();
  });

  it('cancels without saving', async () => {
    const { onSelectAvatar, onClose } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSelectAvatar).not.toHaveBeenCalled();
  });
});
