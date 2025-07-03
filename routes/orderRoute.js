const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const { createOrGetCustomer, verifyAndPlaceOrder } = require('../controllers/orderController');

router.post('/', authenticate, createOrGetCustomer);
router.post('/verify', verifyAndPlaceOrder);

module.exports = router;
