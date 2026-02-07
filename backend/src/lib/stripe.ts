import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("⚠️ Stripe credentials not configured. Payment features will not work.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Webhook signature verification
export const verifyStripeWebhook = (
    payload: string | Buffer,
    signature: string
): Stripe.Event | null => {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.warn("⚠️ Stripe webhook secret not configured");
        return null;
    }

    try {
        const event = stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        return event;
    } catch (error) {
        console.error("Webhook verification failed:", error);
        return null;
    }
};

export interface StripeCheckoutMetadata {
    vehicleId: string;
    buyerId: string;
    sellerId: string;
    vehicleName: string;
    originalAmount: string;
}
