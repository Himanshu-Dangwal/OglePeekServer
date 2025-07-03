const Order = require('../models/Order');
const User = require('../models/User');
const Cart = require("../models/Cart")
const Product = require("../models/Product")

const sendEmail = require("../utils/sendEmail");

// exports.createOrGetCustomer = async (req, res) => {
//     try {
//         const { name, email, phone } = req.body;
//         let customerId = undefined;
//         if (email || phone) {
//             const existingUser = await User.findOne({
//                 $or: [{ email: email }, { phone: phone }]
//             });
//             if (existingUser) {
//                 customerId = existingUser._id;
//                 const otp = Math.floor(100000 + Math.random() * 900000).toString();
//                 const otpExpires = Date.now() + 10 * 60 * 1000;

//                 existingUser.otp = otp;
//                 existingUser.otpExpires = otpExpires;
//                 await existingUser.save();
//             } else {
//                 const newUser = new User({
//                     name: name || 'Guest',
//                     email: email || '',
//                     phone: phone || '',
//                     isVerified: false, // Assuming new users are not verified by default
//                 });

//                 const otp = Math.floor(100000 + Math.random() * 900000).toString();
//                 const otpExpires = Date.now() + 10 * 60 * 1000;
//                 newUser.otp = otp;
//                 newUser.otpExpires = otpExpires;

//                 await newUser.save();
//                 customerId = newUser._id;
//             }

//             // Send OTP via email
//             if (email) {
//                 await sendEmail(email, 'OglePeek Order Verification', `Your OTP is: ${existingUser ? existingUser.otp : newUser.otp}`);
//             }
//         }

//         res.status(201).json({ success: true, message: 'Customer created or retrieved successfully', customerId: customerId });
//     } catch (err) {
//         console.error('Order placement failed:', err);
//         res.status(500).json({ success: false, message: 'Server error while placing order' });
//     }
// };

exports.createOrGetCustomer = async (req, res) => {
    try {
        const user = req.user.user;
        const userId = user.id;

        // 1. Fetch user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty or not found" });
        }

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

            const variant = product.variants.id(item.variantId);
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



exports.verifyAndPlaceOrder = async (req, res) => {
    try {
        const { customerId, otp, address, items, name, email, phone } = req.body;
        // console.log(customerId)
        const userArray = await User.find({ email });
        if (userArray.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const user = userArray[0];

        if (user.otpExpires < Date.now()) {
            console.log("OTP expired")
        }

        console.log(otp);
        console.log(user.otp);
        console.log(user.email);

        if (user.otp !== otp) {
            console.log("OTP not matched")
        }

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const order = new Order({
            customer: customerId,
            name,
            email,
            phone,
            address,
            items,
            status: 'Pending Payment',
            placedAt: new Date()
        });

        console.log(order);

        await order.save();
        return res.status(201).json({ success: true, message: 'Order placed successfully', orderId: order._id });
    } catch (err) {
        console.error('OTP Verification Error:', err);
        return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
    }
};

