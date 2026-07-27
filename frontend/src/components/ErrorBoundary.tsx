import React from 'react';
import ErrorFallback from './ErrorFallback';
import { reportError } from '../utils/errorReporting';

type Props = {
  children: React.ReactNode;
  onReset?: () => void;
};

type State = {
  hasError: boolean;
  error?: Error | null;
  errorInfo?: React.ErrorInfo | null;
};

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.resetError = this.resetError.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    // Report to remote logging endpoint (best-effort)
    try {
      reportError(error, errorInfo);
    } catch (e) {
      // swallow — reporting should not crash the app
      // eslint-disable-next-line no-console
      console.error('Error reporting failed', e);
    }
  }

  resetError() {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) this.props.onReset();
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.resetError}
        />
      );
    }
    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
