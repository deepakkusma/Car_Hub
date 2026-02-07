import "dotenv/config";
import { seedVehicles } from "../lib/seed.js";
const force = process.argv.includes("--force");
console.log("\n🚗 Vehicle Seeding Script");
console.log("========================\n");
if (force) {
    console.log("⚠️  Force mode enabled - existing vehicles will be deleted\n");
}
seedVehicles(force)
    .then(() => {
    console.log("\n✅ Seeding complete!");
    process.exit(0);
})
    .catch((error) => {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
});
