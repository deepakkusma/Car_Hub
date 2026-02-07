
import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { transactions } from "../db/schema.js";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Helper to fill missing days with 0 for the last 7 days
const fillDailyData = (data: any[]) => {
    const result = [];
    const today = new Date();
    // Last 7 days
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);

        const dayName = d.toLocaleString('default', { month: 'short', day: 'numeric' }); // e.g., "Jan 25"
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();

        // Find matching data
        const existing = data.find(item => {
            // item.date is expected to be a date object or string we can compare
            const itemDate = new Date(item.sortDate);
            return itemDate.getDate() === day && itemDate.getMonth() === month && itemDate.getFullYear() === year;
        });

        if (existing) {
            result.push({
                date: dayName,
                totalAmount: existing.totalAmount,
                count: existing.count
            });
        } else {
            result.push({
                date: dayName,
                totalAmount: 0,
                count: 0
            });
        }
    }
    return result;
};

// Seller Analytics
router.get("/seller", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const sellerTransactions = await db.query.transactions.findMany({
            where: and(
                eq(transactions.sellerId, userId),
                sql`${transactions.status} IN ('payment_completed', 'completed')`,
                gte(transactions.createdAt, sevenDaysAgo)
            ),
            orderBy: [desc(transactions.createdAt)],
        });

        // Also fetch total stats (all time)
        const allTimeTransactions = await db.query.transactions.findMany({
            where: and(
                eq(transactions.sellerId, userId),
                sql`${transactions.status} IN ('payment_completed', 'completed')`
            ),
        });

        let totalRevenue = 0;
        let totalSold = 0;

        const dailyMap = new Map<string, { sortDate: Date, totalAmount: number, count: number }>();

        // Helper to check if it's a full payment
        const isFullPayment = (tx: typeof sellerTransactions[0]) => {
            const remaining = parseFloat(tx.remainingAmount || "0");
            return remaining <= 0;
        };

        // Process all time for totals
        allTimeTransactions.forEach(tx => {
            if (!isFullPayment(tx)) return;
            totalRevenue += parseFloat(tx.amount || "0");
            totalSold += 1;
        });

        // Process recent for chart
        sellerTransactions.forEach(tx => {
            if (!isFullPayment(tx)) return;
            const amount = parseFloat(tx.amount || "0");
            const date = new Date(tx.createdAt);
            // key can be simple YYYY-MM-DD for uniqueness
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            if (!dailyMap.has(key)) {
                dailyMap.set(key, { sortDate: date, totalAmount: 0, count: 0 });
            }

            const current = dailyMap.get(key)!;
            current.totalAmount += amount;
            current.count += 1;
        });

        const aggregatedData = Array.from(dailyMap.values());
        const finalData = fillDailyData(aggregatedData);

        res.json({
            summary: {
                totalRevenue,
                totalSold
            },
            chartData: finalData
        });

    } catch (error) {
        console.error("Error fetching seller analytics:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

// Buyer Analytics
router.get("/buyer", requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const buyerTransactions = await db.query.transactions.findMany({
            where: and(
                eq(transactions.buyerId, userId),
                sql`${transactions.status} IN ('payment_completed', 'completed')`,
                gte(transactions.createdAt, sevenDaysAgo)
            ),
            orderBy: [desc(transactions.createdAt)],
        });

        // All time stats
        const allTimeTransactions = await db.query.transactions.findMany({
            where: and(
                eq(transactions.buyerId, userId),
                sql`${transactions.status} IN ('payment_completed', 'completed')`
            ),
        });

        let totalSpent = 0;
        let totalBought = 0;

        const dailyMap = new Map<string, { sortDate: Date, totalAmount: number, count: number }>();

        // Helper to check if it's a full payment
        const isFullPayment = (tx: typeof buyerTransactions[0]) => {
            const remaining = parseFloat(tx.remainingAmount || "0");
            return remaining <= 0;
        };

        // Process all time for totals
        allTimeTransactions.forEach(tx => {
            if (!isFullPayment(tx)) return;
            totalSpent += parseFloat(tx.amount || "0");
            totalBought += 1;
        });

        // Process recent for chart
        buyerTransactions.forEach(tx => {
            if (!isFullPayment(tx)) return;
            const amount = parseFloat(tx.amount || "0");
            const date = new Date(tx.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            if (!dailyMap.has(key)) {
                dailyMap.set(key, { sortDate: date, totalAmount: 0, count: 0 });
            }

            const current = dailyMap.get(key)!;
            current.totalAmount += amount;
            current.count += 1;
        });

        const aggregatedData = Array.from(dailyMap.values());
        const finalData = fillDailyData(aggregatedData);

        res.json({
            summary: {
                totalSpent,
                totalBought
            },
            chartData: finalData
        });

    } catch (error) {
        console.error("Error fetching buyer analytics:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

export default router;
