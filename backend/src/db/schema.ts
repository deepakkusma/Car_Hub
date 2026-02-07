import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    decimal,
    uuid,
    pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "buyer", "seller"]);
export const vehicleStatusEnum = pgEnum("vehicle_status", [
    "pending",
    "approved",
    "rejected",
    "sold",
]);
export const fuelTypeEnum = pgEnum("fuel_type", [
    "petrol",
    "diesel",
    "electric",
    "hybrid",
    "cng",
]);
export const transmissionEnum = pgEnum("transmission", [
    "manual",
    "automatic",
]);
export const inquiryStatusEnum = pgEnum("inquiry_status", [
    "pending",
    "responded",
    "closed",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
    "pending",
    "payment_initiated",
    "payment_completed",
    "payment_failed",
    "completed",
    "cancelled",
    "refunded",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
    "full_card",      // Full payment via card (Stripe)
    "advance_upi",    // Advance/booking amount via UPI/QR
    "cash_booking",   // Token booking with cash on delivery
    "split_qr",       // QR/UPI (manual) + remaining via Card
    "split_cash",     // Cash (manual) + remaining via Card
]);

// Delivery/Collection Status for tracking purchases
export const deliveryStatusEnum = pgEnum("delivery_status", [
    "processing",         // Purchase complete, preparing vehicle
    "inspection",         // Vehicle under inspection
    "documentation",      // Documentation in progress
    "ready_for_collection", // Ready for buyer to collect
    "collected",          // Buyer has collected the vehicle
]);

export const complaintStatusEnum = pgEnum("complaint_status", [
    "pending",
    "reviewed",
    "resolved",
    "dismissed"
]);

// Users table (required by better-auth)
export const users = pgTable("users", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("buyer"),
    phone: text("phone"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    suspended: boolean("suspended").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Sessions table (required by better-auth)
export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
});

// Accounts table (required by better-auth for OAuth)
export const accounts = pgTable("accounts", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Verification table (required by better-auth)
export const verifications = pgTable("verifications", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// Vehicles table
export const vehicles = pgTable("vehicles", {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: text("seller_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    mileage: integer("mileage"),
    fuelType: fuelTypeEnum("fuel_type").notNull(),
    transmission: transmissionEnum("transmission").notNull(),
    color: text("color"),
    description: text("description"),
    images: text("images").array().default([]),
    status: vehicleStatusEnum("status").notNull().default("pending"),
    registrationNumber: text("registration_number"),
    engineNumber: text("engine_number"),
    chassisNumber: text("chassis_number"),
    ownerCount: integer("owner_count").default(1),
    location: text("location"),
    views: integer("views").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Listings table (for featured/active listings)
export const listings = pgTable("listings", {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
        .notNull()
        .references(() => vehicles.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredUntil: timestamp("featured_until"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Favorites table
export const favorites = pgTable("favorites", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
        .notNull()
        .references(() => vehicles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Inquiries table
export const inquiries = pgTable("inquiries", {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
        .notNull()
        .references(() => vehicles.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: inquiryStatusEnum("status").notNull().default("pending"),
    sellerResponse: text("seller_response"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Transactions table
export const transactions = pgTable("transactions", {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
        .notNull()
        .references(() => vehicles.id, { onDelete: "cascade" }),
    buyerId: text("buyer_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    sellerId: text("seller_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    bookingAmount: decimal("booking_amount", { precision: 12, scale: 2 }), // Amount paid for booking (advance/token)
    remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }), // Remaining amount to be paid
    status: transactionStatusEnum("status").notNull().default("pending"),
    paymentType: paymentTypeEnum("payment_type").default("full_card"), // Type of payment chosen
    // Razorpay/Stripe fields
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    razorpaySignature: text("razorpay_signature"),
    paymentMethod: text("payment_method"),
    upiReference: text("upi_reference"), // UPI transaction reference
    paymentErrorCode: text("payment_error_code"),
    paymentErrorDescription: text("payment_error_description"),
    // Delivery tracking fields
    deliveryStatus: deliveryStatusEnum("delivery_status").default("processing"),
    estimatedReadyDate: timestamp("estimated_ready_date"),
    deliveryNotes: text("delivery_notes"),
    collectedAt: timestamp("collected_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Complaints table
export const complaints = pgTable("complaints", {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: complaintStatusEnum("status").notNull().default("pending"),
    reporterId: text("reporter_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: text("reported_user_id")
        .references(() => users.id, { onDelete: "set null" }), // Optional: if reporting a specific user
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
    vehicle: one(vehicles, {
        fields: [transactions.vehicleId],
        references: [vehicles.id],
    }),
    buyer: one(users, {
        fields: [transactions.buyerId],
        references: [users.id],
    }),
    seller: one(users, {
        fields: [transactions.sellerId],
        references: [users.id],
    }),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
    vehicles: many(vehicles),
    favorites: many(favorites),
    inquiriesSent: many(inquiries, { relationName: "buyerInquiries" }),
    inquiriesReceived: many(inquiries, { relationName: "sellerInquiries" }),
    sessions: many(sessions),
    accounts: many(accounts),
    complaintsFiled: many(complaints, { relationName: "complaintReporter" }),
    complaintsReceived: many(complaints, { relationName: "complaintReportedUser" }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
    seller: one(users, {
        fields: [vehicles.sellerId],
        references: [users.id],
    }),
    listing: one(listings),
    favorites: many(favorites),
    inquiries: many(inquiries),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
    vehicle: one(vehicles, {
        fields: [listings.vehicleId],
        references: [vehicles.id],
    }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
    user: one(users, {
        fields: [favorites.userId],
        references: [users.id],
    }),
    vehicle: one(vehicles, {
        fields: [favorites.vehicleId],
        references: [vehicles.id],
    }),
}));

export const inquiriesRelations = relations(inquiries, ({ one, many }) => ({
    vehicle: one(vehicles, {
        fields: [inquiries.vehicleId],
        references: [vehicles.id],
    }),
    buyer: one(users, {
        fields: [inquiries.buyerId],
        references: [users.id],
        relationName: "buyerInquiries",
    }),
    seller: one(users, {
        fields: [inquiries.sellerId],
        references: [users.id],
        relationName: "sellerInquiries",
    }),
    messages: many(inquiryMessages),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, {
        fields: [accounts.userId],
        references: [users.id],
    }),
}));

// Inquiry Messages table (for conversation threading)
export const inquiryMessages = pgTable("inquiry_messages", {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id")
        .notNull()
        .references(() => inquiries.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inquiryMessagesRelations = relations(inquiryMessages, ({ one }) => ({
    inquiry: one(inquiries, {
        fields: [inquiryMessages.inquiryId],
        references: [inquiries.id],
    }),
    sender: one(users, {
        fields: [inquiryMessages.senderId],
        references: [users.id],
    }),
}));

export const complaintsRelations = relations(complaints, ({ one }) => ({
    reporter: one(users, {
        fields: [complaints.reporterId],
        references: [users.id],
        relationName: "complaintReporter",
    }),
    reportedUser: one(users, {
        fields: [complaints.reportedUserId],
        references: [users.id],
        relationName: "complaintReportedUser",
    }),
}));
