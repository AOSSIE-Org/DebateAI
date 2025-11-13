import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { RouteErrorFallback } from './ErrorFallback';
import { ErrorBoundaryProps } from './types';

interface RouteErrorBoundaryProps extends Omit<ErrorBoundaryProps, 'fallback'> {
  fallback?: React.ComponentType<any>;
}

export default function RouteErrorBoundary({ 
  children, 
  fallback = RouteErrorFallback,
  ...props 
}: RouteErrorBoundaryProps) {
  return (
    <ErrorBoundary fallback={fallback} {...props}>
      {children}
    </ErrorBoundary>
  );
}
