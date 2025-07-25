const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create a new group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Group name is required and must be a non-empty string'
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        error: 'Group name must be 100 characters or less'
      });
    }

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
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid group ID format'
      });
    }

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
router.post('/join/:inviteToken', authenticateToken, async (req, res) => {
  try {
    const { inviteToken } = req.params;

    // Validate UUID format for invite token
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(inviteToken)) {
      return res.status(400).json({
        error: 'Invalid invite token format'
      });
    }

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
router.get('/:id/members', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid group ID format'
      });
    }

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
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { id, userId } = req.params;

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(userId)) {
      return res.status(400).json({
        error: 'Invalid ID format'
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
router.post('/:id/activities', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid group ID format'
      });
    }

    // Validate input
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Activity title is required and must be a non-empty string'
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        error: 'Activity title must be 200 characters or less'
      });
    }

    if (description && typeof description !== 'string') {
      return res.status(400).json({
        error: 'Activity description must be a string'
      });
    }

    if (description && description.trim().length > 1000) {
      return res.status(400).json({
        error: 'Activity description must be 1000 characters or less'
      });
    }

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
router.get('/:id/activities', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid group ID format'
      });
    }

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

module.exports = router;