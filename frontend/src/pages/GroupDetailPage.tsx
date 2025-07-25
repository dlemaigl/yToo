import React from 'react';
import { useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div className="page">
      <div className="page-header">
        <h1>Group Activities</h1>
        <Button>Propose Activity</Button>
      </div>

      <div className="page-content">
        <Card>
          <div className="empty-state">
            <h3>No activities yet</h3>
            <p>Be the first to propose an activity for this group!</p>
            <Button>Propose First Activity</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GroupDetailPage;