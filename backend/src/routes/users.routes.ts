import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Get current user profile
router.get("/me", requireAuth, async (req: Request, res: Response) => {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, req.user!.id),
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                image: true,
                emailVerified: true,
                createdAt: true,
                city: true,
                state: true,
                pincode: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// Update user profile
router.put("/me", requireAuth, async (req: Request, res: Response) => {
    try {
        const { name, phone, image } = req.body;

        const [updatedUser] = await db
            .update(users)
            .set({
                ...(name && { name }),
                ...(phone && { phone }),
                ...(image && { image }),
                ...(req.body.city !== undefined && { city: req.body.city }),
                ...(req.body.state !== undefined && { state: req.body.state }),
                ...(req.body.pincode !== undefined && { pincode: req.body.pincode }),
                updatedAt: new Date(),
            })
            .where(eq(users.id, req.user!.id))
            .returning();

        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
    }
});

// Get user by ID (public profile)
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const user = await db.query.users.findFirst({
            where: eq(users.id, id),
            columns: {
                id: true,
                name: true,
                image: true,
                createdAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

export default router;
