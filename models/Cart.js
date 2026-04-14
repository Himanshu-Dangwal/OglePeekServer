const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    }
});

// A user can have more than 1 cart; each cart links to an order.
// Only one cart can be active (userActiveCart: true) at a time.
const CartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    items: [CartItemSchema],
    peekCoins: {
        type: Number,
        default: 0
    },
    userActiveCart: {
        type: Boolean,
        default: true
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index — every cart operation queries this pair; without the index
// it is a full collection scan on every request.
CartSchema.index({ userId: 1, userActiveCart: 1 });

module.exports = mongoose.model('Cart', CartSchema);
