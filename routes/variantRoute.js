const express = require("express");
const router = express.Router();
const { adminOnly, authenticate } = require("../middlewares/authMiddleware");
const multer = require('multer');
const upload = multer({ dest: 'tmp/' }); // using disk storage (tmp) for example
const { createVariant } = require("../controllers/variantController.js")

//Create a variant
router.post("/:id", authenticate, adminOnly, upload.any(), createVariant); //required product Id in req body


module.exports = router;