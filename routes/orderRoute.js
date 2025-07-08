const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authMiddleware");
const { createOrGetCustomer } = require('../controllers/orderController');

router.post('/', authenticate, createOrGetCustomer);

module.exports = router;
