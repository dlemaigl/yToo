import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

interface Activity {
  id: string;
  title: string;
  description?: string;
  isChosen: boolean;
  createdAt: string;
}

interface Member {
  id: string;
  username: string;
  joinedAt: string;
}

interface ActivityUpdateEvent {
  activity: Activity;
}

interface ActivityStatusEvent {
  activityId: string;
  isChosen: boolean;
}

interface MemberJoinedEvent {
  member: Member;
  groupId: string;
}

interface Notification {
  id: string;
  type: 'activity_added' | 'activity_chosen' | 'activity_unchosen' | 'member_joined';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

interface UseRealTimeUpdatesProps {
  groupId: string;
  initialActivities: Activity[];
  initialMembers?: Member[];
  onActivityUpdate?: (activities: Activity[]) => void;
  onMemberUpdate?: (members: Member[]) => void;
}

export const useRealTimeUpdates = ({
  groupId,
  initialActivities,
  initialMembers = [],
  onActivityUpdate,
  onMemberUpdate
}: UseRealTimeUpdatesProps) => {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastActivityUpdate, setLastActivityUpdate] = useState<Date | null>(null);
  const { socket, isConnected, isReconnecting, connectionError, joinGroup, leaveGroup } = useSocket();

  // Update activities when initial data changes
  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  // Update members when initial data changes
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  // Join/leave group room for real-time updates
  useEffect(() => {
    if (isConnected && groupId) {
      joinGroup(groupId);
      
      return () => {
        leaveGroup(groupId);
      };
    }
  }, [isConnected, groupId, joinGroup, leaveGroup]);

  // Create notification helper
  const createNotification = useCallback((
    type: Notification['type'],
    title: string,
    message: string,
    data?: any
  ): Notification => ({
    id: `${type}-${Date.now()}-${Math.random()}`,
    type,
    title,
    message,
    timestamp: new Date(),
    data
  }), []);

  // Add notification and auto-remove after delay
  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  // Dismiss notification manually
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!socket) return;

    const handleActivityAdded = (data: ActivityUpdateEvent) => {
      console.log('New activity added:', data.activity);
      
      setActivities(prev => {
        // Check if activity already exists to avoid duplicates
        const exists = prev.some(activity => activity.id === data.activity.id);
        if (exists) return prev;
        
        const updated = [...prev, data.activity];
        onActivityUpdate?.(updated);
        return updated;
      });
      
      setLastActivityUpdate(new Date());
      
      // Show notification for new activity
      const notification = createNotification(
        'activity_added',
        'New Activity Proposed!',
        `"${data.activity.title}" has been added to the group`,
        data.activity
      );
      addNotification(notification);
    };

    const handleActivityChosen = (data: ActivityStatusEvent) => {
      console.log('Activity chosen:', data);
      
      setActivities(prev => {
        const updated = prev.map(activity => 
          activity.id === data.activityId 
            ? { ...activity, isChosen: true }
            : { ...activity, isChosen: false } // Only one activity can be chosen
        );
        onActivityUpdate?.(updated);
        return updated;
      });
      
      setLastActivityUpdate(new Date());
      
      // Find the chosen activity to show in notification
      const chosenActivity = activities.find(a => a.id === data.activityId);
      if (chosenActivity) {
        const notification = createNotification(
          'activity_chosen',
          'Activity Chosen! 🎉',
          `"${chosenActivity.title}" has been selected by the group`,
          { activityId: data.activityId, activity: chosenActivity }
        );
        addNotification(notification);
      }
    };

    const handleActivityUnchosen = (data: ActivityStatusEvent) => {
      console.log('Activity unchosen:', data);
      
      setActivities(prev => {
        const updated = prev.map(activity => 
          activity.id === data.activityId 
            ? { ...activity, isChosen: false }
            : activity
        );
        onActivityUpdate?.(updated);
        return updated;
      });
      
      setLastActivityUpdate(new Date());
      
      // Find the unchosen activity to show in notification
      const unchosenActivity = activities.find(a => a.id === data.activityId);
      if (unchosenActivity) {
        const notification = createNotification(
          'activity_unchosen',
          'Activity Status Changed',
          `"${unchosenActivity.title}" is no longer the chosen activity`,
          { activityId: data.activityId, activity: unchosenActivity }
        );
        addNotification(notification);
      }
    };

    const handleMemberJoined = (data: MemberJoinedEvent) => {
      console.log('Member joined:', data);
      
      if (data.groupId === groupId) {
        setMembers(prev => {
          // Check if member already exists to avoid duplicates
          const exists = prev.some(member => member.id === data.member.id);
          if (exists) return prev;
          
          const updated = [...prev, data.member];
          onMemberUpdate?.(updated);
          return updated;
        });
        
        // Show notification for new member
        const notification = createNotification(
          'member_joined',
          'New Member Joined! 👋',
          `${data.member.username} has joined the group`,
          data.member
        );
        addNotification(notification);
      }
    };

    // Handle connection status changes
    const handleReconnect = () => {
      console.log('Socket reconnected, rejoining group');
      if (groupId) {
        joinGroup(groupId);
      }
    };

    // Register event listeners
    socket.on('group:activity_added', handleActivityAdded);
    socket.on('group:activity_chosen', handleActivityChosen);
    socket.on('group:activity_unchosen', handleActivityUnchosen);
    socket.on('group:member_joined', handleMemberJoined);
    socket.on('reconnect', handleReconnect);

    // Cleanup event listeners
    return () => {
      socket.off('group:activity_added', handleActivityAdded);
      socket.off('group:activity_chosen', handleActivityChosen);
      socket.off('group:activity_unchosen', handleActivityUnchosen);
      socket.off('group:member_joined', handleMemberJoined);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, groupId, activities, createNotification, addNotification, onActivityUpdate, onMemberUpdate, joinGroup]);

  return {
    // Data
    activities,
    members,
    
    // Notifications
    notifications,
    dismissNotification,
    clearAllNotifications,
    
    // Connection status
    isConnected,
    isReconnecting,
    connectionError,
    lastActivityUpdate,
    
    // Utilities
    hasRecentActivity: lastActivityUpdate && (Date.now() - lastActivityUpdate.getTime()) < 30000 // 30 seconds
  };
};