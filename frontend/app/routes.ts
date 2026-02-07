import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
    // Public routes
    index("routes/home.tsx"),
    route("vehicles", "routes/vehicles/index.tsx"),
    route("vehicles/:id", "routes/vehicles/$id.tsx"),
    route("vehicles/:id/payment", "routes/vehicles/$id.payment.tsx"),
    route("login", "routes/auth/login.tsx"),
    route("register", "routes/auth/register.tsx"),
    route("forgot-password", "routes/auth/forgot-password.tsx"),
    route("reset-password", "routes/auth/reset-password.tsx"),
    route("profile", "routes/profile.tsx"),
    route("profile/edit", "routes/profile.edit.tsx"),
    route("how-it-works", "routes/how-it-works.tsx"),

    // Buyer routes
    ...prefix("buyer", [
        route("dashboard", "routes/buyer/dashboard.tsx"),
        route("favorites", "routes/buyer/favorites.tsx"),
        route("inquiries", "routes/buyer/inquiries.tsx"),
        route("purchases", "routes/buyer/purchases.tsx"),
        route("bookings", "routes/buyer/bookings.tsx"),
        route("tracking", "routes/buyer/tracking.tsx"),
        route("issues", "routes/buyer/issues.tsx"),
    ]),

    // Seller routes
    ...prefix("seller", [
        route("dashboard", "routes/seller/dashboard.tsx"),
        route("listings", "routes/seller/listings.tsx"),
        route("add-vehicle", "routes/seller/add-vehicle.tsx"),
        route("inquiries", "routes/seller/inquiries.tsx"),
        route("sales", "routes/seller/sales.tsx"),
        route("bookings", "routes/seller/bookings.tsx"),
        route("issues", "routes/seller/issues.tsx"),
    ]),

    // Admin routes
    ...prefix("admin", [
        route("dashboard", "routes/admin/dashboard.tsx"),
        route("users", "routes/admin/users.tsx"),
        route("listings", "routes/admin/listings.tsx"),
        route("payments", "routes/admin/payments.tsx"),
        route("deliveries", "routes/admin/deliveries.tsx"),
        route("inquiries", "routes/admin/inquiries.tsx"),
        route("complaints", "routes/admin/complaints.tsx"),
    ]),
] satisfies RouteConfig;

