import React from 'react';
import Button from './ui/Button';

interface Activity {
  id: string;
  title: string;
  description?: string;
  isChosen: boolean;
  createdAt: string;
}

interface ActivityNotificationProps {
  activity: Activity;
  onDismiss: () => void;
}

const ActivityNotification: React.FC<ActivityNotificationProps> = ({
  activity,
  onDismiss
}) => {
  return (
    <div className="activity-notification">
      <div className="activity-notification-content">
        <div className="activity-notification-icon">
          🎯
        </div>
        <div className="activity-notification-text">
          <h4>New Activity Proposed!</h4>
          <p>"{activity.title}" has been added to the group</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="activity-notification-dismiss"
        >
          ×
        </Button>
      </div>
    </div>
  );
};

export default ActivityNotification;