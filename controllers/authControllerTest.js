const crypto = require('crypto')
const secretKey = process.env.secretKey;
const User = require('../models/User')
const jwt = require('jsonwebtoken');
const axios = require('axios');

const sendEmail = require("../utils/sendEmail");

// Registering a customer needs an OTP confirmation via both email and Phone

module.exports.registerTestHandler = async (req, res) => {
    const { name, email, phone, password } = req.body

    console.log(name);

    try {

        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(409).json({ message: 'Email or phone already registered' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpExpires = Date.now() + 10 * 60 * 1000; // valid for 10 minutes

        console.log(otp);
        const user = new User({
            name,
            email,
            phone,
            password,
            otp,
            otpExpires
        });

        const resp = await user.save()

        console.log(resp);

        // Send OTP via email
        await sendEmail(email, 'OglePeek Email Verification', `Your OTP is: ${otp}`);
        res.status(200).json({ success: true, message: 'OTP sent to your email. Please verify.' });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}


module.exports.loginHandlerViaEmailTest = async (req, res) => {

    const { email, password } = req.body;

    try {
        // Find the customer by email
        const foundUser = await User.findOne({ email });
        if (!foundUser) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Compare the password with the hashed password in the database
        const isMatch = await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate JWT token
        const data2 = {
            user: { id: foundUser._id }
        };
        const authToken = jwt.sign(data2, secretKey, { expiresIn: '365d' });
        res.cookie("authToken", authToken, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 365 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            firstName: foundUser.name,
            peekCoins: foundUser.peekCoins
        });

        // res.status(200).json({ success: true, authToken, firstName: foundUser.name });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



module.exports.loginHandlerViaPhoneTest = async (req, res) => {
    const { phone, password } = req.body;

    try {

        // Find the customer by phone
        const foundUser = await User.findOne({ phone });
        if (!foundUser) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Compare the password with the hashed password in the database
        const isMatch = await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate JWT token
        const data2 = {
            user: { id: foundUser._id }
        };
        const authToken = jwt.sign(data2, secretKey, { expiresIn: '1h' });

        res.status(200).json({ success: true, authToken });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


