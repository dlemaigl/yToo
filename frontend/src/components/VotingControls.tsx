import React, { useState } from 'react';
import Button from './ui/Button';

interface VotingControlsProps {
  activityId: string;
  hasUserVoted: boolean;
  isChosen: boolean;
  onVote: (activityId: string) => Promise<void>;
  onRemoveVote: (activityId: string) => Promise<void>;
  disabled?: boolean;
}

const VotingControls: React.FC<VotingControlsProps> = ({
  activityId,
  hasUserVoted,
  isChosen,
  onVote,
  onRemoveVote,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleVote = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    try {
      if (hasUserVoted) {
        await onRemoveVote(activityId);
      } else {
        await onVote(activityId);
      }
    } catch (error) {
      console.error('Voting error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="voting-controls">
      <Button
        variant={hasUserVoted ? "primary" : "outline"}
        size="sm"
        onClick={handleVote}
        disabled={disabled || isLoading}
        className={`vote-button ${hasUserVoted ? 'voted' : ''} ${isChosen ? 'chosen-activity' : ''}`}
      >
        {isLoading ? (
          <span className="loading-spinner">⟳</span>
        ) : hasUserVoted ? (
          <>
            <span className="vote-icon">✓</span>
            Voted
          </>
        ) : (
          <>
            <span className="vote-icon">+</span>
            Vote
          </>
        )}
      </Button>
      
      {hasUserVoted && (
        <div className="vote-status">
          <span className="user-vote-indicator">Your vote</span>
        </div>
      )}
    </div>
  );
};

export default VotingControls;