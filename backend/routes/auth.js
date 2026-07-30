const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.authUser.id,
      email: req.authUser.email,
    },
    profile: req.profile,
  });
});

module.exports = router;
