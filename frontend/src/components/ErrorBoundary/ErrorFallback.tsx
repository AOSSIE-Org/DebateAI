import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { ErrorFallbackProps } from './types';

export function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border rounded-lg shadow-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-16 w-16 text-destructive" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Oops! Something went wrong
        </h1>
        
        <p className="text-muted-foreground mb-6">
          We encountered an unexpected error. Don't worry, our team has been notified.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={resetError}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        </div>
        
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export function RouteErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="max-w-sm w-full bg-card border rounded-lg shadow p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Page Error
        </h2>
        
        <p className="text-sm text-muted-foreground mb-4">
          This page encountered an error. Please try refreshing or go back.
        </p>
        
        <div className="space-y-2">
          <button
            onClick={resetError}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded text-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
          
          <button
            onClick={() => window.history.back()}
            className="w-full bg-secondary text-secondary-foreground px-3 py-2 rounded text-sm hover:bg-secondary/90 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function ComponentErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-4 m-2">
      <div className="flex items-center gap-2 text-destructive mb-2">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">Component Error</span>
      </div>
      
      <p className="text-xs text-muted-foreground mb-3">
        A component failed to render properly.
      </p>
      
      <button
        onClick={resetError}
        className="flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90 transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
      
      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Debug Info
          </summary>
          <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto max-h-20">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  );
}
