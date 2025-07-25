import React from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const GroupListPage: React.FC = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>My Groups</h1>
        <Button>Create Group</Button>
      </div>

      <div className="page-content">
        <Card>
          <div className="empty-state">
            <h3>No groups yet</h3>
            <p>Create your first group to start organizing activities with friends!</p>
            <Button>Create Your First Group</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GroupListPage;