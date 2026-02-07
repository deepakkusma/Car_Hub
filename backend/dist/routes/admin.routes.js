import { Router } from "express";
import { db } from "../db/index.js";
import { vehicles, users, inquiries, transactions, inquiryMessages } from "../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { requireRole } from "../middleware/auth.middleware.js";
const router = Router();
// All admin routes require admin role
router.use(requireRole("admin"));
// Get all users
router.get("/users", async (req, res) => {
    try {
        const { page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
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
                    createdAt: true,
                },
                orderBy: [desc(users.createdAt)],
                limit: limitNum,
                offset,
            }),
            db.select({ count: sql `count(*)` }).from(users),
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
    }
    catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});
// Update user role
router.put("/users/:id/role", async (req, res) => {
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
    }
    catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: "Failed to update user role" });
    }
});
// Delete user
router.delete("/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // Prevent self-deletion
        if (id === req.user.id) {
            return res.status(400).json({ error: "Cannot delete yourself" });
        }
        const result = await db.delete(users).where(eq(users.id, id)).returning();
        if (result.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({ message: "User deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});
// Get all listings (including pending)
router.get("/listings", async (req, res) => {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const whereClause = status ? eq(vehicles.status, status) : undefined;
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
            db.select({ count: sql `count(*)` }).from(vehicles).where(whereClause),
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
    }
    catch (error) {
        console.error("Error fetching listings:", error);
        res.status(500).json({ error: "Failed to fetch listings" });
    }
});
// Approve/reject vehicle listing
router.put("/listings/:id/status", async (req, res) => {
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
    }
    catch (error) {
        console.error("Error updating listing status:", error);
        res.status(500).json({ error: "Failed to update listing status" });
    }
});
// Get platform statistics
router.get("/stats", async (req, res) => {
    try {
        const [totalUsersResult, totalVehiclesResult, pendingVehiclesResult, totalInquiriesResult, usersByRoleResult, vehiclesByStatusResult,] = await Promise.all([
            db.select({ count: sql `count(*)` }).from(users),
            db.select({ count: sql `count(*)` }).from(vehicles),
            db
                .select({ count: sql `count(*)` })
                .from(vehicles)
                .where(eq(vehicles.status, "pending")),
            db.select({ count: sql `count(*)` }).from(inquiries),
            db
                .select({
                role: users.role,
                count: sql `count(*)`,
            })
                .from(users)
                .groupBy(users.role),
            db
                .select({
                status: vehicles.status,
                count: sql `count(*)`,
            })
                .from(vehicles)
                .groupBy(vehicles.status),
        ]);
        res.json({
            totalUsers: Number(totalUsersResult[0]?.count || 0),
            totalVehicles: Number(totalVehiclesResult[0]?.count || 0),
            pendingVehicles: Number(pendingVehiclesResult[0]?.count || 0),
            totalInquiries: Number(totalInquiriesResult[0]?.count || 0),
            usersByRole: usersByRoleResult.reduce((acc, row) => ({
                ...acc,
                [row.role]: Number(row.count),
            }), {}),
            vehiclesByStatus: vehiclesByStatusResult.reduce((acc, row) => ({
                ...acc,
                [row.status]: Number(row.count),
            }), {}),
        });
    }
    catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});
// Get all payments/transactions
router.get("/payments", async (req, res) => {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const whereClause = status ? eq(transactions.status, status) : undefined;
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
            db.select({ count: sql `count(*)` }).from(transactions).where(whereClause),
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
    }
    catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ error: "Failed to fetch payments" });
    }
});
// Update payment/transaction status
router.put("/payments/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ["pending", "payment_initiated", "payment_completed", "payment_failed", "completed", "cancelled", "refunded"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        const [updatedTransaction] = await db
            .update(transactions)
            .set({ status, updatedAt: new Date() })
            .where(eq(transactions.id, id))
            .returning();
        if (!updatedTransaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        // If payment is completed, mark vehicle as sold
        if (status === "payment_completed" || status === "completed") {
            await db
                .update(vehicles)
                .set({ status: "sold", updatedAt: new Date() })
                .where(eq(vehicles.id, updatedTransaction.vehicleId));
        }
        res.json(updatedTransaction);
    }
    catch (error) {
        console.error("Error updating payment status:", error);
        res.status(500).json({ error: "Failed to update payment status" });
    }
});
// Get all inquiries for admin
router.get("/inquiries", async (req, res) => {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        const whereClause = status ? eq(inquiries.status, status) : undefined;
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
            db.select({ count: sql `count(*)` }).from(inquiries).where(whereClause),
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
    }
    catch (error) {
        console.error("Error fetching inquiries:", error);
        res.status(500).json({ error: "Failed to fetch inquiries" });
    }
});
export default router;
