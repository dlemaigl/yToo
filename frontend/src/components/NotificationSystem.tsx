import React from 'react';
import Button from './ui/Button';

interface Notification {
  id: string;
  type: 'activity_added' | 'activity_chosen' | 'activity_unchosen' | 'member_joined';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (notificationId: string) => void;
  onClearAll: () => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onDismiss,
  onClearAll
}) => {
  if (notifications.length === 0) {
    return null;
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'activity_added':
        return '🎯';
      case 'activity_chosen':
        return '🎉';
      case 'activity_unchosen':
        return '🔄';
      case 'member_joined':
        return '👋';
      default:
        return '📢';
    }
  };

  const getNotificationClass = (type: Notification['type']) => {
    switch (type) {
      case 'activity_added':
        return 'notification-info';
      case 'activity_chosen':
        return 'notification-success';
      case 'activity_unchosen':
        return 'notification-warning';
      case 'member_joined':
        return 'notification-info';
      default:
        return 'notification-info';
    }
  };

  return (
    <div className="notification-system">
      {notifications.length > 1 && (
        <div className="notification-header">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAll}
            className="clear-all-btn"
          >
            Clear All ({notifications.length})
          </Button>
        </div>
      )}
      
      <div className="notifications-container">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification ${getNotificationClass(notification.type)}`}
          >
            <div className="notification-content">
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-text">
                <h4 className="notification-title">{notification.title}</h4>
                <p className="notification-message">{notification.message}</p>
                <span className="notification-time">
                  {notification.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDismiss(notification.id)}
                className="notification-dismiss"
              >
                ×
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationSystem;