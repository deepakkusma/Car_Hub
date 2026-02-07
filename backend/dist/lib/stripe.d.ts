import Stripe from "stripe";
export declare const stripe: Stripe;
export declare const verifyStripeWebhook: (payload: string | Buffer, signature: string) => Stripe.Event | null;
export interface StripeCheckoutMetadata {
    vehicleId: string;
    buyerId: string;
    sellerId: string;
    vehicleName: string;
    originalAmount: string;
}
