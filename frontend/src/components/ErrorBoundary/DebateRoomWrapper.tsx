import { Component, ErrorInfo, ReactNode } from 'react';
import { DebateRoomErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Specialized error boundary for debate rooms with enhanced error handling
 * for WebSocket connections, WebRTC, and speech recognition
 */
class DebateRoomErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DebateRoomErrorBoundary caught an error:', error, errorInfo);
    
    // Enhanced logging for debate room specific errors
    const errorData = {
      type: 'debate_room_error',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      roomId: this.extractRoomId(),
    };
    
    console.error('Debate room error logged:', errorData);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.logDebateRoomError(errorData);
    }
  }

  private extractRoomId = (): string | null => {
    const pathname = window.location.pathname;
    const match = pathname.match(/\/debate-room\/([^\/]+)/);
    return match ? match[1] : null;
  };

  private logDebateRoomError = (errorData: any) => {
    // Placeholder for error logging service integration
    // This could include additional context like:
    // - Current debate phase
    // - WebSocket connection status
    // - Audio/video permissions
    // - User role (for/against)
    console.error('Debate room error sent to service:', errorData);
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <DebateRoomErrorFallback
          resetError={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

export default DebateRoomErrorBoundary;
