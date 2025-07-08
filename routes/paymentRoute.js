// routes/paymentRoutes.js (for eSewa)
const express = require('express');
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const { initiateEsewaPayment, esewaSuccess, esewaFailure } = require('../controllers/paymentController');

// Initiate eSewa payment (redirect user to eSewa)
router.get('/esewa/initiate/:orderId', authenticate, initiateEsewaPayment);

// Callback routes for eSewa to redirect to after payment
router.get('/esewa/success', authenticate, esewaSuccess);
router.get('/esewa/failure', authenticate, esewaFailure);


// routes/paymentRoutes.js (additional route for Option B)
router.post('/esewa/verify-payment', verifyEsewaPayment);


module.exports = router;
