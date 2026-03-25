import React from 'react';
import { Button } from './ui/button';

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
type RTCState = 'connected' | 'disconnected' | 'failed';

interface ConnectionStatusProps {
  state: ConnectionState;
  retryCount: number;
  maxRetries: number;
  rtcState: RTCState;
  lastErrorMessage: string | null;
  onReconnect: () => void;
  onLeave: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  retryCount,
  maxRetries,
  rtcState,
  lastErrorMessage,
  onReconnect,
  onLeave,
}) => {
  const getStatusColor = () => {
    switch (state) {
      case 'connected':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'connecting':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'reconnecting':
        return 'text-amber-600 bg-amber-100 border-amber-200';
      case 'disconnected':
      case 'error':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (state) {
      case 'connected':
        return '●';
      case 'connecting':
        return '↻';
      case 'reconnecting':
        return '↻';
      case 'disconnected':
        return '⚠';
      case 'error':
        return '⚠';
      default:
        return '○';
    }
  };

  const getStatusText = () => {
    switch (state) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return `Reconnecting (${retryCount}/${maxRetries})...`;
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return `Connection Error`;
      default:
        return 'Unknown';
    }
  };

  const getRTCStatusText = () => {
    switch (rtcState) {
      case 'connected':
        return 'Video/Audio: OK';
      case 'disconnected':
        return 'Video/Audio: Disconnected';
      case 'failed':
        return 'Video/Audio: Failed';
      default:
        return '';
    }
  };

  const shouldShowComponent = () => {
    // Show component when not connected or when there's an issue
    return state !== 'connected' || rtcState !== 'connected';
  };

  if (!shouldShowComponent()) {
    // Minimal connected indicator
    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center space-x-2 bg-green-100 border border-green-200 rounded-lg px-3 py-2 shadow-sm">
          <span className="text-green-600 text-sm font-medium">● Connected</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className={`border rounded-lg p-4 shadow-lg ${getStatusColor()}`}>
        <div className="flex items-center space-x-2 mb-2">
          <span className={`text-lg ${state === 'reconnecting' ? 'animate-spin' : ''}`}>
            {getStatusIcon()}
          </span>
          <span className="font-semibold text-sm">{getStatusText()}</span>
        </div>

        {rtcState !== 'connected' && (
          <div className="text-xs mb-2 text-gray-700">
            {getRTCStatusText()}
          </div>
        )}

        {lastErrorMessage && (
          <div className="text-xs mb-3 text-gray-800 bg-white bg-opacity-50 rounded p-2">
            <strong>Error:</strong> {lastErrorMessage}
          </div>
        )}

        {(state === 'disconnected' || state === 'error') && (
          <div className="flex space-x-2">
            <Button
              onClick={onReconnect}
              className="text-xs px-3 py-1 h-8 rounded-md"
            >
              Reconnect
            </Button>
            <Button
              onClick={onLeave}
              className="text-xs px-3 py-1 h-8 rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              Leave Debate
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;