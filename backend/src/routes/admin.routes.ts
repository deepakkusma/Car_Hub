import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { vehicles, users, inquiries, transactions, listings, inquiryMessages } from "../db/schema.js";
import { eq, desc, sql, count } from "drizzle-orm";
import { requireRole } from "../middleware/auth.middleware.js";

const router = Router();

// All admin routes require admin role
router.use(requireRole("admin"));

// Get all users
router.get("/users", async (req: Request, res: Response) => {
    try {
        const { page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const [usersList, countResult] = await Promise.all([
            db.query.users.findMany({
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    image: true,
                    emailVerified: true,
                    suspended: true,
                    createdAt: true,
                },
                orderBy: [desc(users.createdAt)],
                limit: limitNum,
                offset,
            }),
            db.select({ count: sql<number>`count(*)` }).from(users),
        ]);

        res.json({
            users: usersList,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: Number(countResult[0]?.count || 0),
                totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum),
            },
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Update user role
router.put("/users/:id/role", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!["admin", "buyer", "seller"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const [updatedUser] = await db
            .update(users)
            .set({ role, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: "Failed to update user role" });
    }
});

// Update user verification status
router.put("/users/:id/verify", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { verified } = req.body;

        if (typeof verified !== "boolean") {
            return res.status(400).json({ error: "Invalid verification status" });
        }

        const [updatedUser] = await db
            .update(users)
            .set({ emailVerified: verified, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user verification:", error);
        res.status(500).json({ error: "Failed to update user verification" });
    }
});

// Suspend/unsuspend user
router.put("/users/:id/suspend", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { suspended } = req.body;

        if (typeof suspended !== "boolean") {
            return res.status(400).json({ error: "Invalid suspension status" });
        }

        // Prevent self-suspension
        if (id === req.user!.id) {
            return res.status(400).json({ error: "Cannot suspend yourself" });
        }

        const [updatedUser] = await db
            .update(users)
            .set({ suspended, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user suspension:", error);
        res.status(500).json({ error: "Failed to update user suspension" });
    }
});

// Delete user
router.delete("/users/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.user!.id) {
            return res.status(400).json({ error: "Cannot delete yourself" });
        }

        const result = await db.delete(users).where(eq(users.id, id)).returning();

        if (result.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

// Get all listings (including pending)
router.get("/listings", async (req: Request, res: Response) => {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const whereClause = status ? eq(vehicles.status, status as any) : undefined;

        const [vehiclesList, countResult] = await Promise.all([
            db.query.vehicles.findMany({
                where: whereClause,
                with: {
                    seller: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: [desc(vehicles.createdAt)],
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
        console.error("Error fetching listings:", error);
        res.status(500).json({ error: "Failed to fetch listings" });
    }
});

// Approve/reject vehicle listing
router.put("/listings/:id/status", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["approved", "rejected", "pending"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const [updatedVehicle] = await db
            .update(vehicles)
            .set({ status, updatedAt: new Date() })
            .where(eq(vehicles.id, id))
            .returning();

        if (!updatedVehicle) {
            return res.status(404).json({ error: "Vehicle not found" });
        }

        res.json(updatedVehicle);
    } catch (error) {
        console.error("Error updating listing status:", error);
        res.status(500).json({ error: "Failed to update listing status" });
    }
});

// Get platform statistics
router.get("/stats", async (req: Request, res: Response) => {
    try {
        const [
            totalUsersResult,
            totalVehiclesResult,
            pendingVehiclesResult,
            totalInquiriesResult,
            usersByRoleResult,
            vehiclesByStatusResult,
        ] = await Promise.all([
            db.select({ count: sql<number>`count(*)` }).from(users),
            db.select({ count: sql<number>`count(*)` }).from(vehicles),
            db
                .select({ count: sql<number>`count(*)` })
                .from(vehicles)
                .where(eq(vehicles.status, "pending")),
            db.select({ count: sql<number>`count(*)` }).from(inquiries),
            db
                .select({
                    role: users.role,
                    count: sql<number>`count(*)`,
                })
                .from(users)
                .groupBy(users.role),
            db
                .select({
                    status: vehicles.status,
                    count: sql<number>`count(*)`,
                })
                .from(vehicles)
                .groupBy(vehicles.status),
        ]);

        res.json({
            totalUsers: Number(totalUsersResult[0]?.count || 0),
            totalVehicles: Number(totalVehiclesResult[0]?.count || 0),
            pendingVehicles: Number(pendingVehiclesResult[0]?.count || 0),
            totalInquiries: Number(totalInquiriesResult[0]?.count || 0),
            usersByRole: usersByRoleResult.reduce(
                (acc, row) => ({
                    ...acc,
                    [row.role]: Number(row.count),
                }),
                {}
            ),
            vehiclesByStatus: vehiclesByStatusResult.reduce(
                (acc, row) => ({
                    ...acc,
                    [row.status]: Number(row.count),
                }),
                {}
            ),
        });
    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});

// Get all payments/transactions
router.get("/payments", async (req: Request, res: Response) => {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const whereClause = status ? eq(transactions.status, status as any) : undefined;

        const [transactionsList, countResult] = await Promise.all([
            db.query.transactions.findMany({
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
                            color: true,
                            registrationNumber: true,
                        },
                    },
                    buyer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },
                    seller: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },
                },
                orderBy: [desc(transactions.createdAt)],
                limit: limitNum,
                offset,
            }),
            db.select({ count: sql<number>`count(*)` }).from(transactions).where(whereClause),
        ]);

        res.json({
            transactions: transactionsList,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: Number(countResult[0]?.count || 0),
                totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum),
            },
        });
    } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ error: "Failed to fetch payments" });
    }
});

