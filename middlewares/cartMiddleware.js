const Cart = require('../models/Cart');
const Variant = require('../models/Variant');
const verifyCart = async (req, res, next) => {
    try {
        const userId = req.user.user.id;
        const cart = await Cart.findOne({ userId, userActiveCart: true });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty or not found" });
        }

        for (const item of cart.items) {
            const variant = await Variant.findById(item.variantId);
            if (!variant || variant.inStock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for item with variant ID ${item.variantId}. Available: ${variant ? variant.inStock : 0}`
                });
            }
        }

        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error("Error verifying cart:", error);
        res.status(500).json({ success: false, message: 'Failed to verify cart', error });
    }
}

module.exports = {
    verifyCart
};