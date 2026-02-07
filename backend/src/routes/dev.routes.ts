import { Router } from "express";

const router = Router();

// Store for development reset links (in-memory, resets when server restarts)
let lastResetLink: { email: string; url: string; token: string; createdAt: Date } | null = null;

// Function to store reset link (called from auth config)
export function storeResetLink(email: string, url: string, token: string) {
    lastResetLink = { email, url, token, createdAt: new Date() };
}

// Function to get and clear the reset link
export function getAndClearResetLink(email: string) {
    if (lastResetLink && lastResetLink.email === email) {
        const link = lastResetLink;
        // Don't clear immediately, allow multiple fetches for 5 minutes
        if (new Date().getTime() - link.createdAt.getTime() > 5 * 60 * 1000) {
            lastResetLink = null;
            return null;
        }
        return link;
    }
    return null;
}

// Development-only endpoint to get reset link
router.get("/reset-link/:email", (req, res) => {
    // Only allow in development mode
    if (process.env.NODE_ENV === "production") {
        return res.status(404).json({ error: "Not found" });
    }

    const email = decodeURIComponent(req.params.email);
    const resetLink = getAndClearResetLink(email);

    if (resetLink) {
        res.json({
            success: true,
            url: resetLink.url,
            token: resetLink.token,
            createdAt: resetLink.createdAt,
        });
    } else {
        res.json({
            success: false,
            message: "No reset link found for this email",
        });
    }
});

export default router;
