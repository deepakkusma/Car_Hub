import { db } from "../db/index.js";
import { users, vehicles, listings } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { auth } from "./auth.js";
// Sample vehicle data with real images from Unsplash
const SAMPLE_VEHICLES = [
    {
        make: "Maruti Suzuki",
        model: "Swift",
        year: 2022,
        price: "650000",
        mileage: 25000,
        fuelType: "petrol",
        transmission: "manual",
        color: "Pearl White",
        description: "Well maintained Maruti Swift in excellent condition. Single owner, regularly serviced at authorized service center. All original documents available. New tyres fitted recently. AC cooling is perfect. No accident history.",
        images: [
            "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
            "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80"
        ],
        registrationNumber: "MH02AB1234",
        ownerCount: 1,
        location: "Mumbai, Maharashtra",
    },
    {
        make: "Hyundai",
        model: "i20",
        year: 2021,
        price: "780000",
        mileage: 35000,
        fuelType: "petrol",
        transmission: "automatic",
        color: "Titan Grey",
        description: "Premium Hyundai i20 Asta variant with sunroof. Automatic transmission makes city driving a breeze. Features include wireless charging, connected car tech, and 7 airbags. Mint condition inside out.",
        images: [
            "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800&q=80",
            "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80"
        ],
        registrationNumber: "KA01CD5678",
        ownerCount: 1,
        location: "Bangalore, Karnataka",
    },
    {
        make: "Tata",
        model: "Nexon",
        year: 2023,
        price: "1150000",
        mileage: 15000,
        fuelType: "diesel",
        transmission: "manual",
        color: "Flame Red",
        description: "Tata Nexon XZ+ variant with all safety features. 5-star NCAP rated safest car in its segment. Touchscreen infotainment, climate control, and projector headlamps. Extended warranty available.",
        images: [
            "https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80",
            "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80"
        ],
        registrationNumber: "DL04EF9012",
        ownerCount: 1,
        location: "New Delhi",
    },
    {
        make: "Honda",
        model: "City",
        year: 2020,
        price: "950000",
        mileage: 45000,
        fuelType: "petrol",
        transmission: "automatic",
        color: "Platinum White Pearl",
        description: "Honda City ZX CVT - The most trusted sedan in India. Smooth CVT transmission with paddle shifters. Lane watch camera, 8 speaker sound system, and LED headlamps. All service records available.",
        images: [
            "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80",
            "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80"
        ],
        registrationNumber: "TN07GH3456",
        ownerCount: 2,
        location: "Chennai, Tamil Nadu",
    },
    {
        make: "Mahindra",
        model: "XUV700",
        year: 2022,
        price: "1850000",
        mileage: 20000,
        fuelType: "diesel",
        transmission: "automatic",
        color: "Midnight Black",
        description: "Mahindra XUV700 AX7 Luxury - Flagship variant with ADAS technology. Features include panoramic sunroof, 360-degree camera, ventilated seats, and AdrenoX connected car tech. Best-in-class features.",
        images: [
            "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80",
            "https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=800&q=80"
        ],
        registrationNumber: "MH14IJ7890",
        ownerCount: 1,
        location: "Pune, Maharashtra",
    },
    {
        make: "Kia",
        model: "Seltos",
        year: 2021,
        price: "1350000",
        mileage: 30000,
        fuelType: "diesel",
        transmission: "automatic",
        color: "Glacier White Pearl",
        description: "Kia Seltos HTX+ with turbo diesel engine. Automatic transmission, Bose sound system, UVO connected car features, and ventilated front seats. Premium build quality. Extended warranty transferable.",
        images: [
            "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
            "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80"
        ],
        registrationNumber: "GJ05KL1234",
        ownerCount: 1,
        location: "Ahmedabad, Gujarat",
    },
    {
        make: "Toyota",
        model: "Fortuner",
        year: 2021,
        price: "3500000",
        mileage: 40000,
        fuelType: "diesel",
        transmission: "automatic",
        color: "Super White",
        description: "Toyota Fortuner 4x4 Legender variant - The ultimate SUV. Powerful 2.8L diesel engine with 6-speed automatic transmission. Premium interiors with quilted leather seats. Perfect for both city and off-road.",
        images: [
            "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80",
            "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?w=800&q=80"
        ],
        registrationNumber: "KA05MN5678",
        ownerCount: 1,
        location: "Bangalore, Karnataka",
    },
    {
        make: "MG",
        model: "Hector",
        year: 2022,
        price: "1650000",
        mileage: 18000,
        fuelType: "petrol",
        transmission: "automatic",
        color: "Glaze Red",
        description: "MG Hector Sharp Pro - Internet car with 14-inch portrait touchscreen. iSmart connected features including voice commands. Panoramic sunroof, 360-degree camera, and powered tailgate.",
        images: [
            "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",
            "https://images.unsplash.com/photo-1547245324-d777c6f05e80?w=800&q=80"
        ],
        registrationNumber: "UP16OP9012",
        ownerCount: 1,
        location: "Noida, Uttar Pradesh",
    },
    {
        make: "Maruti Suzuki",
        model: "Baleno",
        year: 2023,
        price: "850000",
        mileage: 8000,
        fuelType: "petrol",
        transmission: "manual",
        color: "Nexa Blue",
        description: "Brand new shape Maruti Baleno Alpha variant. 9-inch SmartPlay Pro+ infotainment, heads-up display, 360-degree camera, and 6 airbags. Under company warranty. Like brand new condition.",
        images: [
            "https://images.unsplash.com/photo-1550355291-bbee04a92027?w=800&q=80",
            "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80"
        ],
        registrationNumber: "RJ14QR3456",
        ownerCount: 1,
        location: "Jaipur, Rajasthan",
    },
    {
        make: "Hyundai",
        model: "Creta",
        year: 2022,
        price: "1450000",
        mileage: 22000,
        fuelType: "petrol",
        transmission: "automatic",
        color: "Phantom Black",
        description: "Hyundai Creta SX(O) - Top variant with all bells and whistles. Turbo petrol engine with DCT gearbox. Panoramic sunroof, Bose sound system, ventilated seats, and BlueLink connected features.",
        images: [
            "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800&q=80",
            "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80"
        ],
        registrationNumber: "HR26ST7890",
        ownerCount: 1,
        location: "Gurugram, Haryana",
    },
    {
        make: "Tata",
        model: "Punch",
        year: 2023,
        price: "750000",
        mileage: 5000,
        fuelType: "petrol",
        transmission: "manual",
        color: "Tropical Mist",
        description: "Tata Punch Creative variant - Micro SUV with SUV-like stance. 5-star safety rating, 7-inch touchscreen, automatic climate control, and cruise control. Almost new with remaining company warranty.",
        images: [
            "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&q=80",
            "https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=800&q=80"
        ],
        registrationNumber: "MP09UV1234",
        ownerCount: 1,
        location: "Indore, Madhya Pradesh",
    },
    {
        make: "Volkswagen",
        model: "Taigun",
        year: 2022,
        price: "1550000",
        mileage: 25000,
        fuelType: "petrol",
        transmission: "automatic",
        color: "Wild Cherry Red",
        description: "Volkswagen Taigun GT Line - German engineering at its best. 1.5L TSI turbo engine with DSG transmission. Premium interiors, ventilated seats, digital cockpit, and wireless Android Auto/Apple CarPlay.",
        images: [
            "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
            "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=800&q=80"
        ],
        registrationNumber: "GA01WX5678",
        ownerCount: 1,
        location: "Panaji, Goa",
    },
];
/**
 * Seed default admin user if it doesn't exist
 */
