import { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

interface Activity {
  id: string;
  title: string;
  description?: string;
  isChosen: boolean;
  createdAt: string;
}

interface UseRealTimeActivitiesProps {
  groupId: string;
  initialActivities: Activity[];
}

interface ActivityUpdateEvent {
  activity: Activity;
}

interface ActivityStatusEvent {
  activityId: string;
  isChosen: boolean;
}

export const useRealTimeActivities = ({ 
  groupId, 
  initialActivities 
}: UseRealTimeActivitiesProps) => {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [newActivityNotification, setNewActivityNotification] = useState<Activity | null>(null);
  const { socket, isConnected, joinGroup, leaveGroup } = useSocket();

  // Update activities when initial data changes
  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  // Join/leave group room for real-time updates
  useEffect(() => {
    if (isConnected && groupId) {
      joinGroup(groupId);
      
      return () => {
        leaveGroup(groupId);
      };
    }
  }, [isConnected, groupId, joinGroup, leaveGroup]);

  // Set up event listeners
  useEffect(() => {
    if (!socket) return;

    const handleActivityAdded = (data: ActivityUpdateEvent) => {
      console.log('New activity added:', data.activity);
      
      setActivities(prev => {
        // Check if activity already exists to avoid duplicates
        const exists = prev.some(activity => activity.id === data.activity.id);
        if (exists) return prev;
        
        return [...prev, data.activity];
      });
      
      // Show notification for new activity
      setNewActivityNotification(data.activity);
      
      // Clear notification after 5 seconds
      setTimeout(() => {
        setNewActivityNotification(null);
      }, 5000);
    };

    const handleActivityChosen = (data: ActivityStatusEvent) => {
      console.log('Activity status changed:', data);
      
      setActivities(prev => 
        prev.map(activity => 
          activity.id === data.activityId 
            ? { ...activity, isChosen: data.isChosen }
            : activity
        )
      );
    };

    const handleActivityUnchosen = (data: ActivityStatusEvent) => {
      console.log('Activity unchosen:', data);
      
      setActivities(prev => 
        prev.map(activity => 
          activity.id === data.activityId 
            ? { ...activity, isChosen: false }
            : activity
        )
      );
    };

    // Register event listeners
    socket.on('group:activity_added', handleActivityAdded);
    socket.on('group:activity_chosen', handleActivityChosen);
    socket.on('group:activity_unchosen', handleActivityUnchosen);

    // Cleanup event listeners
    return () => {
      socket.off('group:activity_added', handleActivityAdded);
      socket.off('group:activity_chosen', handleActivityChosen);
      socket.off('group:activity_unchosen', handleActivityUnchosen);
    };
  }, [socket]);

  const dismissNotification = () => {
    setNewActivityNotification(null);
  };

  return {
    activities,
    newActivityNotification,
    dismissNotification,
    isConnected
  };
};