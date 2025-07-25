const MajorityCalculationService = require('../majorityCalculation');
const db = require('../../config/database');
const Activity = require('../../models/Activity');

// Mock the database and models
jest.mock('../../config/database');
jest.mock('../../models/Activity');

describe('MajorityCalculationService', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.getClient.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe('calculateActivityMajority', () => {
    it('should calculate majority correctly for activity with majority votes', async () => {
      const activityId = 'activity-1';
      const groupId = 'group-1';
      
      // Mock activity query
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: activityId, group_id: groupId, is_chosen: false }]
        })
        // Mock member count query
        .mockResolvedValueOnce({
          rows: [{ count: '10' }]
        })
        // Mock vote count query
        .mockResolvedValueOnce({
          rows: [{ count: '6' }]
        });

      const result = await MajorityCalculationService.calculateActivityMajority(activityId);

      expect(result).toEqual({
        activityId,
        groupId,
        voteCount: 6,
        totalMembers: 10,
        majorityThreshold: 5,
        hasMajority: true,
        percentage: 60,
        currentStatus: false
      });

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should calculate majority correctly for activity without majority votes', async () => {
      const activityId = 'activity-1';
      const groupId = 'group-1';
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: activityId, group_id: groupId, is_chosen: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '10' }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '4' }]
        });

      const result = await MajorityCalculationService.calculateActivityMajority(activityId);

      expect(result).toEqual({
        activityId,
        groupId,
        voteCount: 4,
        totalMembers: 10,
        majorityThreshold: 5,
        hasMajority: false,
        percentage: 40,
        currentStatus: false
      });
    });

    it('should handle exact 50% votes as not majority', async () => {
      const activityId = 'activity-1';
      const groupId = 'group-1';
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: activityId, group_id: groupId, is_chosen: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '10' }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '5' }]
        });

      const result = await MajorityCalculationService.calculateActivityMajority(activityId);

      expect(result.hasMajority).toBe(false);
      expect(result.percentage).toBe(50);
    });

    it('should throw error for non-existent activity', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        MajorityCalculationService.calculateActivityMajority('non-existent')
      ).rejects.toThrow('Activity not found');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle zero members correctly', async () => {
      const activityId = 'activity-1';
      const groupId = 'group-1';
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: activityId, group_id: groupId, is_chosen: false }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }]
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }]
        });

      const result = await MajorityCalculationService.calculateActivityMajority(activityId);

      expect(result.percentage).toBe(0);
      expect(result.hasMajority).toBe(false);
    });
  });

  describe('calculateGroupMajorities', () => {
    it('should calculate majorities for all activities in a group', async () => {
      const groupId = 'group-1';
      
      mockClient.query
        // Mock member count query
        .mockResolvedValueOnce({
          rows: [{ count: '10' }]
        })
        // Mock activities with vote counts query
        .mockResolvedValueOnce({
          rows: [
            { id: 'activity-1', title: 'Activity 1', is_chosen: false, vote_count: '6' },
            { id: 'activity-2', title: 'Activity 2', is_chosen: true, vote_count: '3' },
            { id: 'activity-3', title: 'Activity 3', is_chosen: false, vote_count: '8' }
          ]
        });

      const results = await MajorityCalculationService.calculateGroupMajorities(groupId);

      expect(results).toHaveLength(3);
      
      expect(results[0]).toEqual({
        activityId: 'activity-1',
        title: 'Activity 1',
        groupId,
        voteCount: 6,
        totalMembers: 10,
        majorityThreshold: 5,
        hasMajority: true,
        percentage: 60,
        currentStatus: false
      });

      expect(results[1]).toEqual({
        activityId: 'activity-2',
        title: 'Activity 2',
        groupId,
        voteCount: 3,
        totalMembers: 10,
        majorityThreshold: 5,
        hasMajority: false,
        percentage: 30,
        currentStatus: true
      });

      expect(results[2]).toEqual({
        activityId: 'activity-3',
        title: 'Activity 3',
        groupId,
        voteCount: 8,
        totalMembers: 10,
        majorityThreshold: 5,
        hasMajority: true,
        percentage: 80,
        currentStatus: false
      });
    });

    it('should handle empty group correctly', async () => {
      const groupId = 'group-1';
      
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ count: '0' }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const results = await MajorityCalculationService.calculateGroupMajorities(groupId);

      expect(results).toHaveLength(0);
    });
  });

  describe('updateActivityStatus', () => {
    beforeEach(() => {
      Activity.findById.mockResolvedValue({
        id: 'activity-1',
        groupId: 'group-1'
      });
    });

    it('should mark activity as chosen when it gains majority', async () => {
      const activityId = 'activity-1';
      
      // Mock the majority calculation
      jest.spyOn(MajorityCalculationService, 'calculateActivityMajority')
        .mockResolvedValue({
          activityId,
          groupId: 'group-1',
          voteCount: 6,
          totalMembers: 10,
          majorityThreshold: 5,
          hasMajority: true,
          percentage: 60,
          currentStatus: false
        });

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // UPDATE
        .mockResolvedValueOnce(); // COMMIT

      const result = await MajorityCalculationService.updateActivityStatus(activityId);

      expect(result.statusChanged).toBe(true);
      expect(result.newStatus).toBe(true);
      expect(result.action).toBe('chosen');
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE activities SET is_chosen = true WHERE id = $1',
        [activityId]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should unmark activity as chosen when it loses majority', async () => {
      const activityId = 'activity-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateActivityMajority')
        .mockResolvedValue({
          activityId,
          groupId: 'group-1',
          voteCount: 4,
          totalMembers: 10,
          majorityThreshold: 5,
          hasMajority: false,
          percentage: 40,
          currentStatus: true
        });

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // UPDATE
        .mockResolvedValueOnce(); // COMMIT

      const result = await MajorityCalculationService.updateActivityStatus(activityId);

      expect(result.statusChanged).toBe(true);
      expect(result.newStatus).toBe(false);
      expect(result.action).toBe('unchosen');
      
      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE activities SET is_chosen = false WHERE id = $1',
        [activityId]
      );
    });

    it('should not change status when no change is needed', async () => {
      const activityId = 'activity-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateActivityMajority')
        .mockResolvedValue({
          activityId,
          groupId: 'group-1',
          voteCount: 6,
          totalMembers: 10,
          majorityThreshold: 5,
          hasMajority: true,
          percentage: 60,
          currentStatus: true // Already chosen
        });

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce(); // COMMIT

      const result = await MajorityCalculationService.updateActivityStatus(activityId);

      expect(result.statusChanged).toBe(false);
      expect(result.newStatus).toBe(true);
      expect(result.action).toBe('no_change');
    });

    it('should rollback on error', async () => {
      const activityId = 'activity-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateActivityMajority')
        .mockRejectedValue(new Error('Database error'));

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce(); // ROLLBACK

      await expect(
        MajorityCalculationService.updateActivityStatus(activityId)
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('updateGroupStatuses', () => {
    it('should update all activities in a group', async () => {
      const groupId = 'group-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateGroupMajorities')
        .mockResolvedValue([
          {
            activityId: 'activity-1',
            hasMajority: true,
            currentStatus: false,
            voteCount: 6,
            totalMembers: 10
          },
          {
            activityId: 'activity-2',
            hasMajority: false,
            currentStatus: true,
            voteCount: 3,
            totalMembers: 10
          }
        ]);

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce() // UPDATE activity-1
        .mockResolvedValueOnce() // UPDATE activity-2
        .mockResolvedValueOnce(); // COMMIT

      const results = await MajorityCalculationService.updateGroupStatuses(groupId);

      expect(results).toHaveLength(2);
      expect(results[0].statusChanged).toBe(true);
      expect(results[0].action).toBe('chosen');
      expect(results[1].statusChanged).toBe(true);
      expect(results[1].action).toBe('unchosen');
    });
  });

  describe('handleTieScenarios', () => {
    it('should detect tie when multiple activities have same highest vote count', async () => {
      const groupId = 'group-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateGroupMajorities')
        .mockResolvedValue([
          {
            activityId: 'activity-1',
            title: 'Activity 1',
            hasMajority: true,
            voteCount: 6,
            percentage: 60
          },
          {
            activityId: 'activity-2',
            title: 'Activity 2',
            hasMajority: true,
            voteCount: 6,
            percentage: 60
          },
          {
            activityId: 'activity-3',
            title: 'Activity 3',
            hasMajority: false,
            voteCount: 3,
            percentage: 30
          }
        ]);

      const result = await MajorityCalculationService.handleTieScenarios(groupId);

      expect(result.hasTie).toBe(true);
      expect(result.tiedActivities).toHaveLength(2);
      expect(result.tiedActivities[0].voteCount).toBe(6);
      expect(result.tiedActivities[1].voteCount).toBe(6);
      expect(result.resolution).toBe('tie_detected');
    });

    it('should not detect tie when one activity has clear majority', async () => {
      const groupId = 'group-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateGroupMajorities')
        .mockResolvedValue([
          {
            activityId: 'activity-1',
            title: 'Activity 1',
            hasMajority: true,
            voteCount: 8,
            percentage: 80
          },
          {
            activityId: 'activity-2',
            title: 'Activity 2',
            hasMajority: true,
            voteCount: 6,
            percentage: 60
          }
        ]);

      const result = await MajorityCalculationService.handleTieScenarios(groupId);

      expect(result.hasTie).toBe(false);
      expect(result.tiedActivities).toHaveLength(1);
      expect(result.tiedActivities[0].voteCount).toBe(8);
      expect(result.resolution).toBe('no_tie');
    });

    it('should handle no activities with majority', async () => {
      const groupId = 'group-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateGroupMajorities')
        .mockResolvedValue([
          {
            activityId: 'activity-1',
            title: 'Activity 1',
            hasMajority: false,
            voteCount: 3,
            percentage: 30
          },
          {
            activityId: 'activity-2',
            title: 'Activity 2',
            hasMajority: false,
            voteCount: 4,
            percentage: 40
          }
        ]);

      const result = await MajorityCalculationService.handleTieScenarios(groupId);

      expect(result.hasTie).toBe(false);
      expect(result.tiedActivities).toHaveLength(0);
      expect(result.activitiesWithMajority).toBe(0);
    });
  });

  describe('processVoteChange', () => {
    beforeEach(() => {
      Activity.findById.mockResolvedValue({
        id: 'activity-1',
        groupId: 'group-1'
      });
    });

    it('should process vote change and return status changes', async () => {
      const activityId = 'activity-1';
      
      jest.spyOn(MajorityCalculationService, 'updateGroupStatuses')
        .mockResolvedValue([
          {
            activityId: 'activity-1',
            statusChanged: true,
            action: 'chosen',
            hasMajority: true
          },
          {
            activityId: 'activity-2',
            statusChanged: false,
            action: 'no_change',
            hasMajority: false
          }
        ]);

      jest.spyOn(MajorityCalculationService, 'handleTieScenarios')
        .mockResolvedValue({
          hasTie: false,
          resolution: 'no_tie'
        });

      const result = await MajorityCalculationService.processVoteChange(activityId);

      expect(result.groupId).toBe('group-1');
      expect(result.processedActivityId).toBe(activityId);
      expect(result.statusChanges).toHaveLength(1);
      expect(result.statusChanges[0].action).toBe('chosen');
      expect(result.totalActivities).toBe(2);
      expect(result.activitiesWithMajority).toBe(1);
    });

    it('should throw error for non-existent activity', async () => {
      Activity.findById.mockResolvedValue(null);

      await expect(
        MajorityCalculationService.processVoteChange('non-existent')
      ).rejects.toThrow('Failed to process vote change: Activity not found');
    });
  });

  describe('getGroupStatistics', () => {
    it('should calculate group statistics correctly', async () => {
      const groupId = 'group-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateGroupMajorities')
        .mockResolvedValue([
          {
            activityId: 'activity-1',
            hasMajority: true,
            currentStatus: true,
            voteCount: 6,
            totalMembers: 10
          },
          {
            activityId: 'activity-2',
            hasMajority: false,
            currentStatus: false,
            voteCount: 3,
            totalMembers: 10
          },
          {
            activityId: 'activity-3',
            hasMajority: true,
            currentStatus: false,
            voteCount: 7,
            totalMembers: 10
          }
        ]);

      const stats = await MajorityCalculationService.getGroupStatistics(groupId);

      expect(stats).toEqual({
        groupId,
        totalActivities: 3,
        activitiesWithMajority: 2,
        chosenActivities: 1,
        totalMembers: 10,
        averageParticipation: expect.closeTo(53.33, 2) // (6+3+7)/(3*10)*100
      });
    });

    it('should handle empty group statistics', async () => {
      const groupId = 'group-1';
      
      jest.spyOn(MajorityCalculationService, 'calculateGroupMajorities')
        .mockResolvedValue([]);

      const stats = await MajorityCalculationService.getGroupStatistics(groupId);

      expect(stats).toEqual({
        groupId,
        totalActivities: 0,
        activitiesWithMajority: 0,
        chosenActivities: 0,
        totalMembers: 0,
        averageParticipation: 0
      });
    });
  });
});