import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { vehicles, listings, users, transactions } from "../db/schema.js";
import { eq, and, desc, asc, ilike, gte, lte, inArray, notExists, sql } from "drizzle-orm";
import { requireAuth, requireRole, getSession, requireNotSuspended } from "../middleware/auth.middleware.js";
import { z } from "zod";

const router = Router();

// Validation schemas
const createVehicleSchema = z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
    price: z.string().or(z.number()),
    mileage: z.number().int().optional(),
    fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "cng"]),
    transmission: z.enum(["manual", "automatic"]),
    color: z.string().optional(),
    description: z.string().optional(),
    images: z.array(z.string()).optional(),
    registrationNumber: z.string().optional(),
    engineNumber: z.string().optional(),
    chassisNumber: z.string().optional(),
    ownerCount: z.number().int().optional(),
    location: z.string().optional(),
});

// Get all vehicles with filters (public)
router.get("/", getSession, async (req: Request, res: Response) => {
    try {
        const {
            make,
            model,
            minPrice,
            maxPrice,
            minYear,
            maxYear,
            fuelType,
            transmission,
            status = "approved",
            page = "1",
            limit = "12",
            sortBy = "newest",
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        // Build conditions
        const conditions = [];

        if (status) {
            conditions.push(eq(vehicles.status, status as any));
        }

        // Exclude vehicles that have been booked/sold (have completed transactions)
        const bookedSubquery = db
            .select({ id: transactions.id })
            .from(transactions)
            .where(and(
                eq(transactions.vehicleId, vehicles.id),
                inArray(transactions.status, ["payment_completed", "completed"])
            ));

        conditions.push(notExists(bookedSubquery));
        if (make) {
            conditions.push(ilike(vehicles.make, `%${make}%`));
        }
        if (model) {
            conditions.push(ilike(vehicles.model, `%${model}%`));
        }
        if (minPrice) {
            conditions.push(gte(vehicles.price, minPrice as string));
        }
        if (maxPrice) {
            conditions.push(lte(vehicles.price, maxPrice as string));
        }
        if (minYear) {
            conditions.push(gte(vehicles.year, parseInt(minYear as string)));
        }
        if (maxYear) {
            conditions.push(lte(vehicles.year, parseInt(maxYear as string)));
        }
        if (fuelType) {
            conditions.push(eq(vehicles.fuelType, fuelType as any));
        }
        if (transmission) {
            conditions.push(eq(vehicles.transmission, transmission as any));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Determine order by based on sortBy parameter
        const getOrderBy = () => {
            switch (sortBy) {
                case "oldest":
                    return [asc(vehicles.createdAt)];
                case "price-low":
                    return [asc(vehicles.price)];
                case "price-high":
                    return [desc(vehicles.price)];
                case "year-new":
                    return [desc(vehicles.year)];
                case "year-old":
                    return [asc(vehicles.year)];
                case "newest":
                default:
                    return [desc(vehicles.createdAt)];
            }
        };

        const [vehiclesList, countResult] = await Promise.all([
            db.query.vehicles.findMany({
                where: whereClause,
                with: {
                    seller: {
                        columns: {
                            id: true,
                            name: true,
                            image: true,
                        },
                    },
                },
                orderBy: getOrderBy(),
                limit: limitNum,
                offset,
            }),
            db.select({ count: sql<number>`count(*)` }).from(vehicles).where(whereClause),
        ]);

        res.json({
            vehicles: vehiclesList,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: Number(countResult[0]?.count || 0),
                totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum),
            },
        });
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        res.status(500).json({ error: "Failed to fetch vehicles" });
    }
});

// Get single vehicle (public)
router.get("/:id", getSession, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, id as string),
            with: {
                seller: {
                    columns: {
                        id: true,
                        name: true,
                        image: true,
                        phone: true,
                        emailVerified: true,
                    },
                },
            },
        });

        if (!vehicle) {
            return res.status(404).json({ error: "Vehicle not found" });
        }

        // Increment view count
        await db
            .update(vehicles)
            .set({ views: (vehicle.views || 0) + 1 })
            .where(eq(vehicles.id, id as string));

        res.json(vehicle);
    } catch (error) {
        console.error("Error fetching vehicle:", error);
        res.status(500).json({ error: "Failed to fetch vehicle" });
    }
});

// Create vehicle (seller/admin only, must not be suspended)
router.post(
    "/",
    requireNotSuspended,
    requireRole("seller", "admin"),
    async (req: Request, res: Response) => {
        try {
            const data = createVehicleSchema.parse(req.body);

            const [newVehicle] = await db
                .insert(vehicles)
                .values({
                    ...data,
                    price: String(data.price),
                    sellerId: req.user!.id,
                    status: req.user!.role === "admin" ? "approved" : "pending",
                })
                .returning();

            // Create listing for the vehicle
            await db.insert(listings).values({
                vehicleId: newVehicle.id,
                isActive: true,
            });

            res.status(201).json(newVehicle);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: "Validation error", details: error.errors });
            }
            console.error("Error creating vehicle:", error);
            res.status(500).json({ error: "Failed to create vehicle" });
        }
    }
);

// Update vehicle (owner/admin only)
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = createVehicleSchema.partial().parse(req.body);

        // Check ownership or admin
        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, id as string),
        });

        if (!vehicle) {
            return res.status(404).json({ error: "Vehicle not found" });
        }

        if (vehicle.sellerId !== req.user!.id && req.user!.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Not authorized" });
        }

        const [updatedVehicle] = await db
            .update(vehicles)
            .set({
                ...data,
                price: data.price ? String(data.price) : undefined,
                updatedAt: new Date(),
            })
            .where(eq(vehicles.id, id as string))
            .returning();

        res.json(updatedVehicle);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error updating vehicle:", error);
        res.status(500).json({ error: "Failed to update vehicle" });
    }
});

// Delete vehicle (owner/admin only)
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, id as string),
        });

        if (!vehicle) {
            return res.status(404).json({ error: "Vehicle not found" });
        }

        if (vehicle.sellerId !== req.user!.id && req.user!.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Not authorized" });
        }

        await db.delete(vehicles).where(eq(vehicles.id, id as string));

        res.json({ message: "Vehicle deleted successfully" });
    } catch (error) {
        console.error("Error deleting vehicle:", error);
        res.status(500).json({ error: "Failed to delete vehicle" });
    }
});

// Get seller's vehicles
router.get("/seller/my-vehicles", requireRole("seller", "admin"), async (req: Request, res: Response) => {
    try {
        const sellerVehicles = await db.query.vehicles.findMany({
            where: eq(vehicles.sellerId, req.user!.id),
            orderBy: [desc(vehicles.createdAt)],
        });

        res.json(sellerVehicles);
    } catch (error) {
        console.error("Error fetching seller vehicles:", error);
        res.status(500).json({ error: "Failed to fetch vehicles" });
    }
});

export default router;
