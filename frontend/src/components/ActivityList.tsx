import React from 'react';

interface Activity {
  id: string;
  title: string;
  description?: string;
  isChosen: boolean;
  createdAt: string;
}

interface ActivityListProps {
  activities: Activity[];
  onActivityClick?: (activity: Activity) => void;
}

const ActivityList: React.FC<ActivityListProps> = ({ 
  activities, 
  onActivityClick 
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (activities.length === 0) {
    return (
      <div className="empty-state">
        <h4>No activities yet</h4>
        <p>Be the first to propose an activity for this group!</p>
      </div>
    );
  }

  return (
    <div className="activities-list">
      {activities.map((activity) => (
        <div 
          key={activity.id} 
          className={`activity-item ${activity.isChosen ? 'activity-chosen' : ''} ${
            onActivityClick ? 'activity-clickable' : ''
          }`}
          onClick={() => onActivityClick?.(activity)}
        >
          <div className="activity-content">
            <div className="activity-header">
              <h4 className="activity-title">
                {activity.title}
              </h4>
              <div className="activity-status">
                {activity.isChosen ? (
                  <span className="activity-chosen-badge">
                    ✓ Chosen
                  </span>
                ) : (
                  <span className="activity-pending-badge">
                    Pending
                  </span>
                )}
              </div>
            </div>
            
            {activity.description && (
              <p className="activity-description">
                {activity.description}
              </p>
            )}
            
            <div className="activity-meta">
              <span className="activity-date">
                Proposed {formatDate(activity.createdAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityList;