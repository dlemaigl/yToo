#!/usr/bin/env node

/**
 * Production Database Migration Script
 * 
 * This script handles database migrations for production deployment.
 * It includes safety checks, backup creation, and rollback capabilities.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Import the migration runner
const MigrationRunner = require('../backend/src/migrations/migrate');

class ProductionMigrationRunner extends MigrationRunner {
  constructor() {
    super();
    this.backupDir = path.join(__dirname, '..', 'backups');
  }

  // Create backup before running migrations
  async createBackup() {
    console.log('Creating database backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.sql`);
    
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });
    
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    try {
      // Create database backup using pg_dump
      execSync(`pg_dump "${dbUrl}" > "${backupFile}"`, { stdio: 'inherit' });
      console.log(`✓ Backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('✗ Failed to create backup:', error.message);
      throw error;
    }
  }

  // Verify database connection and environment
  async verifyEnvironment() {
    console.log('Verifying production environment...');
    
    // Check required environment variables
    const requiredVars = [
      'DATABASE_URL',
      'NODE_ENV',
      'JWT_SECRET',
      'POSTGRES_DB',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Verify NODE_ENV is production
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  NODE_ENV is not set to "production"');
    }
    
    // Test database connection
    const db = require('../backend/src/config/database');
    await db.testConnection();
    console.log('✓ Database connection verified');
    
    // Check if this is a fresh database or existing one
    try {
      const result = await db.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'");
      const tableCount = parseInt(result.rows[0].count);
      
      if (tableCount === 0) {
        console.log('✓ Fresh database detected - full migration will be performed');
      } else {
        console.log(`✓ Existing database detected with ${tableCount} tables`);
      }
    } catch (error) {
      console.log('✓ Database appears to be fresh or inaccessible for table counting');
    }
  }

  // Run production migrations with safety checks
  async runProductionMigrations() {
    console.log('='.repeat(60));
    console.log('PRODUCTION DATABASE MIGRATION');
    console.log('='.repeat(60));
    
    try {
      // Step 1: Verify environment
      await this.verifyEnvironment();
      
      // Step 2: Create backup
      const backupFile = await this.createBackup();
      
      // Step 3: Run migrations
      console.log('\nRunning database migrations...');
      await this.runMigrations();
      
      // Step 4: Verify migration success
      await this.verifyMigrations();
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ PRODUCTION MIGRATION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log(`Backup file: ${backupFile}`);
      console.log('Migration completed at:', new Date().toISOString());
      
    } catch (error) {
      console.error('\n' + '='.repeat(60));
      console.error('❌ PRODUCTION MIGRATION FAILED');
      console.error('='.repeat(60));
      console.error('Error:', error.message);
      console.error('\nPlease check the error above and restore from backup if necessary.');
      console.error('Backup files are located in:', this.backupDir);
      throw error;
    }
  }

  // Verify that migrations were applied correctly
  async verifyMigrations() {
    console.log('Verifying migration success...');
    
    const db = require('../backend/src/config/database');
    
    // Check that all expected tables exist
    const expectedTables = [
      'users', 'groups', 'group_members', 'activities', 'votes',
      'migrations', 'audit_logs', 'system_metrics', 'error_logs'
    ];
    
    for (const table of expectedTables) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      if (!result.rows[0].exists) {
        throw new Error(`Expected table '${table}' was not created`);
      }
    }
    
    // Check that indexes were created
    const result = await db.query(`
      SELECT COUNT(*) as index_count 
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    
    const indexCount = parseInt(result.rows[0].index_count);
    if (indexCount < 10) {
      console.warn(`⚠️  Only ${indexCount} indexes found, expected more`);
    } else {
      console.log(`✓ ${indexCount} database indexes created`);
    }
    
    console.log('✓ Migration verification completed');
  }

  // List available backups
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = files
        .filter(file => file.startsWith('backup-') && file.endsWith('.sql'))
        .sort()
        .reverse();
      
      if (backups.length === 0) {
        console.log('No backups found');
        return;
      }
      
      console.log('Available backups:');
      backups.forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup}`);
      });
    } catch (error) {
      console.log('No backup directory found or error reading backups');
    }
  }

  // Restore from backup
  async restoreFromBackup(backupFile) {
    console.log(`Restoring from backup: ${backupFile}`);
    
    const backupPath = path.join(this.backupDir, backupFile);
    const dbUrl = process.env.DATABASE_URL;
    
    try {
      // Drop all tables first (dangerous!)
      console.log('⚠️  Dropping existing database...');
      execSync(`psql "${dbUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`, { stdio: 'inherit' });
      
      // Restore from backup
      console.log('Restoring from backup...');
      execSync(`psql "${dbUrl}" < "${backupPath}"`, { stdio: 'inherit' });
      
      console.log('✅ Database restored successfully');
    } catch (error) {
      console.error('❌ Failed to restore from backup:', error.message);
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const runner = new ProductionMigrationRunner();
  const command = process.argv[2];
  const arg = process.argv[3];
  
  (async () => {
    try {
      switch (command) {
        case 'migrate':
          await runner.runProductionMigrations();
          break;
        case 'backup':
          await runner.createBackup();
          break;
        case 'list-backups':
          await runner.listBackups();
          break;
        case 'restore':
          if (!arg) {
            console.error('Usage: node migrate-production.js restore <backup-filename>');
            process.exit(1);
          }
          await runner.restoreFromBackup(arg);
          break;
        case 'verify':
          await runner.verifyEnvironment();
          await runner.verifyMigrations();
          break;
        default:
          console.log('Usage: node migrate-production.js [command]');
          console.log('Commands:');
          console.log('  migrate       - Run production migrations with backup');
          console.log('  backup        - Create database backup only');
          console.log('  list-backups  - List available backup files');
          console.log('  restore <file> - Restore from backup file');
          console.log('  verify        - Verify environment and migrations');
      }
    } catch (error) {
      console.error('Migration script error:', error);
      process.exit(1);
    }
  })();
}

module.exports = ProductionMigrationRunner;