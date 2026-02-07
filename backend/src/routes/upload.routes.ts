import { Router, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadImage, uploadImages, deleteImage } from "../lib/cloudinary.js";

const router = Router();

// Configure multer for memory storage (for Cloudinary uploads)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed."));
        }
    },
});

// Upload single image to Cloudinary
router.post(
    "/image",
    requireAuth,
    upload.single("image"),
    async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            const result = await uploadImage(req.file.buffer, {
                folder: "cars24/vehicles",
            });

            res.json({
                url: result.url,
                publicId: result.publicId,
                width: result.width,
                height: result.height,
            });
        } catch (error) {
            console.error("Error uploading image:", error);
            res.status(500).json({ error: "Failed to upload image" });
        }
    }
);

// Upload multiple images to Cloudinary
router.post(
    "/images",
    requireAuth,
    upload.array("images", 10),
    async (req: Request, res: Response) => {
        try {
            const files = req.files as Express.Multer.File[];

            if (!files || files.length === 0) {
                return res.status(400).json({ error: "No files uploaded" });
            }

            const buffers = files.map((file) => file.buffer);
            const results = await uploadImages(buffers, {
                folder: "cars24/vehicles",
            });

            const urls = results.map((r) => r.url);
            const publicIds = results.map((r) => r.publicId);

            res.json({ urls, publicIds });
        } catch (error) {
            console.error("Error uploading images:", error);
            res.status(500).json({ error: "Failed to upload images" });
        }
    }
);

// Delete an image from Cloudinary
router.delete(
    "/image",
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const { publicId } = req.body;

            if (!publicId) {
                return res.status(400).json({ error: "Public ID is required in request body" });
            }

            const success = await deleteImage(publicId);

            if (success) {
                res.json({ message: "Image deleted successfully" });
            } else {
                res.status(500).json({ error: "Failed to delete image" });
            }
        } catch (error) {
            console.error("Error deleting image:", error);
            res.status(500).json({ error: "Failed to delete image" });
        }
    }
);

export default router;

