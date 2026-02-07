import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { runAllSeeds } from "./lib/seed.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
// Import routes
import vehiclesRoutes from "./routes/vehicles.routes.js";
import inquiriesRoutes from "./routes/inquiries.routes.js";
import favoritesRoutes from "./routes/favorites.routes.js";
import usersRoutes from "./routes/users.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
const app = express();
const PORT = process.env.PORT || 3001;
// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));
// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Static files for uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
// Better-auth handler - must be before other routes
app.all("/api/auth/{*splat}", toNodeHandler(auth));
// API routes
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/inquiries", inquiriesRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payments", paymentRoutes);
// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Error handling
app.use(notFoundHandler);
app.use(errorHandler);
// Start server
const startServer = async () => {
    // Seed database with admin and sample data
    await runAllSeeds();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📄 API docs: http://localhost:${PORT}/api`);
    });
};
startServer();
export default app;
