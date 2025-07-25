import React, { useState } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';

interface InviteLinkProps {
  inviteToken: string;
  groupName: string;
}

const InviteLink: React.FC<InviteLinkProps> = ({ inviteToken, groupName }) => {
  const [copied, setCopied] = useState(false);
  
  const inviteUrl = `${window.location.origin}/join/${inviteToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <div className="invite-link-container">
        <h4>Invite Others to "{groupName}"</h4>
        <p>Share this link with others to invite them to join your group:</p>
        
        <div className="invite-link-input-group">
          <input
            type="text"
            value={inviteUrl}
            readOnly
            className="invite-link-input"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button onClick={handleCopy} variant="outline">
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        
        <p className="invite-link-help">
          Anyone with this link can join your group. Keep it secure!
        </p>
      </div>
    </Card>
  );
};

export default InviteLink;