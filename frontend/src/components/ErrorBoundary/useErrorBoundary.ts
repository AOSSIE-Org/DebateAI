import { useState, useCallback } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Custom hook to manually trigger error boundaries and manage error state
 * Useful for async operations and event handlers that don't automatically trigger error boundaries
 */
export function useErrorBoundary() {
  const [errorState, setErrorState] = useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
  });

  // Function to manually trigger an error boundary
  const throwError = useCallback((error: Error) => {
    setErrorState({ hasError: true, error });
    // Re-throw the error to trigger the nearest error boundary
    throw error;
  }, []);

  // Function to reset error state
  const resetError = useCallback(() => {
    setErrorState({ hasError: false, error: null });
  }, []);

  // Function to handle async errors safely
  const handleAsyncError = useCallback(<T>(asyncFn: () => Promise<T>) => {
    return async (): Promise<T | undefined> => {
      try {
        const result = await asyncFn();
        return result;
      } catch (error) {
        console.error('Async error caught:', error);
        throwError(error instanceof Error ? error : new Error(String(error)));
        return undefined; // This line won't be reached due to throwError, but satisfies TypeScript
      }
    };
  }, [throwError]);

  // Function to wrap event handlers with error catching
  const wrapEventHandler = useCallback((handler: (...args: any[]) => void) => {
    return (...args: any[]) => {
      try {
        handler(...args);
      } catch (error) {
        console.error('Event handler error caught:', error);
        throwError(error instanceof Error ? error : new Error(String(error)));
      }
    };
  }, [throwError]);

  return {
    hasError: errorState.hasError,
    error: errorState.error,
    throwError,
    resetError,
    handleAsyncError,
    wrapEventHandler,
  };
}

/**
 * Hook specifically for WebSocket error handling
 */
export function useWebSocketErrorBoundary() {
  const { throwError, handleAsyncError, wrapEventHandler } = useErrorBoundary();

  const handleWebSocketError = useCallback((error: Event | Error) => {
    const wsError = error instanceof Error 
      ? error 
      : new Error('WebSocket connection error');
    
    console.error('WebSocket error:', wsError);
    throwError(wsError);
  }, [throwError]);

  const handleConnectionError = useCallback((message: string = 'Connection failed') => {
    const connectionError = new Error(`WebSocket ${message}`);
    throwError(connectionError);
  }, [throwError]);

  return {
    handleWebSocketError,
    handleConnectionError,
    handleAsyncError,
    wrapEventHandler,
  };
}

/**
 * Hook for debate room specific error handling
 */
export function useDebateRoomErrorBoundary() {
  const { throwError, handleAsyncError } = useErrorBoundary();

  const handleDebateError = useCallback((error: Error, context: string) => {
    const debateError = new Error(`Debate room error in ${context}: ${error.message}`);
    debateError.stack = error.stack;
    throwError(debateError);
  }, [throwError]);

  const handleSpeechRecognitionError = useCallback((error: any) => {
    const speechError = new Error(`Speech recognition error: ${error.error || error.message || 'Unknown error'}`);
    throwError(speechError);
  }, [throwError]);

  const handleWebRTCError = useCallback((error: Error) => {
    const webrtcError = new Error(`WebRTC error: ${error.message}`);
    webrtcError.stack = error.stack;
    throwError(webrtcError);
  }, [throwError]);

  return {
    handleDebateError,
    handleSpeechRecognitionError,
    handleWebRTCError,
    handleAsyncError,
  };
}
