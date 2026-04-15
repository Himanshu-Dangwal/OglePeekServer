const jwt = require('jsonwebtoken');
const User = require('../models/User');

// exports.authenticate = async (req, res, next) => {
//     const token = req.headers.authorization?.split(' ')[1];
//     if (!token) return res.status(401).json({ message: 'No token provided' });
//     try {
//         // console.log(process.env.secretKey);
//         const decoded = jwt.verify(token, process.env.secretKey);
//         req.user = decoded;
//         if (!req.user) return res.status(401).json({ message: 'User not found' });
//         next();
//     } catch (err) {
//         return res.status(401).json({ message: 'Invalid token' });
//     }
// };


exports.authenticate = (req, res, next) => {
    const token = req.cookies.authToken;
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    try {
        const decoded = jwt.verify(token, process.env.secretKey);
        req.user = decoded;
        if (!req.user) return res.status(401).json({ message: 'User not found' });
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

exports.adminOnly = async (req, res, next) => {
    req.user = req.user.user;
    const currUser = await User.findById(req.user.id);
    if (currUser && currUser.isAdmin) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Admins only' });
    }
};
