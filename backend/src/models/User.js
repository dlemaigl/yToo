const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create a new user
  static async create({ username, email, password }) {
    try {
      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const query = `
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, username, email, created_at, updated_at
      `;
      
      const result = await db.query(query, [username, email, passwordHash]);
      return new User(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        }
        if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
      }
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Find user by username
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await db.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return new User(result.rows[0]);
  }

  // Verify password
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.passwordHash);
  }

  // Update user
  async update(data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.username) {
      fields.push(`username = $${paramCount++}`);
      values.push(data.username);
    }
    
    if (data.email) {
      fields.push(`email = $${paramCount++}`);
      values.push(data.email);
    }

    if (data.password) {
      const passwordHash = await bcrypt.hash(data.password, 12);
      fields.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }

    if (fields.length === 0) {
      return this;
    }

    values.push(this.id);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, created_at, updated_at
    `;

    const result = await db.query(query, values);
    return new User(result.rows[0]);
  }

  // Delete user
  async delete() {
    const query = 'DELETE FROM users WHERE id = $1';
    await db.query(query, [this.id]);
  }

  // Convert to JSON (exclude password hash)
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;