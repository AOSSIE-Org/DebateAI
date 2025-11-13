import { ErrorDetails } from './types';

class ErrorLogger {
  private static instance: ErrorLogger;
  private errorQueue: ErrorDetails[] = [];
  private isOnline: boolean = navigator.onLine;

  private constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushErrorQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  public logError(error: Error, componentStack?: string, userId?: string): void {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId,
    };

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Component Stack:', componentStack);
      console.error('Error Details:', errorDetails);
      console.groupEnd();
    }

    // Store error locally
    this.storeErrorLocally(errorDetails);

    // Send to remote logging service if online
    if (this.isOnline) {
      this.sendToRemoteLogger(errorDetails);
    } else {
      this.errorQueue.push(errorDetails);
    }
  }

  private storeErrorLocally(errorDetails: ErrorDetails): void {
    try {
      const existingErrors = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      const updatedErrors = [...existingErrors, errorDetails].slice(-50); // Keep last 50 errors
      localStorage.setItem('errorLogs', JSON.stringify(updatedErrors));
    } catch (e) {
      console.warn('Failed to store error locally:', e);
    }
  }

  private async sendToRemoteLogger(errorDetails: ErrorDetails): Promise<void> {
    try {
      // Replace with your actual error reporting service
      // Examples: Sentry, LogRocket, Bugsnag, or custom endpoint
      const response = await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorDetails),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (e) {
      console.warn('Failed to send error to remote logger:', e);
      // Add back to queue for retry
      this.errorQueue.push(errorDetails);
    }
  }

  private async flushErrorQueue(): Promise<void> {
    while (this.errorQueue.length > 0 && this.isOnline) {
      const errorDetails = this.errorQueue.shift();
      if (errorDetails) {
        await this.sendToRemoteLogger(errorDetails);
      }
    }
  }

  public getLocalErrors(): ErrorDetails[] {
    try {
      return JSON.parse(localStorage.getItem('errorLogs') || '[]');
    } catch (e) {
      console.warn('Failed to retrieve local errors:', e);
      return [];
    }
  }

  public clearLocalErrors(): void {
    try {
      localStorage.removeItem('errorLogs');
    } catch (e) {
      console.warn('Failed to clear local errors:', e);
    }
  }
}

export default ErrorLogger;
