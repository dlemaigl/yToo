const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const Activity = require('../models/Activity');
const Vote = require('../models/Vote');
const { authenticateToken } = require('../middleware/auth');
const { validateGroupCreation, validateActivityCreation, validateUUID } = require('../middleware/validation');
const { applyRateLimit } = require('../middleware/rateLimiting');

const router = express.Router();

// Create a new group
router.post('/', 
  authenticateToken, 
  applyRateLimit('groupCreation'),
  validateGroupCreation, 
  async (req, res) => {
    try {
      const { name } = req.body;

      // Create group with the authenticated user as creator
      const group = await Group.create({
        name: name.trim(),
        creatorId: req.user.id
      });

      res.status(201).json({
        message: 'Group created successfully',
        group: group.toJSON()
      });
    } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({
      error: 'Failed to create group'
    });
  }
});

// Get user's groups
router.get('/', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.findByUserId(req.user.id);
    
    // Get member count for each group
    const groupsWithMemberCount = await Promise.all(
      groups.map(async (group) => {
        const memberCount = await group.getMemberCount();
        return {
          ...group.toJSON(),
          memberCount
        };
      })
    );

    res.json({
      groups: groupsWithMemberCount
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      error: 'Failed to fetch groups'
    });
  }
});

// Get group details
router.get('/:id', 
  authenticateToken, 
  validateUUID('id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const group = await Group.findById(id);
    
    if (!group) {
      return res.status(404).json({
        error: 'Group not found'
      });
    }

    // Check if user is a member of the group
    const isMember = await group.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({
        error: 'Access denied. You are not a member of this group.'
      });
    }

    // Get group members
    const members = await group.getMembers();

    res.json({
      group: {
        ...group.toJSON(),
        members
      }
    });
  } catch (error) {
    console.error('Error fetching group details:', error);
    res.status(500).json({
      error: 'Failed to fetch group details'
    });
  }
});

// Join group via invite token
router.post('/join/:inviteToken', 
  authenticateToken, 
  applyRateLimit('groupJoining'),
  validateUUID('inviteToken'),
  async (req, res) => {
    try {
      const { inviteToken } = req.params;

      // Find group by invite token
    const group = await Group.findByInviteToken(inviteToken);
    
    if (!group) {
      return res.status(404).json({
        error: 'Invalid or expired invitation link'
      });
    }

    // Check if user is already a member
    const isMember = await group.isMember(req.user.id);
    if (isMember) {
      return res.status(400).json({
        error: 'You are already a member of this group'
      });
    }

    // Add user to group
    const membershipData = await group.addMember(req.user.id);

    res.status(201).json({
      message: 'Successfully joined the group',
      group: group.toJSON(),
      joinedAt: membershipData.joined_at
    });
  } catch (error) {
    console.error('Error joining group:', error);
    
    if (error.message === 'User is already a member of this group') {
      return res.status(400).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to join group'
    });
  }
});

// Get group members (separate endpoint for member management)
router.get('/:id/members', 
  authenticateToken, 
  validateUUID('id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const group = await Group.findById(id);
      
      if (!group) {
        return res.status(404).json({
          error: 'Group not found'
        });
      }

      // Check if user is a member of the group
    const isMember = await group.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({
        error: 'Access denied. You are not a member of this group.'
      });
    }

    const members = await group.getMembers();

    res.json({
      members
    });
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({
      error: 'Failed to fetch group members'
    });
  }
});

// Remove member from group (only group creator can do this)
router.delete('/:id/members/:userId', 
  authenticateToken, 
  validateUUID('id'),
  async (req, res) => {
    try {
      const { id, userId } = req.params;

      // Validate userId format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        return res.status(400).json({
          error: 'Invalid user ID format'
        });
      }

      const group = await Group.findById(id);
    
    if (!group) {
      return res.status(404).json({
        error: 'Group not found'
      });
    }

    // Only group creator can remove members
    if (group.creatorId !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied. Only the group creator can remove members.'
      });
    }

    // Cannot remove the creator
    if (userId === group.creatorId) {
      return res.status(400).json({
        error: 'Cannot remove the group creator'
      });
    }

    // Check if the user to be removed is actually a member
    const isMember = await group.isMember(userId);
    if (!isMember) {
      return res.status(404).json({
        error: 'User is not a member of this group'
      });
    }

    // Remove the member
    const removed = await group.removeMember(userId);
    
    if (!removed) {
      return res.status(404).json({
        error: 'Failed to remove member'
      });
    }

    res.json({
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing group member:', error);
    res.status(500).json({
      error: 'Failed to remove member'
    });
  }
});

// Create activity for a group (anonymous)
router.post('/:id/activities', 
  authenticateToken, 
  applyRateLimit('activityCreation'),
  validateUUID('id'),
  validateActivityCreation,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description } = req.body;

      // Check if group exists
    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({
        error: 'Group not found'
      });
    }

    // Check if user is a member of the group
    const isMember = await group.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({
        error: 'Access denied. You are not a member of this group.'
      });
    }

    // Create activity (anonymous - no creator tracking)
    const activity = await Activity.create({
      groupId: id,
      title: title.trim(),
      description: description ? description.trim() : null
    });

    res.status(201).json({
      message: 'Activity created successfully',
      activity: activity.toJSON()
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({
      error: 'Failed to create activity'
    });
  }
});

// Get activities for a group
router.get('/:id/activities', 
  authenticateToken, 
  validateUUID('id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check if group exists
    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({
        error: 'Group not found'
      });
    }

    // Check if user is a member of the group
    const isMember = await group.isMember(req.user.id);
    if (!isMember) {
      return res.status(403).json({
        error: 'Access denied. You are not a member of this group.'
      });
    }

    // Get activities for the group
    const activities = await Activity.findByGroupId(id);

    res.json({
      activities: activities.map(activity => activity.toJSON())
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({
      error: 'Failed to fetch activities'
    });
  }
});

// Get user's voting status for all activities in a group
router.get('/:id/my-votes', 
  authenticateToken, 
  validateUUID('id'),
  async (req, res) => {
    try {
      const { id: groupId } = req.params;
      const userId = req.user.id;

      // Check if group exists
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({
          error: 'Group not found'
        });
      }

      // Check if user is a member of the group
      const isMember = await group.isMember(userId);
      if (!isMember) {
        return res.status(403).json({
          error: 'Access denied. You are not a member of this group.'
        });
      }

      // Get user's vote status for all activities in the group
      const voteStatus = await Vote.getUserVoteStatusForGroup(userId, groupId);

      res.json({
        votes: voteStatus.map(status => ({
          activityId: status.activityId,
          hasVoted: status.hasVoted
          // Note: No vote counts, percentages, or other users' votes exposed
        }))
      });
    } catch (error) {
      console.error('Error fetching user voting status:', error);
      res.status(500).json({
        error: 'Failed to fetch voting status'
      });
    }
  }
);

module.exports = router;