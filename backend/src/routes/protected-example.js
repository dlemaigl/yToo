const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Example protected route
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user.toJSON()
  });
});

// Example route with optional authentication
router.get('/public', (req, res) => {
  res.json({
    message: 'This is a public route',
    authenticated: false
  });
});

module.exports = router;