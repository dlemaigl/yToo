const db = require('../config/database');
const Activity = require('../models/Activity');
const Vote = require('../models/Vote');

class MajorityCalculationService {
  /**
   * Calculate majority status for a single activity
   * @param {string} activityId - The activity ID to check
   * @returns {Promise<Object>} Majority calculation result
   */
  static async calculateActivityMajority(activityId) {
    const client = await db.getClient();
    
    try {
      // Get activity and group info
      const activityQuery = 'SELECT * FROM activities WHERE id = $1';
      const activityResult = await client.query(activityQuery, [activityId]);
      
      if (activityResult.rows.length === 0) {
        throw new Error('Activity not found');
      }
      
      const activity = activityResult.rows[0];
      const groupId = activity.group_id;
      
      // Get total members in the group
      const memberCountQuery = `
        SELECT COUNT(*) as count 
        FROM group_members 
        WHERE group_id = $1
      `;
      const memberResult = await client.query(memberCountQuery, [groupId]);
      const totalMembers = parseInt(memberResult.rows[0].count);
      
      // Get vote count for this activity
      const voteCountQuery = 'SELECT COUNT(*) as count FROM votes WHERE activity_id = $1';
      const voteResult = await client.query(voteCountQuery, [activityId]);
      const voteCount = parseInt(voteResult.rows[0].count);
      
      // Calculate majority (>50% of members)
      const majorityThreshold = totalMembers / 2;
      const hasMajority = voteCount > majorityThreshold;
      const percentage = totalMembers > 0 ? (voteCount / totalMembers) * 100 : 0;
      
      return {
        activityId,
        groupId,
        voteCount,
        totalMembers,
        majorityThreshold,
        hasMajority,
        percentage,
        currentStatus: activity.is_chosen
      };
    } finally {
      client.release();
    }
  }

  /**
   * Calculate majority status for all activities in a group
   * @param {string} groupId - The group ID to check
   * @returns {Promise<Array>} Array of majority calculation results
   */
  static async calculateGroupMajorities(groupId) {
    const client = await db.getClient();
    
    try {
      // Get total members in the group
      const memberCountQuery = `
        SELECT COUNT(*) as count 
        FROM group_members 
        WHERE group_id = $1
      `;
      const memberResult = await client.query(memberCountQuery, [groupId]);
      const totalMembers = parseInt(memberResult.rows[0].count);
      
      // Get all activities with their vote counts
      const activitiesQuery = `
        SELECT 
          a.id,
          a.title,
          a.is_chosen,
          COUNT(v.id) as vote_count
        FROM activities a
        LEFT JOIN votes v ON a.id = v.activity_id
        WHERE a.group_id = $1
        GROUP BY a.id, a.title, a.is_chosen
        ORDER BY a.created_at DESC
      `;
      const activitiesResult = await client.query(activitiesQuery, [groupId]);
      
      // Calculate majority for each activity
      const majorityThreshold = totalMembers / 2;
      const results = activitiesResult.rows.map(row => {
        const voteCount = parseInt(row.vote_count);
        const hasMajority = voteCount > majorityThreshold;
        const percentage = totalMembers > 0 ? (voteCount / totalMembers) * 100 : 0;
        
        return {
          activityId: row.id,
          title: row.title,
          groupId,
          voteCount,
          totalMembers,
          majorityThreshold,
          hasMajority,
          percentage,
          currentStatus: row.is_chosen
        };
      });
      
      return results;
    } finally {
      client.release();
    }
  }

