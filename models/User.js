/*

name
email
phoneNo
productBought - [productIds]
Address
Bought History -> [Item1, Item2]

Item1 would be like this -> ItemID, Address, Amount, Date, BillingNumber, Phone Number Used, Email Id Used, Coupons applied ?
*/

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { boolean, required } = require('joi');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6 },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    isAdmin: { type: Boolean, require: true, default: false },
    peekCoins: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

