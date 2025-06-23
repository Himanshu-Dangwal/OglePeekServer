const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
            quantity: { type: Number, required: true }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);