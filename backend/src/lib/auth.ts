import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { storeResetLink } from "../routes/dev.routes.js";

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
        },
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // Set to true in production
        sendResetPassword: async ({ user, url, token }, request) => {
            // Failsafe: Block admins here too
            if ((user as any).role === "admin") {
                console.log(`[AUTH] Blocked password reset generation for admin: ${user.email}`);
                throw new APIError("FORBIDDEN", {
                    message: "Admins cannot reset their password via this method. Please contact system support.",
                });
            }

            // In production, use an email service like SendGrid, Resend, or Nodemailer
            // For development, we'll log the reset URL to the console
            console.log("=".repeat(60));
            console.log("PASSWORD RESET REQUEST");
            console.log("=".repeat(60));
            console.log(`User: ${user.name} (${user.email})`);
            console.log(`Reset URL: ${url}`);
            console.log(`Token: ${token}`);
            console.log("=".repeat(60));

            // Store for dev endpoint (allows showing link on website)
            if (process.env.NODE_ENV !== "production") {
                storeResetLink(user.email, url, token);
            }
        },
        onPasswordReset: async ({ user }, request) => {
            console.log(`Password for user ${user.email} has been reset successfully.`);
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes
        },
        cookie: {
            maxAge: 0, // Session cookie - expires when browser closes
        },
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "buyer",
                input: true,
            },
            phone: {
                type: "string",
                required: false,
                input: true,
            },
        },
    },
    hooks: {
        before: createAuthMiddleware(async (ctx) => {
            // Check for admin role on password reset
            if (ctx.path.includes("/forget-password")) {
                const email = ctx.body?.email;
                if (email) {
                    const user = await db.query.users.findFirst({
                        where: eq(schema.users.email, email),
                        columns: {
                            role: true,
                        },
                    });

                    if (!user) {
                        throw new APIError("BAD_REQUEST", {
                            message: "No email exists",
                        });
                    }

                    if (user.role === "admin") {
                        throw new APIError("FORBIDDEN", {
                            message: "Admins cannot reset their password via this form. Please contact system support.",
                        });
                    }
                }
            }

            // Check for suspended users on sign-in
            if (ctx.path === "/sign-in/email") {
                const email = ctx.body?.email;
                if (email) {
                    const user = await db.query.users.findFirst({
                        where: eq(schema.users.email, email),
                        columns: {
                            suspended: true,
                        },
                    });

                    if (user?.suspended) {
                        throw new APIError("FORBIDDEN", {
                            message: "Your account has been suspended. Please contact support for assistance.",
                        });
                    }
                }
            }
        }),
    },
    trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:5173"],
});
