const MajorityCalculationService = require('./majorityCalculation');
const Vote = require('../models/Vote');

/**
 * Vote Processing Service
 * Handles vote casting and triggers majority calculations
 */
class VoteProcessor {
  /**
   * Process a vote cast by a user
   * @param {string} activityId - The activity being voted on
   * @param {string} userId - The user casting the vote
   * @returns {Promise<Object>} Processing result with status changes
   */
  static async processVote(activityId, userId) {
    try {
      // Cast the vote (this will insert or update existing vote)
      await Vote.castVote({ activityId, userId });
      
      // Process the vote change and update activity statuses
      const result = await MajorityCalculationService.processVoteChange(activityId);
      
      return {
        success: true,
        voteProcessed: true,
        ...result
      };
    } catch (error) {
      throw new Error(`Failed to process vote: ${error.message}`);
    }
  }

  /**
   * Remove a vote and process the change
   * @param {string} activityId - The activity to remove vote from
   * @param {string} userId - The user removing their vote
   * @returns {Promise<Object>} Processing result with status changes
   */
  static async removeVote(activityId, userId) {
    try {
      // Remove the vote
      const removed = await Vote.removeVote({ activityId, userId });
      
      if (!removed) {
        return {
          success: false,
          message: 'No vote found to remove'
        };
      }
      
      // Process the vote change and update activity statuses
      const result = await MajorityCalculationService.processVoteChange(activityId);
      
      return {
        success: true,
        voteRemoved: true,
        ...result
      };
    } catch (error) {
      throw new Error(`Failed to remove vote: ${error.message}`);
    }
  }

  /**
   * Get the current status of all activities in a group
   * @param {string} groupId - The group ID
   * @returns {Promise<Object>} Group status information
   */
  static async getGroupStatus(groupId) {
    try {
      const majorities = await MajorityCalculationService.calculateGroupMajorities(groupId);
      const statistics = await MajorityCalculationService.getGroupStatistics(groupId);
      const tieResult = await MajorityCalculationService.handleTieScenarios(groupId);
      
      return {
        success: true,
        groupId,
        activities: majorities.map(m => ({
          activityId: m.activityId,
          title: m.title,
          isChosen: m.currentStatus,
          hasMajority: m.hasMajority
          // Note: Vote counts and percentages are intentionally excluded for privacy
        })),
        statistics: {
          totalActivities: statistics.totalActivities,
          chosenActivities: statistics.chosenActivities,
          totalMembers: statistics.totalMembers
          // Note: Participation stats excluded for privacy
        },
        hasTies: tieResult.hasTie
      };
    } catch (error) {
      throw new Error(`Failed to get group status: ${error.message}`);
    }
  }

  /**
   * Recalculate all statuses for a group (useful for maintenance or after member changes)
   * @param {string} groupId - The group ID
   * @returns {Promise<Object>} Recalculation result
   */
  static async recalculateGroup(groupId) {
    try {
      const updateResults = await MajorityCalculationService.updateGroupStatuses(groupId);
      const statusChanges = updateResults.filter(result => result.statusChanged);
      
      return {
        success: true,
        groupId,
        totalActivities: updateResults.length,
        statusChanges: statusChanges.length,
        changes: statusChanges.map(change => ({
          activityId: change.activityId,
          action: change.action,
          newStatus: change.newStatus
        }))
      };
    } catch (error) {
      throw new Error(`Failed to recalculate group: ${error.message}`);
    }
  }
}

module.exports = VoteProcessor;