const Cart    = require('../models/Cart');
const Variant = require('../models/Variant');
const Product = require('../models/Product');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Batch-fetch variant prices and compute cart total.
 * Single $in query instead of N sequential findById calls.
 */
const calculateTotalAmount = async (items) => {
    const ids      = items.map(i => i.variantId);
    const variants = await Variant.find({ _id: { $in: ids } }).lean();
    const priceMap = {};
    variants.forEach(v => { priceMap[v._id.toString()] = v.price; });

    return items.reduce((total, item) => {
        const price = priceMap[item.variantId.toString()] || 0;
        return total + price * item.quantity;
    }, 0);
};

// ── Add / Update cart item ───────────────────────────────────────────────────

const addOrUpdateCartItem = async (req, res) => {
    try {
        let { productId, variantId, quantity } = req.body;
        const userId = req.user.user.id;

        quantity = Number(quantity);
        if (!quantity || quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        // ── Stock check: ensure the variant exists and has enough inStock ──
        const variant = await Variant.findById(variantId).lean();
        if (!variant) {
            return res.status(404).json({ success: false, message: 'Product variant not found' });
        }

        let cart = await Cart.findOne({ userId, userActiveCart: true });

        // How many the user already has in their cart for this variant?
        const existingItem = cart?.items.find(
            i => i.variantId.toString() === variantId.toString()
        );
        const currentQtyInCart = existingItem?.quantity || 0;
        const newTotalQty      = currentQtyInCart + quantity;

        if (newTotalQty > variant.inStock) {
            return res.status(400).json({
                success: false,
                message: `Only ${variant.inStock} unit(s) available. You already have ${currentQtyInCart} in your cart.`
            });
        }

        // ── Upsert cart ──
        if (!cart) {
            cart = new Cart({ userId, items: [{ productId, variantId, quantity }] });
        } else {
            const idx = cart.items.findIndex(
                i =>
                    i.productId.toString() === productId.toString() &&
                    i.variantId.toString() === variantId.toString()
            );

            if (idx > -1) {
                cart.items[idx].quantity += quantity;
                if (cart.items[idx].quantity <= 0) cart.items.splice(idx, 1);
            } else {
                cart.items.push({ productId, variantId, quantity });
            }
        }

        if (cart.items.length === 0) {
            await Cart.deleteOne({ userId });
            return res.status(200).json({ success: true, message: 'Cart is now empty' });
        }

        cart.totalAmount = await calculateTotalAmount(cart.items);
        cart.updatedAt   = Date.now();
        await cart.save();

        res.status(200).json({ success: true, cart });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update cart' });
    }
};

// ── Remove item ──────────────────────────────────────────────────────────────

const removeCartItem = async (req, res) => {
    const { productId, variantId } = req.body;
    const userId = req.user.user.id;

    try {
        const cart = await Cart.findOne({ userId, userActiveCart: true });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        cart.items = cart.items.filter(
            i => !(i.productId.toString() === productId && i.variantId.toString() === variantId)
        );

        if (cart.items.length === 0) {
            await Cart.deleteOne({ _id: cart._id });
            return res.status(200).json({ success: true, message: 'Cart is now empty' });
        }

        cart.totalAmount = await calculateTotalAmount(cart.items);
        cart.updatedAt   = Date.now();
        await cart.save();

        res.status(200).json({ success: true, cart });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to remove item' });
    }
};

// ── Update quantity ──────────────────────────────────────────────────────────

const updateCartItemQuantity = async (req, res) => {
    const { productId, variantId, quantity } = req.body;
    const userId = req.user.user.id;

    try {
        if (!quantity || quantity < 1) {
            return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
        }

        // Stock check
        const variant = await Variant.findById(variantId).lean();
        if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });
        if (quantity > variant.inStock) {
            return res.status(400).json({
                success: false,
                message: `Only ${variant.inStock} unit(s) available`
            });
        }

        const cart = await Cart.findOne({ userId, userActiveCart: true });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const item = cart.items.find(
            i => i.productId.toString() === productId && i.variantId.toString() === variantId
        );
        if (!item) return res.status(404).json({ success: false, message: 'Item not in cart' });

        item.quantity    = quantity;
        cart.totalAmount = await calculateTotalAmount(cart.items);
        cart.updatedAt   = Date.now();
        await cart.save();

        res.status(200).json({ success: true, cart });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update quantity' });
    }
};

// ── Get cart items ───────────────────────────────────────────────────────────

const getCartItems = async (req, res) => {
    const userId = req.user.user.id;

    try {
        const cart = await Cart.findOne({ userId, userActiveCart: true }).lean();
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        // Single batched query for each collection instead of N+1 loops
        const productIds = cart.items.map(i => i.productId);
        const variantIds = cart.items.map(i => i.variantId);

        const [products, variants] = await Promise.all([
            Product.find({ _id: { $in: productIds } }).lean(),
            Variant.find({ _id: { $in: variantIds } }).lean(),
        ]);

        const productMap = {};
        products.forEach(p => { productMap[p._id.toString()] = p; });
        const variantMap = {};
        variants.forEach(v => { variantMap[v._id.toString()] = v; });

        const detailedItems = cart.items.map(item => {
            const product = productMap[item.productId.toString()];
            const variant = variantMap[item.variantId.toString()];
            if (!product || !variant) return null;
            return {
                productId:   product._id,
                variantId:   item.variantId,
                quantity:    item.quantity,
                name:        product.name,
                price:       variant.price,
                image:       variant.images?.[0],
                frameColor:  variant.frameColor,
                frameStyle:  product.frameStyle,
                material:    product.material,
                lens:        product.lens,
                frameType:   product.frameType,
                description: product.description,
            };
        }).filter(Boolean);

        res.status(200).json({ success: true, items: detailedItems, peekCoins: cart.peekCoins });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch cart items' });
    }
};

module.exports = { addOrUpdateCartItem, removeCartItem, updateCartItemQuantity, getCartItems };
