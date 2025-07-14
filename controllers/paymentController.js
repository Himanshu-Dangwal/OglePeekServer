const axios = require('axios');
const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Variant = require('../models/Variant');

const ESEWA_MERCHANT_ID = process.env.MERCHANT_ID;      // eSewa merchant code
const ESEWA_PAYMENT_URL = process.env.ESEWAPAYMENT_URL; // eSewa payment endpoint (for redirect/form)
const ESEWA_VERIFY_URL = process.env.ESEWA_STATUS_URL;  // eSewa transaction verification endpoint

// Helper to generate HMAC-SHA256 signature in Base64
function generateSignature(dataString, secretKey) {
    return crypto.createHmac('sha256', secretKey)
        .update(dataString)
        .digest('base64');
}


// 1. Initiate payment - redirect user to eSewa gateway
exports.initiateEsewaPayment = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const amount = order.totalAmount;  // assume order has a total amount field
        const tax_amount = 0;
        const product_service_charge = 0;
        const product_delivery_charge = 0;

        const total_amount = Math.round(amount + tax_amount + product_service_charge + product_delivery_charge);

        const product_code = process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST';

        const transaction_uuid = `${order._id.toString()}-${Date.now()}`; // unique transaction ID for eSewa (use Order ID here)
        console.log(process.env.Backend_URL)
        const success_url = `${process.env.Backend_URL}/api/payment/pay/esewa/success`;  // URL to handle success
        const failure_url = `${process.env.Backend_URL}/api/payment/pay/esewa/failure`;  // URL to handle failure
        const signed_field_names = "total_amount,transaction_uuid,product_code";
        const dataToSign = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;

        const secretKey = "8gBm/:&EnhH.1/q";  // test secret from eSewa docs:contentReference[oaicite:15]{index=15}
        const signature = generateSignature(dataToSign, secretKey);
        // 3. Respond with an HTML form that auto-submits to eSewa
        const eSewaFormURL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
        res.send(`<!DOCTYPE html>
      <html>
        <head><title>Redirecting to eSewa...</title></head>
        <body onload="document.forms[0].submit()">
          <form action="${eSewaFormURL}" method="POST">
            <input type="hidden" name="amount" value="${amount}" />
            <input type="hidden" name="tax_amount" value="${tax_amount}" />
            <input type="hidden" name="product_service_charge" value="${product_service_charge}" />
            <input type="hidden" name="product_delivery_charge" value="${product_delivery_charge}" />
            <input type="hidden" name="total_amount" value="${total_amount}" />
            <input type="hidden" name="product_code" value="${product_code}" />
            <input type="hidden" name="transaction_uuid" value="${transaction_uuid}" />
            <input type="hidden" name="success_url" value="${success_url}" />
            <input type="hidden" name="failure_url" value="${failure_url}" />
            <input type="hidden" name="signed_field_names" value="${signed_field_names}" />
            <input type="hidden" name="signature" value="${signature}" />
            <noscript><input type="submit" value="Pay with eSewa"/></noscript>
          </form>
          <p>Redirecting to eSewa payment gateway...</p>
        </body>
      </html>
    `);
    } catch (err) {
        console.error('Error initiating eSewa payment:', err);
        res.status(500).json({ message: 'Could not initiate payment' });
    }
};


exports.esewaSuccess = async (req, res) => {
    try {
        const encodedData = req.query.data;  // eSewa attaches the result in 'data' query param (Base64)
        if (!encodedData) {
            return res.status(400).send("No data received from eSewa.");
        }
        // Decode the base64 encoded response
        const jsonString = Buffer.from(encodedData, 'base64').toString('utf-8');
        const responseData = JSON.parse(jsonString);
        // Verify the response signature to ensure integrity (optional but recommended)
        const respSignature = responseData.signature;
        const respSignedFields = responseData.signed_field_names;  // e.g. "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names"
        // Prepare string in the same format to verify signature
        let verifyString = "";
        respSignedFields.split(',').forEach((field, index, arr) => {
            verifyString += `${field}=${responseData[field]}`;
            if (index !== arr.length - 1) verifyString += ',';
        });
        const computedRespSig = generateSignature(verifyString, process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q");
        if (computedRespSig !== respSignature) {
            console.error("Signature mismatch! Possible tampering of response.");
            return res.status(400).send("Invalid payment response signature.");
        }
        // Check payment status
        if (responseData.status === "COMPLETE") {
            // Payment successful – update Order in database
            const fullUUID = responseData.transaction_uuid;
            const orderId = fullUUID.split("-")[0]; // ✅ Extract only the ObjectId part
            console.log("Order ID from eSewa response:", orderId);

            const paidOrder = await Order.findById(orderId);
            console.log("Paid Order:", paidOrder);
            if (paidOrder) {
                paidOrder.paymentStatus = 'Paid';
                paidOrder.orderStatus = 'Confirmed';        // mark order as confirmed since payment done
                paidOrder.paymentRef = responseData.transaction_code || "";  // store eSewa transaction code
                await paidOrder.save();
            }
            console.log("Trying to update the cart status for order:", orderId);
            // You might clear the user's cart or mark it inactive as well
            if (paidOrder && paidOrder.cartId) {
                await Cart.findByIdAndUpdate(paidOrder.cartId, { userActiveCart: false });
            }

            //Also need to update the inStock of each variant in the order
            //First need to populate the order with cart items
            await paidOrder.populate({
                path: 'cartId',
                populate: {
                    path: 'items.variantId',
                    model: 'Variant'
                }
            });
            console.log("Trying to update in Stock for each variant in the order:", paidOrder);
            for (const item of paidOrder.cartId.items) {
                const variant = await Variant.findById(item.variantId);
                if (variant) {
                    variant.inStock -= item.quantity;
                    await variant.save();
                }
            }
            // Respond or redirect to a success page
            console.log("Payment successful for order:", orderId);
            console.log(`${process.env.CLIENT_URL}/payment-success?orderId=${orderId}`)
            return res.redirect(`${process.env.CLIENT_URL}/payment-success?orderId=${orderId}`);

            // return res.json({ message: "Payment successful", orderId: orderId, status: responseData.status });
            // (In a real app, you might redirect the user to a frontend route like: res.redirect('/order-success?orderId=...'))
        } else {
            // Status is not COMPLETE (could be "PENDING" or others, treat as failure for now)
            console.warn("Payment not completed. Status:", responseData.status);
            return res.json({ message: "Payment not completed", status: responseData.status });
        }
    } catch (err) {
        console.error("Error in eSewa success handler:", err);
        res.status(500).send("Error processing payment success.");
    }
};

exports.esewaFailure = async (req, res) => {
    try {
        // eSewa might attach ?data even on failure with status "PENDING" or error info, or it might not.
        if (req.query.data) {
            const jsonString = Buffer.from(req.query.data, 'base64').toString('utf-8');
            const responseData = JSON.parse(jsonString);
            console.warn("eSewa failure data:", responseData);
            // If we get a transaction UUID and the status indicates failure, we can update that order:
            if (responseData.transaction_uuid) {
                await Order.findByIdAndUpdate(responseData.transaction_uuid, { orderStatus: 'Cancelled', paymentStatus: 'Failed' });
            }
        } else {
            console.warn("Payment failed or canceled by user (no data provided from eSewa).");
        }
        // Respond with a failure message or redirect to a retry page
        // return res.json({ message: "Payment failed or was cancelled. Please try again." });
        return res.redirect(`${process.env.CLIENT_URL}/payment-failure`);
    } catch (err) {
        console.error("Error in eSewa failure handler:", err);
        res.status(500).send("Error handling payment failure.");
    }
};
