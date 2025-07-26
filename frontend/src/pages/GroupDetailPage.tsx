import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import GroupMembers from '../components/GroupMembers';
import InviteLink from '../components/InviteLink';
import ActivityProposalForm from '../components/ActivityProposalForm';
import ActivityList from '../components/ActivityList';
import NotificationSystem from '../components/NotificationSystem';
import ConnectionStatus from '../components/ConnectionStatus';
import OfflineModal from '../components/OfflineModal';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import { useVoting } from '../hooks/useVoting';

interface Group {
  id: string;
  name: string;
  creatorId: string;
  inviteToken: string;
  createdAt: string;
  members: Array<{
    id: string;
    username: string;
    joinedAt: string;
  }>;
}

interface Activity {
  id: string;
  title: string;
  description?: string;
  isChosen: boolean;
  createdAt: string;
}

const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { reconnect } = useSocket();
  const [group, setGroup] = useState<Group | null>(null);
  const [initialActivities, setInitialActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineModalDismissed, setOfflineModalDismissed] = useState(false);

  // Use enhanced real-time updates hook
  const { 
    activities,
    members,
    notifications,
    dismissNotification,
    clearAllNotifications,
    isConnected,
    isReconnecting,
    connectionError,
    lastActivityUpdate,
    hasRecentActivity
  } = useRealTimeUpdates({
    groupId: groupId || '',
    initialActivities,
    initialMembers: group?.members || [],
    onActivityUpdate: (updatedActivities) => {
      // Optional: Handle activity updates if needed
    },
    onMemberUpdate: (updatedMembers) => {
      // Update group members when new members join
      if (group) {
        setGroup(prev => prev ? { ...prev, members: updatedMembers } : null);
      }
    }
  });

  // Use voting hook
  const {
    hasUserVoted,
    castVote,
    removeVote,
    loading: votingLoading,
    error: votingError
  } = useVoting({
    groupId: groupId || '',
    activities
  });

  useEffect(() => {
    if (groupId) {
      fetchGroupDetails();
      fetchActivities();
    }
  }, [groupId]);

  const fetchGroupDetails = async () => {
    try {
      const response = await apiClient.get(`/groups/${groupId}`);
      setGroup(response.data.group);
    } catch (err: any) {
      if (err.status === 404) {
        setError('Group not found');
      } else if (err.status === 403) {
        setError('You do not have access to this group');
      } else {
        setError(err.message || 'Failed to fetch group details');
      }
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await apiClient.get(`/groups/${groupId}/activities`);
      setInitialActivities(response.data.activities);
    } catch (err: any) {
      // Activities might not be accessible if user isn't a member
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle extended offline states
  useEffect(() => {
    let offlineTimer: NodeJS.Timeout;
    
    if (!isConnected && !isReconnecting && !offlineModalDismissed) {
      // Show offline modal after 10 seconds of being disconnected
      offlineTimer = setTimeout(() => {
        setShowOfflineModal(true);
      }, 10000);
    } else {
      setShowOfflineModal(false);
    }
    
    return () => {
      if (offlineTimer) {
        clearTimeout(offlineTimer);
      }
    };
  }, [isConnected, isReconnecting, offlineModalDismissed]);

  // Reset offline modal state when connection is restored
  useEffect(() => {
    if (isConnected) {
      setOfflineModalDismissed(false);
      setShowOfflineModal(false);
    }
  }, [isConnected]);

  const handleActivityCreated = (newActivity: Activity) => {
    setShowProposalForm(false);
    // The real-time hook will handle adding the activity to the list
  };

  const handleOfflineModalDismiss = () => {
    setShowOfflineModal(false);
    setOfflineModalDismissed(true);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-content">
          <div className="loading-state">Loading group details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="page-content">
          <Card>
            <div className="error-state">
              <h3>Error</h3>
              <p>{error}</p>
              <Button onClick={() => navigate('/')}>
                Back to Groups
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="page">
        <div className="page-content">
          <Card>
            <div className="error-state">
              <h3>Group not found</h3>
              <Button onClick={() => navigate('/')}>
                Back to Groups
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1>{group.name}</h1>
            <p className="group-subtitle">
              {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
            </p>
          </div>
          <div className="page-header-actions">
            <Button variant="outline" onClick={() => setShowInviteLink(!showInviteLink)}>
              {showInviteLink ? 'Hide' : 'Share'} Invite Link
            </Button>
            <Button onClick={() => setShowProposalForm(true)}>
              Propose Activity
            </Button>
          </div>
        </div>
      </div>

      <div className="page-content">
        {showInviteLink && (
          <InviteLink 
            inviteToken={group.inviteToken} 
            groupName={group.name}
          />
        )}

        <div className="group-detail-grid">
          <div className="group-detail-main">
            {showProposalForm ? (
              <ActivityProposalForm
                groupId={groupId!}
                onActivityCreated={handleActivityCreated}
                onCancel={() => setShowProposalForm(false)}
              />
            ) : (
              <Card>
                <div className="activities-section">
                  <div className="activities-header">
                    <h3>Activities</h3>
                    <ConnectionStatus
                      isConnected={isConnected}
                      isReconnecting={isReconnecting}
                      connectionError={connectionError}
                      onReconnect={reconnect}
                      hasRecentActivity={hasRecentActivity}
                      lastActivityUpdate={lastActivityUpdate}
                    />
                  </div>
                  
                  <ActivityList 
                    activities={activities}
                    onVote={castVote}
                    onRemoveVote={removeVote}
                    hasUserVoted={hasUserVoted}
                    votingDisabled={votingLoading}
                  />
                </div>
              </Card>
            )}
          </div>

          <div className="group-detail-sidebar">
            <GroupMembers 
              members={members.length > 0 ? members : group.members}
              creatorId={group.creatorId}
              currentUserId={user?.id || ''}
            />
          </div>
        </div>

        {/* Enhanced notification system */}
        <NotificationSystem
          notifications={notifications}
          onDismiss={dismissNotification}
          onClearAll={clearAllNotifications}
        />

        {/* Voting error notification */}
        {votingError && (
          <div className="error-notification">
            <div className="error-content">
              <span className="error-message">{votingError}</span>
              <button 
                className="error-dismiss"
                onClick={() => {/* Error will clear on next successful action */}}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Offline state modal */}
        <OfflineModal
          isVisible={showOfflineModal}
          onReconnect={reconnect}
          onDismiss={handleOfflineModalDismiss}
          isReconnecting={isReconnecting}
        />
      </div>
    </div>
  );
};

export default GroupDetailPage;