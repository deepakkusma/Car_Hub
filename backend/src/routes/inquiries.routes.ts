import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { inquiries, vehicles, users, inquiryMessages } from "../db/schema.js";
import { eq, and, desc, or, asc } from "drizzle-orm";
import { requireAuth, requireRole, requireNotSuspended } from "../middleware/auth.middleware.js";
import { z } from "zod";

const router = Router();

// Create inquiry (buyer)
const createInquirySchema = z.object({
    vehicleId: z.string().uuid(),
    message: z.string().min(10),
});

router.post("/", requireNotSuspended, async (req: Request, res: Response) => {
    try {
        const data = createInquirySchema.parse(req.body);

        // Get vehicle to find seller
        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, data.vehicleId),
        });

        if (!vehicle) {
            return res.status(404).json({ error: "Vehicle not found" });
        }

        // Can't inquire about your own vehicle
        if (vehicle.sellerId === req.user!.id) {
            return res.status(400).json({ error: "Cannot inquire about your own vehicle" });
        }

        // Create the inquiry
        const [newInquiry] = await db
            .insert(inquiries)
            .values({
                vehicleId: data.vehicleId,
                buyerId: req.user!.id,
                sellerId: vehicle.sellerId,
                message: data.message,
            })
            .returning();

        // Also add the initial message to the conversation
        await db.insert(inquiryMessages).values({
            inquiryId: newInquiry.id,
            senderId: req.user!.id,
            message: data.message,
        });

        res.status(201).json(newInquiry);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating inquiry:", error);
        res.status(500).json({ error: "Failed to create inquiry" });
    }
});

// Get user's inquiries (sent as buyer or received as seller)
router.get("/", requireAuth, async (req: Request, res: Response) => {
    try {
        const { type = "all" } = req.query;

        let whereClause;
        if (type === "sent") {
            whereClause = eq(inquiries.buyerId, req.user!.id);
        } else if (type === "received") {
            whereClause = eq(inquiries.sellerId, req.user!.id);
        } else {
            whereClause = or(
                eq(inquiries.buyerId, req.user!.id),
                eq(inquiries.sellerId, req.user!.id)
            );
        }

        const userInquiries = await db.query.inquiries.findMany({
            where: whereClause,
            with: {
                vehicle: {
                    columns: {
                        id: true,
                        make: true,
                        model: true,
                        year: true,
                        price: true,
                        images: true,
                    },
                },
                buyer: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                seller: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                messages: {
                    with: {
                        sender: {
                            columns: {
                                id: true,
                                name: true,
                                role: true,
                            },
                        },
                    },
                    // Oldest -> newest so the UI can render and auto-scroll correctly
                    orderBy: [asc(inquiryMessages.createdAt)],
                },
            },
            orderBy: [desc(inquiries.updatedAt)],
        });

        res.json(userInquiries);
    } catch (error) {
        console.error("Error fetching inquiries:", error);
        res.status(500).json({ error: "Failed to fetch inquiries" });
    }
});

// Get single inquiry by ID
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
    try {
        const id = String((req.params as any).id);

        const inquiry = await db.query.inquiries.findFirst({
            where: eq(inquiries.id, id),
            with: {
                vehicle: {
                    columns: {
                        id: true,
                        make: true,
                        model: true,
                        year: true,
                        price: true,
                        images: true,
                    },
                },
                buyer: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                seller: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                messages: {
                    with: {
                        sender: {
                            columns: {
                                id: true,
                                name: true,
                                role: true,
                            },
                        },
                    },
                    // Oldest -> newest so the UI can render and auto-scroll correctly
                    orderBy: [asc(inquiryMessages.createdAt)],
                },
            },
        });

        if (!inquiry) {
            return res.status(404).json({ error: "Inquiry not found" });
        }

        // Check if user is part of this inquiry or is admin
        const user = req.user as any;
        if (inquiry.buyerId !== user.id && inquiry.sellerId !== user.id && user.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Not authorized" });
        }

        res.json(inquiry);
    } catch (error) {
        console.error("Error fetching inquiry:", error);
        res.status(500).json({ error: "Failed to fetch inquiry" });
    }
});

