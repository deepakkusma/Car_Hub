import DodoPayments from "dodopayments";
import { Webhook } from "standardwebhooks";

if (!process.env.DODO_PAYMENTS_API_KEY) {
    console.warn("⚠️ DodoPay credentials not configured. Payment features will not work.");
}

// Determine environment based on NODE_ENV
const environment = process.env.NODE_ENV === "production" ? "live_mode" : "test_mode";

export const dodoPayments = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
    environment: environment,
});

// Webhook verification
export const verifyDodoWebhook = async (
    rawBody: string,
    webhookHeaders: {
        "webhook-id": string;
        "webhook-signature": string;
        "webhook-timestamp": string;
    }
): Promise<boolean> => {
    if (!process.env.DODO_WEBHOOK_KEY) {
        console.warn("⚠️ DodoPay webhook key not configured");
        return false;
    }

    try {
        const webhook = new Webhook(process.env.DODO_WEBHOOK_KEY);
        await webhook.verify(rawBody, webhookHeaders);
        return true;
    } catch (error) {
        console.error("Webhook verification failed:", error);
        return false;
    }
};

export interface DodoWebhookPayload {
    business_id: string;
    type: string;
    timestamp: string;
    data: {
        payload_type: "Payment" | "Subscription" | "Refund" | "Dispute" | "LicenseKey";
        payment_id?: string;
        status?: string;
        amount?: number;
        currency?: string;
        customer?: {
            email: string;
            name?: string;
        };
        metadata?: Record<string, string>;
    };
}
