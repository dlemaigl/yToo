const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get WebSocket connection statistics (admin/debug endpoint)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const websocketService = req.websocketService;
    
    if (!websocketService) {
      return res.status(500).json({ error: 'WebSocket service not available' });
    }

    const stats = await websocketService.getConnectionStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to get connection statistics' });
  }
});

// Get connection stats for a specific group
router.get('/groups/:groupId/stats', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const websocketService = req.websocketService;
    
    if (!websocketService) {
      return res.status(500).json({ error: 'WebSocket service not available' });
    }

    // TODO: Add authorization check to ensure user is member of the group
    
    const stats = await websocketService.getGroupConnectionStats(groupId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting group WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to get group connection statistics' });
  }
});

// Health check for WebSocket functionality
router.get('/health', (req, res) => {
  try {
    const socketServer = req.socketServer;
    
    if (!socketServer) {
      return res.status(500).json({ 
        status: 'ERROR',
        websocket: 'not_available',
        timestamp: new Date().toISOString()
      });
    }

    const io = socketServer.getIO();
    
    res.json({
      status: 'OK',
      websocket: 'available',
      engine: io.engine ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('WebSocket health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      websocket: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;