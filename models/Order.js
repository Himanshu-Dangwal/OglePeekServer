const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    cartId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart', required: true },
    totalAmount: { type: Number }, // Total amount of the order
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    orderStatus: {
        type: String,
        enum: ['Confirmed', 'Pending', 'Completed', 'Cancelled'],  //Confirmed -> When it is paid for, Pending -> When it is not paid for, Completed -> When it is delivered, Cancelled -> When it is cancelled
        default: 'Pending'   //Order is created but not paid for
    },

    // Shipping Info
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },

    gender: { type: String, enum: ['Male', 'Female', 'other'], default: 'other' },

    paymentStatus: {
        type: String,
        enum: ['Pending Payment', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending Payment',
    },
    paymentRef: { type: String, default: '' },
    placedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
