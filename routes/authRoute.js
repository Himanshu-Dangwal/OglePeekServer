const express    = require('express');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const User       = require('../models/User');

const verifyAuthToken = require('../middlewares/verifyAuthToken');
const catchAsync      = require('../utils/catchAsync');

// Main controllers (with reCAPTCHA)
const { loginHandlerViaEmail, loginHandlerViaPhone, registerHandler, verifyOtpHandler } = require('../controllers/authController');

// Test controllers (without reCAPTCHA — used by clientv2)
const { loginHandlerViaEmailTest, loginHandlerViaPhoneTest, registerTestHandler } = require('../controllers/authControllerTest');

// Validators
const { validateUserRegister }                               = require('../middlewares/validateUserRegister');
const { validateUserLoginViaEmail, validateUserLoginViaPhone } = require('../middlewares/validateUserLogin');
const { validateUserRegisterTest }                           = require('../middlewares/validateUserRegisterTest');
const { validateUserLoginViaEmailTest, validateUserLoginViaPhoneTest } = require('../middlewares/validateUserLoginTest');

// ── Rate limiters ────────────────────────────────────────────────────────────

/** 10 login attempts per 15 minutes per IP */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
});

/** 5 registration attempts per hour per IP */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many registration attempts. Please try again in 1 hour.' },
});

/** 5 OTP attempts per 15 minutes per IP — prevents brute-forcing 6-digit OTPs */
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP attempts. Please try again in 15 minutes.' },
});

// ── Main routes (reCAPTCHA required) ────────────────────────────────────────

router.post('/login/email',  loginLimiter,    validateUserLoginViaEmail,   catchAsync(loginHandlerViaEmail));
router.post('/login/phone',  loginLimiter,    validateUserLoginViaPhone,   catchAsync(loginHandlerViaPhone));
router.post('/register',     registerLimiter, validateUserRegister,        catchAsync(registerHandler));

// ── Test routes (no reCAPTCHA — clientv2) ───────────────────────────────────

router.post('/login/email/test',  loginLimiter,    validateUserLoginViaEmailTest,   catchAsync(loginHandlerViaEmailTest));
router.post('/login/phone/test',  loginLimiter,    validateUserLoginViaPhoneTest,   catchAsync(loginHandlerViaPhoneTest));
router.post('/registerTest',      registerLimiter, validateUserRegisterTest,        catchAsync(registerTestHandler));

// ── OTP verification ─────────────────────────────────────────────────────────

router.post('/verify-otp', otpLimiter, catchAsync(verifyOtpHandler));

// ── Logout ───────────────────────────────────────────────────────────────────

router.post('/logout', (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('authToken', {
        httpOnly: true,
        secure:   isProd,
        sameSite: isProd ? 'None' : 'Lax',
    });
    res.json({ success: true });
});

// ── Auth check ───────────────────────────────────────────────────────────────

router.post('/check', verifyAuthToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.user.id).select('name isAdmin');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ success: true, firstName: user.name, isAdmin: user.isAdmin });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
