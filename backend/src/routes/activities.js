const express = require('express');
const Activity = require('../models/Activity');
const Vote = require('../models/Vote');
const Group = require('../models/Group');
const { authenticateToken } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validation');
const { applyRateLimit } = require('../middleware/rateLimiting');

const router = express.Router();

// Vote for an activity (anonymous voting)
router.post('/:id/vote', 
  authenticateToken,
  applyRateLimit('voting'),
  validateUUID('id'),
  async (req, res) => {
    try {
      const { id: activityId } = req.params;
      const userId = req.user.id;

      // Check if activity exists
      const activity = await Activity.findById(activityId);
      if (!activity) {
        return res.status(404).json({
          error: 'Activity not found'
        });
      }

      // Check if user is a member of the group
      const group = await Group.findById(activity.groupId);
      if (!group) {
        return res.status(404).json({
          error: 'Group not found'
        });
      }

      const isMember = await group.isMember(userId);
      if (!isMember) {
        return res.status(403).json({
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Cast or update vote (anonymous)
      const vote = await Vote.castVote(userId, activityId);

      // Trigger majority calculation (this will be handled by the background service)
      // For now, we'll trigger it manually
      const majorityService = require('../services/majorityCalculation');
      await majorityService.calculateMajorityForGroup(activity.groupId);

      res.status(201).json({
        message: 'Vote cast successfully',
        voteId: vote.id
      });
    } catch (error) {
      console.error('Error casting vote:', error);
      
      if (error.message === 'Vote already exists for this user and activity') {
        return res.status(400).json({
          error: 'You have already voted for this activity'
        });
      }
      
      res.status(500).json({
        error: 'Failed to cast vote'
      });
    }
  }
);

// Remove vote from an activity
router.delete('/:id/vote',
  authenticateToken,
  applyRateLimit('voting'),
  validateUUID('id'),
  async (req, res) => {
    try {
      const { id: activityId } = req.params;
      const userId = req.user.id;

      // Check if activity exists
      const activity = await Activity.findById(activityId);
      if (!activity) {
        return res.status(404).json({
          error: 'Activity not found'
        });
      }

      // Check if user is a member of the group
      const group = await Group.findById(activity.groupId);
      if (!group) {
        return res.status(404).json({
          error: 'Group not found'
        });
      }

      const isMember = await group.isMember(userId);
      if (!isMember) {
        return res.status(403).json({
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Remove vote
      const removed = await Vote.removeVote(userId, activityId);
      
      if (!removed) {
        return res.status(404).json({
          error: 'No vote found to remove'
        });
      }

      // Trigger majority calculation
      const majorityService = require('../services/majorityCalculation');
      await majorityService.calculateMajorityForGroup(activity.groupId);

      res.json({
        message: 'Vote removed successfully'
      });
    } catch (error) {
      console.error('Error removing vote:', error);
      res.status(500).json({
        error: 'Failed to remove vote'
      });
    }
  }
);

// Get user's vote status for activities in a group (privacy-safe)
router.get('/group/:groupId/vote-status',
  authenticateToken,
  applyRateLimit('general'),
  validateUUID('groupId'),
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      // Check if group exists and user is a member
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          error: 'Group not found'
        });
      }

      const isMember = await group.isMember(userId);
      if (!isMember) {
        return res.status(403).json({
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Get user's vote status for all activities in the group
      const voteStatus = await Vote.getUserVoteStatusForGroup(userId, groupId);

      res.json({
        voteStatus: voteStatus.map(status => ({
          activityId: status.activityId,
          hasVoted: status.hasVoted
          // Note: No vote counts, percentages, or other users' votes exposed
        }))
      });
    } catch (error) {
      console.error('Error fetching vote status:', error);
      res.status(500).json({
        error: 'Failed to fetch vote status'
      });
    }
  }
);

module.exports = router;