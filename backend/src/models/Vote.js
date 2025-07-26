const db = require('../config/database');

class Vote {
  constructor(data) {
    this.id = data.id;
    this.activityId = data.activity_id;
    this.userId = data.user_id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Cast or update a vote
  static async castVote(userId, activityId) {
    try {
      const query = `
        INSERT INTO votes (activity_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (activity_id, user_id) 
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await db.query(query, [activityId, userId]);
      return new Vote(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Remove a vote
  static async removeVote(userId, activityId) {
    const query = 'DELETE FROM votes WHERE activity_id = $1 AND user_id = $2';
    const result = await db.query(query, [activityId, userId]);
    return result.rowCount > 0;
  }

  // Check if user has voted for activity
  static async hasUserVoted({ activityId, userId }) {
    const query = 'SELECT 1 FROM votes WHERE activity_id = $1 AND user_id = $2';
    const result = await db.query(query, [activityId, userId]);
    return result.rows.length > 0;
  }

  // Get user's vote for activity (returns Vote instance or null)
  static async getUserVote({ activityId, userId }) {
    const query = 'SELECT * FROM votes WHERE activity_id = $1 AND user_id = $2';
    const result = await db.query(query, [activityId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Vote(result.rows[0]);
  }

  // Get all votes for an activity (internal use only - never exposed via API)
  static async getVotesForActivity(activityId) {
    const query = 'SELECT * FROM votes WHERE activity_id = $1';
    const result = await db.query(query, [activityId]);
    return result.rows.map(row => new Vote(row));
  }

  // Get vote count for activity (internal use only)
  static async getVoteCount(activityId) {
    const query = 'SELECT COUNT(*) as count FROM votes WHERE activity_id = $1';
    const result = await db.query(query, [activityId]);
    return parseInt(result.rows[0].count);
  }

  // Get all votes for activities in a group (internal use only)
  static async getVotesForGroup(groupId) {
    const query = `
      SELECT v.* FROM votes v
      INNER JOIN activities a ON v.activity_id = a.id
      WHERE a.group_id = $1
    `;
    const result = await db.query(query, [groupId]);
    return result.rows.map(row => new Vote(row));
  }

  // Get user's votes in a group (returns only activity IDs for privacy)
  static async getUserVotesInGroup({ groupId, userId }) {
    const query = `
      SELECT v.activity_id FROM votes v
      INNER JOIN activities a ON v.activity_id = a.id
      WHERE a.group_id = $1 AND v.user_id = $2
    `;
    const result = await db.query(query, [groupId, userId]);
    return result.rows.map(row => row.activity_id);
  }

  // Get user's vote status for all activities in a group (privacy-safe)
  static async getUserVoteStatusForGroup(userId, groupId) {
    const query = `
      SELECT 
        a.id as activity_id,
        CASE WHEN v.id IS NOT NULL THEN true ELSE false END as has_voted
      FROM activities a
      LEFT JOIN votes v ON a.id = v.activity_id AND v.user_id = $1
      WHERE a.group_id = $2
      ORDER BY a.created_at DESC
    `;
    const result = await db.query(query, [userId, groupId]);
    return result.rows.map(row => ({
      activityId: row.activity_id,
      hasVoted: row.has_voted
    }));
  }

  // Calculate majority status for all activities in a group
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
      
      // Get vote counts for all activities in the group
      const voteCountQuery = `
        SELECT a.id as activity_id, COUNT(v.id) as vote_count
        FROM activities a
        LEFT JOIN votes v ON a.id = v.activity_id
        WHERE a.group_id = $1
        GROUP BY a.id
      `;
      const voteResult = await client.query(voteCountQuery, [groupId]);
      
      // Calculate which activities have majority
      const majorityThreshold = totalMembers / 2;
      const results = voteResult.rows.map(row => ({
        activityId: row.activity_id,
        voteCount: parseInt(row.vote_count),
        totalMembers,
        hasMajority: parseInt(row.vote_count) > majorityThreshold
      }));
      
      return results;
    } finally {
      client.release();
    }
  }

  // Delete vote
  async delete() {
    const query = 'DELETE FROM votes WHERE id = $1';
    await db.query(query, [this.id]);
  }

  // Convert to JSON (minimal data for privacy)
  toJSON() {
    return {
      id: this.id,
      activityId: this.activityId,
      // Note: userId is intentionally excluded for privacy
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Vote;