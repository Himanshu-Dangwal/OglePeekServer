const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    }
});


//A user can have more than 1 cart, and each cart will be linked to an order. 
//The orders can be Pending, Confirmed, Completed, Cancelled
//At one time only 1 order can be in pending state, and that will be the active cart of the user
//The cart will be used to store the items that the user has added to the cart,
const CartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [CartItemSchema],
    peekCoins: {  //Redemable peek coins (This will be updated if user uses them, or whenever a purchase is completed the peekCoins will be increased)
        type: Number,
        default: 0
    },
    userActiveCart: { // This will be used to check if the user has an active cart or not
        // Main idea is to differentiate between the current active cart of the user and the other carts of the user, which are associated with the user
        type: Boolean,
        default: true
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Cart', CartSchema);
