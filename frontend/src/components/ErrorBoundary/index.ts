export { default as GlobalErrorBoundary } from './GlobalErrorBoundary';
export { default as RouteErrorBoundary } from './RouteErrorBoundary';
export {
  ErrorFallback,
  DebateRoomErrorFallback,
  WebSocketErrorFallback,
  AuthErrorFallback,
  ComponentErrorFallback,
} from './ErrorFallback';
export {
  useErrorBoundary,
  useWebSocketErrorBoundary,
  useDebateRoomErrorBoundary,
} from './useErrorBoundary';

