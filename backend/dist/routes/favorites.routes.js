import { Router } from "express";
import { db } from "../db/index.js";
import { favorites, vehicles } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware.js";
const router = Router();
// Get user's favorites
router.get("/", requireAuth, async (req, res) => {
    try {
        const userFavorites = await db.query.favorites.findMany({
            where: eq(favorites.userId, req.user.id),
            with: {
                vehicle: {
                    with: {
                        seller: {
                            columns: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
            },
            orderBy: [desc(favorites.createdAt)],
        });
        res.json(userFavorites.map((f) => f.vehicle));
    }
    catch (error) {
        console.error("Error fetching favorites:", error);
        res.status(500).json({ error: "Failed to fetch favorites" });
    }
});
// Add to favorites
router.post("/:vehicleId", requireAuth, async (req, res) => {
    try {
        const { vehicleId } = req.params;
        // Check if vehicle exists
        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, vehicleId),
        });
        if (!vehicle) {
            return res.status(404).json({ error: "Vehicle not found" });
        }
        // Check if already favorited
        const existing = await db.query.favorites.findFirst({
            where: and(eq(favorites.userId, req.user.id), eq(favorites.vehicleId, vehicleId)),
        });
        if (existing) {
            return res.status(400).json({ error: "Vehicle already in favorites" });
        }
        const [newFavorite] = await db
            .insert(favorites)
            .values({
            userId: req.user.id,
            vehicleId,
        })
            .returning();
        res.status(201).json(newFavorite);
    }
    catch (error) {
        console.error("Error adding to favorites:", error);
        res.status(500).json({ error: "Failed to add to favorites" });
    }
});
// Remove from favorites
router.delete("/:vehicleId", requireAuth, async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const result = await db
            .delete(favorites)
            .where(and(eq(favorites.userId, req.user.id), eq(favorites.vehicleId, vehicleId)))
            .returning();
        if (result.length === 0) {
            return res.status(404).json({ error: "Favorite not found" });
        }
        res.json({ message: "Removed from favorites" });
    }
    catch (error) {
        console.error("Error removing from favorites:", error);
        res.status(500).json({ error: "Failed to remove from favorites" });
    }
});
// Check if vehicle is favorited
router.get("/:vehicleId/check", requireAuth, async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const favorite = await db.query.favorites.findFirst({
            where: and(eq(favorites.userId, req.user.id), eq(favorites.vehicleId, vehicleId)),
        });
        res.json({ isFavorited: !!favorite });
    }
    catch (error) {
        console.error("Error checking favorite:", error);
        res.status(500).json({ error: "Failed to check favorite" });
    }
});
export default router;
