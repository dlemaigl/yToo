import React from 'react';
import Button from './ui/Button';

interface OfflineModalProps {
  isVisible: boolean;
  onReconnect: () => void;
  onDismiss: () => void;
  isReconnecting: boolean;
}

const OfflineModal: React.FC<OfflineModalProps> = ({
  isVisible,
  onReconnect,
  onDismiss,
  isReconnecting
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="offline-overlay">
      <div className="offline-modal">
        <div className="offline-icon">📡</div>
        <h3>Connection Lost</h3>
        <p>
          You've been disconnected from the live updates. Some features may not work properly 
          until the connection is restored.
        </p>
        <div className="offline-actions">
          <Button
            onClick={onReconnect}
            disabled={isReconnecting}
            className="reconnect-primary-btn"
          >
            {isReconnecting ? 'Reconnecting...' : 'Try to Reconnect'}
          </Button>
          <Button
            variant="outline"
            onClick={onDismiss}
            disabled={isReconnecting}
          >
            Continue Offline
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OfflineModal;