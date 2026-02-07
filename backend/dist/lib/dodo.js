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
export const verifyDodoWebhook = async (rawBody, webhookHeaders) => {
    if (!process.env.DODO_WEBHOOK_KEY) {
        console.warn("⚠️ DodoPay webhook key not configured");
        return false;
    }
    try {
        const webhook = new Webhook(process.env.DODO_WEBHOOK_KEY);
        await webhook.verify(rawBody, webhookHeaders);
        return true;
    }
    catch (error) {
        console.error("Webhook verification failed:", error);
        return false;
    }
};
