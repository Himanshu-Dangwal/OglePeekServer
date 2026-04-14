const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart', required: true },
    totalAmount: { type: Number },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    orderStatus: {
        type: String,
        enum: ['Confirmed', 'Pending', 'Completed', 'Cancelled'],
        // Confirmed  → paid
        // Pending    → created, awaiting payment
        // Completed  → delivered
        // Cancelled  → payment failed / user cancelled
        default: 'Pending'
    },

    // Whether stock has been reserved for this order.
    // Set true at order creation, false once stock is consumed or released.
    isReserved: { type: Boolean, default: false },

    // Shipping info
    name:    { type: String, required: true },
    email:   { type: String, required: true },
    phone:   { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    city:    { type: String, required: true },
    country: { type: String, required: true },
    state:   { type: String, required: true },

    gender: { type: String, enum: ['Male', 'Female', 'other'], default: 'other' },

    paymentStatus: {
        type: String,
        enum: ['Pending Payment', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending Payment',
    },
    // Unique eSewa transaction code — used to prevent replaying the same callback
    paymentRef: { type: String, default: '' },
    placedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

// Speeds up getUserOrders and order status checks
orderSchema.index({ customer: 1, orderStatus: 1 });
// Speeds up the createOrUpdateOrder duplicate check
orderSchema.index({ cartId: 1, customer: 1, orderStatus: 1 });
// Ensures no duplicate payment reference (prevents replay attacks)
orderSchema.index({ paymentRef: 1 }, { unique: true, sparse: true, partialFilterExpression: { paymentRef: { $ne: '' } } });

module.exports = mongoose.model('Order', orderSchema);
