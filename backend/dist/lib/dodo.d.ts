import DodoPayments from "dodopayments";
export declare const dodoPayments: DodoPayments;
export declare const verifyDodoWebhook: (rawBody: string, webhookHeaders: {
    "webhook-id": string;
    "webhook-signature": string;
    "webhook-timestamp": string;
}) => Promise<boolean>;
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
