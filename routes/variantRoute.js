const express = require("express");
const router = express.Router();
const { adminOnly, authenticate } = require("../middlewares/authMiddleware");
const multer = require('multer');
// memoryStorage keeps files in RAM — safe on Render where the disk is ephemeral.
// Cloudinary's upload_stream accepts a Buffer directly.
const upload = multer({ storage: multer.memoryStorage() });
const { createVariant, updateVariant, deleteVariant } = require("../controllers/variantController.js")

//Create a variant
router.post("/:id", authenticate, adminOnly, upload.any(), createVariant); //required product Id in req body

//Update a variant
router.put("/:id", authenticate, adminOnly, upload.any(), updateVariant);

//Delete a variant
router.delete("/:id", authenticate, adminOnly, deleteVariant);

module.exports = router;