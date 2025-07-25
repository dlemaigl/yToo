import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { apiClient } from '../services/apiClient';

const JoinGroupPage: React.FC = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [groupName, setGroupName] = useState('');

  const handleJoinGroup = async () => {
    if (!inviteToken) {
      setError('Invalid invitation link');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post(`/groups/join/${inviteToken}`);
      setGroupName(response.data.group.name);
      setSuccess(true);
      
      // Redirect to the group after a short delay
      setTimeout(() => {
        navigate(`/groups/${response.data.group.id}`);
      }, 2000);
    } catch (err: any) {
      if (err.message.includes('already a member')) {
        setError('You are already a member of this group');
      } else if (err.message.includes('Invalid or expired')) {
        setError('This invitation link is invalid or has expired');
      } else {
        setError(err.message || 'Failed to join group');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page">
        <div className="page-content">
          <Card>
            <div className="success-state">
              <h2>Welcome to {groupName}!</h2>
              <p>You have successfully joined the group.</p>
              <p>Redirecting you to the group page...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Join Group</h1>
      </div>

      <div className="page-content">
        <Card>
          <div className="join-group-content">
            <h3>You've been invited to join a group!</h3>
            <p>Click the button below to join and start participating in group activities.</p>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-actions">
              <Button onClick={handleJoinGroup} loading={loading}>
                Join Group
              </Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                Go to My Groups
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default JoinGroupPage;