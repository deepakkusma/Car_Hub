/**
 * Script to move all vehicles listed by admin to seller@gmail.com account.
 * 
 * Run with: npx tsx move-vehicles-to-seller.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import * as schema from "./src/db/schema.js";
import "dotenv/config";

const { Pool } = pg;

const ADMIN_EMAIL = "admin@cars24.com";
const SELLER_EMAIL = "seller@gmail.com";

async function moveVehiclesToSeller() {
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

    console.log("Starting vehicle transfer...\n");

    try {
        // Find admin user
        const adminUser = await db.query.users.findFirst({
            where: eq(schema.users.email, ADMIN_EMAIL),
        });

        if (!adminUser) {
            console.error(`❌ Admin user not found with email: ${ADMIN_EMAIL}`);
            await pool.end();
            process.exit(1);
        }
        console.log(`✅ Found admin: ${adminUser.name} (${adminUser.email})`);
        console.log(`   Admin ID: ${adminUser.id}`);

        // Find seller user
        const sellerUser = await db.query.users.findFirst({
            where: eq(schema.users.email, SELLER_EMAIL),
        });

        if (!sellerUser) {
            console.error(`❌ Seller user not found with email: ${SELLER_EMAIL}`);
            console.log("\nPlease make sure the seller account exists before running this script.");
            await pool.end();
            process.exit(1);
        }
        console.log(`✅ Found seller: ${sellerUser.name} (${sellerUser.email})`);
        console.log(`   Seller ID: ${sellerUser.id}`);

        // Find all vehicles listed by admin
        const adminVehicles = await db.query.vehicles.findMany({
            where: eq(schema.vehicles.sellerId, adminUser.id),
        });

        if (adminVehicles.length === 0) {
            console.log("\n⚠️  No vehicles found listed by admin.");
            await pool.end();
            process.exit(0);
        }

        console.log(`\n📦 Found ${adminVehicles.length} vehicle(s) listed by admin:`);
        adminVehicles.forEach((v, index) => {
            console.log(`   ${index + 1}. ${v.year} ${v.make} ${v.model} (Status: ${v.status})`);
        });

        // Update vehicles to seller
        const result = await db
            .update(schema.vehicles)
            .set({
                sellerId: sellerUser.id,
                updatedAt: new Date(),
            })
            .where(eq(schema.vehicles.sellerId, adminUser.id))
            .returning();

        console.log(`\n✅ Successfully transferred ${result.length} vehicle(s) to ${SELLER_EMAIL}`);

        console.log("\n📋 Updated vehicles:");
        result.forEach((v, index) => {
            console.log(`   ${index + 1}. ${v.year} ${v.make} ${v.model} - Now owned by seller`);
        });

        console.log("\n🎉 Vehicle transfer completed successfully!");
    } catch (error) {
        console.error("❌ Error during vehicle transfer:", error);
    } finally {
        await pool.end();
    }
}

moveVehiclesToSeller();
