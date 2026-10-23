import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TeamChatSidebar from '../TeamChatSidebar';

function fakeSocket(readyState: number = WebSocket.OPEN) {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    onopen: null as null | (() => void),
    onmessage: null as null | ((e: { data: string }) => void),
    onclose: null as null | (() => void),
    onerror: null as null | ((e: unknown) => void),
  };
}

const asWs = (s: ReturnType<typeof fakeSocket>) => s as unknown as WebSocket;

describe('TeamChatSidebar', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<TeamChatSidebar teamId='t1' isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('joins the team room when the socket is open', () => {
    const ws = fakeSocket();
    render(<TeamChatSidebar teamId='t1' isOpen onClose={vi.fn()} ws={asWs(ws)} />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({ type: 'join', room: 't1' });
  });

  it('shows Disconnected and disables input without a socket', () => {
    render(<TeamChatSidebar teamId='t1' isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message...')).toBeDisabled();
  });

  it('renders incoming team chat messages', () => {
    const ws = fakeSocket();
    render(<TeamChatSidebar teamId='t1' isOpen onClose={vi.fn()} ws={asWs(ws)} />);
    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
    act(() => {
      ws.onmessage!({ data: JSON.stringify({ type: 'teamChatMessage', messageId: 'm1', userId: 'u1', username: 'Asha', content: 'Take the rebuttal' }) });
      ws.onmessage!({ data: JSON.stringify({ type: 'somethingElse', content: 'ignored' }) });
    });
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('Take the rebuttal')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).toBeNull();
  });

  it('sends a message on Enter and clears the input', async () => {
    const ws = fakeSocket();
    render(<TeamChatSidebar teamId='t1' isOpen onClose={vi.fn()} ws={asWs(ws)} />);
    const input = screen.getByPlaceholderText('Type a message...');
    await userEvent.type(input, 'Hello team{Enter}');
    const sent = JSON.parse(ws.send.mock.calls[1][0]);
    expect(sent).toMatchObject({ type: 'message', room: 't1', content: 'Hello team' });
    expect(input).toHaveValue('');
  });

  it('marks the chat disconnected when the socket closes', () => {
    const ws = fakeSocket();
    render(<TeamChatSidebar teamId='t1' isOpen onClose={vi.fn()} ws={asWs(ws)} />);
    act(() => ws.onclose!());
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    render(<TeamChatSidebar teamId='t1' isOpen onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(onClose).toHaveBeenCalled();
  });
});
