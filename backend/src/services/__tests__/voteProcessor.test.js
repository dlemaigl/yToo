const VoteProcessor = require('../voteProcessor');
const MajorityCalculationService = require('../majorityCalculation');
const Vote = require('../../models/Vote');

// Mock dependencies
jest.mock('../majorityCalculation');
jest.mock('../../models/Vote');

describe('VoteProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processVote', () => {
    it('should process vote and return status changes', async () => {
      const activityId = 'activity-1';
      const userId = 'user-1';
      
      Vote.castVote.mockResolvedValue({ id: 'vote-1' });
      MajorityCalculationService.processVoteChange.mockResolvedValue({
        groupId: 'group-1',
        processedActivityId: activityId,
        statusChanges: [
          {
            activityId: 'activity-1',
            statusChanged: true,
            action: 'chosen'
          }
        ],
        totalActivities: 2,
        activitiesWithMajority: 1
      });

      const result = await VoteProcessor.processVote(activityId, userId);

      expect(Vote.castVote).toHaveBeenCalledWith({ activityId, userId });
      expect(MajorityCalculationService.processVoteChange).toHaveBeenCalledWith(activityId);
      
      expect(result).toEqual({
        success: true,
        voteProcessed: true,
        groupId: 'group-1',
        processedActivityId: activityId,
        statusChanges: [
          {
            activityId: 'activity-1',
            statusChanged: true,
            action: 'chosen'
          }
        ],
        totalActivities: 2,
        activitiesWithMajority: 1
      });
    });

    it('should handle vote processing errors', async () => {
      const activityId = 'activity-1';
      const userId = 'user-1';
      
      Vote.castVote.mockRejectedValue(new Error('Database error'));

      await expect(
        VoteProcessor.processVote(activityId, userId)
      ).rejects.toThrow('Failed to process vote: Database error');
    });
  });

  describe('removeVote', () => {
    it('should remove vote and process changes', async () => {
      const activityId = 'activity-1';
      const userId = 'user-1';
      
      Vote.removeVote.mockResolvedValue(true);
      MajorityCalculationService.processVoteChange.mockResolvedValue({
        groupId: 'group-1',
        processedActivityId: activityId,
        statusChanges: [
          {
            activityId: 'activity-1',
            statusChanged: true,
            action: 'unchosen'
          }
        ],
        totalActivities: 2,
        activitiesWithMajority: 0
      });

      const result = await VoteProcessor.removeVote(activityId, userId);

      expect(Vote.removeVote).toHaveBeenCalledWith({ activityId, userId });
      expect(MajorityCalculationService.processVoteChange).toHaveBeenCalledWith(activityId);
      
      expect(result).toEqual({
        success: true,
        voteRemoved: true,
        groupId: 'group-1',
        processedActivityId: activityId,
        statusChanges: [
          {
            activityId: 'activity-1',
            statusChanged: true,
            action: 'unchosen'
          }
        ],
        totalActivities: 2,
        activitiesWithMajority: 0
      });
    });

    it('should handle case when no vote exists to remove', async () => {
      const activityId = 'activity-1';
      const userId = 'user-1';
      
      Vote.removeVote.mockResolvedValue(false);

      const result = await VoteProcessor.removeVote(activityId, userId);

      expect(result).toEqual({
        success: false,
        message: 'No vote found to remove'
      });
      
      expect(MajorityCalculationService.processVoteChange).not.toHaveBeenCalled();
    });

    it('should handle vote removal errors', async () => {
      const activityId = 'activity-1';
      const userId = 'user-1';
      
      Vote.removeVote.mockRejectedValue(new Error('Database error'));

      await expect(
        VoteProcessor.removeVote(activityId, userId)
      ).rejects.toThrow('Failed to remove vote: Database error');
    });
  });

  describe('getGroupStatus', () => {
    it('should return group status with privacy-safe information', async () => {
      const groupId = 'group-1';
      
      MajorityCalculationService.calculateGroupMajorities.mockResolvedValue([
        {
          activityId: 'activity-1',
          title: 'Activity 1',
          currentStatus: true,
          hasMajority: true,
          voteCount: 6,
          percentage: 60
        },
        {
          activityId: 'activity-2',
          title: 'Activity 2',
          currentStatus: false,
          hasMajority: false,
          voteCount: 3,
          percentage: 30
        }
      ]);

      MajorityCalculationService.getGroupStatistics.mockResolvedValue({
        totalActivities: 2,
        chosenActivities: 1,
        totalMembers: 10,
        averageParticipation: 45
      });

      MajorityCalculationService.handleTieScenarios.mockResolvedValue({
        hasTie: false
      });

      const result = await VoteProcessor.getGroupStatus(groupId);

      expect(result).toEqual({
        success: true,
        groupId,
        activities: [
          {
            activityId: 'activity-1',
            title: 'Activity 1',
            isChosen: true,
            hasMajority: true
          },
          {
            activityId: 'activity-2',
            title: 'Activity 2',
            isChosen: false,
            hasMajority: false
          }
        ],
        statistics: {
          totalActivities: 2,
          chosenActivities: 1,
          totalMembers: 10
        },
        hasTies: false
      });

      // Verify that sensitive data (vote counts, percentages) are not included
      expect(result.activities[0]).not.toHaveProperty('voteCount');
      expect(result.activities[0]).not.toHaveProperty('percentage');
      expect(result.statistics).not.toHaveProperty('averageParticipation');
    });

    it('should handle group status errors', async () => {
      const groupId = 'group-1';
      
      MajorityCalculationService.calculateGroupMajorities.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        VoteProcessor.getGroupStatus(groupId)
      ).rejects.toThrow('Failed to get group status: Database error');
    });
  });

  describe('recalculateGroup', () => {
    it('should recalculate group statuses and return changes', async () => {
      const groupId = 'group-1';
      
      MajorityCalculationService.updateGroupStatuses.mockResolvedValue([
        {
          activityId: 'activity-1',
          statusChanged: true,
          action: 'chosen',
          newStatus: true
        },
        {
          activityId: 'activity-2',
          statusChanged: false,
          action: 'no_change',
          newStatus: false
        },
        {
          activityId: 'activity-3',
          statusChanged: true,
          action: 'unchosen',
          newStatus: false
        }
      ]);

      const result = await VoteProcessor.recalculateGroup(groupId);

      expect(MajorityCalculationService.updateGroupStatuses).toHaveBeenCalledWith(groupId);
      
      expect(result).toEqual({
        success: true,
        groupId,
        totalActivities: 3,
        statusChanges: 2,
        changes: [
          {
            activityId: 'activity-1',
            action: 'chosen',
            newStatus: true
          },
          {
            activityId: 'activity-3',
            action: 'unchosen',
            newStatus: false
          }
        ]
      });
    });

    it('should handle recalculation with no changes', async () => {
      const groupId = 'group-1';
      
      MajorityCalculationService.updateGroupStatuses.mockResolvedValue([
        {
          activityId: 'activity-1',
          statusChanged: false,
          action: 'no_change',
          newStatus: true
        }
      ]);

      const result = await VoteProcessor.recalculateGroup(groupId);

      expect(result).toEqual({
        success: true,
        groupId,
        totalActivities: 1,
        statusChanges: 0,
        changes: []
      });
    });

    it('should handle recalculation errors', async () => {
      const groupId = 'group-1';
      
      MajorityCalculationService.updateGroupStatuses.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        VoteProcessor.recalculateGroup(groupId)
      ).rejects.toThrow('Failed to recalculate group: Database error');
    });
  });
});