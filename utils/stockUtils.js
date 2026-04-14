/**
 * stockUtils.js
 *
 * Shared atomic helpers for stock reservation and deduction.
 * All operations use MongoDB's $inc / conditional findOneAndUpdate so they
 * are race-condition safe even under concurrent requests.
 */

const Variant = require('../models/Variant');
const Cart    = require('../models/Cart');

/**
 * Reserve stock for every item in a cart.
 *
 * Uses an atomic findOneAndUpdate with a conditional filter:
 *   only updates the document if (inStock - reserved) >= requestedQty
 * If any item fails (insufficient available stock), rolls back all
 * reservations already made in this batch and throws an error.
 *
 * @param {Array}  items   - cart.items array  [{ variantId, quantity }]
 * @param {String} label   - product name hint for error messages (optional)
 * @returns {void}
 * @throws  Error with a user-facing message if stock is insufficient
 */
async function reserveStock(items) {
    const reserved = []; // track successful reservations for rollback

    for (const item of items) {
        const result = await Variant.findOneAndUpdate(
            {
                _id: item.variantId,
                // Atomic condition: available (inStock - reserved) >= quantity
                $expr: {
                    $gte: [
                        { $subtract: ['$inStock', { $ifNull: ['$reserved', 0] }] },
                        item.quantity
                    ]
                }
            },
            { $inc: { reserved: item.quantity } }
        );

        if (!result) {
            // Rollback all reservations made so far in this loop
            await rollbackReservations(reserved);
            throw new Error(`Insufficient stock for one or more items. Please update your cart and try again.`);
        }

        reserved.push({ variantId: item.variantId, quantity: item.quantity });
    }
}

/**
 * Release (undo) reservations — called on payment failure or order cancellation.
 * Safe to call multiple times; the $gte guard prevents reserved going below 0.
 *
 * @param {mongoose.Types.ObjectId|String} cartId
 */
async function releaseReservation(cartId) {
    const cart = await Cart.findById(cartId).lean();
    if (!cart) return;

    await rollbackReservations(cart.items);
}

/**
 * Atomically deduct inStock and release reserved for each item.
 * Called after confirmed payment. Includes a safety guard so inStock
 * never goes below 0 even if called twice (idempotency layer).
 *
 * @param {Array} items  - array of { variantId, quantity }
 */
async function deductStock(items) {
    await Promise.all(
        items.map(item =>
            Variant.findOneAndUpdate(
                {
                    _id: item.variantId,
                    inStock:  { $gte: item.quantity },
                    reserved: { $gte: item.quantity }
                },
                {
                    $inc: {
                        inStock:  -item.quantity,
                        reserved: -item.quantity,
                        updatedAt: Date.now()  // touch the timestamp
                    }
                }
            )
        )
    );
}

// ── Internal helper ──────────────────────────────────────────────────────────

async function rollbackReservations(items) {
    await Promise.all(
        items.map(item =>
            Variant.updateOne(
                { _id: item.variantId, reserved: { $gte: item.quantity } },
                { $inc: { reserved: -item.quantity } }
            )
        )
    );
}

module.exports = { reserveStock, releaseReservation, deductStock };
