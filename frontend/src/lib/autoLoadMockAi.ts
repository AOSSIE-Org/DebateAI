// Temporary helper: if `window.__mockAiJudgement` is defined in the browser
// this module will persist it to sessionStorage so components can load it
// without requiring a backend. Remove this file when testing is complete.

declare global {
  interface Window {
    __mockAiJudgement?: any;
  }
}

try {
  if (typeof window !== 'undefined' && (window as any).__mockAiJudgement) {
    try {
      sessionStorage.setItem(
        'mockAiJudgement',
        JSON.stringify((window as any).__mockAiJudgement)
      );
      // Optionally delete the global to avoid accidental reuse
      // delete (window as any).__mockAiJudgement;
    } catch (e) {
      // ignore storage errors
      // console.warn('autoLoadMockAi: failed to persist mock judgement', e);
    }
  }
} catch (e) {
  // ignore non-browser environments
}

export {};
