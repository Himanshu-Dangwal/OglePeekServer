const cloudinary = require("../utils/cloudinaryConfig");
const Product = require("../models/Product");
const Variant = require("../models/Variant");

/**
 * Upload a buffer to Cloudinary using upload_stream.
 * Used because multer is configured with memoryStorage (file.buffer, not file.path).
 */
function uploadBuffer(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
        stream.end(buffer);
    });
}

exports.createVariant = async (req, res) => {
    try {
        const { id } = req.params; // Product ID
        const { frameColor, inStock, price, size, hidden } = req.body;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const newVariant = new Variant({
            productId: id,
            frameColor,
            inStock,
            price,
            size,
            hidden,
            images: []
        });

        // Upload each file buffer to Cloudinary
        for (const file of req.files) {
            const result = await uploadBuffer(file.buffer, 'products');
            newVariant.images.push(result.secure_url);
        }

        if (newVariant.images.length === 0) {
            return res.status(400).json({ success: false, message: "At least one image is required." });
        }

        await newVariant.save();

        product.variants.push(newVariant._id);
        await product.save();

        res.status(201).json({ success: true, variant: newVariant });

    } catch (error) {
        console.error("Variant creation failed:", error);
        res.status(500).json({ success: false, message: "Server error while creating variant." });
    }
};

exports.updateVariant = async (req, res) => {
    try {
        const { id } = req.params; // variantId
        const { frameColor, inStock, price, size, hidden, deleteImageUrls } = req.body;

        const variant = await Variant.findById(id);
        if (!variant) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        if (frameColor) variant.frameColor = frameColor;
        if (inStock !== undefined) variant.inStock = inStock;
        if (price) variant.price = price;
        if (size) variant.size = size;
        if (hidden !== undefined) variant.hidden = hidden;

        // Delete specific images from Cloudinary if requested
        if (deleteImageUrls && Array.isArray(deleteImageUrls)) {
            for (const imageUrl of deleteImageUrls) {
                try {
                    const publicId = imageUrl.split('/').pop().split('.')[0];
                    await cloudinary.uploader.destroy(`products/${publicId}`);
                    variant.images = variant.images.filter(img => img !== imageUrl);
                } catch (err) {
                    console.warn(`Failed to delete image from Cloudinary: ${imageUrl}`);
                }
            }
        }

        // Upload new images if provided (buffer-based, memoryStorage)
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await uploadBuffer(file.buffer, 'products');
                variant.images.push(result.secure_url);
            }
        }

        await variant.save();
        return res.status(200).json({ success: true, variant });
    } catch (error) {
        console.error("Variant update failed:", error);
        return res.status(500).json({ success: false, message: "Server error while updating variant." });
    }
};

exports.deleteVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const variant = await Variant.findById(id);
        if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });
        for (const imageUrl of variant.images) {
            try {
                const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
                await cloudinary.uploader.destroy(`products/${publicId}`);
            } catch (e) { /* continue if Cloudinary delete fails */ }
        }
        await Product.findByIdAndUpdate(variant.productId, { $pull: { variants: variant._id } });
        await variant.deleteOne();
        return res.status(200).json({ success: true, message: 'Variant deleted' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error while deleting variant' });
    }
};