// Send a message in an inquiry (buyer or seller)
router.post("/:id/messages", requireNotSuspended, async (req: Request, res: Response) => {
    try {
        const id = String((req.params as any).id);
        const { message } = req.body;

        if (!message || message.length < 2) {
            return res.status(400).json({ error: "Message must be at least 2 characters" });
        }

        const inquiry = await db.query.inquiries.findFirst({
            where: eq(inquiries.id, id),
        });

        if (!inquiry) {
            return res.status(404).json({ error: "Inquiry not found" });
        }

        // Check if user is part of this inquiry or is admin
        const user = req.user as any;
        if (inquiry.buyerId !== user.id && inquiry.sellerId !== user.id && user.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: Not authorized" });
        }

        // Add the message
        const [newMessage] = await db
            .insert(inquiryMessages)
            .values({
                inquiryId: id,
                senderId: user.id,
                message,
            })
            .returning();

        // Update inquiry status if seller responds
        if (inquiry.sellerId === user.id && inquiry.status === "pending") {
            await db
                .update(inquiries)
                .set({
                    status: "responded",
                    sellerResponse: message,
                    updatedAt: new Date(),
                })
                .where(eq(inquiries.id, id));
        } else {
            // Just update the timestamp
            await db
                .update(inquiries)
                .set({ updatedAt: new Date() })
                .where(eq(inquiries.id, id));
        }

        // Get the message with sender info
        const messageWithSender = await db.query.inquiryMessages.findFirst({
            where: eq(inquiryMessages.id, newMessage.id),
            with: {
                sender: {
                    columns: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
        });

        res.status(201).json(messageWithSender);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ error: "Failed to send message" });
    }
});

// Respond to inquiry (seller only) - kept for backward compatibility
router.put("/:id/respond", requireAuth, async (req: Request, res: Response) => {
    try {
        const id = String((req.params as any).id);
        const { response } = req.body;

        if (!response || response.length < 5) {
            return res.status(400).json({ error: "Response must be at least 5 characters" });
        }

        const inquiry = await db.query.inquiries.findFirst({
            where: eq(inquiries.id, id),
        });

        if (!inquiry) {
            return res.status(404).json({ error: "Inquiry not found" });
        }

        if (inquiry.sellerId !== req.user!.id) {
            return res.status(403).json({ error: "Forbidden: Not authorized" });
        }

        // Add the response as a message
        await db.insert(inquiryMessages).values({
            inquiryId: id,
            senderId: req.user!.id,
            message: response,
        });

        const [updatedInquiry] = await db
            .update(inquiries)
            .set({
                sellerResponse: response,
                status: "responded",
                updatedAt: new Date(),
            })
            .where(eq(inquiries.id, id))
            .returning();

        res.json(updatedInquiry);
    } catch (error) {
        console.error("Error responding to inquiry:", error);
        res.status(500).json({ error: "Failed to respond to inquiry" });
    }
});

// Close inquiry
router.put("/:id/close", requireAuth, async (req: Request, res: Response) => {
    try {
        const id = String((req.params as any).id);

        const inquiry = await db.query.inquiries.findFirst({
            where: eq(inquiries.id, id),
        });

        if (!inquiry) {
            return res.status(404).json({ error: "Inquiry not found" });
        }

        if (inquiry.buyerId !== req.user!.id && inquiry.sellerId !== req.user!.id) {
            return res.status(403).json({ error: "Forbidden: Not authorized" });
        }

        const [updatedInquiry] = await db
            .update(inquiries)
            .set({
                status: "closed",
                updatedAt: new Date(),
            })
            .where(eq(inquiries.id, id))
            .returning();

        res.json(updatedInquiry);
    } catch (error) {
        console.error("Error closing inquiry:", error);
        res.status(500).json({ error: "Failed to close inquiry" });
    }
});

export default router;
