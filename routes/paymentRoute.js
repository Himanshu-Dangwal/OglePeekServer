// routes/paymentRoutes.js (for eSewa)
const express = require('express');
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const { verifyCart } = require('../middlewares/cartMiddleware');
const { initiateEsewaPayment, esewaSuccess, esewaFailure } = require('../controllers/paymentController');

// Initiate eSewa payment (redirect user to eSewa)
router.post('/pay/esewa/:orderId', authenticate, verifyCart, initiateEsewaPayment);

// Callback routes for eSewa to redirect to after payment
router.get('/pay/esewa/success', authenticate, esewaSuccess);
router.get('/pay/esewa/failure', authenticate, esewaFailure);


// routes/paymentRoutes.js (additional route for Option B)
// router.post('/pay/esewa/verify-payment', verifyEsewaPayment);


module.exports = router;
