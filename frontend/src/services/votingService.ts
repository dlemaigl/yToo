import { apiClient } from './apiClient';

export interface UserVoteStatus {
  activityId: string;
  hasVoted: boolean;
}

export interface VotingResponse {
  success: boolean;
  message?: string;
  activityStatusChanged?: boolean;
  newChosenActivity?: string;
  previousChosenActivity?: string;
}

class VotingService {
  /**
   * Cast a vote for an activity
   */
  async castVote(activityId: string): Promise<VotingResponse> {
    try {
      const response = await apiClient.post(`/activities/${activityId}/vote`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to cast vote');
    }
  }

  /**
   * Remove a vote for an activity
   */
  async removeVote(activityId: string): Promise<VotingResponse> {
    try {
      const response = await apiClient.delete(`/activities/${activityId}/vote`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to remove vote');
    }
  }

  /**
   * Get user's voting status for activities in a group
   * Returns only which activities the user has voted for, no counts or other user data
   */
  async getUserVotingStatus(groupId: string): Promise<UserVoteStatus[]> {
    try {
      const response = await apiClient.get(`/groups/${groupId}/my-votes`);
      return response.data.votes || [];
    } catch (error: any) {
      // If endpoint doesn't exist yet, return empty array
      if (error.status === 404) {
        return [];
      }
      throw new Error(error.message || 'Failed to get voting status');
    }
  }

  /**
   * Check if user has voted for a specific activity
   */
  async hasUserVoted(activityId: string): Promise<boolean> {
    try {
      const response = await apiClient.get(`/activities/${activityId}/my-vote`);
      return response.data.hasVoted || false;
    } catch (error: any) {
      // If endpoint doesn't exist yet or user hasn't voted, return false
      if (error.status === 404) {
        return false;
      }
      throw new Error(error.message || 'Failed to check vote status');
    }
  }
}

export const votingService = new VotingService();