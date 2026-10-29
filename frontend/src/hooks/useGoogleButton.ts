import { useEffect, useRef } from 'react';

type GoogleButtonText = 'signin_with' | 'signup_with' | 'continue_with';
type GoogleCredentialResponse = { credential: string; select_by: string };

// Google's renderButton only accepts a pixel width between 200 and 400; a
// percentage is ignored and the button shrinks to fit its text.
export const GOOGLE_BUTTON_MIN_WIDTH = 200;
export const GOOGLE_BUTTON_MAX_WIDTH = 400;
export const googleButtonWidth = (containerWidth: number) =>
  Math.round(Math.min(GOOGLE_BUTTON_MAX_WIDTH, Math.max(GOOGLE_BUTTON_MIN_WIDTH, containerWidth)));

// The Google Identity Services script loads async, so it may arrive after
// the form mounts. Wait for it, but stop if it never comes (blocked, offline).
export const GOOGLE_SCRIPT_POLL_MS = 100;
export const GOOGLE_SCRIPT_TIMEOUT_MS = 10_000;
// Wait for resizing to settle before redrawing the button.
export const GOOGLE_BUTTON_RESIZE_DEBOUNCE_MS = 100;

/**
 * Renders Google's sign-in button into the returned ref, as wide as its
 * container, and redraws it when the container's width changes (window
 * resize, phone rotation). Google is initialized once per mount.
 *
 * Responsive re-rendering adapted from the approach in #774 by @aryanpatil-07.
 */
export function useGoogleButton(
  text: GoogleButtonText,
  onCredential: (response: GoogleCredentialResponse) => void
) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-initializing Google when it changes.
  const callbackRef = useRef(onCredential);
  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: ResizeObserver | undefined;
    let drawnWidth = 0;

    const draw = () => {
      const google = window.google;
      if (!google?.accounts) return;
      const width = googleButtonWidth(container.clientWidth);
      if (width === drawnWidth) return;
      drawnWidth = width;
      container.innerHTML = '';
      google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text, width });
    };

    const start = () => {
      window.google?.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response) => callbackRef.current(response),
      });
      draw();
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(draw, GOOGLE_BUTTON_RESIZE_DEBOUNCE_MS);
        });
        observer.observe(container);
      }
    };

    if (window.google?.accounts) {
      start();
    } else {
      const startedAt = Date.now();
      pollTimer = setInterval(() => {
        if (window.google?.accounts) {
          clearInterval(pollTimer);
          start();
        } else if (Date.now() - startedAt >= GOOGLE_SCRIPT_TIMEOUT_MS) {
          clearInterval(pollTimer);
          console.warn('Google sign-in script did not load; the Google button is unavailable.');
        }
      }, GOOGLE_SCRIPT_POLL_MS);
    }

    return () => {
      clearInterval(pollTimer);
      clearTimeout(resizeTimer);
      observer?.disconnect();
      window.google?.accounts?.id?.cancel();
    };
  }, [text]);

  return ref;
}
