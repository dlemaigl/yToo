import { useState, useEffect, useCallback } from 'react';
import { votingService, UserVoteStatus, VotingResponse } from '../services/votingService';
import { useSocket } from '../contexts/SocketContext';

interface UseVotingProps {
  groupId: string;
  activities: Array<{ id: string; isChosen: boolean }>;
}

interface VotingState {
  userVotes: Map<string, boolean>; // activityId -> hasVoted
  loading: boolean;
  error: string | null;
}

export const useVoting = ({ groupId, activities }: UseVotingProps) => {
  const { socket } = useSocket();
  const [state, setState] = useState<VotingState>({
    userVotes: new Map(),
    loading: true,
    error: null
  });

  const loadVotingStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const votingStatus = await votingService.getUserVotingStatus(groupId);
      const userVotes = new Map<string, boolean>();
      
      // Initialize all activities as not voted
      activities.forEach(activity => {
        userVotes.set(activity.id, false);
      });
      
      // Mark activities that user has voted for
      votingStatus.forEach(vote => {
        userVotes.set(vote.activityId, vote.hasVoted);
      });
      
      setState(prev => ({
        ...prev,
        userVotes,
        loading: false
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        loading: false
      }));
    }
  }, [groupId, activities]);

  // Load initial voting status
  useEffect(() => {
    if (groupId && activities.length > 0) {
      loadVotingStatus();
    }
  }, [groupId, activities.length, loadVotingStatus]);

  // Listen for real-time voting updates
  useEffect(() => {
    if (!socket || !groupId) return;

    const handleActivityChosen = (data: { activityId: string; isChosen: boolean }) => {
      // Activity status changed - no need to update user votes, just activity status
      // The parent component will handle activity status updates
    };

    const handleActivityUnchosen = (data: { activityId: string; isChosen: boolean }) => {
      // Activity status changed - handled by parent component
    };

    const handleVoteUpdated = (data: { activityId: string; groupId: string; timestamp: string }) => {
      // Vote status changed - refresh voting status to get latest state
      if (data.groupId === groupId) {
        loadVotingStatus();
      }
    };

    socket.on('group:activity_chosen', handleActivityChosen);
    socket.on('group:activity_unchosen', handleActivityUnchosen);
    socket.on('group:vote_updated', handleVoteUpdated);

    return () => {
      socket.off('group:activity_chosen', handleActivityChosen);
      socket.off('group:activity_unchosen', handleActivityUnchosen);
      socket.off('group:vote_updated', handleVoteUpdated);
    };
  }, [socket, groupId, loadVotingStatus]);

  const castVote = useCallback(async (activityId: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const response: VotingResponse = await votingService.castVote(activityId);
      
      // Update local state
      setState(prev => ({
        ...prev,
        userVotes: new Map(prev.userVotes.set(activityId, true))
      }));
      
      // Real-time updates for activity status changes will be handled by socket events
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to cast vote';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const removeVote = useCallback(async (activityId: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const response: VotingResponse = await votingService.removeVote(activityId);
      
      // Update local state
      setState(prev => ({
        ...prev,
        userVotes: new Map(prev.userVotes.set(activityId, false))
      }));
      
      // Real-time updates for activity status changes will be handled by socket events
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to remove vote';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const hasUserVoted = useCallback((activityId: string): boolean => {
    return state.userVotes.get(activityId) || false;
  }, [state.userVotes]);

  const refreshVotingStatus = useCallback(() => {
    loadVotingStatus();
  }, [loadVotingStatus]);

  return {
    hasUserVoted,
    castVote,
    removeVote,
    refreshVotingStatus,
    loading: state.loading,
    error: state.error
  };
};