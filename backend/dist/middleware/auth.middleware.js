import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
// Middleware to get current session
export async function getSession(req, res, next) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        if (session) {
            req.user = session.user;
            req.session = session.session;
        }
        next();
    }
    catch (error) {
        next();
    }
}
// Middleware to require authentication
export async function requireAuth(req, res, next) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        if (!session) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        req.user = session.user;
        req.session = session.session;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
    }
}
// Middleware to require specific roles
export function requireRole(...roles) {
    return async (req, res, next) => {
        try {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(req.headers),
            });
            if (!session) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const userRole = session.user.role || "buyer";
            if (!roles.includes(userRole)) {
                return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
            }
            req.user = session.user;
            req.session = session.session;
            next();
        }
        catch (error) {
            return res.status(401).json({ error: "Unauthorized" });
        }
    };
}
