/**
 * authControllerTest.js
 * Auth handlers without reCAPTCHA — used by the clientv2 frontend.
 * OTP is SHA-256 hashed before storage; plaintext is only ever sent to the user's email.
 */

const crypto    = require('crypto');
const secretKey = process.env.secretKey;
const User      = require('../models/User');
const jwt       = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

const isProd = process.env.NODE_ENV === 'production';

/** Cookie options — secure + SameSite=None on prod (HTTPS), lax on localhost (HTTP) */
const cookieOptions = {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'None' : 'Lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
};

/** One-way hash for OTP storage */
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// ── Register ─────────────────────────────────────────────────────────────────

module.exports.registerTestHandler = async (req, res) => {
    const { name, email, phone, password } = req.body;

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(409).json({ message: 'Email or phone already registered' });
        }

        const otp        = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        const user = new User({ name, email, phone, password, otp: hashOtp(otp), otpExpires });
        await user.save();

        // Plaintext OTP is sent to the user's email — never logged, never stored
        await sendEmail(email, 'OglePeek Email Verification', `Your OTP is: ${otp}`);

        res.status(200).json({ success: true, message: 'OTP sent to your email. Please verify.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ── Login via Email ───────────────────────────────────────────────────────────

module.exports.loginHandlerViaEmailTest = async (req, res) => {
    const { email, password } = req.body;
    try {
        const foundUser = await User.findOne({ email });
        if (!foundUser) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Block login for accounts that have not verified their email
        if (!foundUser.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email address before logging in.'
            });
        }

        const isMatch = await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const authToken = jwt.sign({ user: { id: foundUser._id } }, secretKey, { expiresIn: '7d' });
        res.cookie('authToken', authToken, cookieOptions);

        res.status(200).json({ success: true, firstName: foundUser.name, peekCoins: foundUser.peekCoins });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ── Login via Phone ───────────────────────────────────────────────────────────

module.exports.loginHandlerViaPhoneTest = async (req, res) => {
    const { phone, password } = req.body;

    try {
        const foundUser = await User.findOne({ phone });
        if (!foundUser) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        if (!foundUser.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email address before logging in.'
            });
        }

        const isMatch = await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // httpOnly cookie — token never exposed to client-side JS
        const authToken = jwt.sign({ user: { id: foundUser._id } }, secretKey, { expiresIn: '7d' });
        res.cookie('authToken', authToken, cookieOptions);

        res.status(200).json({ success: true, firstName: foundUser.name, peekCoins: foundUser.peekCoins });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
