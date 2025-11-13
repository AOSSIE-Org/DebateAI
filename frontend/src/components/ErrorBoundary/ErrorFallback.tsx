import { Link } from 'react-router-dom';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  message?: string;
  showRetry?: boolean;
  showHome?: boolean;
}

export function ErrorFallback({
  resetError,
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  showRetry = true,
  showHome = true,
}: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-destructive">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {title}
          </h3>
          
          <p className="text-muted-foreground mb-6">
            {message}
          </p>

          <div className="space-y-3">
            {showRetry && resetError && (
              <button
                onClick={resetError}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors"
              >
                Try Again
              </button>
            )}
            
            {showHome && (
              <Link
                to="/startDebate"
                className="block w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium transition-colors text-center"
              >
                Go to Home
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Specialized error fallbacks for different scenarios
export function DebateRoomErrorFallback({ resetError }: { resetError?: () => void }) {
  return (
    <ErrorFallback
      resetError={resetError}
      title="Debate Room Error"
      message="There was an error with the debate room. This might be due to connection issues or an unexpected problem."
      showRetry={true}
      showHome={true}
    />
  );
}

export function WebSocketErrorFallback({ resetError }: { resetError?: () => void }) {
  return (
    <ErrorFallback
      resetError={resetError}
      title="Connection Error"
      message="Unable to establish a real-time connection. Please check your internet connection and try again."
      showRetry={true}
      showHome={true}
    />
  );
}

export function AuthErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-destructive">
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Authentication Error
          </h3>
          
          <p className="text-muted-foreground mb-6">
            There was an error with authentication. Please sign in again.
          </p>

          <div className="space-y-3">
            <Link
              to="/auth"
              className="block w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors text-center"
            >
              Sign In
            </Link>
            
            <Link
              to="/"
              className="block w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium transition-colors text-center"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComponentErrorFallback({ 
  resetError, 
  componentName 
}: { 
  resetError?: () => void; 
  componentName?: string;
}) {
  return (
    <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-5 h-5 text-destructive">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h4 className="font-medium text-destructive">
          {componentName ? `${componentName} Error` : 'Component Error'}
        </h4>
      </div>
      
      <p className="text-sm text-muted-foreground mb-3">
        This component encountered an error and couldn't render properly.
      </p>
      
      {resetError && (
        <button
          onClick={resetError}
          className="text-sm bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 rounded font-medium transition-colors"
        >
          Retry Component
        </button>
      )}
    </div>
  );
}