  /**
   * Update activity chosen status based on majority calculation
   * Handles the logic for when activities achieve or lose majority
   * @param {string} activityId - The activity ID to update
   * @returns {Promise<Object>} Update result with status changes
   */
  static async updateActivityStatus(activityId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Calculate current majority status
      const majorityResult = await this.calculateActivityMajority(activityId);
      const { hasMajority, currentStatus, groupId } = majorityResult;
      
      let statusChanged = false;
      let newStatus = currentStatus;
      
      // Update status if it has changed
      if (hasMajority && !currentStatus) {
        // Activity gained majority - mark as chosen
        await client.query(
          'UPDATE activities SET is_chosen = true WHERE id = $1',
          [activityId]
        );
        newStatus = true;
        statusChanged = true;
      } else if (!hasMajority && currentStatus) {
        // Activity lost majority - unmark as chosen
        await client.query(
          'UPDATE activities SET is_chosen = false WHERE id = $1',
          [activityId]
        );
        newStatus = false;
        statusChanged = true;
      }
      
      await client.query('COMMIT');
      
      return {
        ...majorityResult,
        newStatus,
        statusChanged,
        action: statusChanged ? (newStatus ? 'chosen' : 'unchosen') : 'no_change'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update all activity statuses in a group
   * Handles tie scenarios by ensuring only activities with true majority are chosen
   * @param {string} groupId - The group ID to update
   * @returns {Promise<Array>} Array of update results
   */
  static async updateGroupStatuses(groupId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Calculate majorities for all activities
      const majorities = await this.calculateGroupMajorities(groupId);
      
      const updateResults = [];
      
      for (const majority of majorities) {
        const { activityId, hasMajority, currentStatus } = majority;
        
        let statusChanged = false;
        let newStatus = currentStatus;
        
        // Update status based on majority calculation
        if (hasMajority && !currentStatus) {
          // Activity gained majority - mark as chosen
          await client.query(
            'UPDATE activities SET is_chosen = true WHERE id = $1',
            [activityId]
          );
          newStatus = true;
          statusChanged = true;
        } else if (!hasMajority && currentStatus) {
          // Activity lost majority - unmark as chosen
          await client.query(
            'UPDATE activities SET is_chosen = false WHERE id = $1',
            [activityId]
          );
          newStatus = false;
          statusChanged = true;
        }
        
        updateResults.push({
          ...majority,
          newStatus,
          statusChanged,
          action: statusChanged ? (newStatus ? 'chosen' : 'unchosen') : 'no_change'
        });
      }
      
      await client.query('COMMIT');
      
      return updateResults;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Handle tie scenarios - ensures no activity is marked as chosen if there's a tie
   * @param {string} groupId - The group ID to check for ties
   * @returns {Promise<Object>} Tie resolution result
   */
  static async handleTieScenarios(groupId) {
    const majorities = await this.calculateGroupMajorities(groupId);
    
    // Find activities that have majority
    const activitiesWithMajority = majorities.filter(m => m.hasMajority);
    
    // Check for ties (multiple activities with same vote count and majority)
    const voteCountGroups = {};
    activitiesWithMajority.forEach(activity => {
      const count = activity.voteCount;
      if (!voteCountGroups[count]) {
        voteCountGroups[count] = [];
      }
      voteCountGroups[count].push(activity);
    });
    
    // Find if there are ties at the highest vote count
    const voteCounts = Object.keys(voteCountGroups).map(Number).sort((a, b) => b - a);
    const highestVoteCount = voteCounts[0];
    const tiedActivities = highestVoteCount ? voteCountGroups[highestVoteCount] : [];
    
    const hasTie = tiedActivities.length > 1;
    
    return {
      groupId,
      hasTie,
      tiedActivities: tiedActivities.map(a => ({
        activityId: a.activityId,
        title: a.title,
        voteCount: a.voteCount,
        percentage: a.percentage
      })),
      activitiesWithMajority: activitiesWithMajority.length,
      totalActivities: majorities.length,
      resolution: hasTie ? 'tie_detected' : 'no_tie'
    };
  }

  /**
   * Process vote change and update related activity statuses
   * This is the main function to call when a vote is cast or changed
   * @param {string} activityId - The activity that received the vote change
   * @param {Object} websocketService - WebSocket service for real-time notifications
   * @returns {Promise<Object>} Processing result with all status changes
   */
  static async processVoteChange(activityId, websocketService = null) {
    try {
      // Get the group ID for this activity
      const activity = await Activity.findById(activityId);
      if (!activity) {
        throw new Error('Activity not found');
      }
      
      const groupId = activity.groupId;
      
      // Update all statuses in the group to handle any changes
      const updateResults = await this.updateGroupStatuses(groupId);
      
      // Check for tie scenarios
      const tieResult = await this.handleTieScenarios(groupId);
      
      // Find activities that changed status
      const statusChanges = updateResults.filter(result => result.statusChanged);
      
      // Send WebSocket notifications for status changes
      console.log('Status changes detected:', statusChanges.length);
      console.log('WebSocket service available:', !!websocketService);
      
      if (websocketService && statusChanges.length > 0) {
        console.log('Sending WebSocket notifications for status changes');
        for (const change of statusChanges) {
          console.log('Processing status change:', change);
          
          // Notify about vote status change (without exposing vote details)
          await websocketService.notifyVoteStatusChanged(groupId, change.activityId);
          
          // Get the full activity object for chosen/unchosen notifications
          const changedActivity = await Activity.findById(change.activityId);
          if (changedActivity) {
            if (change.newStatus) {
              // Activity was chosen
              console.log('Notifying activity chosen:', change.activityId);
              await websocketService.notifyActivityChosen(groupId, changedActivity);
            } else {
              // Activity was unchosen
              console.log('Notifying activity unchosen:', change.activityId);
              await websocketService.notifyActivityUnchosen(groupId, changedActivity);
            }
          }
        }
      } else if (websocketService) {
        // Always send vote_updated event even if no status changes
        console.log('Sending vote_updated notification');
        await websocketService.notifyVoteStatusChanged(groupId, activityId);
      }
      
      return {
        groupId,
        processedActivityId: activityId,
        statusChanges,
        tieResult,
        totalActivities: updateResults.length,
        activitiesWithMajority: updateResults.filter(r => r.hasMajority).length
      };
    } catch (error) {
      throw new Error(`Failed to process vote change: ${error.message}`);
    }
  }

  /**
   * Get majority statistics for a group (for internal use only)
   * @param {string} groupId - The group ID
   * @returns {Promise<Object>} Group majority statistics
   */
  static async getGroupStatistics(groupId) {
    const majorities = await this.calculateGroupMajorities(groupId);
    
    const stats = {
      groupId,
      totalActivities: majorities.length,
      activitiesWithMajority: majorities.filter(m => m.hasMajority).length,
      chosenActivities: majorities.filter(m => m.currentStatus).length,
      totalMembers: majorities.length > 0 ? majorities[0].totalMembers : 0,
      averageParticipation: 0
    };
    
    if (majorities.length > 0 && stats.totalMembers > 0) {
      const totalVotes = majorities.reduce((sum, m) => sum + m.voteCount, 0);
      const maxPossibleVotes = majorities.length * stats.totalMembers;
      stats.averageParticipation = maxPossibleVotes > 0 ? (totalVotes / maxPossibleVotes) * 100 : 0;
    }
    
    return stats;
  }
}

module.exports = MajorityCalculationService;