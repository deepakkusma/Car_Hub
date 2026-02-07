import { db } from "./src/db/index.js";
import { vehicles, listings, users, transactions } from "./src/db/schema.js";
import { eq, and, desc, asc, ilike, gte, lte, inArray, notExists, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function verify() {
    console.log("Starting verification...");

    try {
        // 1. Get an existing user ID (safe select)
        console.log("Finding existing user ID...");
        const existingUsers = await db.select({ id: users.id }).from(users).limit(1);

        let sellerId;
        if (existingUsers.length > 0) {
            sellerId = existingUsers[0].id;
        } else {
            console.log("No users found. Creating one...");
            // fallback
            sellerId = uuidv4();
            await db.insert(users).values({
                id: sellerId,
                name: "Fallback User",
                email: `fallback-${sellerId}@example.com`,
                role: "seller",
                emailVerified: true
            });
        }
        console.log("Using user ID:", sellerId);

        // 2. Create a test vehicle
        const vehicleId = uuidv4();
        console.log("Creating vehicle...");
        const [vehicle] = await db.insert(vehicles).values({
            id: vehicleId,
            sellerId: sellerId,
            make: "TestMakeFilter",
            model: "TestModel",
            year: 2024,
            price: "100000",
            fuelType: "petrol",
            transmission: "manual",
            status: "approved"
        }).returning();
        console.log("Created vehicle:", vehicle.id);

        // 3. Helper to run the query
        const runQuery = async () => {
            const conditions = [
                eq(vehicles.status, "approved")
            ];

            const bookedSubquery = db
                .select({ id: transactions.id })
                .from(transactions)
                .where(and(
                    eq(transactions.vehicleId, vehicles.id),
                    inArray(transactions.status, ["payment_completed", "completed"])
                ));

            conditions.push(notExists(bookedSubquery));
            conditions.push(eq(vehicles.make, "TestMakeFilter"));

            const results = await db.query.vehicles.findMany({
                where: and(...conditions),
            });
            return results;
        };

        // 4. Initial check
        let results = await runQuery();
        console.log("Initial visibility (should be 1):", results.length);

        // 5. Create transaction
        console.log("Creating transaction...");
        await db.insert(transactions).values({
            vehicleId: vehicle.id,
            buyerId: sellerId,
            sellerId: sellerId,
            amount: "50000",
            status: "payment_completed"
        });

        // 6. Final check
        results = await runQuery();
        console.log("Visibility after booking (should be 0):", results.length);

        if (results.length === 0) {
            console.log("SUCCESS: Vehicle filtered out.");
        } else {
            console.error("FAILED: Vehicle NOT filtered out.");
        }

        // Cleanup
        await db.delete(transactions).where(eq(transactions.vehicleId, vehicle.id));
        await db.delete(vehicles).where(eq(vehicles.id, vehicle.id));
        // Only delete user if we created it? Na, keep it simple, don't delete user.
        console.log("Cleanup done.");

    } catch (e: any) {
        console.error("Error:", e.message);
    }
    process.exit(0);
}

verify();
