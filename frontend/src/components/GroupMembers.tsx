import React from 'react';
import Card from './ui/Card';

interface Member {
  id: string;
  username: string;
  joinedAt: string;
}

interface GroupMembersProps {
  members: Member[];
  creatorId: string;
  currentUserId: string;
}

const GroupMembers: React.FC<GroupMembersProps> = ({ members, creatorId, currentUserId }) => {
  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card>
      <div className="group-members">
        <h4>Members ({members.length})</h4>
        
        <div className="members-list">
          {members.map((member) => (
            <div key={member.id} className="member-item">
              <div className="member-info">
                <span className="member-name">
                  {member.username}
                  {member.id === creatorId && (
                    <span className="member-badge">Creator</span>
                  )}
                  {member.id === currentUserId && (
                    <span className="member-badge member-badge-you">You</span>
                  )}
                </span>
                <span className="member-joined">
                  Joined {formatJoinDate(member.joinedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default GroupMembers;