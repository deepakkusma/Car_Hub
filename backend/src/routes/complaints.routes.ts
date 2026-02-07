import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { complaints, users } from "../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// Create a complaint (Any authenticated user)
router.post("/", requireAuth, async (req: Request, res: Response) => {
    try {
        const { subject, description, reportedUserId } = req.body;

        if (!subject || !description) {
            return res.status(400).json({ error: "Subject and description are required" });
        }

        const [newComplaint] = await db
            .insert(complaints)
            .values({
                subject,
                description,
                reporterId: req.user!.id,
                reportedUserId: reportedUserId || null,
            })
            .returning();

        res.status(201).json(newComplaint);
    } catch (error) {
        console.error("Error creating complaint:", error);
        res.status(500).json({ error: "Failed to create complaint" });
    }
});

// Get my complaints (Authenticated user)
router.get("/my-complaints", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const complaintsList = await db.query.complaints.findMany({
            where: eq(complaints.reporterId, userId),
            orderBy: [desc(complaints.createdAt)],
            with: {
                reportedUser: {
                    columns: {
                        id: true,
                        name: true,
                        role: true,
                    }
                }
            }
        });

        res.json(complaintsList);
    } catch (error) {
        console.error("Error fetching my complaints:", error);
        res.status(500).json({ error: "Failed to fetch my complaints" });
    }
});

// Get all complaints (Admin only)
router.get("/", requireRole("admin"), async (req: Request, res: Response) => {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const whereClause = status ? eq(complaints.status, status as any) : undefined;

        const [complaintsList, countResult] = await Promise.all([
            db.query.complaints.findMany({
                where: whereClause,
                with: {
                    reporter: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                    reportedUser: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: [desc(complaints.createdAt)],
                limit: limitNum,
                offset,
            }),
            db.select({ count: sql<number>`count(*)` }).from(complaints).where(whereClause),
        ]);

        res.json({
            complaints: complaintsList,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: Number(countResult[0]?.count || 0),
                totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum),
            },
        });
    } catch (error) {
        console.error("Error fetching complaints:", error);
        res.status(500).json({ error: "Failed to fetch complaints" });
    }
});

// Update complaint status (Admin only)
router.put("/:id/status", requireRole("admin"), async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { status } = req.body;

        if (!["pending", "reviewed", "resolved", "dismissed"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const [updatedComplaint] = await db
            .update(complaints)
            .set({ status, updatedAt: new Date() })
            .where(eq(complaints.id, id))
            .returning();

        if (!updatedComplaint) {
            return res.status(404).json({ error: "Complaint not found" });
        }

        res.json(updatedComplaint);
    } catch (error) {
        console.error("Error updating complaint status:", error);
        res.status(500).json({ error: "Failed to update complaint status" });
    }
});

// Get a single complaint by ID (Admin only)
router.get("/:id", requireRole("admin"), async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const complaint = await db.query.complaints.findFirst({
            where: eq(complaints.id, id),
            with: {
                reporter: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                reportedUser: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        if (!complaint) {
            return res.status(404).json({ error: "Complaint not found" });
        }

        res.json(complaint);
    } catch (error) {
        console.error("Error fetching complaint:", error);
        res.status(500).json({ error: "Failed to fetch complaint" });
    }
});

export default router;
