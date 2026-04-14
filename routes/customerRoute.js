const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { authenticate, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', authenticate, adminOnly, async (req, res) => {
    try {
        const customers = await User.find({}).select('-password -otp -otpExpires').sort({ createdAt: -1 });
        res.status(200).json({ success: true, customers });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
