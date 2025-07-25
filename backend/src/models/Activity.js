const db = require('../config/database');

class Activity {
  constructor(data) {
    this.id = data.id;
    this.groupId = data.group_id;
    this.title = data.title;
    this.description = data.description;
    this.isChosen = data.is_chosen;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new activity (anonymous - no creator tracking)
  static async create({ groupId, title, description }) {
    const query = `
      INSERT INTO activities (group_id, title, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await db.query(query, [groupId, title, description || null]);
    return new Activity(result.rows[0]);
  }

  // Find activity by ID
  static async findById(id) {
    const query = 'SELECT * FROM activities WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Activity(result.rows[0]);
  }

  // Get activities for a group
  static async findByGroupId(groupId) {
    const query = `
      SELECT * FROM activities 
      WHERE group_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [groupId]);
    return result.rows.map(row => new Activity(row));
  }

  // Get vote count for activity (internal use only)
  async getVoteCount() {
    const query = 'SELECT COUNT(*) as count FROM votes WHERE activity_id = $1';
    const result = await db.query(query, [this.id]);
    return parseInt(result.rows[0].count);
  }

  // Check if activity has majority (internal use only)
  async checkMajority() {
    const client = await db.getClient();
    
    try {
      // Get total members in the group
      const memberCountQuery = `
        SELECT COUNT(*) as count 
        FROM group_members 
        WHERE group_id = $1
      `;
      const memberResult = await client.query(memberCountQuery, [this.groupId]);
      const totalMembers = parseInt(memberResult.rows[0].count);
      
      // Get vote count for this activity
      const voteCountQuery = 'SELECT COUNT(*) as count FROM votes WHERE activity_id = $1';
      const voteResult = await client.query(voteCountQuery, [this.id]);
      const voteCount = parseInt(voteResult.rows[0].count);
      
      // Check if votes > 50% of members
      const hasMajority = voteCount > (totalMembers / 2);
      
      return {
        hasMajority,
        voteCount,
        totalMembers,
        percentage: totalMembers > 0 ? (voteCount / totalMembers) * 100 : 0
      };
    } finally {
      client.release();
    }
  }

  // Update chosen status
  async updateChosenStatus(isChosen) {
    const query = `
      UPDATE activities 
      SET is_chosen = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await db.query(query, [isChosen, this.id]);
    return new Activity(result.rows[0]);
  }

  // Update activity
  async update(data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(data.title);
    }
    
    if (data.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(data.description);
    }

    if (data.isChosen !== undefined) {
      fields.push(`is_chosen = $${paramCount++}`);
      values.push(data.isChosen);
    }

    if (fields.length === 0) {
      return this;
    }

    values.push(this.id);
    const query = `
      UPDATE activities 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return new Activity(result.rows[0]);
  }

  // Delete activity
  async delete() {
    const query = 'DELETE FROM activities WHERE id = $1';
    await db.query(query, [this.id]);
  }

  // Convert to JSON (no sensitive data exposed)
  toJSON() {
    return {
      id: this.id,
      groupId: this.groupId,
      title: this.title,
      description: this.description,
      isChosen: this.isChosen,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
      // Note: Vote counts and creator info are intentionally excluded for privacy
    };
  }
}

module.exports = Activity;