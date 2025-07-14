const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require("../models/Cart")
const Product = require("../models/Product")
const Variant = require("../models/Variant")

const sendEmail = require("../utils/sendEmail");
exports.createOrUpdateOrder = async (req, res) => {
    try {
        const userId = req.user.user.id;

        // 1. Fetch user's cart
        const cart = await Cart.findOne({ userId, userActiveCart: true });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty or not found" });
        }

        // 2. Check for existing order with this cart & status 'Pending'
        let existingOrder = await Order.findOne({
            cartId: cart._id,
            customer: userId,
            orderStatus: 'Pending'
        });

        // 3. Validate stock for all items
        for (const item of cart.items) {
            const product = await Product.findById(item.productId);
            const variant = await Variant.findById(item.variantId);

            if (!product || !variant) {
                return res.status(404).json({ success: false, message: `Invalid product or variant in cart.` });
            }

            if (variant.inStock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.name} (${variant.frameColor}). Available: ${variant.inStock}`
                });
            }
        }

        console.log(req.body)

        const userData = req.body.userData || {};

        const orderData = {
            totalAmount: cart.totalAmount,
            customer: userId,
            cartId: cart._id,
            paymentStatus: 'Pending Payment',
            orderStatus: 'Pending',
            placedAt: new Date(),
        };

        // Only assign if field exists in request body
        if (userData.first_name) orderData.name = userData.first_name;
        if (userData.email) orderData.email = userData.email;
        if (userData.phone) orderData.phone = userData.phone;
        if (userData.address) orderData.address = userData.address;
        if (userData.pincode) orderData.pincode = userData.pincode;
        if (userData.city) orderData.city = userData.city;
        if (userData.country) orderData.country = userData.country;
        if (userData.state) orderData.state = userData.state;
        if (userData.gender) orderData.gender = userData.gender;



        // 5. Create or update logic
        if (existingOrder) {
            // Update existing order
            Object.assign(existingOrder, orderData);
            await existingOrder.save();

            return res.status(200).json({
                success: true,
                message: 'Order updated successfully',
                order: existingOrder
            });
        } else {
            // Create new order
            const newOrder = new Order(orderData);
            await newOrder.save();

            return res.status(201).json({
                success: true,
                message: 'Order created successfully',
                order: newOrder
            });
        }

    } catch (error) {
        console.error("Order creation/update error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during order creation or update"
        });
    }
};



exports.getUserOrders = async (req, res) => {
    try {
        const userId = req.user.user.id;
        const orders = await Order.find({ customer: userId })
            .populate({
                path: "cartId",
                populate: [
                    { path: "items.productId", model: "Product" },
                    { path: "items.variantId", model: "Variant" },
                ],
            })
            .sort({ createdAt: -1 });

        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: "No orders found for this user" });
        }

        return res.status(200).json({ success: true, orders });
    } catch (error) {
        console.error("Failed to fetch user orders:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching orders"
        });
    }
};


exports.getOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user.user.id;

        const order = await Order.findById(orderId)
            .populate({
                path: "cartId",
                populate: [
                    { path: "items.productId", model: "Product" },
                    { path: "items.variantId", model: "Variant" },
                ],
            })
            .populate({ path: 'customer', select: 'name email phone' });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        return res.status(200).json({ success: true, order });
    } catch (error) {
        console.error("Failed to fetch order:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching order"
        });
    }
}