// Update payment/transaction status
router.put("/payments/:id/status", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["pending", "payment_initiated", "payment_completed", "payment_failed", "completed", "cancelled", "refunded"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        // First, get the transaction to check if it's a booking or full payment
        const existingTransaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, id),
        });

        if (!existingTransaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        // Determine if this is a booking payment or full payment
        const bookingAmount = parseFloat(existingTransaction.bookingAmount || "0");
        const remainingAmount = parseFloat(existingTransaction.remainingAmount || "0");

        // It's an initial booking payment if:
        // - There's a booking amount > 0 (token was paid)
        // - There's a remaining amount > 0 (balance still due)
        // - The booking amount is NOT "0" (which would indicate this is a balance payment)
        const isInitialBookingPayment = bookingAmount > 0 && remainingAmount > 0;

        // It's a balance payment if bookingAmount is "0" (explicitly set when paying balance via cash)
        const isBalancePayment = existingTransaction.bookingAmount === "0" || existingTransaction.bookingAmount === "0.00";

        // Determine final remaining amount
        let newRemainingAmount = existingTransaction.remainingAmount;

        // Handle vehicle status based on payment type
        if (status === "payment_completed" || status === "completed") {
            if (isInitialBookingPayment && !isBalancePayment) {
                // Initial booking payment verified - keep vehicle as approved (still available for balance payment)
                // The vehicle stays as 'approved' so buyer can pay remaining balance
                // DO NOT change remainingAmount - buyer still owes the balance
                console.log(`Booking verified for vehicle ${existingTransaction.vehicleId}. Remaining: ₹${remainingAmount}`);
            } else {
                // Either:
                // 1. Full direct payment (no booking amount, no remaining) 
                // 2. Balance payment (bookingAmount is "0")
                // In both cases, mark vehicle as SOLD and set remainingAmount to 0
                newRemainingAmount = "0";

                await db
                    .update(vehicles)
                    .set({ status: "sold", updatedAt: new Date() })
                    .where(eq(vehicles.id, existingTransaction.vehicleId));

                console.log(`Full/balance payment verified for vehicle ${existingTransaction.vehicleId}. Vehicle marked as SOLD.`);
            }
        }

        // Calculate estimated ready date (7 days from now) for full payments
        const isFullPaymentVerified = (status === "payment_completed" || status === "completed") &&
            !(isInitialBookingPayment && !isBalancePayment);

        const estimatedReadyDate = isFullPaymentVerified
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
            : existingTransaction.estimatedReadyDate;

        const deliveryStatus = isFullPaymentVerified
            ? "processing" as const
            : existingTransaction.deliveryStatus;

        // Update the transaction with new status and potentially updated remainingAmount
        const [updatedTransaction] = await db
            .update(transactions)
            .set({
                status,
                remainingAmount: newRemainingAmount,
                estimatedReadyDate,
                deliveryStatus,
                updatedAt: new Date()
            })
            .where(eq(transactions.id, id))
            .returning();

        res.json(updatedTransaction);
    } catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).json({ error: "Failed to update payment status" });
    }
});

// Get all inquiries for admin
router.get("/inquiries", async (req: Request, res: Response) => {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const whereClause = status ? eq(inquiries.status, status as any) : undefined;

        const [inquiriesList, countResult] = await Promise.all([
            db.query.inquiries.findMany({
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
                                },
                            },
                        },
                        orderBy: [desc(inquiryMessages.createdAt)],
                    },
                },
                orderBy: [desc(inquiries.updatedAt)],
                limit: limitNum,
                offset,
            }),
            db.select({ count: sql<number>`count(*)` }).from(inquiries).where(whereClause),
        ]);

        res.json({
            inquiries: inquiriesList,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: Number(countResult[0]?.count || 0),
                totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum),
            },
        });
    } catch (error) {
        console.error("Error fetching inquiries:", error);
        res.status(500).json({ error: "Failed to fetch inquiries" });
    }
});

export default router;
