const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require("../models/Cart")
const Product = require("../models/Product")
const Variant = require("../models/Variant")

const sendEmail = require("../utils/sendEmail");

exports.createOrGetCustomer = async (req, res) => {
    try {
        const user = req.user.user;
        const userId = user.id;

        // 1. Fetch user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty or not found" });
        }
        console.log("Cart found:", cart);

        // 2. Check if an order already exists for this cart
        const existingOrder = await Order.findOne({ cartId: cart._id });
        if (existingOrder) {
            return res.status(200).json({
                success: true,
                message: "Order already exists for this cart",
                order: existingOrder
            });
        }

        // 3. Check stock availability for each item
        for (const item of cart.items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ success: false, message: `Product with ID ${item.productId} not found` });
            }

            const variant = await Variant.findById(item.variantId);
            if (!variant) {
                return res.status(404).json({ success: false, message: `Variant with ID ${item.variantId} not found` });
            }

            if (variant.inStock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for product: ${product.name || product._id}, variant: ${item.variantId}`
                });
            }
        }

        // 4. Create new order
        const {
            first_name,
            email,
            phone,
            address,
            pincode,
            city,
            country,
            state,
            gender,
            totalAmount
        } = req.body.userData;

        const order = new Order({
            customer: userId,
            cartId: cart._id,
            totalAmount,
            name: first_name,
            email,
            phone,
            address,
            pincode,
            city,
            country,
            state,
            gender,
            paymentStatus: 'Pending Payment',
            placedAt: new Date()
        });

        await order.save();

        return res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            order
        });
    } catch (error) {
        console.error("Order creation error:", error);
        return res.status(500).json({
            success: false,
            message: 'Server error during order creation'
        });
    }
};



