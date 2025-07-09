const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const { createOrUpdateOrder, getUserOrders, getOrderById } = require('../controllers/orderController');

router.post('/', authenticate, createOrUpdateOrder);
router.get('/', authenticate, getUserOrders);
router.get('/:id', authenticate, getOrderById); // Assuming this is to get a specific order by ID

module.exports = router;
