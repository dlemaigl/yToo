// Main entry point for the backend server
require('dotenv').config();

const app = require('./app');
const db = require('./config/database');

const PORT = process.env.PORT || 3001;

// Add database health check to the existing health endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await db.testConnection();
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: dbStatus ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'error',
      error: error.message
    });
  }
});

// Initialize database connection and start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database connection: ${dbConnected ? 'OK' : 'FAILED'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await db.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await db.end();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;