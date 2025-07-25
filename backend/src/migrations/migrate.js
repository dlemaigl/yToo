const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'scripts');
  }

  // Create migrations table if it doesn't exist
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.query(query);
  }

  // Get list of executed migrations
  async getExecutedMigrations() {
    const query = 'SELECT filename FROM migrations ORDER BY id';
    const result = await db.query(query);
    return result.rows.map(row => row.filename);
  }

  // Get list of migration files
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('No migrations directory found');
        return [];
      }
      throw error;
    }
  }

  // Execute a single migration
  async executeMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    const sql = await fs.readFile(filePath, 'utf8');
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(sql);
      
      // Record the migration as executed
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      console.log(`✓ Executed migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✗ Failed to execute migration: ${filename}`);
      throw error;
    } finally {
      client.release();
    }
  }

  // Run all pending migrations
  async runMigrations() {
    console.log('Starting database migrations...');
    
    await this.createMigrationsTable();
    
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();
    
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }
    
    console.log('All migrations completed successfully');
  }

  // Rollback last migration (basic implementation)
  async rollbackLastMigration() {
    const query = `
      SELECT filename FROM migrations 
      ORDER BY id DESC 
      LIMIT 1
    `;
    const result = await db.query(query);
    
    if (result.rows.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0].filename;
    
    // Remove from migrations table
    await db.query('DELETE FROM migrations WHERE filename = $1', [lastMigration]);
    
    console.log(`✓ Rolled back migration: ${lastMigration}`);
    console.log('Note: This only removes the migration record. Manual schema changes may be needed.');
  }
}

// CLI interface
if (require.main === module) {
  const runner = new MigrationRunner();
  const command = process.argv[2];
  
  (async () => {
    try {
      await db.testConnection();
      
      switch (command) {
        case 'up':
          await runner.runMigrations();
          break;
        case 'rollback':
          await runner.rollbackLastMigration();
          break;
        default:
          console.log('Usage: node migrate.js [up|rollback]');
          console.log('  up       - Run all pending migrations');
          console.log('  rollback - Rollback the last migration');
      }
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    } finally {
      await db.end();
    }
  })();
}

module.exports = MigrationRunner;