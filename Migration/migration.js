const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

const app = express();

const MONGO_PROD_URI = process.env.PROD_URI || "mongodb://localhost:27017/oglepeek";

async function connectToMongo() {
    mongoose.set("strictQuery", false);
    try {
        await mongoose.connect(MONGO_PROD_URI);
        console.log("Successfully connected to MongoDB database");
        console.log("Connected to database:", mongoose.connection.name);
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
}

connectToMongo().catch(err => console.log("Some error"));

const migrateCart = async () => {
    const cart = await Cart.updateMany(
        { peekCoins: { $exists: false } },
        { $set: { peekCoins: 0 } }
    );
    console.log("✅ Cart migration completed:", cart);
};

// migrateCart().catch(err => console.log("Error in cart migration:", err));

const hiddenFieldInProduct = async () => {
    try {
        const result = await Product.updateMany(
            { "variants.hidden": { $exists: false } },
            { $set: { "variants.$[].hidden": false } }
        )
        console.log(`Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
    } catch (error) {
        console.log("Error while migrating the database", error);
    } finally {
        await mongoose.disconnect();
    }
}

// hiddenFieldInProduct().catch(err => console.log("Error in cart migration:", err));

const orderStatusInOrder = async () => {
    try {
        const result = await Order.updateMany(
            { "orderStatus": { $exists: false } },
            { $set: { "orderStatus": "Pending" } }
        )
        console.log(`Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);
    } catch (error) {
        console.log("Error while migrating the database", error);
    } finally {
        await mongoose.disconnect();
    }
}

orderStatusInOrder().catch(err => console.log("Error in cart migration:", err));

