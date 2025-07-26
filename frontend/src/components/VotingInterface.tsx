import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { apiClient } from '../services/apiClient';

interface Activity {
  id: string;
  title: string;
  description?: string;
  isChosen: boolean;
  createdAt: string;
}

interface VotingInterfaceProps {
  activity: Activity;
  userVote: boolean; // Whether the current user has voted for this activity
  onVoteChange: (activityId: string, hasVoted: boolean) => void;
  disabled?: boolean;
}

const VotingInterface: React.FC<VotingInterfaceProps> = ({
  activity,
  userVote,
  onVoteChange,
  disabled = false
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState('');

  const handleVote = async () => {
    if (isVoting || disabled) return;

    setIsVoting(true);
    setError('');

    try {
      if (userVote) {
        // Remove vote
        await apiClient.delete(`/activities/${activity.id}/vote`);
        onVoteChange(activity.id, false);
      } else {
        // Cast vote
        await apiClient.post(`/activities/${activity.id}/vote`);
        onVoteChange(activity.id, true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update vote');
      console.error('Voting error:', err);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="voting-interface">
      <div className="voting-controls">
        <Button
          variant={userVote ? 'primary' : 'outline'}
          size="small"
          onClick={handleVote}
          disabled={isVoting || disabled}
          className={`vote-button ${userVote ? 'voted' : 'not-voted'}`}
        >
          {isVoting ? (
            <span className="voting-loading">
              <span className="loading-spinner"></span>
              {userVote ? 'Removing...' : 'Voting...'}
            </span>
          ) : (
            <span className="vote-text">
              {userVote ? (
                <>
                  <span className="vote-icon">✓</span>
                  Voted
                </>
              ) : (
                <>
                  <span className="vote-icon">○</span>
                  Vote
                </>
              )}
            </span>
          )}
        </Button>
      </div>

      {error && (
        <div className="voting-error">
          <span className="error-text">{error}</span>
        </div>
      )}

      {/* Visual feedback for user's vote status */}
      <div className="vote-status">
        {userVote && !isVoting && (
          <span className="user-vote-indicator">
            You voted for this activity
          </span>
        )}
      </div>
    </div>
  );
};

export default VotingInterface;