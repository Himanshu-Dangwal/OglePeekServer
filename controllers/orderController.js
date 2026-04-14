const mongoose = require('mongoose');
const Order   = require('../models/Order');
const User    = require('../models/User');
const Cart    = require('../models/Cart');
const Product = require('../models/Product');
const Variant = require('../models/Variant');

const { reserveStock, releaseReservation } = require('../utils/stockUtils');

// ── Create or update a Pending order ────────────────────────────────────────
//
// Flow:
//  1. Fetch user's active cart
//  2. Look for an existing Pending order for this cart
//  3. If existing + already reserved → just update shipping info (no re-reservation)
//  4. If new (or existing but not reserved) → validate stock + atomically reserve
//  5. Create / save order

exports.createOrUpdateOrder = async (req, res) => {
    try {
        const userId = req.user.user.id;

        const cart = await Cart.findOne({ userId, userActiveCart: true });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty or not found' });
        }

        // ── Validate required shipping fields up-front ──
        const userData = req.body.userData || {};
        const REQUIRED = ['first_name', 'email', 'phone', 'address', 'pincode', 'city', 'country', 'state'];
        const missing  = REQUIRED.filter(f => !userData[f]);
        if (missing.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.map(f => f.replace('first_name', 'name')).join(', ')}`
            });
        }

        // ── Check for an existing Pending order ──
        let existingOrder = await Order.findOne({
            cartId:      cart._id,
            customer:    userId,
            orderStatus: 'Pending'
        });

        const orderData = {
            totalAmount:   cart.totalAmount,
            customer:      userId,
            cartId:        cart._id,
            paymentStatus: 'Pending Payment',
            orderStatus:   'Pending',
            placedAt:      new Date(),
            name:          userData.first_name,
            email:         userData.email,
            phone:         userData.phone,
            address:       userData.address,
            pincode:       userData.pincode,
            city:          userData.city,
            country:       userData.country,
            state:         userData.state,
            gender:        userData.gender || 'other',
        };

        // ── If the order already exists and stock is reserved, just update shipping ──
        if (existingOrder && existingOrder.isReserved) {
            Object.assign(existingOrder, orderData);
            await existingOrder.save();
            return res.status(200).json({
                success: true,
                message: 'Order updated successfully',
                order: existingOrder
            });
        }

        // ── New order (or existing without reservation) — reserve stock atomically ──
        // reserveStock throws with a user-facing message if any item is out of stock
        try {
            await reserveStock(cart.items);
        } catch (stockErr) {
            return res.status(400).json({ success: false, message: stockErr.message });
        }

        if (existingOrder) {
            Object.assign(existingOrder, { ...orderData, isReserved: true });
            await existingOrder.save();
            return res.status(200).json({
                success: true,
                message: 'Order updated successfully',
                order: existingOrder
            });
        }

        const newOrder = new Order({ ...orderData, isReserved: true });
        await newOrder.save();

        return res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: newOrder
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error during order creation' });
    }
};

// ── Get all orders for the logged-in user ────────────────────────────────────

exports.getUserOrders = async (req, res) => {
    try {
        const userId = req.user.user.id;
        const orders = await Order.find({ customer: userId })
            .populate({
                path: 'cartId',
                populate: [
                    { path: 'items.productId', model: 'Product' },
                    { path: 'items.variantId', model: 'Variant' },
                ],
            })
            .sort({ createdAt: -1 });

        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'No orders found' });
        }

        return res.status(200).json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error while fetching orders' });
    }
};

// ── Get a single order by ID ─────────────────────────────────────────────────
// IDOR fix: verifies the order belongs to the requesting user.

exports.getOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId  = req.user.user.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const order = await Order.findById(orderId)
            .populate({
                path: 'cartId',
                populate: [
                    { path: 'items.productId', model: 'Product' },
                    { path: 'items.variantId', model: 'Variant' },
                ],
            })
            .populate({ path: 'customer', select: 'name email phone' });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Ownership check — prevent IDOR
        if (order.customer._id.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        return res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error while fetching order' });
    }
};

// ── Cancel a Pending order (releases reservation) ───────────────────────────

exports.cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId  = req.user.user.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.customer.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (order.orderStatus !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Only Pending orders can be cancelled' });
        }

        // Release reserved stock before cancelling
        if (order.isReserved) {
            await releaseReservation(order.cartId);
        }

        order.orderStatus   = 'Cancelled';
        order.paymentStatus = 'Failed';
        order.isReserved    = false;
        await order.save();

        return res.status(200).json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error while cancelling order' });
    }
};

exports.getAllOrdersAdmin = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate({ path: 'customer', select: 'name email phone' })
            .populate({
                path: 'cartId',
                populate: [
                    { path: 'items.productId', model: 'Product' },
                    { path: 'items.variantId', model: 'Variant' },
                ],
            })
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderStatus } = req.body;
        const valid = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
        if (!valid.includes(orderStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus }, { new: true });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        return res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
