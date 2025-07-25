import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import GroupCreateForm from '../components/GroupCreateForm';
import { apiClient } from '../services/apiClient';

interface Group {
  id: string;
  name: string;
  creatorId: string;
  memberCount: number;
  createdAt: string;
}

const GroupListPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/groups');
      setGroups(response.data.groups);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupCreated = (newGroup: Group) => {
    setGroups(prev => [newGroup, ...prev]);
    setShowCreateForm(false);
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/groups/${groupId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-content">
          <div className="loading-state">Loading groups...</div>
        </div>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Create New Group</h1>
        </div>
        <div className="page-content">
          <GroupCreateForm
            onGroupCreated={handleGroupCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Groups</h1>
        <Button onClick={() => setShowCreateForm(true)}>
          Create Group
        </Button>
      </div>

      <div className="page-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {groups.length === 0 ? (
          <Card>
            <div className="empty-state">
              <h3>No groups yet</h3>
              <p>Create your first group to start organizing activities with friends!</p>
              <Button onClick={() => setShowCreateForm(true)}>
                Create Your First Group
              </Button>
            </div>
          </Card>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <Card key={group.id} className="group-card">
                <div 
                  className="group-card-content"
                  onClick={() => handleGroupClick(group.id)}
                >
                  <h3 className="group-name">{group.name}</h3>
                  <div className="group-meta">
                    <span className="group-members">
                      {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                    </span>
                    <span className="group-created">
                      Created {formatDate(group.createdAt)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupListPage;