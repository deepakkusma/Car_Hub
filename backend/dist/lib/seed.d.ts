/**
 * Seed default admin user if it doesn't exist
 */
export declare function seedAdmin(): Promise<void>;
/**
 * Seed sample vehicles with real images
 * @param force - If true, delete existing vehicles and reseed
 */
export declare function seedVehicles(force?: boolean): Promise<void>;
/**
 * Run all seed functions
 */
export declare function runAllSeeds(): Promise<void>;
