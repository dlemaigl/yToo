const db = require('../config/database');

class Group {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.creatorId = data.creator_id;
    this.inviteToken = data.invite_token;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new group
  static async create({ name, creatorId }) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create the group
      const groupQuery = `
        INSERT INTO groups (name, creator_id)
        VALUES ($1, $2)
        RETURNING *
      `;
      
      const groupResult = await client.query(groupQuery, [name, creatorId]);
      const group = new Group(groupResult.rows[0]);
      
      // Add creator as first member
      const memberQuery = `
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1, $2)
      `;
      
      await client.query(memberQuery, [group.id, creatorId]);
      
      await client.query('COMMIT');
      return group;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Find group by ID
  static async findById(id) {
    const query = 'SELECT * FROM groups WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Group(result.rows[0]);
  }

  // Find group by invite token
  static async findByInviteToken(inviteToken) {
    const query = 'SELECT * FROM groups WHERE invite_token = $1';
    const result = await db.query(query, [inviteToken]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new Group(result.rows[0]);
  }

  // Get groups for a user
  static async findByUserId(userId) {
    const query = `
      SELECT g.* FROM groups g
      INNER JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = $1
      ORDER BY g.created_at DESC
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows.map(row => new Group(row));
  }

  // Get group members
  async getMembers() {
    const query = `
      SELECT u.id, u.username, u.email, gm.joined_at
      FROM users u
      INNER JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC
    `;
    
    const result = await db.query(query, [this.id]);
    return result.rows;
  }

  // Get member count
  async getMemberCount() {
    const query = 'SELECT COUNT(*) as count FROM group_members WHERE group_id = $1';
    const result = await db.query(query, [this.id]);
    return parseInt(result.rows[0].count);
  }

  // Check if user is member
  async isMember(userId) {
    const query = 'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2';
    const result = await db.query(query, [this.id, userId]);
    return result.rows.length > 0;
  }

  // Add member to group
  async addMember(userId) {
    try {
      const query = `
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1, $2)
        RETURNING joined_at
      `;
      
      const result = await db.query(query, [this.id, userId]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('User is already a member of this group');
      }
      throw error;
    }
  }

  // Remove member from group
  async removeMember(userId) {
    const query = 'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2';
    const result = await db.query(query, [this.id, userId]);
    return result.rowCount > 0;
  }

  // Update group
  async update(data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (fields.length === 0) {
      return this;
    }

    values.push(this.id);
    const query = `
      UPDATE groups 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return new Group(result.rows[0]);
  }

  // Delete group
  async delete() {
    const query = 'DELETE FROM groups WHERE id = $1';
    await db.query(query, [this.id]);
  }

  // Static method to check if user is member of a group
  static async isUserMember(groupId, userId) {
    const query = 'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2';
    const result = await db.query(query, [groupId, userId]);
    return result.rows.length > 0;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      creatorId: this.creatorId,
      inviteToken: this.inviteToken,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Group;