export async function seedAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Admin";
    if (!adminEmail || !adminPassword) {
        console.log("⏭️  No admin credentials in env, skipping admin seed");
        return;
    }
    try {
        // Check if admin already exists
        const existingAdmin = await db
            .select()
            .from(users)
            .where(eq(users.email, adminEmail))
            .limit(1);
        if (existingAdmin.length > 0) {
            // Ensure existing user has admin role
            if (existingAdmin[0].role !== "admin") {
                await db
                    .update(users)
                    .set({ role: "admin" })
                    .where(eq(users.email, adminEmail));
                console.log("✅ Updated existing user to admin role");
            }
            else {
                console.log("✅ Admin user already exists");
            }
            return;
        }
        // Create admin user using better-auth's server-side API
        const result = await auth.api.signUpEmail({
            body: {
                name: adminName,
                email: adminEmail,
                password: adminPassword,
            },
        });
        if (!result.user) {
            throw new Error("Sign up failed: No user returned");
        }
        // Update the user role to admin
        await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.email, adminEmail));
        console.log(`✅ Default admin created: ${adminEmail}`);
    }
    catch (error) {
        console.error("❌ Failed to seed admin:", error);
    }
}
/**
 * Seed sample vehicles with real images
 * @param force - If true, delete existing vehicles and reseed
 */
export async function seedVehicles(force = false) {
    try {
        // Check if vehicles already exist
        const existingVehicles = await db.select({ count: sql `count(*)` }).from(vehicles);
        const count = Number(existingVehicles[0]?.count || 0);
        if (count > 0 && !force) {
            console.log(`✅ Vehicles already seeded (${count} vehicles exist)`);
            return;
        }
        if (count > 0 && force) {
            console.log(`🗑️  Clearing ${count} existing vehicles...`);
            await db.delete(vehicles);
            console.log("✅ Existing vehicles cleared");
        }
        // Use admin user as the seller for seeded vehicles
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail) {
            console.log("⏭️  No admin email in env, skipping vehicle seed");
            return;
        }
        // Get admin user
        const adminUser = await db
            .select()
            .from(users)
            .where(eq(users.email, adminEmail))
            .limit(1);
        if (adminUser.length === 0) {
            console.log("⏭️  Admin user not found, skipping vehicle seed (run seedAdmin first)");
            return;
        }
        const sellerId = adminUser[0].id;
        console.log(`📍 Using admin account (${adminEmail}) as seller for seeded vehicles`);
        // Insert all sample vehicles
        console.log("🚗 Seeding sample vehicles...");
        for (const vehicleData of SAMPLE_VEHICLES) {
            const [newVehicle] = await db
                .insert(vehicles)
                .values({
                ...vehicleData,
                sellerId,
                status: "approved", // Set to approved so they show in listings
            })
                .returning();
            // Create listing for the vehicle
            await db.insert(listings).values({
                vehicleId: newVehicle.id,
                isActive: true,
            });
        }
        console.log(`✅ Seeded ${SAMPLE_VEHICLES.length} sample vehicles`);
    }
    catch (error) {
        console.error("❌ Failed to seed vehicles:", error);
    }
}
/**
 * Run all seed functions
 */
export async function runAllSeeds() {
    console.log("🌱 Starting database seeding...");
    await seedAdmin();
    await seedVehicles();
    console.log("🌱 Database seeding complete!");
}
