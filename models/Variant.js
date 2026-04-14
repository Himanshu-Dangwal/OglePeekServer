const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
    productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    frameColor: { type: String, required: true, trim: true },
    inStock:    { type: Number, required: true, min: 0, default: 0 },
    // Units currently held by pending (unpaid) orders.
    // Available stock = inStock - reserved
    reserved:   { type: Number, default: 0, min: 0 },
    images:     { type: [String], required: true },
    price:      { type: Number, required: true, min: 0 },
    size:       { type: String },
    hidden:     { type: Boolean },
    updatedAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Variant', VariantSchema);
