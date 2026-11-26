import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareVictoryCardModal } from '../ShareVictoryCardModal';
import type { DebateVictoryCardData } from '../types';
import { toBlob, toPng } from 'html-to-image';

// Rendering the card to an image needs a real browser canvas.
vi.mock('html-to-image', () => ({ toPng: vi.fn(), toBlob: vi.fn() }));
const mockToPng = vi.mocked(toPng);
const mockToBlob = vi.mocked(toBlob);

const data: DebateVictoryCardData = {
  topic: 'Should AI be regulated?',
  matchType: 'Online 1v1',
  winner: { name: 'Rounak', score: 32 },
  opponent: { name: 'Asha', score: 24 },
};

function renderModal(props: { isOpen?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(<ShareVictoryCardModal isOpen={props.isOpen ?? true} onClose={onClose} data={data} />);
  return onClose;
}

describe('ShareVictoryCardModal', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText('Share Debate Victory Card')).toBeNull();
  });

  it('shows the dialog with a live preview of the card', () => {
    renderModal();
    expect(screen.getByText('Share Debate Victory Card')).toBeInTheDocument();
    expect(screen.getByText('"Should AI be regulated?"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  });

  it('closes with Escape', async () => {
    const onClose = renderModal();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('downloads the card as a PNG', async () => {
    mockToPng.mockResolvedValue('data:image/png;base64,AAAA');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(mockToPng).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ pixelRatio: 2 }));
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  });

  it('recovers when the export fails', async () => {
    mockToPng.mockRejectedValue(new Error('canvas tainted'));
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled());
  });

  it('copies the image to the clipboard when supported', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    mockToBlob.mockResolvedValue(blob);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write, writeText: vi.fn() } });
    vi.stubGlobal('ClipboardItem', class { constructor(public items: unknown) {} });
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /Copy Image/ }));
    await waitFor(() => expect(write).toHaveBeenCalled());
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('falls back to copying text when image clipboard is unavailable', async () => {
    mockToBlob.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.stubGlobal('ClipboardItem', undefined);
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /Copy Image/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('Should AI be regulated?');
    expect(writeText.mock.calls[0][0]).toContain('32 vs 24');
  });
});
