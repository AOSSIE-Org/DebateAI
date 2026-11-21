import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StrengthenArgument from '../StrengthenArgument';

vi.mock('@/utils/auth', () => ({
  getAuthToken: vi.fn(() => 'mock-jwt-token'),
}));

describe('StrengthenArgument Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 with topic input and stance selector', () => {
    render(<StrengthenArgument />);
    expect(screen.getByText('Strengthen Your Debate Skills')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter a debate topic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Weak Statement/i })).toBeInTheDocument();
  });

  it('displays grammatically correct heading with capitalized stance for "for"', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: '1',
          topic: 'Renewable Energy',
          stance: 'for',
          text: 'Renewable energy is good because sun shines.',
        }),
    } as Response);

    render(<StrengthenArgument />);

    const input = screen.getByPlaceholderText(/Enter a debate topic/i);
    await user.type(input, 'Renewable Energy');

    const generateBtn = screen.getByRole('button', { name: /Generate Weak Statement/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Weak Opening Statement (For) on the topic "Renewable Energy"')
      ).toBeInTheDocument();
    });
  });

  it('displays grammatically correct heading with capitalized stance for "against"', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: '2',
          topic: 'Social Media',
          stance: 'against',
          text: 'Social media is bad because it wastes time.',
        }),
    } as Response);

    render(<StrengthenArgument />);

    const input = screen.getByPlaceholderText(/Enter a debate topic/i);
    await user.type(input, 'Social Media');

    const stanceSelect = screen.getByRole('combobox');
    await user.selectOptions(stanceSelect, 'against');

    const generateBtn = screen.getByRole('button', { name: /Generate Weak Statement/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Weak Opening Statement (Against) on the topic "Social Media"')
      ).toBeInTheDocument();
    });
  });

  it('renders structured feedback modal with line breaks preserved', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'AI Regulation',
            stance: 'for',
            text: 'AI should be regulated.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 85,
            feedback: 'Strengths:\n1. Strong claim.\n\nAreas for Improvement:\n1. Provide data.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    const input = screen.getByPlaceholderText(/Enter a debate topic/i);
    await user.type(input, 'AI Regulation');

    const generateBtn = screen.getByRole('button', { name: /Generate Weak Statement/i });
    await user.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Write your strengthened argument here/i);
    await user.type(textarea, 'AI regulation ensures ethical deployment and safety.');

    const submitBtn = screen.getByRole('button', { name: /Submit Your Argument/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Feedback')).toBeInTheDocument();
      expect(
        screen.getByText(/Review your argument score and feedback from the debate coach/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Strengths:/i)).toBeInTheDocument();
      expect(screen.getByText(/Strong claim/i)).toBeInTheDocument();
      expect(screen.getByText(/Areas for Improvement:/i)).toBeInTheDocument();
    });
  });
});
