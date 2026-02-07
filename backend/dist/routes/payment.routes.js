import { Router } from "express";
import { db } from "../db/index.js";
import { transactions, vehicles, users } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware.js";
import { stripe, verifyStripeWebhook } from "../lib/stripe.js";
import { z } from "zod";
const router = Router();
// Debug / config endpoint (helps confirm what the running backend is using)
router.get("/config", (req, res) => {
    return res.json({
        upiId: process.env.UPI_ID ?? null,
        upiName: process.env.UPI_NAME ?? null,
        nodeEnv: process.env.NODE_ENV ?? null,
    });
});
// Validation schemas
const createCheckoutSchema = z.object({
    vehicleId: z.string().uuid(),
    paymentType: z.enum(["full_card", "advance_upi", "cash_booking", "split_qr", "split_cash"]).default("full_card"),
    qrAmount: z.number().optional(), // Amount paid via QR (for split_qr)
    cashAmount: z.number().optional(), // Amount paid via cash (for split_cash)
});
const verifyManualSchema = z.object({
    transactionId: z.string().uuid(),
    manualTransactionId: z.string().min(1).optional(), // UPI txn id / cash receipt id (optional)
});
// Create checkout session for vehicle purchase
router.post("/create-checkout", requireAuth, async (req, res) => {
    try {
        console.log("Create checkout request body:", req.body);
        const { vehicleId, paymentType, qrAmount, cashAmount } = createCheckoutSchema.parse(req.body);
        console.log("Parsed checkout params:", { vehicleId, paymentType, qrAmount, cashAmount });
        const buyerId = req.user.id;
        const buyerEmail = req.user.email;
        const buyerName = req.user.name;
        // Check if vehicle exists and is available
        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, vehicleId),
            with: {
                seller: {
                    columns: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
            },
        });
        if (!vehicle) {
            return res.status(404).json({ error: "Vehicle not found" });
        }
        if (vehicle.status !== "approved") {
            return res.status(400).json({ error: "Vehicle is not available for purchase" });
        }
        if (vehicle.sellerId === buyerId) {
            return res.status(400).json({ error: "You cannot purchase your own vehicle" });
        }
        // Check if there's already a pending transaction for this vehicle by this buyer
        const existingTransaction = await db.query.transactions.findFirst({
            where: and(eq(transactions.vehicleId, vehicleId), eq(transactions.buyerId, buyerId), eq(transactions.status, "payment_initiated")),
        });
        if (existingTransaction) {
            await db
                .update(transactions)
                .set({
                status: "cancelled",
                paymentErrorDescription: "Session expired - new checkout created",
                updatedAt: new Date(),
            })
                .where(eq(transactions.id, existingTransaction.id));
            console.log("Cancelled old pending transaction:", existingTransaction.id);
        }
        const vehiclePriceINR = parseFloat(vehicle.price);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        // Handle different payment types
        if (paymentType === "full_card") {
            // Full payment via Stripe card
            const amountInPaise = Math.round(vehiclePriceINR * 100);
            const checkoutSession = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "inr",
                            product_data: {
                                name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                                description: `Full payment - ${vehicle.registrationNumber || "N/A"}`,
                                images: vehicle.images && vehicle.images.length > 0 ? [vehicle.images[0]] : [],
                            },
                            unit_amount: amountInPaise,
                        },
                        quantity: 1,
                    },
                ],
                customer_email: buyerEmail,
                success_url: `${frontendUrl}/buyer/purchases?success=true&session_id={CHECKOUT_SESSION_ID}&vehicleId=${vehicleId}`,
                cancel_url: `${frontendUrl}/vehicles/${vehicleId}?cancelled=true`,
                metadata: {
                    vehicleId: vehicle.id,
                    buyerId: buyerId,
                    sellerId: vehicle.sellerId,
                    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                    originalAmount: vehicle.price,
                    paymentType: "full_card",
                },
            });
            const [transaction] = await db
                .insert(transactions)
                .values({
                vehicleId,
                buyerId,
                sellerId: vehicle.sellerId,
                amount: vehicle.price,
                bookingAmount: vehicle.price,
                remainingAmount: "0",
                status: "payment_initiated",
                paymentType: "full_card",
                razorpayOrderId: checkoutSession.id,
            })
                .returning();
            return res.json({
                paymentType: "full_card",
                checkoutUrl: checkoutSession.url,
                sessionId: checkoutSession.id,
                transactionId: transaction.id,
                vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                amount: amountInPaise,
                currency: "INR",
            });
        }
        else if (paymentType === "advance_upi") {
            // Advance payment (10% of vehicle price) via UPI/QR
            const advancePercentage = 0.10; // 10% advance
            const advanceAmount = Math.round(vehiclePriceINR * advancePercentage);
            const remainingAmount = vehiclePriceINR - advanceAmount;
            // Generate a unique UPI reference
            const upiReference = `CARS24-${Date.now()}-${vehicleId.slice(0, 8).toUpperCase()}`;
            // UPI ID for payment (this should be configured in .env)
            const upiId = process.env.UPI_ID;
            const upiName = process.env.UPI_NAME || "Cars24 Payments";
            // In production, never fall back to a dummy UPI ID
            if (process.env.NODE_ENV === "production" && !upiId) {
                console.warn("UPI_ID missing (production). cwd=", process.cwd());
                return res.status(500).json({
                    error: "UPI payments are not configured",
                    details: "Missing UPI_ID in server environment",
                });
            }
            // In dev, still require a UPI_ID for QR flows to be meaningful
            if (!upiId) {
                console.warn("UPI_ID missing. cwd=", process.cwd());
                return res.status(500).json({
                    error: "UPI payments are not configured",
                    details: "Set UPI_ID (your real UPI VPA) in backend .env",
                });
            }
            // Create UPI payment link/QR data
            const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${advanceAmount}&cu=INR&tn=${encodeURIComponent(`Booking ${vehicle.year} ${vehicle.make} ${vehicle.model}`)}&tr=${upiReference}`;
            const [transaction] = await db
                .insert(transactions)
                .values({
                vehicleId,
                buyerId,
                sellerId: vehicle.sellerId,
                amount: vehicle.price,
                bookingAmount: advanceAmount.toString(),
                remainingAmount: remainingAmount.toString(),
                status: "payment_initiated",
                paymentType: "advance_upi",
                upiReference: upiReference,
            })
                .returning();
            return res.json({
                paymentType: "advance_upi",
                transactionId: transaction.id,
                vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                totalAmount: vehiclePriceINR,
                advanceAmount: advanceAmount,
                remainingAmount: remainingAmount,
                currency: "INR",
                upiLink: upiLink,
                upiId: upiId,
                upiReference: upiReference,
                sellerPhone: vehicle.seller?.phone,
            });
        }
        else if (paymentType === "cash_booking") {
            // Cash booking with token amount (₹5000 token, rest on delivery)
            const tokenAmount = 5000;
            const remainingAmount = vehiclePriceINR - tokenAmount;
            // Generate booking reference
            const bookingReference = `CASH-${Date.now()}-${vehicleId.slice(0, 8).toUpperCase()}`;
            const [transaction] = await db
                .insert(transactions)
                .values({
                vehicleId,
                buyerId,
                sellerId: vehicle.sellerId,
                amount: vehicle.price,
                bookingAmount: tokenAmount.toString(),
                remainingAmount: remainingAmount.toString(),
                status: "payment_initiated",
                paymentType: "cash_booking",
                upiReference: bookingReference,
            })
                .returning();
            return res.json({
                paymentType: "cash_booking",
                transactionId: transaction.id,
                vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                totalAmount: vehiclePriceINR,
                tokenAmount: tokenAmount,
                remainingAmount: remainingAmount,
                currency: "INR",
                bookingReference: bookingReference,
                sellerName: vehicle.seller?.name,
                sellerPhone: vehicle.seller?.phone,
                message: "Please contact the seller to confirm booking and arrange cash payment.",
            });
        }
        else if (paymentType === "split_qr" || paymentType === "split_cash") {
            // Split payment: QR/Cash (manual) + remaining via Card
            const manualAmount = paymentType === "split_qr" ? (qrAmount || 0) : (cashAmount || 0);
            if (manualAmount <= 0) {
                return res.status(400).json({
                    error: `${paymentType === "split_qr" ? "QR" : "Cash"} amount must be greater than 0`
                });
            }
            if (manualAmount >= vehiclePriceINR) {
                return res.status(400).json({
                    error: `${paymentType === "split_qr" ? "QR" : "Cash"} amount must be less than the total vehicle price`
                });
            }
            const remainingAmount = vehiclePriceINR - manualAmount;
            const amountInPaise = Math.round(remainingAmount * 100);
            // Generate reference for the manual payment
            const reference = paymentType === "split_qr"
                ? `SPLIT-QR-${Date.now()}-${vehicleId.slice(0, 8).toUpperCase()}`
                : `SPLIT-CASH-${Date.now()}-${vehicleId.slice(0, 8).toUpperCase()}`;
            // If split_qr, create UPI link data so frontend can render a QR for the entered amount
            const upiId = process.env.UPI_ID;
            const upiName = process.env.UPI_NAME || "Cars24 Payments";
            if (paymentType === "split_qr") {
                if (process.env.NODE_ENV === "production" && !upiId) {
                    console.warn("UPI_ID missing (production). cwd=", process.cwd());
                    return res.status(500).json({
                        error: "UPI payments are not configured",
                        details: "Missing UPI_ID in server environment",
                    });
                }
                if (!upiId) {
                    console.warn("UPI_ID missing. cwd=", process.cwd());
                    return res.status(500).json({
                        error: "UPI payments are not configured",
                        details: "Set UPI_ID (your real UPI VPA) in backend .env",
                    });
                }
            }
            const upiLink = paymentType === "split_qr"
                ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${manualAmount}&cu=INR&tn=${encodeURIComponent(`Booking ${vehicle.year} ${vehicle.make} ${vehicle.model}`)}&tr=${reference}`
                : undefined;
            // Create Stripe checkout for the remaining amount
            const checkoutSession = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "inr",
                            product_data: {
                                name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                                description: `Remaining balance after ${paymentType === "split_qr" ? "QR/UPI" : "Cash"} payment of ₹${manualAmount.toLocaleString("en-IN")}`,
                                images: vehicle.images && vehicle.images.length > 0 ? [vehicle.images[0]] : [],
                            },
                            unit_amount: amountInPaise,
                        },
                        quantity: 1,
                    },
                ],
                customer_email: buyerEmail,
                success_url: `${frontendUrl}/buyer/purchases?success=true&session_id={CHECKOUT_SESSION_ID}&vehicleId=${vehicleId}`,
                cancel_url: `${frontendUrl}/vehicles/${vehicleId}?cancelled=true`,
                metadata: {
                    vehicleId: vehicle.id,
                    buyerId: buyerId,
                    sellerId: vehicle.sellerId,
                    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                    originalAmount: vehicle.price,
                    paymentType: paymentType,
                    manualAmount: manualAmount.toString(),
                },
            });
            const [transaction] = await db
                .insert(transactions)
                .values({
                vehicleId,
                buyerId,
                sellerId: vehicle.sellerId,
                amount: vehicle.price,
                bookingAmount: manualAmount.toString(),
                remainingAmount: remainingAmount.toString(),
                status: "payment_initiated",
                paymentType: paymentType,
                razorpayOrderId: checkoutSession.id,
                upiReference: reference,
            })
                .returning();
            return res.json({
                paymentType: paymentType,
                transactionId: transaction.id,
                vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                totalAmount: vehiclePriceINR,
                manualAmount: manualAmount,
                manualPaymentType: paymentType === "split_qr" ? "QR/UPI" : "Cash",
                remainingAmount: remainingAmount,
                currency: "INR",
                reference: reference,
                checkoutUrl: checkoutSession.url,
                sessionId: checkoutSession.id,
                message: `Pay ₹${manualAmount.toLocaleString("en-IN")} via ${paymentType === "split_qr" ? "QR/UPI" : "Cash"}, then complete remaining ₹${remainingAmount.toLocaleString("en-IN")} via Card.`,
                upiLink,
                upiId: paymentType === "split_qr" ? upiId : undefined,
            });
        }
        return res.status(400).json({ error: "Invalid payment type" });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error creating checkout:", error);
        if (error?.type?.startsWith("Stripe")) {
            return res.status(500).json({
                error: "Payment gateway error",
                details: error.message,
            });
        }
        res.status(500).json({ error: "Failed to create checkout session" });
    }
});
// Verify the manual part of a split payment (buyer confirms UPI/Cash before proceeding to card)
router.post("/verify-manual", requireAuth, async (req, res) => {
    try {
        const { transactionId, manualTransactionId } = verifyManualSchema.parse(req.body);
        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        if (transaction.buyerId !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        if (transaction.paymentType !== "split_qr" && transaction.paymentType !== "split_cash") {
            return res.status(400).json({ error: "This transaction is not a split payment" });
        }
        // Mark the manual portion as verified (without completing the transaction/vehicle).
        // Stripe payment for remaining amount will move status to payment_completed via webhook.
        await db
            .update(transactions)
            .set({
            razorpayPaymentId: manualTransactionId || transaction.razorpayPaymentId || transaction.upiReference,
            paymentMethod: transaction.paymentType === "split_qr" ? "upi" : "cash",
            updatedAt: new Date(),
        })
            .where(eq(transactions.id, transactionId));
        return res.json({
            success: true,
            message: "Manual payment verified. You can proceed to card payment.",
            transactionId,
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error verifying manual split payment:", error);
        return res.status(500).json({ error: "Failed to verify manual payment" });
    }
});
// Confirm UPI/Cash booking payment (called by seller/admin to mark payment received)
router.post("/confirm-booking", requireAuth, async (req, res) => {
    try {
        const { transactionId, upiTransactionId } = req.body;
        if (!transactionId) {
            return res.status(400).json({ error: "Transaction ID is required" });
        }
        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        // Only buyer or seller can confirm
        if (transaction.buyerId !== req.user.id && transaction.sellerId !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        // Only allow confirming UPI and cash bookings
        if (transaction.paymentType !== "advance_upi" && transaction.paymentType !== "cash_booking") {
            return res.status(400).json({ error: "This transaction type cannot be confirmed manually" });
        }
        // Update transaction as completed
        await db
            .update(transactions)
            .set({
            status: "payment_completed",
            razorpayPaymentId: upiTransactionId || transaction.upiReference,
            paymentMethod: transaction.paymentType === "advance_upi" ? "upi" : "cash",
            updatedAt: new Date(),
        })
            .where(eq(transactions.id, transactionId));
        // Update vehicle status to sold
        await db
            .update(vehicles)
            .set({
            status: "sold",
            updatedAt: new Date(),
        })
            .where(eq(vehicles.id, transaction.vehicleId));
        res.json({
            success: true,
            message: "Booking confirmed successfully",
            transactionId: transaction.id,
        });
    }
    catch (error) {
        console.error("Error confirming booking:", error);
        res.status(500).json({ error: "Failed to confirm booking" });
    }
});
// Webhook endpoint for Stripe
// Note: This needs raw body parsing - ensure express.raw() middleware is used for this route
router.post("/webhook", async (req, res) => {
    try {
        const signature = req.headers["stripe-signature"];
        if (!signature) {
            console.error("Missing stripe-signature header");
            return res.status(400).json({ error: "Missing signature" });
        }
        // The body should be raw for webhook verification
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        const event = verifyStripeWebhook(rawBody, signature);
        if (!event) {
            console.error("Invalid webhook signature");
            return res.status(401).json({ error: "Invalid webhook signature" });
        }
        console.log("Received Stripe webhook:", event.type);
        // Handle different webhook events
        switch (event.type) {
            case "checkout.session.completed":
                await handleCheckoutSessionCompleted(event.data.object);
                break;
            case "checkout.session.expired":
                await handleCheckoutSessionExpired(event.data.object);
                break;
            case "payment_intent.payment_failed":
                await handlePaymentFailed(event.data.object);
                break;
            default:
                console.log("Unhandled webhook event:", event.type);
        }
        res.json({ received: true });
    }
    catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});
async function handleCheckoutSessionCompleted(session) {
    const sessionId = session.id;
    const metadata = session.metadata;
    // Find transaction by session ID
    const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.razorpayOrderId, sessionId),
    });
    if (!transaction) {
        console.error("Transaction not found for session:", sessionId);
        return;
    }
    // Update transaction as successful
    await db
        .update(transactions)
        .set({
        status: "payment_completed",
        razorpayPaymentId: session.payment_intent,
        paymentMethod: "stripe",
        updatedAt: new Date(),
    })
        .where(eq(transactions.id, transaction.id));
    // Update vehicle status to sold
    await db
        .update(vehicles)
        .set({
        status: "sold",
        updatedAt: new Date(),
    })
        .where(eq(vehicles.id, transaction.vehicleId));
    console.log("Payment succeeded for transaction:", transaction.id);
}
async function handleCheckoutSessionExpired(session) {
    const sessionId = session.id;
    // Find transaction by session ID
    const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.razorpayOrderId, sessionId),
    });
    if (!transaction) {
        console.error("Transaction not found for session:", sessionId);
        return;
    }
    // Update transaction as expired
    await db
        .update(transactions)
        .set({
        status: "cancelled",
        paymentErrorDescription: "Checkout session expired",
        updatedAt: new Date(),
    })
        .where(eq(transactions.id, transaction.id));
    console.log("Checkout session expired for transaction:", transaction.id);
}
async function handlePaymentFailed(paymentIntent) {
    const paymentId = paymentIntent.id;
    // Find transaction by payment ID
    const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.razorpayPaymentId, paymentId),
    });
    if (!transaction) {
        console.error("Transaction not found for payment:", paymentId);
        return;
    }
    // Update transaction as failed
    await db
        .update(transactions)
        .set({
        status: "payment_failed",
        paymentErrorCode: paymentIntent.last_payment_error?.code || null,
        paymentErrorDescription: paymentIntent.last_payment_error?.message || "Payment failed",
        updatedAt: new Date(),
    })
        .where(eq(transactions.id, transaction.id));
    console.log("Payment failed for transaction:", transaction.id);
}
// Manual verification endpoint (called from frontend after redirect)
router.post("/verify", requireAuth, async (req, res) => {
    try {
        const { transactionId, sessionId } = req.body;
        if (!transactionId && !sessionId) {
            return res.status(400).json({ error: "Transaction ID or Session ID is required" });
        }
        let transaction;
        if (transactionId) {
            transaction = await db.query.transactions.findFirst({
                where: eq(transactions.id, transactionId),
            });
        }
        else if (sessionId) {
            transaction = await db.query.transactions.findFirst({
                where: eq(transactions.razorpayOrderId, sessionId),
            });
        }
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        if (transaction.buyerId !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        // Check payment status with Stripe API
        try {
            const session = await stripe.checkout.sessions.retrieve(transaction.razorpayOrderId || sessionId || "");
            if (session.payment_status === "paid") {
                // Update transaction as successful if not already
                if (transaction.status !== "payment_completed") {
                    await db
                        .update(transactions)
                        .set({
                        status: "payment_completed",
                        razorpayPaymentId: session.payment_intent,
                        paymentMethod: "stripe",
                        updatedAt: new Date(),
                    })
                        .where(eq(transactions.id, transaction.id));
                    // Update vehicle status to sold
                    await db
                        .update(vehicles)
                        .set({
                        status: "sold",
                        updatedAt: new Date(),
                    })
                        .where(eq(vehicles.id, transaction.vehicleId));
                }
                return res.json({
                    success: true,
                    message: "Payment verified successfully",
                    transactionId: transaction.id,
                });
            }
            else if (session.status === "expired") {
                await db
                    .update(transactions)
                    .set({
                    status: "cancelled",
                    paymentErrorDescription: "Checkout session expired",
                    updatedAt: new Date(),
                })
                    .where(eq(transactions.id, transaction.id));
                return res.status(400).json({ error: "Checkout session expired" });
            }
            else {
                return res.json({
                    success: false,
                    message: "Payment is still pending",
                    status: session.payment_status,
                });
            }
        }
        catch (apiError) {
            console.error("Error fetching payment status:", apiError);
            // If we can't verify, return current transaction status
            return res.json({
                success: transaction.status === "payment_completed",
                message: "Could not verify payment status",
                currentStatus: transaction.status,
            });
        }
    }
    catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: "Failed to verify payment" });
    }
});
// Handle payment failure (called from frontend)
router.post("/failed", requireAuth, async (req, res) => {
    try {
        const { transactionId, errorCode, errorDescription } = req.body;
        if (!transactionId) {
            return res.status(400).json({ error: "Transaction ID is required" });
        }
        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        if (transaction.buyerId !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        await db
            .update(transactions)
            .set({
            status: "payment_failed",
            paymentErrorCode: errorCode || null,
            paymentErrorDescription: errorDescription || null,
            updatedAt: new Date(),
        })
            .where(eq(transactions.id, transactionId));
        res.json({ success: true, message: "Payment failure recorded" });
    }
    catch (error) {
        console.error("Error recording payment failure:", error);
        res.status(500).json({ error: "Failed to record payment failure" });
    }
});
// Get user's transactions (purchased vehicles)
router.get("/my-purchases", requireAuth, async (req, res) => {
    try {
        const userTransactions = await db.query.transactions.findMany({
            where: eq(transactions.buyerId, req.user.id),
            orderBy: [desc(transactions.createdAt)],
        });
        // Get vehicle, buyer and seller details for each transaction
        const purchasesWithDetails = await Promise.all(userTransactions.map(async (transaction) => {
            const [vehicle, buyer, seller] = await Promise.all([
                db.query.vehicles.findFirst({
                    where: eq(vehicles.id, transaction.vehicleId),
                    with: {
                        seller: {
                            columns: {
                                id: true,
                                name: true,
                                phone: true,
                            },
                        },
                    },
                }),
                db.query.users.findFirst({
                    where: eq(users.id, transaction.buyerId),
                    columns: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                    },
                }),
                db.query.users.findFirst({
                    where: eq(users.id, transaction.sellerId),
                    columns: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                }),
            ]);
            return {
                ...transaction,
                vehicle,
                buyer,
                seller: seller || vehicle?.seller,
            };
        }));
        res.json(purchasesWithDetails);
    }
    catch (error) {
        console.error("Error fetching purchases:", error);
        res.status(500).json({ error: "Failed to fetch purchases" });
    }
});
// Get user's sales (as seller)
router.get("/my-sales", requireAuth, async (req, res) => {
    try {
        const userSales = await db.query.transactions.findMany({
            where: eq(transactions.sellerId, req.user.id),
            orderBy: [desc(transactions.createdAt)],
        });
        // Get vehicle and buyer details for each transaction
        const salesWithDetails = await Promise.all(userSales.map(async (transaction) => {
            const [vehicle, buyer] = await Promise.all([
                db.query.vehicles.findFirst({
                    where: eq(vehicles.id, transaction.vehicleId),
                }),
                db.query.users.findFirst({
                    where: eq(users.id, transaction.buyerId),
                    columns: {
                        id: true,
                        name: true,
                        phone: true,
                        email: true,
                    },
                }),
            ]);
            return {
                ...transaction,
                vehicle,
                buyer,
            };
        }));
        res.json(salesWithDetails);
    }
    catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ error: "Failed to fetch sales" });
    }
});
// Get single transaction details
router.get("/:id", requireAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, id),
        });
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        // Check if user is buyer or seller
        if (transaction.buyerId !== req.user.id && transaction.sellerId !== req.user.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, transaction.vehicleId),
            with: {
                seller: {
                    columns: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
            },
        });
        const buyer = await db.query.users.findFirst({
            where: eq(users.id, transaction.buyerId),
            columns: {
                id: true,
                name: true,
                phone: true,
                email: true,
            },
        });
        res.json({
            ...transaction,
            vehicle,
            buyer,
        });
    }
    catch (error) {
        console.error("Error fetching transaction:", error);
        res.status(500).json({ error: "Failed to fetch transaction" });
    }
});
export default router;
