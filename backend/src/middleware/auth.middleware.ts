import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
                role: string;
                image?: string | null;
                suspended?: boolean;
            };
            session?: {
                id: string;
                token: string;
                userId: string;
                expiresAt: Date;
            };
        }
    }
}

// Middleware to get current session
export async function getSession(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (session) {
            req.user = session.user as any;
            req.session = session.session;
        }
        next();
    } catch (error) {
        next();
    }
}

// Middleware to require authentication
export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.user = session.user as any;
        req.session = session.session;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

// Middleware to require specific roles
export function requireRole(...roles: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const session = await auth.api.getSession({
                headers: fromNodeHeaders(req.headers),
            });

            if (!session) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const userRole = (session.user as any).role || "buyer";

            if (!roles.includes(userRole)) {
                return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
            }

            req.user = session.user as any;
            req.session = session.session;
            next();
        } catch (error) {
            return res.status(401).json({ error: "Unauthorized" });
        }
    };
}

// Middleware to check if user is suspended (blocks suspended users from performing actions)
export async function requireNotSuspended(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Check if user is suspended in the database
        const user = await db.query.users.findFirst({
            where: eq(users.id, session.user.id),
            columns: {
                id: true,
                suspended: true,
            },
        });

        if (user?.suspended) {
            return res.status(403).json({
                error: "Account suspended",
                message: "Your account has been suspended. Please contact support for assistance."
            });
        }

        req.user = session.user as any;
        req.session = session.session;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
    }
}

// Combined middleware: require auth AND check suspension
export function requireAuthNotSuspended(
    req: Request,
    res: Response,
    next: NextFunction
) {
    return requireNotSuspended(req, res, next);
}
