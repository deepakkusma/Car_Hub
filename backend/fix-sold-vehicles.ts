/**
 * Fix vehicles that should be marked as sold.
 * Run with: npx tsx fix-sold-vehicles.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, or, and } from "drizzle-orm";
import * as schema from "./src/db/schema.js";
import "dotenv/config";

const { Pool } = pg;

async function fixSoldVehicles() {
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

    console.log("Checking for completed transactions with vehicles not marked as sold...\n");

    try {
        // Find all completed or payment_completed transactions
        const transactions = await db.query.transactions.findMany({
            where: or(
                eq(schema.transactions.status, "payment_completed"),
                eq(schema.transactions.status, "completed")
            ),
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
            },
        });

        console.log(`Found ${transactions.length} completed transactions.\n`);

        let fixedCount = 0;

        for (const txn of transactions) {
            console.log("---");
            console.log(`Vehicle: ${txn.vehicle?.year} ${txn.vehicle?.make} ${txn.vehicle?.model}`);
            console.log(`Vehicle ID: ${txn.vehicleId}`);
            console.log(`Vehicle Status: ${txn.vehicle?.status}`);
            console.log(`Transaction Status: ${txn.status}`);
            console.log(`Booking Amount: ${txn.bookingAmount || "N/A"}`);
            console.log(`Remaining Amount: ${txn.remainingAmount || "N/A"}`);

            // Check if vehicle should be marked as sold but isn't
            const remainingAmount = parseFloat(txn.remainingAmount || "0");
            const shouldBeSold = remainingAmount === 0 || !txn.remainingAmount;

            if (txn.vehicle && txn.vehicle.status !== "sold" && shouldBeSold) {
                console.log(`\n⚠️ ISSUE FOUND: Vehicle should be marked as SOLD but is "${txn.vehicle.status}"`);
                console.log("Updating vehicle status to 'sold'...");

                await db
                    .update(schema.vehicles)
                    .set({ status: "sold", updatedAt: new Date() })
                    .where(eq(schema.vehicles.id, txn.vehicleId));

                console.log("✅ Vehicle updated to SOLD");
                fixedCount++;
            } else if (txn.vehicle?.status === "sold") {
                console.log("✅ Vehicle already marked as sold");
            } else {
                console.log(`ℹ️ Remaining balance: ₹${remainingAmount} - keeping as available for balance payment`);
            }
            console.log("");
        }

        console.log(`\n✅ Done! Fixed ${fixedCount} vehicle(s).`);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pool.end();
    }
}

fixSoldVehicles();
