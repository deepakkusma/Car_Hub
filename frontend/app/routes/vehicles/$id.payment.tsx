import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router";

import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";

function CheckoutHeader() {
    return (
        <header className="bg-white border-b sticky top-0 z-50">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2">
                    <img src="/logo.svg" alt="CarHub" className="h-8" />
                    <span className="font-bold text-xl tracking-tight hidden sm:block">CarHub</span>
                </Link>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1.5 px-3 py-1">
                        <Shield className="h-3 w-3" />
                        Secure Checkout
                    </Badge>
                </div>
            </div>
        </header>
    );
}

function OrderSummary({ vehicle, totalAmount }: { vehicle: Vehicle, totalAmount: number }) {
    const formatPrice = (price: string | number) => {
        if (!price) return "₹0";
        const num = typeof price === "string" ? parseFloat(price) : price;
        if (isNaN(num)) return "₹0";
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    return (
        <Card className="shadow-sm border bg-white sticky top-24">
            <CardHeader className="pb-4 border-b bg-slate-50/50">
                <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="flex gap-4">
                    <div className="w-24 h-20 rounded-lg bg-slate-200 overflow-hidden shrink-0 border">
                        {vehicle.images?.[0] ? (
                            <img src={getImageUrl(vehicle.images[0]) || ""} alt="Car" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No Img</div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 line-clamp-1">{vehicle.year} {vehicle.make}</h3>
                        <p className="text-sm text-slate-600 mb-1">{vehicle.model}</p>
                        <Badge variant="secondary" className="text-xs font-normal bg-white border text-slate-600">
                            {vehicle.mileage && vehicle.mileage < 500 ? "Like New" : "Pre-Owned"}
                        </Badge>
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Vehicle Price</span>
                        <span className="font-medium text-slate-900">{formatPrice(vehicle.price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Processing Fee</span>
                        <span className="text-green-600">Free</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">Total Payable</span>
                        <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
                    </div>
                </div>

                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex gap-3 items-start">
                    <Shield className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-700">
                        <p className="font-semibold mb-0.5">Purchase Protection</p>
                        This transaction is secured by CarHub Guarantee.
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
import {
    paymentsApi,
    vehiclesApi,
    type Vehicle,
    type PaymentType,
    type UpiCheckoutResponse,
    type CashBookingResponse,
    type SplitPaymentResponse,
} from "~/lib/api";
import { useSession } from "~/lib/auth-client";
import {
    ShoppingCart,
    Loader2,
    CheckCircle,
    XCircle,
    CreditCard,
    QrCode,
    Banknote,
    Phone,
    Copy,
    ExternalLink,
    IndianRupee,
    Split,
    ArrowRight,
    ArrowLeft,
    Shield,
    Sparkles,
    Zap,
    Clock,
    ChevronRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "~/lib/utils";

// Payment methods shown to the buyer
// - "card" → full amount by card (Stripe)
// - "cash" → token now, remaining in cash on delivery
// - "upi_cash_card" → enter UPI + Cash amounts, remaining via card
// - "advance_upi" → 5% booking by card
type PaymentMethod = "card" | "cash" | "upi_cash_card" | "advance_upi";

interface PaymentStep {
    label: string;
    description: string;
}

export default function PaymentPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isBookingMode = searchParams.get("mode") === "booking";
    const { data: session, isPending: isSessionLoading } = useSession();

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [bookingMethod, setBookingMethod] = useState<"card" | "upi" | "cash">("card");
    const [bookingData, setBookingData] = useState<any | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
    const [error, setError] = useState<string>("");

    // Manual split amounts (remaining handled by card)
    const [upiAmount, setUpiAmount] = useState<string>("");
    const [cashAmount, setCashAmount] = useState<string>("");

    // Payment responses
    const [upiData, setUpiData] = useState<UpiCheckoutResponse | null>(null);
    const [cashData, setCashData] = useState<CashBookingResponse | null>(null);
    const [splitData, setSplitData] = useState<SplitPaymentResponse | null>(null);

    // UPI confirmation
    const [upiTransactionId, setUpiTransactionId] = useState("");

    // Split manual verification (UPI/Cash step before enabling card payment)
    const [splitManualVerified, setSplitManualVerified] = useState(false);
    const [splitManualTxnId, setSplitManualTxnId] = useState("");

    const [existingBooking, setExistingBooking] = useState<any | null>(null);

    useEffect(() => {
        if (id) {
            fetchVehicle();
            checkExistingBooking();
        }
    }, [id]);

    useEffect(() => {
        // Redirect if not logged in or if seller
        if (!isSessionLoading) {
            if (!session?.user) {
                navigate(`/login?redirect=/vehicles/${id}/payment`);
                return;
            }
            if ((session.user as any).role === "seller") {
                navigate(`/vehicles/${id}`);
                return;
            }
            // Auto-select booking if mode is booking
            if (isBookingMode && !selectedMethod) {
                setSelectedMethod("advance_upi");
            }
        }
    }, [session, isSessionLoading, id, navigate, isBookingMode]);

    const fetchVehicle = async () => {
        setIsLoading(true);
        try {
            const data = await vehiclesApi.getById(id!);
            setVehicle(data);
        } catch (error) {
            console.error("Failed to fetch vehicle:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkExistingBooking = async () => {
        try {
            const purchases = await paymentsApi.getMyPurchases();
            const booking = purchases.find(p => p.vehicleId === id &&
                (p.status === "payment_completed" || p.status === "completed" || p.status === "payment_initiated" || p.status === "pending") &&
                p.remainingAmount && parseFloat(p.remainingAmount) > 0
            );
            if (booking) {
                setExistingBooking(booking);
            }
        } catch (error) {
            console.error("Failed to check existing booking:", error);
        }
    };

    const formatPrice = (price: number | string) => {
        const num = typeof price === "string" ? parseFloat(price) : price;
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const vehiclePrice = vehicle ? parseFloat(vehicle.price) : 0;
    const tokenAmount = 5000;
    const isBookingActive = !!existingBooking;
    const amountToPay = isBookingActive ? parseFloat(existingBooking.remainingAmount) : vehiclePrice;

    const getImageUrl = (url: string) => {
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleSelectMethod = (method: PaymentMethod) => {
        setSelectedMethod(method);
        setError("");
        setUpiAmount("");
        setCashAmount("");
        setUpiData(null);
        setCashData(null);
        setSplitData(null);
        setSplitManualVerified(false);
        setSplitManualTxnId("");
        setPaymentStatus("idle");
        setBookingData(null);
    };

    const handleBack = () => {
        if (selectedMethod) {
            setSelectedMethod(null);
            setPaymentStatus("idle");
            setError("");
        } else {
            navigate(`/vehicles/${id}`);
        }
    };

    const handleProceed = async () => {
        if (!vehicle) return;

        setIsProcessing(true);
        setError("");
        setSplitManualVerified(false);
        setSplitManualTxnId("");

        const previousTransactionId = existingBooking?.id;

        try {
            switch (selectedMethod) {
                case "card": {
                    const response = await paymentsApi.createCheckout(vehicle.id, "full_card", { previousTransactionId });
                    if (response.paymentType === "full_card" && response.checkoutUrl) {
                        window.location.href = response.checkoutUrl;
                    } else {
                        setError("Failed to get checkout URL");
                    }
                    break;
                }

                case "cash": {
                    const response = await paymentsApi.createCheckout(vehicle.id, "cash_booking", { previousTransactionId });
                    if (response.paymentType === "cash_booking") {
                        setCashData(response);
                        setPaymentStatus("processing");
                    }
                    break;
                }

                case "upi_cash_card": {
                    const upi = parseFloat(upiAmount) || 0;
                    const cash = parseFloat(cashAmount) || 0;
                    const totalManual = upi + cash;

                    // Limit is total price to pay (balance or full)
                    const limitAmount = existingBooking ? parseFloat(existingBooking.remainingAmount) : vehiclePrice;

                    if (totalManual <= 0) {
                        setError("Please enter at least one amount (UPI or Cash).");
                        setIsProcessing(false);
                        return;
                    }
                    if (upi < 0 || cash < 0) {
                        setError("Amounts cannot be negative.");
                        setIsProcessing(false);
                        return;
                    }
                    if (totalManual >= limitAmount) {
                        setError("UPI + Cash must be less than the total amount to pay (remaining will be paid by Card).");
                        setIsProcessing(false);
                        return;
                    }

                    const response = await paymentsApi.createCheckout(vehicle.id, "split_qr", {
                        qrAmount: upi > 0 ? upi : undefined,
                        cashAmount: cash > 0 ? cash : undefined,
                        previousTransactionId,
                    });
                    if (response.paymentType === "split_qr") {
                        setSplitData(response);
                        setPaymentStatus("processing");
                    }
                    break;
                }

                case "advance_upi": {
                    // This method should not be selectable if booking exists, but keeping safety check is fine
                    if (isBookingActive) {
                        setError("Booking already active. Please pay balance.");
                        setIsProcessing(false);
                        return;
                    }
                    const response = await paymentsApi.createCheckout(vehicle.id, "advance_upi", { bookingMethod });
                    // Handle Card (redirection)
                    if (bookingMethod === "card") {
                        if (response.paymentType === "advance_upi" && (response as any).checkoutUrl) {
                            window.location.href = (response as any).checkoutUrl;
                        } else {
                            setError("Failed to get checkout URL");
                        }
                    }
                    // Handle UPI/Cash (show details)
                    else {
                        setBookingData(response);
                        setPaymentStatus("processing");
                    }
                    break;
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to process payment");
            setPaymentStatus("failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVerifySplitManual = async () => {
        if (!splitData) return;
        if (splitData.paymentType === "split_qr" && !splitManualTxnId.trim()) {
            setError("Please enter UPI Transaction ID after payment");
            return;
        }

        setIsProcessing(true);
        setError("");
        try {
            const result = await paymentsApi.verifyManual(splitData.transactionId, splitManualTxnId.trim() || undefined);
            if (result.success) {
                setSplitManualVerified(true);
            } else {
                setError(result.message || "Failed to verify manual payment");
            }
        } catch (err: any) {
            console.error("Verification error:", err);
            const msg = err.data?.error || err.message || "Failed to verify manual payment";
            setError(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmCashBooking = async () => {
        if (!cashData) return;
        setPaymentStatus("success");
    };

    const handleConfirmUpiPayment = async () => {
        if (!upiData || !upiTransactionId.trim()) return;

        setIsProcessing(true);
        try {
            const result = await paymentsApi.confirmBooking(upiData.transactionId, upiTransactionId);
            if (result.success) {
                setPaymentStatus("success");
            } else {
                setError("Failed to confirm payment");
            }
        } catch (err: any) {
            setError(err.message || "Failed to confirm payment");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmBookingPayment = async () => {
        if (!bookingData || !upiTransactionId.trim()) return;

        setIsProcessing(true);
        try {
            const result = await paymentsApi.confirmBooking(bookingData.transactionId, upiTransactionId);
            if (result.success) {
                setPaymentStatus("success");
            } else {
                setError("Failed to confirm payment");
            }
        } catch (err: any) {
            setError(err.message || "Failed to confirm payment");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleViewPurchases = () => {
        navigate("/buyer/purchases");
    };

    // Payment method cards data (simplified to Cash / UPI / Card)
    const paymentMethods = [
        {
            id: "card" as PaymentMethod,
            title: isBookingActive ? "Pay Balance (Card)" : "Card Payment",
            description: isBookingActive ? "Pay the remaining balance using your credit/debit card" : "Pay the complete amount using your credit/debit card",
            icon: CreditCard,
            gradient: "from-blue-500 to-indigo-600",
            bgGradient: "from-blue-50 to-indigo-50",
            borderColor: "border-blue-200 hover:border-blue-400",
            badge: "Recommended",
            badgeColor: "bg-blue-100 text-blue-700",
            amount: formatPrice(amountToPay),
        },
        {
            id: "cash" as PaymentMethod,
            title: isBookingActive ? "Pay Balance (Cash)" : "Cash Payment",
            description: isBookingActive ? "Pay the remaining balance in cash on delivery" : `Pay ₹${tokenAmount.toLocaleString()} token now, remaining in cash on delivery`,
            icon: Banknote,
            gradient: "from-green-500 to-teal-600",
            bgGradient: "from-green-50 to-teal-50",
            borderColor: "border-green-200 hover:border-green-400",
            badge: "Cash",
            badgeColor: "bg-green-100 text-green-700",
            amount: formatPrice(isBookingActive ? amountToPay : vehiclePrice),
        },
        {
            id: "upi_cash_card" as PaymentMethod,
            title: isBookingActive ? "Pay Balance (Split)" : "Cash + UPI + Card",
            description: isBookingActive ? "Split the remaining balance across payment methods" : "Enter cash + UPI amounts, pay the remaining balance via card",
            icon: QrCode,
            gradient: "from-purple-500 to-pink-600",
            bgGradient: "from-purple-50 to-pink-50",
            borderColor: "border-purple-200 hover:border-purple-400",
            badge: "Split",
            badgeColor: "bg-purple-100 text-purple-700",
            amount: "Flexible",
        },
        // Only show Book Now if NO active booking exists
        ...(!isBookingActive ? [
            {
                id: "advance_upi" as PaymentMethod,
                title: "Book Now (Pay 5%)",
                description: `Pay ₹${Math.round(vehiclePrice * 0.05).toLocaleString()} now, remaining upon delivery`,
                icon: CreditCard,
                gradient: "from-blue-500 to-indigo-600",
                bgGradient: "from-blue-50 to-slate-50",
                borderColor: "border-amber-200 hover:border-amber-400",
                badge: "Booking",
                badgeColor: "bg-amber-100 text-amber-700",
                amount: formatPrice(Math.round(vehiclePrice * 0.05)),
            },
        ] : []),
    ];

    if (isLoading || isSessionLoading) {
        return (
            <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
                {/* Header removed */}
                <main className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                        <p className="text-muted-foreground">Loading payment options...</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
                {/* Header removed */}
                <main className="flex-1 container mx-auto px-4 py-16 text-center">
                    <h1 className="text-2xl font-bold mb-4">Vehicle Not Found</h1>
                    <p className="text-muted-foreground mb-6">
                        The vehicle you're looking for doesn't exist or has been removed.
                    </p>
                    <Button asChild>
                        <Link to="/vehicles">Browse Vehicles</Link>
                    </Button>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50/50">
            {/* Header removed for distraction-free checkout */}

            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Left Column: Payment Methods & Forms */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="-ml-2 mb-2">
                            <Button
                                variant="ghost"
                                className="hover:bg-transparent hover:text-primary p-0 h-auto font-medium text-slate-500"
                                onClick={handleBack}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                {selectedMethod ? "Back to Payment Options" : "Back to Vehicle"}
                            </Button>
                        </div>
                        {/* Payment Success */}
                        {paymentStatus === "success" && (
                            <Card className="max-w-2xl mx-auto border-green-200 bg-green-50/50">
                                <CardContent className="py-12 text-center">
                                    {/* If cash/manual repayment, show "Waiting for Approval" */}
                                    {(selectedMethod === "cash" || selectedMethod === "upi_cash_card") && isBookingActive ? (
                                        <>
                                            <div className="rounded-full bg-amber-100 p-4 inline-flex items-center justify-center mb-6 ring-8 ring-amber-50">
                                                <Clock className="h-12 w-12 text-amber-600" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-slate-900 mb-3">Payment Waiting for Approval</h2>
                                            <p className="text-slate-600 mb-8 max-w-md mx-auto">
                                                Your payment details have been sent. Please wait for the seller to verify and approve the payment to complete the sale.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="rounded-full bg-green-100 p-4 inline-flex items-center justify-center mb-6 ring-8 ring-green-50">
                                                <CheckCircle className="h-12 w-12 text-green-600" />
                                            </div>
                                            <h2 className="text-2xl font-bold text-slate-900 mb-3">Booking Confirmed!</h2>
                                            <p className="text-slate-600 mb-8 max-w-md mx-auto">
                                                Your booking has been confirmed successfully. You can track your purchase in the dashboard.
                                            </p>
                                        </>
                                    )}

                                    <div className="flex gap-4 justify-center">
                                        <Button variant="outline" onClick={() => navigate(`/vehicles/${id}`)}>
                                            View Vehicle
                                        </Button>
                                        <Button
                                            onClick={handleViewPurchases}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            View My Purchases
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Payment Failed */}
                        {paymentStatus === "failed" && (
                            <Card className="max-w-2xl mx-auto border-red-200 bg-red-50/50">
                                <CardContent className="py-12 text-center">
                                    <div className="rounded-full bg-red-100 p-4 inline-flex items-center justify-center mb-6 ring-8 ring-red-50">
                                        <XCircle className="h-12 w-12 text-red-600" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Failed</h2>
                                    <p className="text-slate-600 mb-2 font-medium">{error}</p>
                                    <p className="text-slate-500 text-sm mb-8">Please try again or choose a different payment method.</p>
                                    <div className="flex gap-4 justify-center">
                                        <Button variant="outline" onClick={() => navigate(`/vehicles/${id}`)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setPaymentStatus("idle");
                                                setError("");
                                                setSelectedMethod(null);
                                            }}
                                            variant="destructive"
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Payment Method Selection */}
                        {paymentStatus === "idle" && !selectedMethod && (
                            <div className="max-w-5xl mx-auto">
                                <div className="text-center mb-10">
                                    <h2 className="text-3xl font-bold text-slate-900 mb-3">Secure Checkout</h2>
                                    <p className="text-slate-500 text-lg">
                                        Select your preferred payment method to proceed
                                    </p>
                                </div>

                                {/* Features */}
                                <div className="flex justify-center gap-8 mb-10">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                        <Shield className="h-4 w-4 text-primary" />
                                        <span>Bank-Grade Security</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                        <Zap className="h-4 w-4 text-primary" />
                                        <span>Instant Confirmation</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        <span>No Hidden Fees</span>
                                    </div>
                                </div>

                                {/* Payment Options Grid */}
                                <RadioGroup
                                    value={selectedMethod || ""}
                                    onValueChange={(value) => handleSelectMethod(value as PaymentMethod)}
                                    className="grid md:grid-cols-2 lg:grid-cols-2 gap-6"
                                >
                                    {paymentMethods.map((method) => (
                                        <div key={method.id} className="relative">
                                            <RadioGroupItem
                                                value={method.id}
                                                id={method.id}
                                                className="peer sr-only"
                                            />
                                            <Label
                                                htmlFor={method.id}
                                                className={cn(
                                                    "flex flex-col h-full bg-white border-2 rounded-xl p-6 cursor-pointer transition-all duration-200",
                                                    "hover:border-primary/50 hover:shadow-md",
                                                    "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md"
                                                )}
                                            >
                                                <div className="flex items-start gap-4 mb-4">
                                                    <div className={cn("p-2 rounded-lg bg-slate-100",
                                                        method.id === 'card' ? "text-blue-600" :
                                                            method.id === 'cash' ? "text-green-600" :
                                                                method.id === 'upi_cash_card' ? "text-purple-600" : "text-amber-600"
                                                    )}>
                                                        <method.icon className="h-6 w-6" />
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-slate-900">{method.title}</span>
                                                            {method.badge && (
                                                                <Badge variant="secondary" className={cn("text-xs font-normal", method.badgeColor)}>
                                                                    {method.badge}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-500 leading-snug">
                                                            {method.description}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-100/50">
                                                    <span className="text-lg font-bold text-slate-900">
                                                        {method.amount}
                                                    </span>
                                                    <div className="group-hover:translate-x-1 transition-transform">
                                                        <ArrowRight className="h-4 w-4 text-slate-400 peer-data-[state=checked]:text-primary" />
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>

                                {/* Info Box */}
                                <Alert className="mt-8 bg-blue-50/50 border-blue-100">
                                    <Clock className="h-4 w-4 text-blue-600" />
                                    <AlertTitle className="text-blue-800 font-semibold ml-2">Flexible Payment Options</AlertTitle>
                                    <AlertDescription className="text-blue-600 ml-2">
                                        You can split your payment across multiple methods (Cash + UPI + Card) for maximum convenience.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}

                        {/* Payment Method Details */}
                        {paymentStatus === "idle" && selectedMethod && !isProcessing && (
                            <div className="max-w-2xl mx-auto">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-3">
                                            {selectedMethod === "card" && <CreditCard className="h-6 w-6 text-blue-500" />}
                                            {selectedMethod === "cash" && <Banknote className="h-6 w-6 text-green-500" />}
                                            {selectedMethod === "card" && <CreditCard className="h-6 w-6 text-blue-500" />}
                                            {selectedMethod === "cash" && <Banknote className="h-6 w-6 text-green-500" />}
                                            {selectedMethod === "upi_cash_card" && <Split className="h-6 w-6 text-blue-500" />}
                                            {selectedMethod === "advance_upi" && <CreditCard className="h-6 w-6 text-amber-500" />}
                                            {paymentMethods.find(m => m.id === selectedMethod)?.title}
                                        </CardTitle>
                                        <CardDescription>
                                            {paymentMethods.find(m => m.id === selectedMethod)?.description}
                                        </CardDescription>
                                    </CardHeader>

                                    <CardContent className="space-y-6">
                                        {/* Full Card Payment */}
                                        {selectedMethod === "card" && (
                                            <div className="space-y-6">
                                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                                                    <p className="text-sm font-medium text-slate-500 mb-2">Total Amount to Pay</p>
                                                    <div className="text-4xl font-bold text-slate-900 mb-4">
                                                        {formatPrice(vehiclePrice)}
                                                    </div>
                                                    <Badge variant="outline" className="bg-white border-blue-200 text-blue-700 gap-1.5 pl-2 pr-3 py-1">
                                                        <Shield className="h-3 w-3 fill-blue-100" />
                                                        Secure Payment via Stripe
                                                    </Badge>
                                                </div>
                                                <Alert>
                                                    <ExternalLink className="h-4 w-4" />
                                                    <AlertDescription className="ml-2">
                                                        You will be redirected to our secure payment gateway to complete your transaction.
                                                    </AlertDescription>
                                                </Alert>
                                            </div>
                                        )}

                                        {/* Full Cash Payment */}
                                        {selectedMethod === "cash" && (
                                            <div className="space-y-6">
                                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                                                    <h4 className="font-semibold text-slate-900 mb-4">Payment Summary</h4>
                                                    {isBookingActive ? (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-slate-600">Pay on Delivery</span>
                                                            <span className="text-2xl font-bold text-slate-900">
                                                                {formatPrice(amountToPay)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-600">Token Amount (Pay Now)</span>
                                                                <span className="text-xl font-bold text-slate-900">
                                                                    {formatPrice(tokenAmount)}
                                                                </span>
                                                            </div>
                                                            <Separator className="bg-slate-200" />
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-600">Remaining (On Delivery)</span>
                                                                <span className="text-xl font-bold text-slate-900">
                                                                    {formatPrice(vehiclePrice - tokenAmount)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground text-center px-4">
                                                    {isBookingActive
                                                        ? "Confirm that you will pay the remaining balance in cash upon delivery."
                                                        : "Pay a small token amount now to book the vehicle. The rest is paid on delivery."
                                                    }
                                                </p>
                                            </div>
                                        )}

                                        {/* Cash + UPI + Card Split */}
                                        {selectedMethod === "upi_cash_card" && (
                                            <div className="space-y-8">
                                                <div className="grid gap-6 md:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium text-slate-700">Cash Amount</Label>
                                                        <div className="relative">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 bg-slate-100 rounded-md flex items-center justify-center text-slate-500">
                                                                <span className="font-bold">₹</span>
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                className="pl-14 h-11 text-lg font-medium"
                                                                placeholder="0"
                                                                value={cashAmount}
                                                                onChange={(e) => setCashAmount(e.target.value)}
                                                                min={0}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm font-medium text-slate-700">UPI/QR Amount</Label>
                                                        <div className="relative">
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 bg-slate-100 rounded-md flex items-center justify-center text-slate-500">
                                                                <QrCode className="h-4 w-4" />
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                className="pl-14 h-11 text-lg font-medium"
                                                                placeholder="0"
                                                                value={upiAmount}
                                                                onChange={(e) => setUpiAmount(e.target.value)}
                                                                min={0}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {(parseFloat(upiAmount) > 0 || parseFloat(cashAmount) > 0) ? (
                                                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                                        <div className="p-4 bg-slate-100 border-b border-slate-200">
                                                            <h4 className="font-semibold text-slate-800">Payment Breakdown</h4>
                                                        </div>
                                                        <div className="p-4 space-y-3">
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-600 flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                                                    Cash Payment
                                                                </span>
                                                                <span className="font-bold text-slate-800">
                                                                    {formatPrice(parseFloat(cashAmount) || 0)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-600 flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                                    UPI/QR Payment
                                                                </span>
                                                                <span className="font-bold text-slate-800">
                                                                    {formatPrice(parseFloat(upiAmount) || 0)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-600 flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                                    Card Payment (Remaining)
                                                                </span>
                                                                <span className="font-bold text-slate-800">
                                                                    {formatPrice(
                                                                        Math.max(0, amountToPay - (parseFloat(upiAmount) || 0) - (parseFloat(cashAmount) || 0))
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <Separator className="my-2" />
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-slate-900">Total</span>
                                                                <span className="text-xl font-bold text-primary">
                                                                    {formatPrice(amountToPay)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Alert className="bg-blue-50/50 border-blue-100">
                                                        <AlertDescription className="text-blue-700 text-center">
                                                            Enter amounts above to see the breakdown. The remaining balance will be paid via Card.
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>
                                        )}

                                        {/* Booking 5% Payment */}
                                        {selectedMethod === "advance_upi" && (
                                            <div className="space-y-8">
                                                {/* Pricing Breakdown */}
                                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                                                    <h4 className="font-semibold text-slate-900 mb-4">Payment Breakdown</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                                                                    Pay Now (5%)
                                                                </Badge>
                                                                <span className="text-slate-600">Booking Token</span>
                                                            </div>
                                                            <span className="text-2xl font-bold text-slate-900">
                                                                {formatPrice(Math.round(vehiclePrice * 0.05))}
                                                            </span>
                                                        </div>
                                                        <Separator className="bg-slate-200" />
                                                        <div className="flex justify-between items-center text-sm text-slate-500">
                                                            <span>Remaining Balance (On Delivery)</span>
                                                            <span className="font-medium text-slate-900">
                                                                {formatPrice(Math.round(vehiclePrice * 0.95))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Booking Sub-Method Selection */}
                                                <div className="space-y-4">
                                                    <Label className="text-base font-semibold text-slate-900">Select Payment Method</Label>

                                                    <RadioGroup
                                                        value={bookingMethod}
                                                        onValueChange={(val) => setBookingMethod(val as any)}
                                                        className="grid grid-cols-3 gap-4"
                                                    >
                                                        {[
                                                            { id: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600' },
                                                            { id: 'upi', label: 'UPI', icon: QrCode, color: 'text-green-600' },
                                                            { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-amber-600' }
                                                        ].map((m) => (
                                                            <div key={m.id} className="relative">
                                                                <RadioGroupItem value={m.id} id={`booking-${m.id}`} className="peer sr-only" />
                                                                <Label
                                                                    htmlFor={`booking-${m.id}`}
                                                                    className={cn(
                                                                        "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 bg-white cursor-pointer transition-all hover:bg-slate-50",
                                                                        "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:text-primary"
                                                                    )}
                                                                >
                                                                    <m.icon className={cn("h-6 w-6", m.color)} />
                                                                    <span className="font-medium">{m.label}</span>
                                                                </Label>
                                                            </div>
                                                        ))}
                                                    </RadioGroup>
                                                </div>

                                                <Alert className="bg-amber-50/50 border-amber-100">
                                                    <Shield className="h-4 w-4 text-amber-600" />
                                                    <AlertDescription className="text-amber-700 ml-2">
                                                        Secure this vehicle by paying 5% now via {bookingMethod === "card" ? "Card (Stripe)" : bookingMethod === "upi" ? "UPI QR Code" : "Cash (Token)"}.
                                                    </AlertDescription>
                                                </Alert>
                                            </div>
                                        )}

                                        {error && (
                                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                                {error}
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            <Button variant="outline" className="flex-1" onClick={handleBack}>
                                                <ArrowLeft className="h-4 w-4 mr-2" />
                                                Back
                                            </Button>
                                            <Button
                                                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                                                onClick={handleProceed}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <ArrowRight className="h-4 w-4 mr-2" />
                                                )}
                                                Proceed to Pay
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* Processing States */}
                        {isProcessing && (
                            <div className="max-w-md mx-auto text-center py-12">
                                <Loader2 className="h-16 w-16 animate-spin text-orange-500 mx-auto mb-4" />
                                <p className="text-lg text-muted-foreground">Processing your payment...</p>
                            </div>
                        )}

                        {/* Cash Booking Confirmation */}
                        {paymentStatus === "processing" && cashData && (
                            <Card className="max-w-2xl mx-auto border-green-200">
                                <CardHeader className="text-center bg-green-50/50 border-b border-green-100 py-8">
                                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                        <Banknote className="h-8 w-8 text-green-600" />
                                    </div>
                                    <CardTitle className="text-2xl text-green-900">Cash Booking Details</CardTitle>
                                    <CardDescription className="text-green-700 font-medium mt-2">{cashData.message}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-medium">
                                                {cashData.tokenAmount > 0 ? "Token Amount" : "Paid Amount"}
                                            </span>
                                            <span className="text-xl font-bold text-slate-900">
                                                {cashData.tokenAmount > 0
                                                    ? formatPrice(cashData.tokenAmount)
                                                    : formatPrice(existingBooking?.bookingAmount || 0)
                                                }
                                            </span>
                                        </div>
                                        <Separator />
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-medium">
                                                {cashData.tokenAmount > 0 ? "Pay on Delivery" : "Cash Payment"}
                                            </span>
                                            <span className="text-xl font-bold text-slate-900">
                                                {formatPrice(cashData.remainingAmount)}
                                            </span>
                                        </div>
                                        <div className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-center mt-2">
                                            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Booking Ref</span>
                                            <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-800 select-all">
                                                {cashData.bookingReference}
                                            </span>
                                        </div>
                                    </div>

                                    {cashData.sellerPhone && (
                                        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                                <Phone className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-blue-900 font-medium opacity-80">Contact Seller</p>
                                                <p className="text-lg font-bold text-blue-900">{cashData.sellerName} <span className="font-normal text-blue-700 text-base">({cashData.sellerPhone})</span></p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-4">
                                        <Button variant="outline" onClick={handleBack} className="flex-1 h-12">
                                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                                        </Button>
                                        <Button
                                            className="flex-1 h-12 bg-green-600 hover:bg-green-700"
                                            onClick={handleConfirmCashBooking}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            {cashData.tokenAmount > 0 ? "Confirm Booking" : "Confirm Payment"}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Split Payment Confirmation */}
                        {paymentStatus === "processing" && splitData && (
                            <Card className="max-w-2xl mx-auto border-orange-200">
                                <CardHeader className="text-center bg-orange-50/50 border-b border-orange-100 py-8">
                                    <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                                        <Split className="h-8 w-8 text-orange-600" />
                                    </div>
                                    <CardTitle className="text-2xl text-orange-900">Complete Split Payment</CardTitle>
                                    <CardDescription className="text-orange-800 mt-2">{splitData.message}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6">
                                    {/* QR for split_qr */}
                                    {splitData.paymentType === "split_qr" && splitData.upiLink && (
                                        <div className="flex flex-col items-center space-y-4">
                                            <div className="bg-white p-4 rounded-xl border-2 border-slate-100 shadow-sm">
                                                <QRCodeSVG value={splitData.upiLink} size={220} level="M" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-600">
                                                Scan to pay <span className="text-slate-900 font-bold">{formatPrice(splitData.manualAmount)}</span>
                                            </p>

                                            {splitData.upiId && (
                                                <div className="flex items-center gap-2 p-2 bg-slate-50 border rounded-lg px-3">
                                                    <span className="text-xs text-slate-500 font-semibold uppercase">UPI ID</span>
                                                    <span className="font-mono text-sm font-medium">{splitData.upiId}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 ml-1"
                                                        onClick={() => copyToClipboard(splitData.upiId!)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="w-full space-y-2 max-w-sm">
                                                <Label htmlFor="splitUpiTxn" className="sr-only">UPI Transaction ID</Label>
                                                <Input
                                                    id="splitUpiTxn"
                                                    className="text-center h-12"
                                                    placeholder="Enter UPI Transaction ID (e.g., 123456789012)"
                                                    value={splitManualTxnId}
                                                    onChange={(e) => {
                                                        setSplitManualTxnId(e.target.value);
                                                        setError("");
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                        <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
                                            <span className="font-semibold text-slate-700">Payment Breakdown</span>
                                            <span className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{splitData.reference}</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600">{splitData.manualPaymentType} Payment</span>
                                                <span className="font-bold text-orange-600">{formatPrice(splitData.manualAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600">Card Payment (Remaining)</span>
                                                <span className="font-bold text-blue-600">{formatPrice(splitData.remainingAmount)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {error && (
                                        <Alert variant="destructive">
                                            <XCircle className="h-4 w-4" />
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-3">
                                        <Button
                                            className={cn("w-full h-12 text-lg", splitManualVerified ? "bg-green-600 hover:bg-green-700" : "bg-slate-900 hover:bg-slate-800")}
                                            onClick={handleVerifySplitManual}
                                            disabled={isProcessing || splitManualVerified || (splitData.paymentType === "split_qr" && !splitManualTxnId.trim())}
                                        >
                                            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <div className="mr-2">{splitManualVerified ? <CheckCircle className="h-5 w-5" /> : "1."}</div>}
                                            {splitManualVerified ? "Verified Successfully" : `Verify ${splitData.manualPaymentType} Payment`}
                                        </Button>

                                        <Button
                                            className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                                            onClick={() => {
                                                if (splitData.checkoutUrl) {
                                                    window.location.href = splitData.checkoutUrl;
                                                }
                                            }}
                                            disabled={!splitManualVerified}
                                        >
                                            <div className="mr-2">2.</div>
                                            Pay Remaining via Card
                                            <ArrowRight className="h-5 w-5 ml-2" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Booking Confirmation (UPI / Cash) */}
                        {paymentStatus === "processing" && bookingData && (
                            <Card className="max-w-2xl mx-auto border-amber-200">
                                <CardHeader className="text-center bg-amber-50/50 border-b border-amber-100 py-8">
                                    <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                                        {bookingData.bookingMethod === "upi" ? (
                                            <QrCode className="h-8 w-8 text-amber-600" />
                                        ) : (
                                            <Banknote className="h-8 w-8 text-amber-600" />
                                        )}
                                    </div>
                                    <CardTitle className="text-2xl text-amber-900">
                                        {bookingData.bookingMethod === "upi" ? "Complete UPI Payment" : "Cash Booking Instructions"}
                                    </CardTitle>
                                    <CardDescription className="text-amber-800 mt-2">
                                        Booking Amount: <span className="font-bold">{formatPrice(bookingData.amount)}</span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8 pt-6">
                                    {/* UPI Booking Display */}
                                    {bookingData.bookingMethod === "upi" && bookingData.upiLink && (
                                        <div className="flex flex-col items-center space-y-6">
                                            <div className="bg-white p-4 rounded-xl border-2 border-amber-100 shadow-sm">
                                                <QRCodeSVG value={bookingData.upiLink} size={220} level="M" />
                                            </div>

                                            {bookingData.upiId && (
                                                <div className="flex items-center gap-2 p-2 bg-slate-50 border rounded-lg px-3">
                                                    <span className="text-xs text-slate-500 font-semibold uppercase">UPI ID</span>
                                                    <span className="font-mono text-sm font-medium">{bookingData.upiId}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 ml-1"
                                                        onClick={() => copyToClipboard(bookingData.upiId)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="w-full max-w-sm space-y-2">
                                                <Label htmlFor="bookingUpiTxn">Enter UPI Transaction ID</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        id="bookingUpiTxn"
                                                        className="h-11"
                                                        placeholder="e.g. 123456789012"
                                                        value={upiTransactionId}
                                                        onChange={(e) => setUpiTransactionId(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                className="w-full max-w-sm h-12 bg-amber-600 hover:bg-amber-700"
                                                onClick={() => handleConfirmBookingPayment()}
                                                disabled={!upiTransactionId.trim()}
                                            >
                                                <CheckCircle className="h-5 w-5 mr-2" />
                                                Confirm Payment
                                            </Button>
                                        </div>
                                    )}

                                    {/* Cash Booking Display */}
                                    {bookingData.bookingMethod === "cash" && (
                                        <div className="space-y-6">
                                            <div className="bg-amber-50 p-6 rounded-xl border border-amber-200">
                                                <h4 className="font-semibold text-amber-900 mb-4 flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs">1</span>
                                                    Payment Details
                                                </h4>
                                                <div className="space-y-3 pl-8">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-amber-800">Booking Amount (Now)</span>
                                                        <span className="font-bold text-amber-900">{formatPrice(bookingData.amount)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-amber-700">Remaining (On Delivery)</span>
                                                        <span className="font-medium text-amber-800">{formatPrice(bookingData.remainingAmount)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {bookingData.sellerPhone && (
                                                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                                                    <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                                        <span className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-xs">2</span>
                                                        Contact Seller
                                                    </h4>
                                                    <div className="pl-8 flex items-center gap-4">
                                                        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-blue-200 text-blue-600 bg-white">
                                                            <Phone className="h-5 w-5" />
                                                        </Button>
                                                        <div>
                                                            <p className="font-medium text-blue-900">{bookingData.sellerName}</p>
                                                            <a href={`tel:${bookingData.sellerPhone}`} className="text-xl font-bold text-blue-700 hover:underline">
                                                                {bookingData.sellerPhone}
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="text-center pt-4">
                                                <Button
                                                    className="w-full h-12"
                                                    size="lg"
                                                    onClick={() => setPaymentStatus("success")}
                                                >
                                                    I Have Contacted the Seller
                                                </Button>
                                                <p className="text-xs text-muted-foreground mt-3 px-8">
                                                    Clicking this confirms you have initiated the cash payment process with the seller.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                    </div>

                    <div className="lg:col-span-1 min-w-0">
                        <OrderSummary vehicle={vehicle} totalAmount={amountToPay} />
                    </div>
                </div>
            </main >
            <Footer />
        </div >
    );
}
