import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LoginForm, SignUpForm } from '../forms';
import { AuthContext } from '../../../context/authContext';

const renderButton = vi.fn();

function withAuth(ui: React.ReactElement) {
  const auth = {
    login: vi.fn(),
    signup: vi.fn(),
    googleLogin: vi.fn(),
    clearError: vi.fn(),
    error: null,
    loading: false,
  };
  return render(<AuthContext.Provider value={auth as never}>{ui}</AuthContext.Provider>);
}

// jsdom has no layout, so give the button container a measurable width.
function stubContainerWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}

describe('Google sign-in button', () => {
  beforeEach(() => {
    renderButton.mockReset();
    window.google = {
      accounts: { id: { initialize: vi.fn(), renderButton, prompt: vi.fn(), cancel: vi.fn() } },
    };
  });
  afterEach(() => {
    delete window.google;
  });

  it('passes a pixel width matching the form (Google ignores percentages)', () => {
    stubContainerWidth(320);
    withAuth(<LoginForm startForgotPassword={vi.fn()} startOtpVerification={vi.fn()} />);
    const [element, options] = renderButton.mock.calls[0];
    expect(element).toHaveAttribute('id', 'googleSignInButton');
    expect(options.width).toBe(320);
  });

  it('caps the width at Google\'s 400px maximum', () => {
    stubContainerWidth(478);
    withAuth(<LoginForm startForgotPassword={vi.fn()} startOtpVerification={vi.fn()} />);
    expect(renderButton.mock.calls[0][1].width).toBe(400);
  });

  it('never goes below Google\'s 200px minimum', () => {
    stubContainerWidth(0);
    withAuth(<SignUpForm startOtpVerification={vi.fn()} />);
    const [element, options] = renderButton.mock.calls[0];
    expect(element).toHaveAttribute('id', 'googleSignUpButton');
    expect(options.width).toBe(200);
  });
});
