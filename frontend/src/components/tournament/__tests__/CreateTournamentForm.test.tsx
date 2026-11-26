import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CreateTournamentForm } from '../CreateTournamentForm';
import { createTournament } from '@/services/tournamentService';

vi.mock('@/services/tournamentService', () => ({ createTournament: vi.fn() }));
const create = vi.mocked(createTournament);

function renderForm() {
  const { container } = render(
    <MemoryRouter initialEntries={['/tournaments/create']}>
      <Routes>
        <Route path='/tournaments/create' element={<CreateTournamentForm />} />
        <Route path='/tournaments' element={<p>tournaments page</p>} />
      </Routes>
    </MemoryRouter>
  );
  return container.querySelector('form')!;
}

async function fillRequired({ topic = 'Should AI be regulated?', description = 'Open tournament', moderator = 'Rounak' } = {}) {
  await userEvent.type(screen.getByPlaceholderText('e.g. Should AI be regulated?'), topic);
  await userEvent.type(screen.getByPlaceholderText('What is this tournament about?'), description);
  await userEvent.type(screen.getByPlaceholderText("Enter moderator's full name"), moderator);
}

const [minInput, maxInput] = [() => screen.getAllByRole('spinbutton')[0], () => screen.getAllByRole('spinbutton')[1]];
const selects = () => screen.getAllByRole('combobox');

describe('CreateTournamentForm', () => {
  it('requires topic, description and moderator (ignoring whitespace)', async () => {
    const form = renderForm();
    await fillRequired({ topic: '   ' });
    fireEvent.submit(form);
    expect(screen.getByText('Tournament topic, description, and moderator name are required.')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('enforces length limits', async () => {
    const form = renderForm();
    await fillRequired();
    fireEvent.change(screen.getByPlaceholderText('e.g. Should AI be regulated?'), { target: { value: 'x'.repeat(101) } });
    fireEvent.submit(form);
    expect(screen.getByText(/Topic must be at most 100 characters/)).toBeInTheDocument();
  });

  it('validates the participant range', async () => {
    const form = renderForm();
    await fillRequired();
    fireEvent.change(minInput(), { target: { value: '2' } });
    fireEvent.submit(form);
    expect(screen.getByText('Minimum participants must be between 3 and 11.')).toBeInTheDocument();

    fireEvent.change(minInput(), { target: { value: '6' } });
    fireEvent.change(maxInput(), { target: { value: '5' } });
    fireEvent.submit(form);
    expect(screen.getByText('Maximum participants must be between the minimum and 11.')).toBeInTheDocument();
  });

  it('requires a future date for scheduled tournaments', async () => {
    const form = renderForm();
    await fillRequired();
    await userEvent.selectOptions(selects()[2], 'scheduled');
    expect(screen.getByRole('button', { name: 'Open calendar' })).toBeInTheDocument();
    fireEvent.submit(form);
    expect(screen.getByText('Choose a valid future date.')).toBeInTheDocument();
  });

  it('creates a public tournament with trimmed values', async () => {
    create.mockResolvedValue({ id: 'tour-1', topic: 'Should AI be regulated?' } as never);
    const form = renderForm();
    await fillRequired({ topic: '  Should AI be regulated?  ' });
    await userEvent.selectOptions(selects()[1], 'against');
    fireEvent.submit(form);
    expect(await screen.findByText('Tournament Created! 🎉')).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Should AI be regulated?',
        description: 'Open tournament',
        moderatorName: 'Rounak',
        visibility: 'public',
        stance: 'against',
        minParticipants: 3,
        maxParticipants: 11,
        startType: 'direct',
      })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Back to Tournaments' }));
    expect(screen.getByText('tournaments page')).toBeInTheDocument();
  });

  it('shows and copies the invite code for a private tournament', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    create.mockResolvedValue({ id: 'tour-2', topic: 'Private one', inviteCode: '123456' } as never);
    const form = renderForm();
    await fillRequired();
    await userEvent.selectOptions(selects()[0], 'private');
    expect(screen.getByText('Requires invite code')).toBeInTheDocument();
    fireEvent.submit(form);
    expect(await screen.findByText('123456')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy Code' }));
    expect(writeText).toHaveBeenCalledWith('123456');
    expect(await screen.findByText('Invite code copied.')).toBeInTheDocument();
  });

  it('flags an invalid invite code from the server', async () => {
    create.mockResolvedValue({ id: 'tour-3', topic: 'Private one', inviteCode: 'abc' } as never);
    const form = renderForm();
    await fillRequired();
    await userEvent.selectOptions(selects()[0], 'private');
    fireEvent.submit(form);
    expect(await screen.findByText(/invalid invite code\. Contact support with tournament ID: tour-3/)).toBeInTheDocument();
  });

  it('shows the server error when creation fails', async () => {
    create.mockRejectedValue(new Error('Topic already exists'));
    renderForm();
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create Tournament' }));
    expect(await screen.findByText('Topic already exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Tournament' })).toBeEnabled();
  });
});
