import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SavedTranscripts from '../SavedTranscripts';
import { transcriptService, type SavedDebateTranscript } from '@/services/transcriptService';
import { mockFetch } from '../../test/mockFetch';

vi.mock('@/services/transcriptService', () => ({
  transcriptService: { getUserTranscripts: vi.fn(), deleteTranscript: vi.fn() },
}));
vi.mock('../CommentTree', () => ({ default: () => <div>comments</div> }));
const service = vi.mocked(transcriptService);

const transcript = (overrides: Partial<SavedDebateTranscript>): SavedDebateTranscript => ({
  id: 't1',
  userId: 'me',
  email: 'me@example.com',
  debateType: 'user_vs_bot',
  topic: 'Should AI be regulated?',
  opponent: 'Socrates',
  result: 'win',
  messages: [
    { sender: 'User', text: 'AI needs guardrails', phase: 'Opening' },
    { sender: 'Bot', text: 'Innovation needs freedom' },
  ],
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  ...overrides,
});

const sample = [
  transcript({}),
  transcript({ id: 't2', topic: 'Is remote work better?', opponent: 'Asha', result: 'loss', debateType: 'user_vs_user', messages: [] }),
];

function renderList() {
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path='/profile' element={<SavedTranscripts />} />
        <Route path='/community' element={<p>community page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SavedTranscripts', () => {
  beforeEach(() => {
    service.getUserTranscripts.mockResolvedValue(sample);
    service.deleteTranscript.mockResolvedValue(undefined as never);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the empty state', async () => {
    service.getUserTranscripts.mockResolvedValue([]);
    renderList();
    expect(await screen.findByText('No saved transcripts')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    service.getUserTranscripts.mockRejectedValueOnce(new Error('Server down'));
    renderList();
    expect(await screen.findByText('Server down')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Should AI be regulated?')).toBeInTheDocument();
  });

  it('lists transcripts with opponent, result and message count', async () => {
    renderList();
    expect(await screen.findByText('Should AI be regulated?')).toBeInTheDocument();
    expect(screen.getByText('vs Socrates')).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
    expect(screen.getByText('Bot Debate')).toBeInTheDocument();
    expect(screen.getByText('loss')).toBeInTheDocument();
  });

  it('filters by search text and clears filters', async () => {
    renderList();
    await screen.findByText('Should AI be regulated?');
    await userEvent.type(screen.getByLabelText('Search transcripts by topic or opponent'), 'asha');
    expect(screen.queryByText('Should AI be regulated?')).toBeNull();
    expect(screen.getByText('Is remote work better?')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search transcripts by topic or opponent'), 'zzz');
    expect(screen.getByText('No transcripts match your search or filters')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByText('Should AI be regulated?')).toBeInTheDocument();
  });

  it('filters by outcome', async () => {
    renderList();
    await screen.findByText('Should AI be regulated?');
    await userEvent.click(screen.getAllByRole('combobox')[0]);
    await userEvent.click(await screen.findByRole('option', { name: 'Loss' }));
    expect(screen.queryByText('Should AI be regulated?')).toBeNull();
    expect(screen.getByText('Is remote work better?')).toBeInTheDocument();
  });

  it('opens the transcript with its messages', async () => {
    renderList();
    await screen.findByText('Should AI be regulated?');
    await userEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('AI needs guardrails')).toBeInTheDocument();
    expect(within(dialog).getByText('Innovation needs freedom')).toBeInTheDocument();
    expect(within(dialog).getByText('AI')).toBeInTheDocument();
    expect(within(dialog).getByText('comments')).toBeInTheDocument();
  });

  it('shares a transcript to the community feed', async () => {
    localStorage.setItem('token', 'tok');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const fetchMock = mockFetch([{ match: '/posts', method: 'POST', body: { id: 'p1' } }]);
    renderList();
    await screen.findByText('Should AI be regulated?');
    await userEvent.click(screen.getAllByRole('button', { name: 'View' })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'Create Post' }));
    expect(await screen.findByText('community page')).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ transcriptId: 't1' });
  });

  it('deletes a transcript after confirmation', async () => {
    renderList();
    await screen.findByText('Should AI be regulated?');
    await userEvent.click(screen.getByRole('button', { name: 'Delete transcript: Should AI be regulated?' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete transcript' }));
    await waitFor(() => expect(screen.queryByText('Should AI be regulated?')).toBeNull());
    expect(service.deleteTranscript).toHaveBeenCalledWith('t1');
  });
});
