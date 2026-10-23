import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Chatbox, { type ChatMessage, type TypingIndicator } from '../Chatbox';

function renderChatbox(overrides: Partial<React.ComponentProps<typeof Chatbox>> = {}) {
  const props = {
    messages: [] as ChatMessage[],
    transcriptStatus: { loading: false, isUser: false },
    onSendMessage: vi.fn(),
    onTypingChange: vi.fn(),
    onSpeakingChange: vi.fn(),
    typingIndicators: [] as TypingIndicator[],
    isMyTurn: true,
    ...overrides,
  };
  render(<Chatbox {...props} />);
  return props;
}

describe('Chatbox', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders messages and the transcript loading state', () => {
    renderChatbox({
      messages: [
        { isUser: true, text: 'My opening' },
        { isUser: false, text: 'Their rebuttal', isTyping: true },
      ],
      transcriptStatus: { loading: true, isUser: true },
    });
    expect(screen.getByText('My opening')).toBeInTheDocument();
    expect(screen.getByText('Their rebuttal')).toBeInTheDocument();
    expect(screen.getByText('typing...')).toBeInTheDocument();
    expect(screen.getByText('Generating transcript...')).toBeInTheDocument();
  });

  it('shows typing indicators with partial text', () => {
    renderChatbox({
      typingIndicators: [{ userId: 'u2', username: 'Opponent', isTyping: true, isSpeaking: false, partialText: 'I would argue' }],
    });
    expect(screen.getByText('Opponent')).toBeInTheDocument();
    expect(screen.getByText('I would argue')).toBeInTheDocument();
  });

  it('sends a trimmed message on Enter and resets typing', async () => {
    const props = renderChatbox();
    const input = screen.getByPlaceholderText('Type your message...');
    await userEvent.type(input, '  Point one  {Enter}');
    expect(props.onSendMessage).toHaveBeenCalledTimes(1);
    expect(props.onSendMessage).toHaveBeenCalledWith('Point one', 'type');
    expect(props.onTypingChange).toHaveBeenLastCalledWith(false);
    expect(input).toHaveValue('');
  });

  it('reports typing as the user types', async () => {
    const props = renderChatbox();
    await userEvent.type(screen.getByPlaceholderText('Type your message...'), 'Hi');
    expect(props.onTypingChange).toHaveBeenLastCalledWith(true, 'Hi');
  });

  it('locks input when it is not the user\'s turn', () => {
    renderChatbox({ isMyTurn: false });
    expect(screen.getByPlaceholderText('Type your message...')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByTitle('Switch to Voice')).toBeDisabled();
  });

  it('starts speech recognition in voice mode and fills the input', async () => {
    type Handler = ((event?: unknown) => void) | null;
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onstart: Handler = null;
      onend: Handler = null;
      onerror: Handler = null;
      onresult: Handler = null;
      start = vi.fn(() => this.onstart?.());
      stop = vi.fn(() => this.onend?.());
      constructor() {
        instances.push(this);
      }
    }
    const instances: FakeRecognition[] = [];
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const props = renderChatbox();

    await userEvent.click(screen.getByTitle('Switch to Voice'));
    const recognition = instances[0];
    expect(recognition.start).toHaveBeenCalled();
    expect(recognition.lang).toBe('en-US');
    expect(props.onSpeakingChange).toHaveBeenCalledWith(true);
    expect(screen.getByPlaceholderText('Listening...')).toBeInTheDocument();

    act(() => {
      recognition.onresult!({ resultIndex: 0, results: [Object.assign([{ transcript: 'Spoken point' }], { isFinal: true })] });
    });
    expect(screen.getByDisplayValue('Spoken point')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(props.onSendMessage).toHaveBeenCalledWith('Spoken point', 'speak');
    expect(recognition.stop).toHaveBeenCalled();
  });
});
