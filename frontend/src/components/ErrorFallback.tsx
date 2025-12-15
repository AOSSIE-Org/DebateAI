import React from 'react';

type Props = {
  error?: Error | null;
  errorInfo?: React.ErrorInfo | null;
  onReset: () => void;
};

export default function ErrorFallback({ error, errorInfo, onReset }: Props) {
  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h2>Something went wrong</h2>
      {error && <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>}
      {errorInfo && (
        <details style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
          {errorInfo.componentStack}
        </details>
      )}
      <div style={{ marginTop: 16 }}>
        <button onClick={onReset} style={{ padding: '8px 12px' }}>
          Try again
        </button>
      </div>
    </div>
  );
}
