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

  it('renders structured feedback modal with sections and bullets', async () => {
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
            feedback:
              'Strengths:\n- Strong opening thesis.\n- Good articulation.\n\nAreas for Improvement:\n- Provide more statistical evidence.\n- Address counterarguments.',
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
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('Strong opening thesis.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Provide more statistical evidence.')).toBeInTheDocument();
    });
  });

  it('renders inline headings without newlines cleanly', async () => {
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
            pointsEarned: 75,
            feedback: 'Strengths: Clear opening claim. Areas for Improvement: Needs citations.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    const input = screen.getByPlaceholderText(/Enter a debate topic/i);
    await user.type(input, 'AI Regulation');

    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Ethical AI argument.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('Clear opening claim.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Needs citations.')).toBeInTheDocument();
    });
  });

  it('preserves unstructured ordinary text without manufacturing headings or splitting sentences', async () => {
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
            pointsEarned: 70,
            feedback:
              'The strengths of this argument are its clarity and focus. It provides a solid foundation for discussion.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'AI Regulation');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Focus and clarity.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'The strengths of this argument are its clarity and focus. It provides a solid foundation for discussion.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /^Strengths$/i })).toBeNull();
      expect(screen.queryByRole('heading', { name: /^Areas for Improvement$/i })).toBeNull();
    });
  });

  it('renders numbered lists within sections properly', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Renewable Energy',
            stance: 'for',
            text: 'Solar is good.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 90,
            feedback: 'Strengths:\n1. Strong claim.\n2. Concise pacing.\n\nAreas for Improvement:\n1. Add citations.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Renewable Energy');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Solar energy is viable.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByText('Strong claim.')).toBeInTheDocument();
      expect(screen.getByText('Concise pacing.')).toBeInTheDocument();
      expect(screen.getByText('Add citations.')).toBeInTheDocument();
    });
  });

  it('does not misinterpret decimal numbers or abbreviations as list markers', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Economy',
            stance: 'for',
            text: 'Economy grows.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 80,
            feedback: 'Strengths:\n- Performance grew by 3.5% in 2024, e.g., in adoption rates.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Economy');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Statistical growth points.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByText('Performance grew by 3.5% in 2024, e.g., in adoption rates.')).toBeInTheDocument();
    });
  });

  it('preserves existing multiline text without headings (Backward Compatibility)', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Free Speech',
            stance: 'for',
            text: 'Free speech is key.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 80,
            feedback: 'Solid effort overall.\nMake sure to review rebuttal guidelines for next time.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Free Speech');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Defending free speech.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByText(/Solid effort overall/i)).toBeInTheDocument();
      expect(screen.getByText(/Make sure to review rebuttal guidelines for next time/i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /^Strengths$/i })).toBeNull();
    });
  });

  it('does not treat mid-sentence "has strengths:" as a section heading', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Ethics',
            stance: 'for',
            text: 'Ethics are important.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 75,
            feedback: 'The argument has strengths: good evidence and clear reasoning.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Ethics');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Ethical consideration.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(
        screen.getByText('The argument has strengths: good evidence and clear reasoning.')
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /^Strengths$/i })).toBeNull();
    });
  });

  it('correctly identifies heading following sentence punctuation', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Education',
            stance: 'for',
            text: 'Education is vital.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 85,
            feedback: 'Previous evaluation. Strengths: Good argument. Areas for Improvement: Add evidence.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Education');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Educational reform.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByText('Previous evaluation.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('Good argument.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Add evidence.')).toBeInTheDocument();
    });
  });

  it('omits section when Strengths content is empty', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Privacy',
            stance: 'for',
            text: 'Privacy matters.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 60,
            feedback: 'Strengths:\n\nAreas for Improvement:\n- Add evidence.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Privacy');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Digital privacy rights.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /^Strengths$/i })).toBeNull();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Add evidence.')).toBeInTheDocument();
    });
  });

  it('omits section when Areas for Improvement content is empty', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Healthcare',
            stance: 'for',
            text: 'Healthcare access.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 95,
            feedback: 'Strengths:\n- Excellent argumentation.\n\nAreas for Improvement:',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Healthcare');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Universal healthcare access.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('Excellent argumentation.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /^Areas for Improvement$/i })).toBeNull();
    });
  });

  it('falls back to ordinary text when both sections are empty', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Space',
            stance: 'for',
            text: 'Space exploration.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 50,
            feedback: 'Strengths:\n\nAreas for Improvement:',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Space');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Exploring Mars.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /^Strengths$/i })).toBeNull();
      expect(screen.queryByRole('heading', { name: /^Areas for Improvement$/i })).toBeNull();
      expect(screen.getByText(/Strengths:/i)).toBeInTheDocument();
      expect(screen.getByText(/Areas for Improvement:/i)).toBeInTheDocument();
    });
  });

  it('renders Markdown format with colon inside bold markers (**Strengths:**)', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Technology',
            stance: 'for',
            text: 'Tech helps.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 85,
            feedback: '**Strengths:**\n- Point A.\n- Point B.\n\n**Areas for Improvement:**\n- Point C.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Technology');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Technological progress.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('Point A.')).toBeInTheDocument();
      expect(screen.getByText('Point B.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Point C.')).toBeInTheDocument();
    });
  });

  it('renders Markdown format with colon outside bold markers (**Strengths**:)', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Science',
            stance: 'for',
            text: 'Science is empirical.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 90,
            feedback: '**Strengths**:\n- Point X.\n- Point Y.\n\n**Areas for Improvement**:\n- Point Z.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Science');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Scientific research.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('Point X.')).toBeInTheDocument();
      expect(screen.getByText('Point Y.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Point Z.')).toBeInTheDocument();
    });
  });

  it('renders mixed content inside a section correctly (bullets, normal prose, numbers)', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Ethics',
            stance: 'for',
            text: 'Ethics in AI.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 88,
            feedback:
              'Strengths:\n- Compelling opening statement.\nOverall reasoning is sound and well argued.\n1. Effective use of historical context.\n\nAreas for Improvement:\n- Provide more quantitative evidence.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Ethics');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Ethical AI deployment.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('- Compelling opening statement.')).toBeInTheDocument();
      expect(screen.getByText('Overall reasoning is sound and well argued.')).toBeInTheDocument();
      expect(screen.getByText('1. Effective use of historical context.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Provide more quantitative evidence.')).toBeInTheDocument();
    });
  });

  it('renders feedback containing only a populated Strengths section', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Education',
            stance: 'for',
            text: 'Public education funding.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 92,
            feedback: 'Strengths:\n- Excellent clarity and thesis definition.\n- Solid empirical backing.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Education');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Strengthening public schools.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Strengths$/i })).toBeInTheDocument();
      expect(screen.getByText('Excellent clarity and thesis definition.')).toBeInTheDocument();
      expect(screen.getByText('Solid empirical backing.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /^Areas for Improvement$/i })).toBeNull();
    });
  });

  it('renders feedback containing only a populated Areas for Improvement section', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Economy',
            stance: 'against',
            text: 'Tariff policies.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 45,
            feedback:
              'Areas for Improvement:\n- Clearly define the primary economic mechanism.\n- Anticipate and address retaliatory tariffs.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Economy');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Evaluating tariff impacts.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /^Strengths$/i })).toBeNull();
      expect(screen.getByRole('heading', { name: /^Areas for Improvement$/i })).toBeInTheDocument();
      expect(screen.getByText('Clearly define the primary economic mechanism.')).toBeInTheDocument();
      expect(screen.getByText('Anticipate and address retaliatory tariffs.')).toBeInTheDocument();
    });
  });

  it('does not parse unmatched Markdown markers as headings', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: '1',
            topic: 'Democracy',
            stance: 'for',
            text: 'Democratic institutions.',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            pointsEarned: 70,
            feedback: '**Strengths:\n- This heading has unmatched bold markers.',
          }),
      } as Response);

    render(<StrengthenArgument />);

    await user.type(screen.getByPlaceholderText(/Enter a debate topic/i), 'Democracy');
    await user.click(screen.getByRole('button', { name: /Generate Weak Statement/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Write your strengthened argument here/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/Write your strengthened argument here/i), 'Protecting voting rights.');
    await user.click(screen.getByRole('button', { name: /Submit Your Argument/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /^Strengths$/i })).toBeNull();
      expect(screen.getByText(/\*\*Strengths:/)).toBeInTheDocument();
    });
  });
});
