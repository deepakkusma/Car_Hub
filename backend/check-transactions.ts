/**
 * Debug script to check the current state of transactions.
 * Run with: npx tsx check-transactions.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { desc } from "drizzle-orm";
import * as schema from "./src/db/schema.js";
import "dotenv/config";

const { Pool } = pg;

async function checkTransactions() {
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

    console.log("Fetching recent transactions...\n");

    try {
        const transactions = await db.query.transactions.findMany({
            orderBy: [desc(schema.transactions.createdAt)],
            limit: 20,
            with: {
                vehicle: {
                    columns: {
                        id: true,
                        status: true,
                        make: true,
                        model: true,
                        year: true,
                    }
                },
                buyer: {
                    columns: {
                        name: true,
                        email: true,
                    }
                }
            }
        });

        const fs = await import('fs');
        const output: string[] = [];
        output.push(`Found ${transactions.length} transaction(s):\n`);

        for (const txn of transactions) {
            output.push(JSON.stringify({
                id: txn.id,
                buyer: `${txn.buyer?.name} (${txn.buyer?.email})`,
                vehicle: `${txn.vehicle?.year} ${txn.vehicle?.make} ${txn.vehicle?.model}`,
                vehicleStatus: txn.vehicle?.status,
                txnStatus: txn.status,
                paymentType: txn.paymentType,
                amount: txn.amount,
                bookingAmount: txn.bookingAmount,
                remainingAmount: txn.remainingAmount,
            }, null, 2));
            output.push("---");
        }

        fs.writeFileSync('transactions-output.txt', output.join('\n'));
        console.log('Output written to transactions-output.txt');
    } catch (error) {
        console.error("Error checking transactions:", error);
    } finally {
        await pool.end();
    }
}

checkTransactions();
