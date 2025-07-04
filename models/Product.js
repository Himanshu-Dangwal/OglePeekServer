const mongoose = require('mongoose');


const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    frameStyle: { type: String, required: true },    // e.g., Aviator, Wayfarer, etc.
    description: { type: String, required: true, trim: true },
    lens: { type: String, required: true },    // e.g., Polarized, UV400
    gender: { type: String, required: true },    // e.g., Men, Women, Unisex
    material: { type: String, required: true },    // e.g., Metal, Plastic
    productType: { type: String, required: true }, // e.g., Eyeglasses, Sunglasses
    frameType: { type: String, required: true }, // e.g., Full Rim, Half Rim, Rimless
    variants:
        [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Variant'
        }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);
