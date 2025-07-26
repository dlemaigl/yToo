import React from 'react';
import Button from './ui/Button';

interface ConnectionStatusProps {
  isConnected: boolean;
  isReconnecting: boolean;
  connectionError: string | null;
  onReconnect: () => void;
  hasRecentActivity?: boolean | null;
  lastActivityUpdate?: Date | null;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isReconnecting,
  connectionError,
  onReconnect,
  hasRecentActivity = false,
  lastActivityUpdate
}) => {
  const getStatusText = () => {
    if (isReconnecting) {
      return 'Reconnecting...';
    }
    if (isConnected) {
      return hasRecentActivity ? 'Live updates (active)' : 'Live updates';
    }
    if (connectionError) {
      return 'Connection failed';
    }
    return 'Offline';
  };

  const getStatusClass = () => {
    if (isReconnecting) {
      return 'reconnecting';
    }
    if (isConnected) {
      return hasRecentActivity ? 'connected active' : 'connected';
    }
    return 'disconnected';
  };

  const formatLastUpdate = () => {
    if (!lastActivityUpdate) return null;
    
    const now = new Date();
    const diff = now.getTime() - lastActivityUpdate.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else {
      return lastActivityUpdate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  return (
    <div className="connection-status-container">
      <div className={`connection-status ${getStatusClass()}`}>
        <div className="connection-indicator-wrapper">
          <div className="connection-indicator"></div>
          {isReconnecting && <div className="connection-spinner"></div>}
        </div>
        
        <div className="connection-text">
          <span className="connection-status-text">{getStatusText()}</span>
          {lastActivityUpdate && (
            <span className="last-update-text">
              Last update: {formatLastUpdate()}
            </span>
          )}
        </div>
        
        {!isConnected && !isReconnecting && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReconnect}
            className="reconnect-btn"
          >
            Reconnect
          </Button>
        )}
      </div>
      
      {connectionError && (
        <div className="connection-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{connectionError}</span>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;