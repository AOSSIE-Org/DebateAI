import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { ComponentErrorFallback } from './ErrorFallback';
import { ErrorBoundaryProps } from './types';

interface WithErrorBoundaryOptions extends Omit<ErrorBoundaryProps, 'children'> {
  fallback?: React.ComponentType<any>;
  displayName?: string;
}

type ComponentWithOptionalRef<P> = React.ComponentType<P> | React.ForwardRefExoticComponent<P>;

export function withErrorBoundary<P extends object>(
  Component: ComponentWithOptionalRef<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const {
    fallback = ComponentErrorFallback,
    displayName,
    ...errorBoundaryProps
  } = options;

  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    return (
      <ErrorBoundary fallback={fallback} {...errorBoundaryProps}>
        <Component {...props as any} ref={ref} />
      </ErrorBoundary>
    );
  });

  WrappedComponent.displayName = displayName || `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Convenience HOCs for specific use cases
export const withRouteErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
) => withErrorBoundary(Component, {
  displayName: `withRouteErrorBoundary(${Component.displayName || Component.name})`,
});

export const withComponentErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
) => withErrorBoundary(Component, {
  fallback: ComponentErrorFallback,
  displayName: `withComponentErrorBoundary(${Component.displayName || Component.name})`,
});

export default withErrorBoundary;
