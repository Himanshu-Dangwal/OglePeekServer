const { ref } = require('joi');
const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    frameColor: { type: String, required: true, trim: true },
    inStock: { type: Number, required: true, min: 0, default: 0 },
    images: { type: [String], required: true },  // array of image URLs (Cloudinary links)
    price: { type: Number, required: true, min: 0 },
    size: { type: String },
    hidden: { type: Boolean }
});

module.exports = mongoose.model("Variant", VariantSchema)