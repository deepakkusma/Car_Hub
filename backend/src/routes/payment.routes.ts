import { Router, Request, Response } from "express";
import { db } from "../db/index.js";
import { transactions, vehicles, users } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireNotSuspended } from "../middleware/auth.middleware.js";
import { stripe, verifyStripeWebhook, type StripeCheckoutMetadata } from "../lib/stripe.js";
import { z } from "zod";
import type Stripe from "stripe";

const router = Router();

// Debug / config endpoint (helps confirm what the running backend is using)
router.get("/config", (req: Request, res: Response) => {
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
    bookingMethod: z.enum(["card", "upi", "cash"]).optional(), // Sub-method for booking
    previousTransactionId: z.string().uuid().optional(), // ID of existing booking transaction if paying balance
});

const verifyManualSchema = z.object({
    transactionId: z.string().uuid(),
    manualTransactionId: z.string().min(1).optional(), // UPI txn id / cash receipt id (optional)
});

// Create checkout session for vehicle purchase (requires not suspended)
router.post("/create-checkout", requireNotSuspended, async (req: Request, res: Response) => {
    try {
        console.log("Create checkout request body:", req.body);
        const { vehicleId, paymentType, qrAmount, cashAmount, previousTransactionId } = createCheckoutSchema.parse(req.body);
        console.log("Parsed checkout params:", { vehicleId, paymentType, qrAmount, cashAmount, previousTransactionId });
        const buyerId = req.user!.id;
        const buyerEmail = (req.user as any).email;
        const buyerName = (req.user as any).name;

        // Check if vehicle exists
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

        if ((req.user as any).role === "seller") {
            return res.status(403).json({ error: "Sellers cannot purchase vehicles. Please register as a buyer." });
        }

        let transactionToUpdate: any = null;
        let amountToPay = parseFloat(vehicle.price);
        let vehiclePriceINR = parseFloat(vehicle.price);

        // If paying balance, retrieve existing transaction
        if (previousTransactionId) {
            const existing = await db.query.transactions.findFirst({
                where: and(
                    eq(transactions.id, previousTransactionId),
                    eq(transactions.vehicleId, vehicleId),
                    eq(transactions.buyerId, buyerId)
                ),
            });

            if (!existing) {
                return res.status(404).json({ error: "Booking transaction not found" });
            }

            if (!existing.remainingAmount || parseFloat(existing.remainingAmount) <= 0) {
                return res.status(400).json({ error: "No remaining balance to pay for this booking" });
            }

            transactionToUpdate = existing;
            amountToPay = parseFloat(existing.remainingAmount);
            // We skip "Vehicle available" check because this user already booked it.
        } else {
            // New Purchase Checks
            if (vehicle.status !== "approved") {
                return res.status(400).json({ error: "Vehicle is not available for purchase" });
            }

            if (vehicle.sellerId === buyerId) {
                return res.status(400).json({ error: "You cannot purchase your own vehicle" });
            }

            // Check if there's already a pending transaction for this vehicle by this buyer
            const existingTransaction = await db.query.transactions.findFirst({
                where: and(
                    eq(transactions.vehicleId, vehicleId),
                    eq(transactions.buyerId, buyerId),
                    eq(transactions.status, "payment_initiated")
                ),
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
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

        // Handle different payment types
        if (paymentType === "full_card") {
            // Full payment via Stripe card OR Balance Payment via Card
            const amountInPaise = Math.round(amountToPay * 100);

            const checkoutSession = await stripe.checkout.sessions.create({
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "inr",
                            product_data: {
                                name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                                description: transactionToUpdate ? `Balance Payment` : `Full payment - ${vehicle.registrationNumber || "N/A"}`,
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
                    paymentType: "full_card", // or "balance_card"? Keep simple for now
                },
            });

            let transaction;
            if (transactionToUpdate) {
                [transaction] = await db
                    .update(transactions)
                    .set({
                        razorpayOrderId: checkoutSession.id,
                        updatedAt: new Date(),
                    })
                    .where(eq(transactions.id, transactionToUpdate.id))
                    .returning();
            } else {
                [transaction] = await db
                    .insert(transactions)
                    .values({
                        vehicleId,
                        buyerId,
                        sellerId: vehicle.sellerId,
                        amount: vehicle.price,
                        bookingAmount: vehicle.price, // Technically full amount is booking + remaining
                        remainingAmount: "0",
                        status: "payment_initiated",
                        paymentType: "full_card",
                        razorpayOrderId: checkoutSession.id,
                    })
                    .returning();
            }

            return res.json({
                paymentType: "full_card",
                checkoutUrl: checkoutSession.url,
                sessionId: checkoutSession.id,
                transactionId: transaction.id,
                vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                amount: amountInPaise,
                currency: "INR",
            });
        } else if (paymentType === "advance_upi") {
            // ... (Same as before, simplified for space)
            // Note: advance_upi is for NEW bookings. If previousTransactionId exists, we shouldn't be here (or treated as error/ignore)
            if (transactionToUpdate) {
                return res.status(400).json({ error: "Cannot make a new booking for an existing transaction" });
            }

            // Original logic for advance_upi...
            const bookingMethod = req.body.bookingMethod || "card"; // Default to card
            const bookingPercentage = 0.05;
            const bookingAmount = Math.round(vehiclePriceINR * bookingPercentage);
            const remainingAmount = vehiclePriceINR - bookingAmount;

            // Common transaction partial
            const transactionValues = {
                vehicleId,
                buyerId,
                sellerId: vehicle.sellerId,
                amount: vehicle.price,
                bookingAmount: bookingAmount.toString(),
                remainingAmount: remainingAmount.toString(),
                status: "payment_initiated" as const, // Cast to literal
                paymentType: "advance_upi" as const,  // Cast to literal
                paymentMethod: bookingMethod,
            };

            if (bookingMethod === "card") {
                const amountInPaise = Math.round(bookingAmount * 100);
                const checkoutSession = await stripe.checkout.sessions.create({
                    mode: "payment",
                    payment_method_types: ["card"],
                    line_items: [
                        {
                            price_data: {
                                currency: "inr",
                                product_data: {
                                    name: `Booking: ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                                    description: `5% Booking Amount - Pay remaining ₹${remainingAmount.toLocaleString("en-IN")} later`,
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
                        paymentType: "advance_upi",
                    },
                });

                const [transaction] = await db
                    .insert(transactions)
                    .values({ ...transactionValues, razorpayOrderId: checkoutSession.id })
                    .returning();

                return res.json({
                    paymentType: "advance_upi",
                    checkoutUrl: checkoutSession.url,
                    sessionId: checkoutSession.id,
                    transactionId: transaction.id,
                    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                    amount: amountInPaise,
                    currency: "INR",
                });
            } else if (bookingMethod === "upi") {
                // Generate UPI/QR
                const upiReference = `CARS24-BK-${Date.now()}-${vehicleId.slice(0, 4).toUpperCase()}`;
                const upiId = process.env.UPI_ID;
                const upiName = process.env.UPI_NAME || "Cars24 Payments";

                if (!upiId) return res.status(500).json({ error: "UPI not configured" });

                const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${bookingAmount}&cu=INR&tn=${encodeURIComponent(`Booking ${vehicle.year} ${vehicle.make} ${vehicle.model}`)}&tr=${upiReference}`;

                const [transaction] = await db
                    .insert(transactions)
                    .values({ ...transactionValues, upiReference })
                    .returning();

                return res.json({
                    paymentType: "advance_upi",
                    transactionId: transaction.id,
                    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                    amount: bookingAmount,
                    bookingMethod: "upi",
                    upiLink,
                    upiId,
                    upiReference,
                    remainingAmount,
                });
            } else if (bookingMethod === "cash") {
                // Cash Booking
                const [transaction] = await db
                    .insert(transactions)
                    .values({ ...transactionValues }) // No external ID needed yet
                    .returning();

                return res.json({
                    paymentType: "advance_upi",
                    transactionId: transaction.id,
                    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                    amount: bookingAmount,
                    bookingMethod: "cash",
                    remainingAmount,
                    sellerName: vehicle.seller?.name || "The Seller",
                    sellerPhone: vehicle.seller?.phone || "N/A",
                });
            }
        } else if (paymentType === "cash_booking") {
            // If updating: Pay Balance via Cash
            if (transactionToUpdate) {
                // Determine remaining amount (balance)
                const remaining = amountToPay; // This is the balance

                // Update transaction details
                await db
                    .update(transactions)
                    .set({
                        status: "payment_initiated",
                        paymentType: "cash_booking", // Or "cash_balance" if preferred, but schema strictness matters
                        bookingAmount: "0", // Mark as balance payment (0 token)
                        updatedAt: new Date(),
                        // We might want to clear old references if switching methods, but keeping them is safer for history
                    })
                    .where(eq(transactions.id, transactionToUpdate.id));

                // Return same structure but for balance
                return res.json({
                    paymentType: "cash_booking",
                    transactionId: transactionToUpdate.id,
                    vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                    totalAmount: vehiclePriceINR,
                    tokenAmount: 0,
                    remainingAmount: remaining,
                    currency: "INR",
                    bookingReference: transactionToUpdate.upiReference || `CASH-BAL-${Date.now()}`,
                    sellerName: vehicle.seller?.name,
                    sellerPhone: vehicle.seller?.phone,
                    message: "Please contact the seller to confirm balance payment in cash.",
                });
            }

            // Cash booking with token amount (5% of vehicle price, rest on delivery)
            const bookingPercentage = 0.05;
            const tokenAmount = Math.round(vehiclePriceINR * bookingPercentage);
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
        } else if (paymentType === "split_qr" || paymentType === "split_cash") {
            // Split payment: QR/Cash (manual) + remaining via Card
            const upiPortion = paymentType === "split_qr" ? (qrAmount || 0) : 0;
            const cashPortion = paymentType === "split_qr" ? (cashAmount || 0) : (cashAmount || 0);
            const manualAmount = paymentType === "split_qr" ? (upiPortion + cashPortion) : cashPortion;

            if (manualAmount <= 0) {
                return res.status(400).json({
                    error: `${paymentType === "split_qr" ? "QR/UPI or Cash" : "Cash"} amount must be greater than 0`
                });
            }

            if (manualAmount >= amountToPay) {
                return res.status(400).json({
                    error: `Manual payment must be less than the total amount to pay`
                });
            }

            const remainingCardAmount = amountToPay - manualAmount;
            const amountInPaise = Math.round(remainingCardAmount * 100);

            // Generate reference for the manual payment
            const reference =
                paymentType === "split_qr"
                    ? `SPLIT-MIX-${Date.now()}-${vehicleId.slice(0, 8).toUpperCase()}`
                    : `SPLIT-CASH-${Date.now()}-${vehicleId.slice(0, 8).toUpperCase()}`;

            // If split_qr and a UPI portion exists, create UPI link data
            const upiId = process.env.UPI_ID;
            const upiName = process.env.UPI_NAME || "Cars24 Payments";

            const upiLink =
                paymentType === "split_qr" && upiPortion > 0
                    ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${upiPortion}&cu=INR&tn=${encodeURIComponent(
                        `Booking ${vehicle.year} ${vehicle.make} ${vehicle.model}`
                    )}&tr=${reference}`
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
                                description: `Balance Payment: Manual ₹${manualAmount} + Card`,
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

            let transaction;
            if (transactionToUpdate) {
                [transaction] = await db
                    .update(transactions)
                    .set({
                        razorpayOrderId: checkoutSession.id,
                        upiReference: reference,
                        updatedAt: new Date(),
                        paymentType: paymentType,
                        bookingAmount: manualAmount.toString(),
                        remainingAmount: remainingCardAmount.toString(),
                    })
                    .where(eq(transactions.id, transactionToUpdate.id))
                    .returning();
            } else {
                [transaction] = await db
                    .insert(transactions)
                    .values({
                        vehicleId,
                        buyerId,
                        sellerId: vehicle.sellerId,
                        amount: vehicle.price,
                        bookingAmount: manualAmount.toString(),
                        remainingAmount: remainingCardAmount.toString(),
                        status: "payment_initiated",
                        paymentType: paymentType,
                        razorpayOrderId: checkoutSession.id,
                        upiReference: reference,
                    })
                    .returning();
            }

            return res.json({
                paymentType: paymentType,
                transactionId: transaction.id,
                vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                totalAmount: vehiclePriceINR,
                manualAmount: manualAmount,
                manualPaymentType:
                    paymentType === "split_qr"
                        ? (upiPortion > 0 && cashPortion > 0 ? "UPI/QR + Cash" : upiPortion > 0 ? "UPI/QR" : "Cash")
                        : "Cash",
                remainingAmount: remainingCardAmount,
                currency: "INR",
                reference: reference,
                checkoutUrl: checkoutSession.url,
                sessionId: checkoutSession.id,
                message:
                    paymentType === "split_qr"
                        ? `Pay ₹${manualAmount.toLocaleString("en-IN")} via ${upiPortion > 0 && cashPortion > 0 ? "UPI/QR + Cash" : upiPortion > 0 ? "UPI/QR" : "Cash"}, then complete remaining ₹${remainingCardAmount.toLocaleString("en-IN")} via Card.`
                        : `Pay ₹${manualAmount.toLocaleString("en-IN")} via Cash, then complete remaining ₹${remainingCardAmount.toLocaleString("en-IN")} via Card.`,
                upiLink,
                upiId: paymentType === "split_qr" ? upiId : undefined,
            });
        }

        return res.status(400).json({ error: "Invalid payment type" });
    } catch (error: any) {
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
router.post("/verify-manual", requireAuth, async (req: Request, res: Response) => {
    try {
        const { transactionId, manualTransactionId } = verifyManualSchema.parse(req.body);

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        if (transaction.buyerId !== req.user!.id) {
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
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        console.error("Error verifying manual split payment:", error);
        return res.status(500).json({ error: "Failed to verify manual payment" });
    }
});

// Confirm UPI/Cash booking payment (called by seller/admin to mark payment received)
router.post("/confirm-booking", requireAuth, async (req: Request, res: Response) => {
    try {
        const { transactionId, upiTransactionId } = req.body;

        if (!transactionId) {
            return res.status(400).json({ error: "Transaction ID is required" });
        }

        // Fetch transaction with vehicle data to check current status
        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
            with: {
                vehicle: true,
            },
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        // Only buyer or seller can confirm
        if (transaction.buyerId !== req.user!.id && transaction.sellerId !== req.user!.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        // Allow confirming if it's pending/initiated OR it's a cash/split type
        const allowedTypes = ["advance_upi", "cash_booking", "split_qr", "split_cash"];
        if ((!transaction.paymentType || !allowedTypes.includes(transaction.paymentType)) && transaction.status !== "payment_initiated") {
            return res.status(400).json({ error: "This transaction type cannot be confirmed manually" });
        }

        let newRemaining = transaction.remainingAmount;
        // Default to sold. Using 'approved' for 'booked' status logic due to schema.
        let vehicleStatus: "sold" | "approved" = "sold";

        const pType = transaction.paymentType || "";

        // Check if this is a balance payment (bookingAmount is 0) or if there's no remaining amount
        // Use parseFloat to handle string decimals ("0.00" vs "0")
        const currentBookingAmount = parseFloat(transaction.bookingAmount || "0");
        const currentRemainingAmount = parseFloat(transaction.remainingAmount || "0");

        // Logic Re-evaluation:
        // 1. If remaining amount is <= 0, it means everything is paid. Mark as SOLD.
        // 2. If it's a balance payment (bookingAmount is 0/null), it implies this transaction IS the balance payment logic.
        // But wait, if paymentType is 'cash_booking', it can be EITHER a token payment OR a balance payment.

        // Better heuristic:
        // If currentRemainingAmount is initially 0, it's a full payment.
        // If currentRemainingAmount > 0, it's a partial booking.

        // HOWEVER, we are confirming the *current* payment.
        // If the transaction represents a BOOKING (partial), after confirmation, the status should be APPROVED (not SOLD), and remaining should stay as is (or be calculated if we were updating amounts, but here we just confirm the event).
        // Actually, the previous logic was setting `remainingAmount = 0` if it thought it was a full payment.

        if (currentRemainingAmount <= 0) {
            // Already fully paid or intended as full payment
            newRemaining = "0";
            vehicleStatus = "sold";
        } else {
            // It has a remaining balance, so it's a partial booking confirmation
            // Keep the existing remaining amount (ensure strict string for DB)
            newRemaining = transaction.remainingAmount;
            vehicleStatus = "approved";
        }

        // Special case: If this was a "cash_booking" where they paid the BALANCE (bookingAmount was set to 0 in creating logic for balance payments)
        // In create-checkout for cash balance: bookingAmount="0", remainingAmount=amountToPay (which is the balance).
        // Wait, if I pay balance, remainingAmount in the new transaction record is actually... let's check create-checkout.
        // For cash_balance: bookingAmount="0", remainingAmount=remaining (the balance amount).
        // So if bookingAmount is 0, it DOES NOT mean full payment. It means this specific transaction record captures the "balance" component.
        // But if I confirm this "balance" transaction, then the TOTAL remaining amount for the CAR should become 0.

        if (currentBookingAmount === 0 && transaction.paymentType === "cash_booking") {
            // This is a balance payment confirmation.
            newRemaining = "0";
            vehicleStatus = "sold";
        }

        // Update transaction as completed
        await db
            .update(transactions)
            .set({
                status: "payment_completed",
                razorpayPaymentId: upiTransactionId || transaction.razorpayPaymentId,
                updatedAt: new Date(),
                remainingAmount: newRemaining,
            })
            .where(eq(transactions.id, transactionId));

        // Update vehicle status
        if (transaction.vehicleId) {
            await db
                .update(vehicles)
                .set({
                    status: vehicleStatus,
                    updatedAt: new Date(),
                })
                .where(eq(vehicles.id, transaction.vehicleId));
        }

        res.json({
            success: true,
            message: "Booking confirmed successfully",
            transactionId: transaction.id,
        });

    } catch (error) {
        console.error("Error confirming booking:", error);
        res.status(500).json({ error: "Failed to confirm booking" });
    }
});
// Update delivery status (Admin only)
router.put("/:id/delivery-status", requireAuth, async (req: Request, res: Response) => {
    try {
        if ((req.user as any).role !== "admin") {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const transactionId = req.params.id as string;
        const { deliveryStatus, estimatedReadyDate, deliveryNotes } = req.body;

        if (!deliveryStatus) {
            return res.status(400).json({ error: "Status is required" });
        }

        const [updatedTxn] = await db
            .update(transactions)
            .set({
                deliveryStatus,
                estimatedReadyDate: estimatedReadyDate ? new Date(estimatedReadyDate) : null,
                deliveryNotes,
                updatedAt: new Date(),
            })
            .where(eq(transactions.id, transactionId))
            .returning();

        if (!updatedTxn) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        res.json({ success: true, message: "Delivery status updated", transaction: updatedTxn });
    } catch (error) {
        console.error("Error updating delivery status:", error);
        res.status(500).json({ error: "Failed to update delivery status" });
    }
});

// Confirm Collection (Buyer only)
router.post("/:id/confirm-collection", requireAuth, async (req: Request, res: Response) => {
    try {
        const transactionId = req.params.id as string;
        const userId = req.user!.id;

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        if (transaction.buyerId !== userId) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        if (transaction.deliveryStatus !== "ready_for_collection") {
            return res.status(400).json({ error: "Vehicle is not ready for collection" });
        }

        const [updatedTxn] = await db
            .update(transactions)
            .set({
                deliveryStatus: "collected",
                collectedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(transactions.id, transactionId))
            .returning();

        res.json({ success: true, message: "Collection confirmed", transaction: updatedTxn });
    } catch (error) {
        console.error("Error confirming collection:", error);
        res.status(500).json({ error: "Failed to confirm collection" });
    }
});

// Webhook endpoint for Stripe
// Note: This needs raw body parsing - ensure express.raw() middleware is used for this route
router.post("/webhook", async (req: Request, res: Response) => {
    try {
        const signature = req.headers["stripe-signature"] as string;

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
                await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
                break;
            case "checkout.session.expired":
                await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
                break;
            case "payment_intent.payment_failed":
                await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
                break;
            default:
                console.log("Unhandled webhook event:", event.type);
        }

        res.json({ received: true });
    } catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const sessionId = session.id;
    const metadata = session.metadata as unknown as StripeCheckoutMetadata;

    // Find transaction by session ID
    const transaction = await db.query.transactions.findFirst({
        where: eq(transactions.razorpayOrderId, sessionId),
    });

    if (!transaction) {
        console.error("Transaction not found for session:", sessionId);
        return;
    }

    // Update transaction as successful - set remainingAmount to 0 for completed payments
    await db
        .update(transactions)
        .set({
            status: "payment_completed",
            razorpayPaymentId: session.payment_intent as string,
            paymentMethod: "stripe",
            remainingAmount: "0",
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

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
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

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
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
router.post("/verify", requireAuth, async (req: Request, res: Response) => {
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
        } else if (sessionId) {
            transaction = await db.query.transactions.findFirst({
                where: eq(transactions.razorpayOrderId, sessionId),
            });
        }

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        if (transaction.buyerId !== req.user!.id) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        // Check payment status with Stripe API
        try {
            const session = await stripe.checkout.sessions.retrieve(
                transaction.razorpayOrderId || sessionId || ""
            );

            if (session.payment_status === "paid") {
                // Update transaction as successful if not already
                if (transaction.status !== "payment_completed") {
                    await db
                        .update(transactions)
                        .set({
                            status: "payment_completed",
                            razorpayPaymentId: session.payment_intent as string,
                            paymentMethod: "stripe",
                            remainingAmount: "0",
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
            } else if (session.status === "expired") {
                await db
                    .update(transactions)
                    .set({
                        status: "cancelled",
                        paymentErrorDescription: "Checkout session expired",
                        updatedAt: new Date(),
                    })
                    .where(eq(transactions.id, transaction.id));

                return res.status(400).json({ error: "Checkout session expired" });
            } else {
                return res.json({
                    success: false,
                    message: "Payment is still pending",
                    status: session.payment_status,
                });
            }
        } catch (apiError) {
            console.error("Error fetching payment status:", apiError);
            // If we can't verify, return current transaction status
            return res.json({
                success: transaction.status === "payment_completed",
                message: "Could not verify payment status",
                currentStatus: transaction.status,
            });
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ error: "Failed to verify payment" });
    }
});

// Handle payment failure (called from frontend)
router.post("/failed", requireAuth, async (req: Request, res: Response) => {
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

        if (transaction.buyerId !== req.user!.id) {
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
    } catch (error) {
        console.error("Error recording payment failure:", error);
        res.status(500).json({ error: "Failed to record payment failure" });
    }
});

// Get user's transactions (purchased vehicles)
router.get("/my-purchases", requireAuth, async (req: Request, res: Response) => {
    try {
        const userTransactions = await db.query.transactions.findMany({
            where: eq(transactions.buyerId, req.user!.id),
            orderBy: [desc(transactions.createdAt)],
        });

        // Get vehicle, buyer and seller details for each transaction
        const purchasesWithDetails = await Promise.all(
            userTransactions.map(async (transaction) => {
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
            })
        );

        res.json(purchasesWithDetails);
    } catch (error) {
        console.error("Error fetching purchases:", error);
        res.status(500).json({ error: "Failed to fetch purchases" });
    }
});

// Get user's sales (as seller)
router.get("/my-sales", requireAuth, async (req: Request, res: Response) => {
    try {
        const userSales = await db.query.transactions.findMany({
            where: eq(transactions.sellerId, req.user!.id),
            orderBy: [desc(transactions.createdAt)],
        });

        // Get vehicle and buyer details for each transaction
        const salesWithDetails = await Promise.all(
            userSales.map(async (transaction) => {
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
            })
        );

        res.json(salesWithDetails);
    } catch (error) {
        console.error("Error fetching sales:", error);
        res.status(500).json({ error: "Failed to fetch sales" });
    }
});

// Get single transaction details
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, id),
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        // Check if user is buyer or seller
        if (transaction.buyerId !== req.user!.id && transaction.sellerId !== req.user!.id) {
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
    } catch (error) {
        console.error("Error fetching transaction:", error);
        res.status(500).json({ error: "Failed to fetch transaction" });
    }
});

// Update delivery status (seller can update after sale is complete)
router.put("/:id/delivery-status", requireAuth, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { deliveryStatus, estimatedReadyDate, deliveryNotes } = req.body;

        if (!deliveryStatus) {
            return res.status(400).json({ error: "Delivery status is required" });
        }

        const validStatuses = ["processing", "inspection", "documentation", "ready_for_collection", "collected"];
        if (!validStatuses.includes(deliveryStatus)) {
            return res.status(400).json({ error: "Invalid delivery status" });
        }

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, id),
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        // Only seller or admin can update delivery status
        const user = req.user as any;
        if (transaction.sellerId !== user.id && user.role !== "admin") {
            return res.status(403).json({ error: "Only the seller can update delivery status" });
        }

        // Transaction must be completed/paid
        if (transaction.status !== "payment_completed" && transaction.status !== "completed") {
            return res.status(400).json({ error: "Cannot update delivery status for unpaid transactions" });
        }

        // Build update object
        const updateData: any = {
            deliveryStatus,
            updatedAt: new Date(),
        };

        if (estimatedReadyDate) {
            updateData.estimatedReadyDate = new Date(estimatedReadyDate);
        }

        if (deliveryNotes !== undefined) {
            updateData.deliveryNotes = deliveryNotes;
        }

        const [updated] = await db
            .update(transactions)
            .set(updateData)
            .where(eq(transactions.id, id))
            .returning();

        // Fetch full transaction with details
        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, updated.vehicleId),
        });

        const buyer = await db.query.users.findFirst({
            where: eq(users.id, updated.buyerId),
            columns: { id: true, name: true, email: true, phone: true },
        });

        res.json({
            success: true,
            message: deliveryStatus === "ready_for_collection"
                ? "Vehicle is ready for collection! Buyer has been notified."
                : "Delivery status updated successfully",
            transaction: { ...updated, vehicle, buyer },
        });
    } catch (error) {
        console.error("Error updating delivery status:", error);
        res.status(500).json({ error: "Failed to update delivery status" });
    }
});

// Confirm vehicle collection (buyer marks as collected)
router.post("/:id/confirm-collection", requireAuth, async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, id),
        });

        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        // Only buyer can confirm collection
        if (transaction.buyerId !== req.user!.id) {
            return res.status(403).json({ error: "Only the buyer can confirm collection" });
        }

        // Check if ready for collection
        if (transaction.deliveryStatus !== "ready_for_collection") {
            return res.status(400).json({ error: "Vehicle is not ready for collection yet" });
        }

        const [updated] = await db
            .update(transactions)
            .set({
                deliveryStatus: "collected",
                collectedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(transactions.id, id))
            .returning();

        // Fetch full transaction with details
        const vehicle = await db.query.vehicles.findFirst({
            where: eq(vehicles.id, updated.vehicleId),
        });

        const seller = await db.query.users.findFirst({
            where: eq(users.id, updated.sellerId),
            columns: { id: true, name: true, phone: true },
        });

        res.json({
            success: true,
            message: "Congratulations! Vehicle collection confirmed. Enjoy your new car! 🚗",
            transaction: { ...updated, vehicle, seller },
        });
    } catch (error) {
        console.error("Error confirming collection:", error);
        res.status(500).json({ error: "Failed to confirm collection" });
    }
});

export default router;
