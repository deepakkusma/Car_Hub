/**
 * Script to clear all purchase/transaction history and reset vehicles to fresh state.
 * This will:
 * 1. Delete ALL transactions (payment records)
 * 2. Reset all vehicle statuses to "approved" (available for buying)
 * 
 * Run with: npx tsx reset-marketplace.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, sql } from "drizzle-orm";
import * as schema from "./src/db/schema.js";
import "dotenv/config";

const { Pool } = pg;

async function resetMarketplace() {
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

    console.log("🔄 Starting marketplace reset...\n");

    try {
        // Step 1: Count existing transactions
        const existingTransactions = await db.query.transactions.findMany();
        console.log(`📊 Found ${existingTransactions.length} transaction(s) to delete`);

        // Step 2: Delete all transactions
        if (existingTransactions.length > 0) {
            await db.delete(schema.transactions);
            console.log(`✅ Deleted all ${existingTransactions.length} transaction(s)`);
        }

        // Step 3: Find all vehicles that are "sold" status
        const soldVehicles = await db.query.vehicles.findMany({
            where: eq(schema.vehicles.status, "sold"),
        });
        console.log(`\n📦 Found ${soldVehicles.length} sold vehicle(s) to reset`);

        if (soldVehicles.length > 0) {
            console.log("\nSold vehicles being reset:");
            soldVehicles.forEach((v, index) => {
                console.log(`   ${index + 1}. ${v.year} ${v.make} ${v.model}`);
            });
        }

        // Step 4: Reset all sold vehicles to "approved"
        const resetResult = await db
            .update(schema.vehicles)
            .set({
                status: "approved",
                updatedAt: new Date(),
            })
            .where(eq(schema.vehicles.status, "sold"))
            .returning();

        if (resetResult.length > 0) {
            console.log(`\n✅ Reset ${resetResult.length} vehicle(s) to "approved" status`);
        }

        // Step 5: Count final state
        const approvedVehicles = await db.query.vehicles.findMany({
            where: eq(schema.vehicles.status, "approved"),
        });

        console.log("\n" + "=".repeat(50));
        console.log("📋 MARKETPLACE RESET COMPLETE");
        console.log("=".repeat(50));
        console.log(`✅ Transactions deleted: ${existingTransactions.length}`);
        console.log(`✅ Vehicles reset to available: ${resetResult.length}`);
        console.log(`✅ Total vehicles now available for purchase: ${approvedVehicles.length}`);
        console.log("\n🎉 Fresh start! All vehicles are ready to be purchased.");

    } catch (error) {
        console.error("❌ Error during marketplace reset:", error);
    } finally {
        await pool.end();
    }
}

resetMarketplace();
