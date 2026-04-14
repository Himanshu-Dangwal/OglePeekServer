const crypto     = require('crypto');
const secretKey  = process.env.secretKey;
const User       = require('../models/User');
const jwt        = require('jsonwebtoken');
const axios      = require('axios');
const sendEmail  = require('../utils/sendEmail');

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

/** One-way hash for OTP storage — fast SHA-256 is fine for short-lived tokens */
const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// ── Register (with reCAPTCHA) ────────────────────────────────────────────────

module.exports.registerHandler = async (req, res) => {
    const { name, email, phone, password, captchaValue } = req.body;
    if (!captchaValue) {
        return res.status(400).json({ error: 'CAPTCHA is required!' });
    }

    try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${captchaValue}`;
        const { data } = await axios.post(verifyUrl);
        if (!data.success) {
            return res.status(400).json({ error: 'CAPTCHA verification failed!' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(409).json({ message: 'Email or phone already registered' });
        }

        const otp        = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        const user = new User({ name, email, phone, password, otp: hashOtp(otp), otpExpires });
        await user.save();

        await sendEmail(email, 'OglePeek Email Verification', `Your OTP is: ${otp}`);

        res.status(200).json({ success: true, message: 'OTP sent to your email. Please verify.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// ── Login via Email (with reCAPTCHA) ────────────────────────────────────────

module.exports.loginHandlerViaEmail = async (req, res) => {
    const { email, password, captchaValue } = req.body;
    if (!captchaValue) {
        return res.status(400).json({ error: 'CAPTCHA is required!' });
    }

    try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${captchaValue}`;
        const { data } = await axios.post(verifyUrl);
        if (!data.success) {
            return res.status(400).json({ error: 'CAPTCHA verification failed!' });
        }

        const foundUser = await User.findOne({ email });
        if (!foundUser) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Block login for unverified accounts
        if (!foundUser.isVerified) {
            return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
        }

        const isMatch = await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const authToken = jwt.sign({ user: { id: foundUser._id } }, secretKey, { expiresIn: '7d' });
        res.cookie('authToken', authToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({ success: true, firstName: foundUser.name, peekCoins: foundUser.peekCoins });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ── Login via Phone (with reCAPTCHA) ────────────────────────────────────────

module.exports.loginHandlerViaPhone = async (req, res) => {
    const { phone, password, captchaValue } = req.body;
    if (!captchaValue) {
        return res.status(400).json({ error: 'CAPTCHA is required!' });
    }

    try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${captchaValue}`;
        const { data } = await axios.post(verifyUrl);
        if (!data.success) {
            return res.status(400).json({ error: 'CAPTCHA verification failed!' });
        }

        const foundUser = await User.findOne({ phone });
        if (!foundUser) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        if (!foundUser.isVerified) {
            return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });
        }

        const isMatch = await foundUser.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Use httpOnly cookie — consistent with email login, token not exposed to JS
        const authToken = jwt.sign({ user: { id: foundUser._id } }, secretKey, { expiresIn: '7d' });
        res.cookie('authToken', authToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({ success: true, firstName: foundUser.name, peekCoins: foundUser.peekCoins });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ── Verify OTP ───────────────────────────────────────────────────────────────

module.exports.verifyOtpHandler = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Account already verified' });
        }

        const expired = !user.otpExpires || Date.now() > user.otpExpires.getTime();
        if (expired || user.otp !== hashOtp(otp)) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        user.isVerified  = true;
        user.otp         = undefined;
        user.otpExpires  = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Account verified successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
