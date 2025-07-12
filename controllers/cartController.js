const Cart = require('../models/Cart'); // Assuming you have a Cart model defined
const mongoose = require("mongoose")
const Variant = require('../models/Variant'); // Assuming you have a Variant model defined
const Product = require('../models/Product');

const addOrUpdateCartItem = async (req, res) => {
    try {
        let { productId, variantId, quantity } = req.body;
        const userId = req.user.user.id;

        if (typeof quantity !== "number") {
            quantity = Number(quantity);
        }

        let cart = await Cart.findOne({ userId, userActiveCart: true });

        if (!cart) {
            cart = new Cart({
                userId,
                items: [{ productId, variantId, quantity }]
            });
        } else {
            const itemIndex = cart.items.findIndex(
                (item) =>
                    item.productId.toString() === productId.toString() &&
                    item.variantId.toString() === variantId.toString()
            );

            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += quantity;

                if (cart.items[itemIndex].quantity <= 0) {
                    cart.items.splice(itemIndex, 1);
                }
            } else {
                cart.items.push({ productId, variantId, quantity });
            }
        }


        if (cart.items.length === 0) {
            // If the cart is empty, remove it
            await Cart.deleteOne({ userId });
            return res.status(200).json({ success: true, message: "Cart is empty now" });
        }

        cart.updatedAt = Date.now();
        await cart.save();
        res.status(200).json({ success: true, cart });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update cart', error });
    }
};

const removeCartItem = async (req, res) => {
    const { productId, variantId } = req.body;
    const userId = req.user.user.id;

    try {
        const cart = await Cart.findOne({ userId, userActiveCart: true });

        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        cart.items = cart.items.filter(
            (item) =>
                item.productId.toString() !== productId ||
                item.variantId.toString() !== variantId
        );

        cart.updatedAt = Date.now();
        await cart.save();
        res.status(200).json({ success: true, cart });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to remove item' });
    }
};

const updateCartItemQuantity = async (req, res) => {
    const { productId, variantId, quantity } = req.body;
    const userId = req.user.user.id;

    try {
        const cart = await Cart.findOne({ userId, userActiveCart: true });
        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        const item = cart.items.find(
            (item) =>
                item.productId.toString() === productId &&
                item.variantId.toString() === variantId
        );

        if (!item) return res.status(404).json({ success: false, message: "Item not in cart" });

        item.quantity = quantity;
        cart.updatedAt = Date.now();
        await cart.save();
        res.status(200).json({ success: true, cart });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to update quantity' });
    }
};
const getCartItems = async (req, res) => {
    const userId = req.user.user.id;

    try {
        const cart = await Cart.findOne({ userId, userActiveCart: true }).populate('items.productId');

        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        // console.log("Cart fetched", cart);
        // Map through items and attach variant info manually
        const detailedItems = await Promise.all(cart.items.map(async item => {
            const product = await Product.findById(item.productId);
            const variant = await Variant.findById(item.variantId);
            // console.log("Product and variant fetched", product, variant);

            return {
                productId: product._id,
                variantId: item.variantId,
                quantity: item.quantity,
                name: product.name,
                price: variant?.price,
                image: variant?.images[0],
                frameColor: variant?.frameColor,
                frameStyle: product.frameStyle,
                material: product.material,
                lens: product.lens,
                frameType: product.frameType,
                description: product.description
            };
        }));

        return res.status(200).json({ success: true, items: detailedItems, peekCoins: cart.peekCoins });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to fetch cart items' });
    }
};


module.exports = {
    addOrUpdateCartItem,
    removeCartItem,
    updateCartItemQuantity,
    getCartItems
};
