const express = require('express');
const router  = express.Router();
const { authenticate, adminOnly } = require('../middlewares/authMiddleware');
const { createOrUpdateOrder, getUserOrders, getOrderById, cancelOrder, getAllOrdersAdmin, updateOrderStatus } = require('../controllers/orderController');

// Admin routes — must be before /:id to avoid param conflict
router.get('/admin',         authenticate, adminOnly, getAllOrdersAdmin);
router.patch('/:id/status',  authenticate, adminOnly, updateOrderStatus);
router.patch('/:id/cancel',  authenticate, cancelOrder);

// User routes
router.post('/',    authenticate, createOrUpdateOrder);
router.get('/',     authenticate, getUserOrders);
router.get('/:id',  authenticate, getOrderById);

module.exports = router;
