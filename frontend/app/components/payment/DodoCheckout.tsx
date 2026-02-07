import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { paymentsApi, type Vehicle } from "~/lib/api";
import { ShoppingCart, Loader2, CheckCircle, XCircle, ExternalLink, CreditCard } from "lucide-react";

interface StripeCheckoutProps {
    vehicle: Vehicle;
    onSuccess?: (transactionId: string) => void;
    onClose?: () => void;
}

export function StripeCheckout({ vehicle, onSuccess, onClose }: StripeCheckoutProps) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [checkoutUrl, setCheckoutUrl] = useState<string>("");
    const [transactionId, setTransactionId] = useState<string>("");
    const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
    const [error, setError] = useState<string>("");

    const formatPrice = (price: string) => {
        const num = parseFloat(price);
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const handleBuyNow = async () => {
        setIsOpen(true);
        setIsLoading(true);
        setPaymentStatus("idle");
        setError("");
        setCheckoutUrl("");

        try {
            // Create checkout session
            const response = await paymentsApi.createCheckout(vehicle.id);

            setTransactionId(response.transactionId);
            setCheckoutUrl(response.checkoutUrl || "");
            setIsLoading(false);

            if (response.checkoutUrl) {
                // Redirect to Stripe checkout (same tab for better UX)
                window.location.href = response.checkoutUrl;
            } else {
                setPaymentStatus("failed");
                setError("Failed to get checkout URL");
            }
        } catch (err: any) {
            setIsLoading(false);
            setPaymentStatus("failed");
            setError(err.message || "Failed to initiate payment");
        }
    };

    const handleCheckPaymentStatus = async () => {
        if (!transactionId) return;

        setIsLoading(true);
        try {
            const result = await paymentsApi.verifyPayment({
                transactionId,
                razorpayOrderId: "",
                razorpayPaymentId: "",
                razorpaySignature: "",
            });

            if (result.success) {
                setPaymentStatus("success");
                onSuccess?.(transactionId);
            } else {
                setPaymentStatus("processing");
            }
        } catch (err) {
            setPaymentStatus("processing");
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        onClose?.();
        if (paymentStatus === "success") {
            navigate("/buyer/purchases");
        }
    };

    const handleViewPurchases = () => {
        setIsOpen(false);
        navigate("/buyer/purchases");
    };

    return (
        <>
            <Button
                onClick={handleBuyNow}
                className="w-full gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-lg py-6"
            >
                <ShoppingCart className="h-5 w-5" />
                Buy Now - {formatPrice(vehicle.price)}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {paymentStatus === "success"
                                ? "Payment Successful!"
                                : paymentStatus === "failed"
                                    ? "Payment Failed"
                                    : paymentStatus === "processing"
                                        ? "Complete Your Payment"
                                        : "Processing..."}
                        </DialogTitle>
                        <DialogDescription>
                            {vehicle.year} {vehicle.make} {vehicle.model} - {formatPrice(vehicle.price)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center py-8">
                        {isLoading && paymentStatus === "idle" && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                                <p className="mt-4 text-slate-600 font-medium">Processing payment...</p>
                            </div>
                        )}

                        {paymentStatus === "processing" && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="rounded-full bg-blue-100 p-4">
                                    <CreditCard className="h-12 w-12 text-blue-600" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-lg mb-2">Complete Payment</p>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        You are being redirected to Stripe to complete your payment.
                                        <br />
                                        Please do not close this page.
                                    </p>
                                </div>

                                {checkoutUrl && (
                                    <Button
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => window.location.href = checkoutUrl}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Continue to Payment
                                    </Button>
                                )}

                                <div className="flex gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={handleCheckPaymentStatus}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        Check Payment Status
                                    </Button>
                                    <Button onClick={handleViewPurchases}>
                                        View Purchases
                                    </Button>
                                </div>
                            </div>
                        )}

                        {paymentStatus === "success" && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="rounded-full bg-green-100 p-4">
                                    <CheckCircle className="h-12 w-12 text-green-600" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-lg">Congratulations!</p>
                                    <p className="text-muted-foreground">
                                        You have successfully purchased this vehicle.
                                    </p>
                                </div>
                                <Button onClick={handleClose} className="mt-4">
                                    View My Purchases
                                </Button>
                            </div>
                        )}

                        {paymentStatus === "failed" && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="rounded-full bg-red-100 p-4">
                                    <XCircle className="h-12 w-12 text-red-600" />
                                </div>
                                <div className="text-center">
                                    <p className="font-semibold text-lg">Payment Failed</p>
                                    <p className="text-muted-foreground">{error}</p>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button variant="outline" onClick={handleClose}>
                                        Close
                                    </Button>
                                    <Button onClick={handleBuyNow}>Try Again</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Export with DodoCheckout alias for backwards compatibility
export { StripeCheckout as DodoCheckout };
