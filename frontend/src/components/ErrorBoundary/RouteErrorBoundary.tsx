import { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  routeName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RouteErrorBoundary extends Component<Props, State> {
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
    console.error(`RouteErrorBoundary caught an error in ${this.props.routeName || 'unknown route'}:`, error, errorInfo);
    
    // Log route-specific errors
    if (process.env.NODE_ENV === 'production') {
      this.logRouteError(error, errorInfo);
    }
  }

  private logRouteError = (error: Error, errorInfo: ErrorInfo) => {
    const errorData = {
      type: 'route_error',
      route: this.props.routeName || 'unknown',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pathname: window.location.pathname,
    };
    
    console.error('Route error logged:', errorData);
    // In production, send to error tracking service
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-lg w-full bg-card border border-border rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 text-destructive">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              
              <h2 className="text-lg font-semibold text-foreground mb-2">
                Page Error
              </h2>
              
              <p className="text-muted-foreground mb-6">
                {this.props.routeName 
                  ? `There was an error loading the ${this.props.routeName} page.`
                  : 'There was an error loading this page.'
                } Please try again or return to the home page.
              </p>

              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Try Again
                </button>
                
                <Link
                  to="/startDebate"
                  className="block w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium transition-colors text-center"
                >
                  Go to Home
                </Link>
              </div>

              {/* Development error details */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Route Error Details (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded text-xs font-mono overflow-auto max-h-32">
                    <div className="mb-2">
                      <strong>Route:</strong> {this.props.routeName || 'Unknown'}
                    </div>
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap mt-1 text-xs">
                          {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
