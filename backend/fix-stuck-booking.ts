/**
 * One-time fix script to update stuck bookings that should be purchases.
 * Finds transactions where:
 * - status is payment_completed
 * - vehicle status is sold
 * - but remainingAmount is still > 0
 * 
 * And updates remainingAmount to "0" to move them to purchases page.
 * 
 * Run with: npx tsx fix-stuck-booking.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "./src/db/schema.js";
import "dotenv/config";

const { Pool } = pg;

async function fixStuckBookings() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error("DATABASE_URL not found in environment");
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    const db = drizzle(pool, { schema });

    console.log("Looking for stuck bookings...");

    try {
        // Find all transactions that are completed but still have remaining balance
        // Check for both "payment_completed" and "completed" statuses
        const stuckTransactions = await db.query.transactions.findMany({
            where: sql`${schema.transactions.status} IN ('payment_completed', 'completed')`,
            with: {
                vehicle: {
                    columns: {
                        id: true,
                        status: true,
                        make: true,
                        model: true,
                        year: true,
                    }
                }
            }
        });

        // Filter those with remaining balance > 0
        const stuck = stuckTransactions.filter(txn => {
            const remaining = parseFloat(txn.remainingAmount || "0");
            return remaining > 0;
        });

        console.log(`Found ${stuck.length} stuck transaction(s) out of ${stuckTransactions.length} completed`);

        for (const txn of stuck) {
            // Fix if vehicle is sold OR if it's approved (stuck due to bug)
            if (txn.vehicle?.status === "sold" || txn.vehicle?.status === "approved") {
                console.log(`Fixing transaction ${txn.id} for ${txn.vehicle.year} ${txn.vehicle.make} ${txn.vehicle.model}`);
                console.log(`  - Old remainingAmount: ${txn.remainingAmount}`);
                console.log(`  - Old vehicle status: ${txn.vehicle.status}`);

                await db
                    .update(schema.transactions)
                    .set({
                        remainingAmount: "0",
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.transactions.id, txn.id));

                // If vehicle was still approved, mark it as sold
                if (txn.vehicle.status === "approved") {
                    await db
                        .update(schema.vehicles)
                        .set({
                            status: "sold",
                            updatedAt: new Date(),
                        })
                        .where(eq(schema.vehicles.id, txn.vehicle.id));
                    console.log(`  - Marked vehicle as SOLD`);
                }

                console.log(`  - New remainingAmount: 0`);
                console.log(`  ✅ Fixed!`);
            } else {
                console.log(`Skipping transaction ${txn.id} - vehicle status is ${txn.vehicle?.status}`);
            }
        }

        console.log("\nDone! Refresh your bookings page.");
    } catch (error) {
        console.error("Error fixing stuck bookings:", error);
    } finally {
        await pool.end();
    }
}

fixStuckBookings();
