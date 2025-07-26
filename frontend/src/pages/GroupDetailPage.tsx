import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import GroupMembers from '../components/GroupMembers';
import InviteLink from '../components/InviteLink';
import ActivityProposalForm from '../components/ActivityProposalForm';
import ActivityList from '../components/ActivityList';
import ActivityNotification from '../components/ActivityNotification';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useRealTimeActivities } from '../hooks/useRealTimeActivities';
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
  const { isConnected } = useSocket();
  const [group, setGroup] = useState<Group | null>(null);
  const [initialActivities, setInitialActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);

  // Use real-time activities hook
  const { 
    activities, 
    newActivityNotification, 
    dismissNotification 
  } = useRealTimeActivities({
    groupId: groupId || '',
    initialActivities
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

  const handleActivityCreated = (newActivity: Activity) => {
    setShowProposalForm(false);
    // The real-time hook will handle adding the activity to the list
  };

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
                    <div className="connection-status">
                      <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
                      {isConnected ? 'Live updates' : 'Offline'}
                    </div>
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
              members={group.members}
              creatorId={group.creatorId}
              currentUserId={user?.id || ''}
            />
          </div>
        </div>

        {/* Real-time notification for new activities */}
        {newActivityNotification && (
          <ActivityNotification
            activity={newActivityNotification}
            onDismiss={dismissNotification}
          />
        )}

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
      </div>
    </div>
  );
};

export default GroupDetailPage;