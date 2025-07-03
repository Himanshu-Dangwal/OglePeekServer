const cloudinary = require("../utils/cloudinaryConfig")
const Product = require('../models/Product');

exports.createProduct = async (req, res) => {
    try {
        const { name, frameStyle, description, lens, gender, material, productType, frameType } = req.body;
        let variants = req.body.variants;

        if (!variants) {
            return res.status(400).json({ success: false, message: 'Variants data is required.' });
        }

        if (typeof variants === 'string') {
            variants = JSON.parse(variants);
        }

        if (!Array.isArray(variants) || variants.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one variant is required.' });
        }

        variants = variants.map(variant => ({
            ...variant,
            images: []
        }));

        // Process image files and assign them to correct variants
        for (const file of req.files) {
            const field = file.fieldname; // e.g., images0, images1, etc.
            const match = field.match(/images(\d+)/);
            if (!match) continue;
            const index = parseInt(match[1]);

            if (variants[index]) {
                const uploadResult = await cloudinary.uploader.upload(file.path, { folder: 'products' });
                variants[index].images.push(uploadResult.secure_url);
            }
        }

        // Ensure each variant has at least one image
        for (const variant of variants) {
            if (!variant.images || variant.images.length === 0) {
                return res.status(400).json({ success: false, message: `Variant '${variant.frameColor}' must have at least one image.` });
            }
        }

        const product = new Product({
            name,
            frameStyle,
            description,
            lens,
            gender,
            material,
            productType,
            frameType,
            variants
        });

        await product.save();

        res.status(201).json({ success: true, product });
    } catch (err) {
        console.error('Product creation failed:', err);
        res.status(500).json({ success: false, message: 'Server error while creating product' });
    }
};


// Get all products with full details
exports.getAllProducts = async (req, res) => {
    console.log("Fetching all products...");
    try {
        const products = await Product.find({}).lean();
        return res.status(200).json({ products });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch products", details: err.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).lean();

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

        if (frameStyle) filter.frameStyle = frameStyle;
        if (productType) filter.productType = productType;
        if (frameType) filter.frameType = frameType;
        if (gender) filter.gender = gender;
        if (material) filter.material = material;
        if (lens) filter.lens = lens;

        if (frameColor) {
            filter["variants.frameColor"] = frameColor;
        }

        let sortOption = {};
        if (sort === "lowtohigh") sortOption = { "variants.price": 1 };
        else if (sort === "hightolow") sortOption = { "variants.price": -1 };
        console.log(filter)

        const products = await Product.find(filter)
            .sort(sortOption)
            .skip(Number(page) * Number(limit))
            .limit(Number(limit));

        res.status(200).json(products);
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

        // Delete all images in Cloudinary for each variant
        for (const variant of product.variants) {
            for (const imageUrl of variant.images) {
                const publicId = imageUrl.split('/').pop().split('.')[0];
                try {
                    await cloudinary.uploader.destroy(`products/${publicId}`);
                } catch (e) {
                    console.warn(`Failed to delete image ${publicId} from Cloudinary`);
                }
            }
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

        const { name, frameStyle, description, lens, gender, material, productType, frameType, variants } = req.body;

        if (name) product.name = name;
        if (style) product.style = style;
        if (description) product.description = description;
        if (lens) product.lens = lens;
        if (gender) product.gender = gender;
        if (material) product.material = material;
        if (productType) product.productType = productType;
        if (frameType) product.frameType = frameType;

        if (variants) {
            let parsedVariants = variants;
            if (typeof variants === 'string') parsedVariants = JSON.parse(variants);

            if (Array.isArray(parsedVariants)) {
                parsedVariants.forEach((newVar, i) => {
                    if (product.variants[i]) {
                        product.variants[i].frameColor = newVar.frameColor || product.variants[i].frameColor;
                        product.variants[i].inStock = newVar.inStock !== undefined ? newVar.inStock : product.variants[i].inStock;
                        product.variants[i].price = newVar.price || product.variants[i].price;
                        product.variants[i].size = newVar.size || product.variants[i].size;
                    }
                });
            }
        }

        // Handle images update
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const field = file.fieldname; // e.g., images0, images1, etc.
                const match = field.match(/images(\d+)/);
                if (!match) continue;
                const index = parseInt(match[1]);
                if (product.variants[index]) {
                    const uploadResult = await cloudinary.uploader.upload(file.path, { folder: 'products' });
                    product.variants[index].images.push(uploadResult.secure_url);
                }
            }
        }

        product.updatedAt = Date.now();
        await product.save();

        res.status(200).json({ success: true, product });
    } catch (err) {
        console.error('Product update failed:', err);
        res.status(500).json({ success: false, message: 'Server error while updating product' });
    }
}



