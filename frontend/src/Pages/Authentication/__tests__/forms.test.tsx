import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { LoginForm, SignUpForm } from '../forms';
import { AuthContext } from '../../../context/authContext';
import {
  GOOGLE_BUTTON_RESIZE_DEBOUNCE_MS,
  GOOGLE_SCRIPT_POLL_MS,
  GOOGLE_SCRIPT_TIMEOUT_MS,
} from '../../../hooks/useGoogleButton';

const renderButton = vi.fn();
const initialize = vi.fn();
const cancel = vi.fn();
const googleLogin = vi.fn();

function withAuth(ui: React.ReactElement) {
  const auth = {
    login: vi.fn(),
    signup: vi.fn(),
    googleLogin,
    clearError: vi.fn(),
    error: null,
    loading: false,
  };
  return render(<AuthContext.Provider value={auth as never}>{ui}</AuthContext.Provider>);
}

const renderLogin = () => withAuth(<LoginForm startForgotPassword={vi.fn()} startOtpVerification={vi.fn()} />);

function installGoogle() {
  window.google = { accounts: { id: { initialize, renderButton, prompt: vi.fn(), cancel } } };
}

// jsdom has no layout, so give the button container a measurable width.
let widthSpy: ReturnType<typeof vi.spyOn>;
function stubContainerWidth(width: number) {
  widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}

// ResizeObserver that tests can trigger by hand.
let resizeCallbacks: Array<() => void> = [];
const disconnect = vi.fn();
class FakeResizeObserver {
  constructor(cb: () => void) {
    resizeCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect = disconnect;
}
const resize = (width: number) => {
  widthSpy.mockReturnValue(width);
  act(() => resizeCallbacks.forEach((cb) => cb()));
};

describe('Google sign-in button', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    [renderButton, initialize, cancel, googleLogin, disconnect].forEach((m) => m.mockReset());
    resizeCallbacks = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    installGoogle();
  });
  afterEach(() => {
    delete window.google;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('passes a pixel width matching the form (Google ignores percentages)', () => {
    stubContainerWidth(320);
    renderLogin();
    const [element, options] = renderButton.mock.calls[0];
    expect(element).toHaveAttribute('id', 'googleSignInButton');
    expect(options).toMatchObject({ width: 320, text: 'signin_with', theme: 'outline', size: 'large' });
  });

  it("caps the width at Google's 400px maximum", () => {
    stubContainerWidth(478);
    renderLogin();
    expect(renderButton.mock.calls[0][1].width).toBe(400);
  });

  it("never goes below Google's 200px minimum", () => {
    stubContainerWidth(0);
    withAuth(<SignUpForm startOtpVerification={vi.fn()} />);
    const [element, options] = renderButton.mock.calls[0];
    expect(element).toHaveAttribute('id', 'googleSignUpButton');
    expect(options).toMatchObject({ width: 200, text: 'signup_with' });
  });

  it('redraws at the new width after a resize settles', () => {
    stubContainerWidth(320);
    renderLogin();
    expect(renderButton).toHaveBeenCalledTimes(1);

    resize(260);
    expect(renderButton).toHaveBeenCalledTimes(1); // still debouncing
    act(() => vi.advanceTimersByTime(GOOGLE_BUTTON_RESIZE_DEBOUNCE_MS));
    expect(renderButton).toHaveBeenCalledTimes(2);
    expect(renderButton.mock.calls[1][1].width).toBe(260);
  });

  it('does not redraw when the width is unchanged, and initializes Google once', () => {
    stubContainerWidth(320);
    renderLogin();
    resize(320);
    act(() => vi.advanceTimersByTime(GOOGLE_BUTTON_RESIZE_DEBOUNCE_MS));
    resize(300);
    act(() => vi.advanceTimersByTime(GOOGLE_BUTTON_RESIZE_DEBOUNCE_MS));
    expect(renderButton).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('waits for the Google script when it loads after the form', () => {
    delete window.google;
    stubContainerWidth(320);
    renderLogin();
    act(() => vi.advanceTimersByTime(GOOGLE_SCRIPT_POLL_MS * 3));
    expect(renderButton).not.toHaveBeenCalled();

    installGoogle();
    act(() => vi.advanceTimersByTime(GOOGLE_SCRIPT_POLL_MS));
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(renderButton.mock.calls[0][1].width).toBe(320);
  });

  it('stops waiting if the Google script never loads', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete window.google;
    stubContainerWidth(320);
    renderLogin();
    act(() => vi.advanceTimersByTime(GOOGLE_SCRIPT_TIMEOUT_MS + GOOGLE_SCRIPT_POLL_MS));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Google sign-in script did not load'));

    // Loading it later no longer renders anything: polling has stopped.
    installGoogle();
    act(() => vi.advanceTimersByTime(GOOGLE_SCRIPT_POLL_MS * 5));
    expect(renderButton).not.toHaveBeenCalled();
  });

  it('sends the Google credential to googleLogin', () => {
    stubContainerWidth(320);
    renderLogin();
    const { callback } = initialize.mock.calls[0][0];
    callback({ credential: 'id-token', select_by: 'btn' });
    expect(googleLogin).toHaveBeenCalledWith('id-token');
  });

  it('cleans up on unmount', () => {
    stubContainerWidth(320);
    const { unmount } = renderLogin();
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });
});
