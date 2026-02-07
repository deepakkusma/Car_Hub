/**
 * Script to clear all inquiries from the database.
 * This will also delete all inquiry messages due to cascade delete.
 * 
 * Run with: npx tsx clear-inquiries.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./src/db/schema.js";
import "dotenv/config";

const { Pool } = pg;

async function clearInquiries() {
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

    console.log("Clearing all inquiries...\n");

    try {
        // First count how many inquiries and messages we have
        const inquiryCount = await db.select({ count: sql<number>`count(*)` }).from(schema.inquiries);
        const messageCount = await db.select({ count: sql<number>`count(*)` }).from(schema.inquiryMessages);

        console.log(`Found ${inquiryCount[0].count} inquiries`);
        console.log(`Found ${messageCount[0].count} inquiry messages`);

        // Delete all inquiries (messages will be cascade deleted)
        await db.delete(schema.inquiries);

        console.log("\n✅ All inquiries and messages have been deleted!");
        console.log("All accounts can now start fresh with no inquiries.");
    } catch (error) {
        console.error("Error clearing inquiries:", error);
    } finally {
        await pool.end();
    }
}

clearInquiries();
