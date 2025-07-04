const cloudinary = require("../utils/cloudinaryConfig");
const Product = require("../models/Product");
const Variant = require("../models/Variant");

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

        // Upload and assign images to variant
        for (const file of req.files) {
            const uploadResult = await cloudinary.uploader.upload(file.path, { folder: 'products' });
            newVariant.images.push(uploadResult.secure_url);
        }

        if (newVariant.images.length === 0) {
            return res.status(400).json({ success: false, message: "At least one image is required." });
        }

        await newVariant.save();

        // Optionally, link variant to product (not necessary unless you store references in Product)
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

        // ⛔ Delete specific images from Cloudinary if requested
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

        // ✅ Upload new images (if any)
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploadResult = await cloudinary.uploader.upload(file.path, {
                    folder: 'products',
                });
                variant.images.push(uploadResult.secure_url);
            }
        }

        await variant.save();
        return res.status(200).json({ success: true, variant });
    } catch (error) {
        console.error("Variant update failed:", error);
        return res.status(500).json({ success: false, message: "Server error while updating variant." });
    }
};
