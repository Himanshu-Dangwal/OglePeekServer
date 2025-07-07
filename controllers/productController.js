const cloudinary = require("../utils/cloudinaryConfig")
const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
    try {
        const { name, frameStyle, description, lens, gender, material, productType, frameType } = req.body;

        const product = new Product({
            name,
            frameStyle,
            description,
            lens,
            gender,
            material,
            productType,
            frameType,
        });

        await product.save();

        res.status(201).json({ success: true, product });
    } catch (err) {
        console.error('Product creation failed:', err);
        res.status(500).json({ success: false, message: 'Server error while creating product' });
    }
};



exports.getAllProducts = async (req, res) => {
    console.log("Fetching all products...");
    try {
        const products = await Product.find({})
            .populate('variants')  // <-- this populates the variant IDs
            .lean();

        return res.status(200).json({ products });
    } catch (err) {
        console.error("Error in getAllProducts:", err);
        return res.status(500).json({ error: "Failed to fetch products", details: err.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('variants').lean();

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ message: "Server error" });
    }
}


exports.getProductsWithFilterAndPagination = async (req, res) => {
    try {
        const {
            sort,
            frameStyle,
            productType,
            frameType,
            frameColor,
            gender,
            material,
            lens,
            page = 0,
            limit = 10
        } = req.query;

        const filter = {};

        // Filter only product-level fields
        if (frameStyle) filter.frameStyle = frameStyle;
        if (productType) filter.productType = productType;
        if (frameType) filter.frameType = frameType;
        if (gender) filter.gender = gender;
        if (material) filter.material = material;
        if (lens) filter.lens = lens;

        let sortOption = {};

        // Step 1: Fetch base products
        let products = await Product.find(filter)
            .populate('variants')
            .lean()
            .skip(Number(page) * Number(limit))
            .limit(Number(limit));

        // Step 2: Filter products by variant field (e.g., frameColor)
        if (frameColor) {
            products = products.filter(product =>
                product.variants.some(variant => variant.frameColor === frameColor)
            );
        }

        // Step 3: Sorting by variant price
        if (sort === 'lowtohigh') {
            products.sort((a, b) => {
                const minA = Math.min(...a.variants.map(v => v.price || Infinity));
                const minB = Math.min(...b.variants.map(v => v.price || Infinity));
                return minA - minB;
            });
        } else if (sort === 'hightolow') {
            products.sort((a, b) => {
                const maxA = Math.max(...a.variants.map(v => v.price || 0));
                const maxB = Math.max(...b.variants.map(v => v.price || 0));
                return maxB - maxA;
            });
        }

        return res.status(200).json(products);
    } catch (error) {
        console.error("Error fetching filtered products:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete a product by ID (admin only)
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        await product.remove();
        return res.status(200).json({ message: "Product deleted successfully" });
    } catch (err) {
        return res.status(500).json({ error: "Failed to delete product", details: err.message });
    }
};



// Update product or a specific variant

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const {
            name,
            frameStyle,
            description,
            lens,
            gender,
            material,
            productType,
            frameType
        } = req.body;

        if (name) product.name = name;
        if (frameStyle) product.frameStyle = frameStyle;
        if (description) product.description = description;
        if (lens) product.lens = lens;
        if (gender) product.gender = gender;
        if (material) product.material = material;
        if (productType) product.productType = productType;
        if (frameType) product.frameType = frameType;

        product.updatedAt = Date.now();
        await product.save();

        return res.status(200).json({ success: true, product });
    } catch (err) {
        console.error('Product update failed:', err);
        return res.status(500).json({ success: false, message: 'Server error while updating product' });
    }
};

