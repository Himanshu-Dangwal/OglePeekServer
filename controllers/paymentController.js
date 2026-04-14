const crypto  = require('crypto');
const mongoose = require('mongoose');
const Order   = require('../models/Order');
const Cart    = require('../models/Cart');
const Variant = require('../models/Variant');

const { deductStock, releaseReservation } = require('../utils/stockUtils');

const ESEWA_MERCHANT_ID  = process.env.MERCHANT_ID;
const ESEWA_PAYMENT_URL  = process.env.ESEWAPAYMENT_URL;
const ESEWA_VERIFY_URL   = process.env.ESEWA_STATUS_URL;

// Secret key is read from env — never hardcoded
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY;

function generateSignature(dataString, secretKey) {
    return crypto.createHmac('sha256', secretKey)
        .update(dataString)
        .digest('base64');
}

// ── 1. Initiate payment — redirect user to eSewa gateway ────────────────────

exports.initiateEsewaPayment = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Re-verify the total from live variant prices to prevent price tampering
        const cart = await Cart.findById(order.cartId).lean();
        if (!cart) return res.status(400).json({ message: 'Cart not found for this order' });

        const variantIds = cart.items.map(i => i.variantId);
        const variants   = await Variant.find({ _id: { $in: variantIds } }).lean();
        const variantMap = {};
        variants.forEach(v => { variantMap[v._id.toString()] = v; });

        const liveTotal = cart.items.reduce((sum, item) => {
            const v = variantMap[item.variantId.toString()];
            return sum + (v ? v.price * item.quantity : 0);
        }, 0);

        const total_amount = Math.round(liveTotal);

        const product_code      = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';
        // ObjectId is exactly 24 hex chars; append timestamp as tiebreaker
        const transaction_uuid  = `${order._id.toString()}-${Date.now()}`;
        const success_url       = `${process.env.Backend_URL}/api/payment/pay/esewa/success`;
        const failure_url       = `${process.env.Backend_URL}/api/payment/pay/esewa/failure`;
        const signed_field_names = 'total_amount,transaction_uuid,product_code';
        const dataToSign        = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
        const signature         = generateSignature(dataToSign, ESEWA_SECRET_KEY);

        res.send(`<!DOCTYPE html>
      <html>
        <head><title>Redirecting to eSewa...</title></head>
        <body onload="document.forms[0].submit()">
          <form action="https://rc-epay.esewa.com.np/api/epay/main/v2/form" method="POST">
            <input type="hidden" name="amount"                   value="${liveTotal}" />
            <input type="hidden" name="tax_amount"               value="0" />
            <input type="hidden" name="product_service_charge"   value="0" />
            <input type="hidden" name="product_delivery_charge"  value="0" />
            <input type="hidden" name="total_amount"             value="${total_amount}" />
            <input type="hidden" name="product_code"             value="${product_code}" />
            <input type="hidden" name="transaction_uuid"         value="${transaction_uuid}" />
            <input type="hidden" name="success_url"              value="${success_url}" />
            <input type="hidden" name="failure_url"              value="${failure_url}" />
            <input type="hidden" name="signed_field_names"       value="${signed_field_names}" />
            <input type="hidden" name="signature"                value="${signature}" />
            <noscript><input type="submit" value="Pay with eSewa"/></noscript>
          </form>
          <p>Redirecting to eSewa payment gateway...</p>
        </body>
      </html>`);
    } catch (err) {
        res.status(500).json({ message: 'Could not initiate payment' });
    }
};

// ── 2. eSewa success callback ────────────────────────────────────────────────

exports.esewaSuccess = async (req, res) => {
    try {
        const encodedData = req.query.data;
        if (!encodedData) {
            return res.status(400).send('No data received from eSewa.');
        }

        const jsonString   = Buffer.from(encodedData, 'base64').toString('utf-8');
        const responseData = JSON.parse(jsonString);

        // ── Signature verification ──
        const respSignedFields = responseData.signed_field_names;
        let verifyString = '';
        respSignedFields.split(',').forEach((field, i, arr) => {
            verifyString += `${field}=${responseData[field]}`;
            if (i !== arr.length - 1) verifyString += ',';
        });
        const computedSig = generateSignature(verifyString, ESEWA_SECRET_KEY);
        if (computedSig !== responseData.signature) {
            return res.status(400).send('Invalid payment response signature.');
        }

        if (responseData.status !== 'COMPLETE') {
            return res.json({ message: 'Payment not completed', status: responseData.status });
        }

        // ObjectId is always exactly 24 hex chars — safe to substring
        const fullUUID = responseData.transaction_uuid;
        const orderId  = fullUUID.substring(0, 24);

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).send('Invalid order reference in payment response.');
        }

        const paidOrder = await Order.findById(orderId);
        if (!paidOrder) {
            return res.status(404).send('Order not found.');
        }

        // ── Idempotency guard — if already processed, redirect without re-deducting ──
        if (paidOrder.paymentStatus === 'Paid') {
            return res.redirect(`${process.env.CLIENT_URL}/payment-success?orderId=${orderId}`);
        }

        // ── Replay-attack guard — reject duplicate eSewa transaction codes ──
        const transactionCode = responseData.transaction_code || '';
        if (transactionCode) {
            const duplicate = await Order.findOne({ paymentRef: transactionCode });
            if (duplicate && duplicate._id.toString() !== orderId) {
                return res.status(400).send('Duplicate payment transaction detected.');
            }
        }

        // ── Atomic stock deduction (inStock -= qty, reserved -= qty) ──
        const cart = await Cart.findById(paidOrder.cartId).lean();
        if (cart) {
            await deductStock(cart.items);
        }

        // ── Mark order confirmed ──
        paidOrder.paymentStatus = 'Paid';
        paidOrder.orderStatus   = 'Confirmed';
        paidOrder.paymentRef    = transactionCode;
        paidOrder.isReserved    = false;
        await paidOrder.save();

        // ── Deactivate cart ──
        await Cart.findByIdAndUpdate(paidOrder.cartId, { userActiveCart: false });

        return res.redirect(`${process.env.CLIENT_URL}/payment-success?orderId=${orderId}`);

    } catch (err) {
        res.status(500).send('Error processing payment success.');
    }
};

// ── 3. eSewa failure callback ────────────────────────────────────────────────

exports.esewaFailure = async (req, res) => {
    try {
        if (req.query.data) {
            const jsonString   = Buffer.from(req.query.data, 'base64').toString('utf-8');
            const responseData = JSON.parse(jsonString);

            const fullUUID = responseData.transaction_uuid || '';
            const orderId  = fullUUID.substring(0, 24);

            if (orderId && mongoose.Types.ObjectId.isValid(orderId)) {
                const failedOrder = await Order.findById(orderId);
                if (failedOrder && failedOrder.paymentStatus !== 'Paid') {
                    // Release reserved stock so others can purchase
                    if (failedOrder.isReserved) {
                        await releaseReservation(failedOrder.cartId);
                    }
                    failedOrder.orderStatus   = 'Cancelled';
                    failedOrder.paymentStatus = 'Failed';
                    failedOrder.isReserved    = false;
                    await failedOrder.save();
                }
            }
        }

        return res.redirect(`${process.env.CLIENT_URL}/payment-failure`);
    } catch (err) {
        res.status(500).send('Error handling payment failure.');
    }
};
