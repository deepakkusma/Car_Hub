import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
    paymentsApi,
    type Vehicle,
    type PaymentType,
    type UpiCheckoutResponse,
    type CashBookingResponse,
    type SplitPaymentResponse,
} from "~/lib/api";
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
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface PaymentOptionsProps {
    vehicle: Vehicle;
    onSuccess?: (transactionId: string) => void;
    onClose?: () => void;
}

export function PaymentOptions({ vehicle, onSuccess, onClose }: PaymentOptionsProps) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<PaymentType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
    const [error, setError] = useState<string>("");

    // UPI payment state
    const [upiData, setUpiData] = useState<UpiCheckoutResponse | null>(null);
    const [upiTransactionId, setUpiTransactionId] = useState("");

    // Cash booking state
    const [cashData, setCashData] = useState<CashBookingResponse | null>(null);

    // Split payment state
    const [splitData, setSplitData] = useState<SplitPaymentResponse | null>(null);
    const [splitQrAmount, setSplitQrAmount] = useState<string>("");
    const [splitCashAmount, setSplitCashAmount] = useState<string>("");
    const [showSplitInput, setShowSplitInput] = useState<"qr" | "cash" | null>(null);
    const [splitManualVerified, setSplitManualVerified] = useState(false);
    const [splitManualTxnId, setSplitManualTxnId] = useState("");

    // Calculate amounts early so they're available in handlers
    const vehiclePrice = parseFloat(vehicle.price);
    const advanceAmount = Math.round(vehiclePrice * 0.10);
    const tokenAmount = 5000;
    const defaultBookingAmount = 50000;

    const formatPrice = (price: number | string) => {
        const num = typeof price === "string" ? parseFloat(price) : price;
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const handleSelectPaymentMethod = async (method: PaymentType) => {
        // For split payments, first show the amount input
        if (method === "split_qr") {
            setShowSplitInput("qr");
            setSelectedMethod(method);
            return;
        }
        if (method === "split_cash") {
            setShowSplitInput("cash");
            setSelectedMethod(method);
            return;
        }

        setSelectedMethod(method);
        setIsLoading(true);
        setPaymentStatus("idle");
        setError("");
        setUpiData(null);
        setCashData(null);
        setSplitData(null);

        try {
            const response = await paymentsApi.createCheckout(vehicle.id, method);

            if (response.paymentType === "full_card") {
                // Redirect to Stripe checkout
                if (response.checkoutUrl) {
                    window.location.href = response.checkoutUrl;
                } else {
                    setPaymentStatus("failed");
                    setError("Failed to get checkout URL");
                }
            } else if (response.paymentType === "advance_upi") {
                setUpiData(response);
                setPaymentStatus("processing");
            } else if (response.paymentType === "cash_booking") {
                setCashData(response);
                setPaymentStatus("processing");
            }
        } catch (err: any) {
            setPaymentStatus("failed");
            setError(err.message || "Failed to initiate payment");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSplitPayment = async () => {
        const amount = showSplitInput === "qr" ? parseFloat(splitQrAmount) : parseFloat(splitCashAmount);

        if (isNaN(amount) || amount <= 0) {
            setError("Please enter a valid amount");
            return;
        }

        if (amount >= vehiclePrice) {
            setError("Amount must be less than the total vehicle price");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const paymentType = showSplitInput === "qr" ? "split_qr" : "split_cash";
            const options = showSplitInput === "qr"
                ? { qrAmount: amount }
                : { cashAmount: amount };

            console.log("Creating split checkout with:", { vehicleId: vehicle.id, paymentType, options });
            const response = await paymentsApi.createCheckout(vehicle.id, paymentType as PaymentType, options);
            console.log("Split payment response:", response);

            if (response.paymentType === "split_qr" || response.paymentType === "split_cash") {
                const splitResponse = response as SplitPaymentResponse;
                console.log("Setting split data:", splitResponse);
                setSplitData(splitResponse);
                setSplitManualVerified(false);
                setSplitManualTxnId("");
                setPaymentStatus("processing");
                setShowSplitInput(null);
            } else {
                console.error("Unexpected response type:", response.paymentType);
                setError("Unexpected response from server");
                setPaymentStatus("failed");
            }
        } catch (err: any) {
            console.error("Split payment error:", err);
            setPaymentStatus("failed");
            setError(err.message || "Failed to initiate split payment");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifySplitManual = async () => {
        if (!splitData) return;
        if (splitData.paymentType === "split_qr" && !splitManualTxnId.trim()) {
            setError("Please enter UPI Transaction ID after payment");
            return;
        }

        setIsLoading(true);
        setError("");
        try {
            const result = await paymentsApi.verifyManual(splitData.transactionId, splitManualTxnId.trim() || undefined);
            if (result.success) {
                setSplitManualVerified(true);
            } else {
                setError("Failed to verify manual payment");
            }
        } catch (err: any) {
            setError(err.message || "Failed to verify manual payment");
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmUpiPayment = async () => {
        if (!upiData || !upiTransactionId.trim()) return;

        setIsLoading(true);
        try {
            const result = await paymentsApi.confirmBooking(upiData.transactionId, upiTransactionId);
            if (result.success) {
                setPaymentStatus("success");
                onSuccess?.(upiData.transactionId);
            } else {
                setError("Failed to confirm payment");
            }
        } catch (err: any) {
            setError(err.message || "Failed to confirm payment");
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmCashBooking = async () => {
        if (!cashData) return;

        setPaymentStatus("success");
        onSuccess?.(cashData.transactionId);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
    };

    const handleClose = () => {
        setIsOpen(false);
        setSelectedMethod(null);
        setPaymentStatus("idle");
        setUpiData(null);
        setCashData(null);
        setSplitData(null);
        setSplitQrAmount("");
        setSplitCashAmount("");
        setShowSplitInput(null);
        setSplitManualVerified(false);
        setSplitManualTxnId("");
        onClose?.();
        if (paymentStatus === "success") {
            navigate("/buyer/purchases");
        }
    };

    const handleViewPurchases = () => {
        setIsOpen(false);
        navigate("/buyer/purchases");
    };

    // Note: vehiclePrice, advanceAmount, tokenAmount, defaultBookingAmount are defined at the top of the component

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                className="w-full gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-lg py-6"
            >
                <ShoppingCart className="h-5 w-5" />
                Buy Now - {formatPrice(vehicle.price)}
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {paymentStatus === "success"
                                ? "Booking Successful!"
                                : paymentStatus === "failed"
                                    ? "Payment Failed"
                                    : showSplitInput
                                        ? "Enter Booking Amount"
                                        : selectedMethod
                                            ? "Complete Your Payment"
                                            : "Choose Payment Method"}
                        </DialogTitle>
                        <DialogDescription>
                            {vehicle.year} {vehicle.make} {vehicle.model} - {formatPrice(vehicle.price)}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Split Payment Amount Input */}
                    {showSplitInput && paymentStatus === "idle" && !isLoading && (
                        <div className="space-y-6 py-4">
                            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl">
                                <div className="rounded-full bg-blue-100 p-3 inline-block mb-3">
                                    {showSplitInput === "qr" ? (
                                        <QrCode className="h-8 w-8 text-blue-600" />
                                    ) : (
                                        <Banknote className="h-8 w-8 text-blue-600" />
                                    )}
                                </div>
                                <h3 className="font-semibold text-lg">
                                    {showSplitInput === "qr" ? "UPI/QR" : "Cash"} + Card Payment
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Pay a booking amount via {showSplitInput === "qr" ? "UPI/QR" : "Cash"}, then complete the remaining via Card
                                </p>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="bookingAmount" className="text-base font-medium">
                                    Booking Amount ({showSplitInput === "qr" ? "via UPI/QR" : "in Cash"})
                                </Label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="bookingAmount"
                                        type="number"
                                        className="pl-10 text-lg h-12"
                                        placeholder={`e.g., ${defaultBookingAmount.toLocaleString("en-IN")}`}
                                        value={showSplitInput === "qr" ? splitQrAmount : splitCashAmount}
                                        onChange={(e) => {
                                            if (showSplitInput === "qr") {
                                                setSplitQrAmount(e.target.value);
                                            } else {
                                                setSplitCashAmount(e.target.value);
                                            }
                                            setError("");
                                        }}
                                        min={1}
                                        max={vehiclePrice - 1}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Enter any amount between ₹1 and {formatPrice(vehiclePrice - 1)}
                                </p>
                            </div>

                            {/* Preview breakdown */}
                            {(showSplitInput === "qr" ? splitQrAmount : splitCashAmount) && (
                                <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">
                                            {showSplitInput === "qr" ? "UPI/QR" : "Cash"} Payment
                                        </span>
                                        <span className="font-semibold text-blue-600">
                                            {formatPrice(parseFloat(showSplitInput === "qr" ? splitQrAmount : splitCashAmount) || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Card Payment</span>
                                        <span className="font-semibold text-blue-600">
                                            {formatPrice(
                                                Math.max(0, vehiclePrice - (parseFloat(showSplitInput === "qr" ? splitQrAmount : splitCashAmount) || 0))
                                            )}
                                        </span>
                                    </div>
                                    <div className="border-t pt-2 mt-2 flex justify-between items-center">
                                        <span className="text-sm font-medium">Total</span>
                                        <span className="font-bold text-green-600">{formatPrice(vehiclePrice)}</span>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <p className="text-sm text-red-500 text-center">{error}</p>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowSplitInput(null);
                                        setSelectedMethod(null);
                                        setSplitQrAmount("");
                                        setSplitCashAmount("");
                                        setError("");
                                    }}
                                >
                                    ← Back
                                </Button>
                                <Button
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                    onClick={handleSplitPayment}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                    )}
                                    Proceed to Payment
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Payment Method Selection */}
                    {!selectedMethod && paymentStatus === "idle" && !showSplitInput && (
                        <div className="space-y-4 py-4">
                            {/* Section: Full Payment Options */}
                            <div className="mb-2">
                                <h4 className="text-sm font-medium text-muted-foreground mb-3">Full Payment</h4>

                                {/* Full Card Payment */}
                                <Card
                                    className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all mb-3"
                                    onClick={() => handleSelectPaymentMethod("full_card")}
                                >
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                                            <CreditCard className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold">Pay Full Amount by Card</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Pay {formatPrice(vehicle.price)} via Card
                                            </p>
                                        </div>
                                        <Badge className="bg-blue-100 text-blue-700">Stripe</Badge>
                                    </CardContent>
                                </Card>

                                {/* Full Cash Payment */}
                                <Card
                                    className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all"
                                    onClick={() => handleSelectPaymentMethod("cash_booking")}
                                >
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-teal-500">
                                            <Banknote className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold">Pay Full Amount in Cash</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Token {formatPrice(tokenAmount)} now - Remaining {formatPrice(vehiclePrice - tokenAmount)} on delivery
                                            </p>
                                        </div>
                                        <Badge className="bg-green-100 text-green-700">Cash</Badge>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Section: Split Payment Options */}
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                                    <Split className="h-4 w-4" />
                                    Split Payment (Booking + Card)
                                </h4>

                                {/* Split UPI/QR + Card */}
                                <Card
                                    className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all border-blue-200 mb-3"
                                    onClick={() => handleSelectPaymentMethod("split_qr")}
                                >
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                                            <QrCode className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold">UPI/QR + Card</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Pay booking amount via UPI/QR, remaining via Card
                                            </p>
                                            <p className="text-xs text-blue-600">
                                                You can choose your booking amount (e.g., ₹50,000)
                                            </p>
                                        </div>
                                        <Badge className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700">
                                            Split
                                        </Badge>
                                    </CardContent>
                                </Card>

                                {/* Split Cash + Card */}
                                <Card
                                    className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all border-blue-200"
                                    onClick={() => handleSelectPaymentMethod("split_cash")}
                                >
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="p-3 rounded-full bg-gradient-to-r from-green-500 to-blue-500">
                                            <Banknote className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold">Cash + Card</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Pay booking amount in Cash, remaining via Card
                                            </p>
                                            <p className="text-xs text-blue-600">
                                                You can choose your booking amount (e.g., ₹50,000)
                                            </p>
                                        </div>
                                        <Badge className="bg-gradient-to-r from-green-100 to-blue-100 text-green-700">
                                            Split
                                        </Badge>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Section: Book Now, Pay Later */}
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-3">Book Now, Pay Later</h4>

                                {/* UPI/QR Advance Payment */}
                                <Card
                                    className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all"
                                    onClick={() => handleSelectPaymentMethod("advance_upi")}
                                >
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                                            <QrCode className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold">Book with 10% Advance (UPI/QR)</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Pay {formatPrice(advanceAmount)} advance (10%)
                                            </p>
                                            <p className="text-xs text-blue-600">
                                                Remaining {formatPrice(vehiclePrice - advanceAmount)} on delivery
                                            </p>
                                        </div>
                                        <Badge className="bg-purple-100 text-purple-700">UPI</Badge>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                            <p className="text-muted-foreground">Processing...</p>
                        </div>
                    )}

                    {/* UPI Payment View */}
                    {!isLoading && upiData && paymentStatus === "processing" && (
                        <div className="space-y-6 py-4">
                            <div className="text-center">
                                <div className="bg-white p-4 rounded-lg border-2 border-purple-200 inline-block">
                                    <QRCodeSVG value={upiData.upiLink} size={260} level="M" includeMargin />
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Scan this QR code to pay
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Amount to Pay</span>
                                    <span className="font-bold text-lg text-purple-700">
                                        {formatPrice(upiData.advanceAmount)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">UPI ID</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm">{upiData.upiId}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => copyToClipboard(upiData.upiId)}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Reference</span>
                                    <span className="font-mono text-xs">{upiData.upiReference}</span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Remaining Amount</span>
                                    <span className="font-semibold text-blue-700">
                                        {formatPrice(upiData.remainingAmount)} on delivery
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="upiTxn">Enter UPI Transaction ID after payment</Label>
                                <Input
                                    id="upiTxn"
                                    placeholder="e.g., 123456789012"
                                    value={upiTransactionId}
                                    onChange={(e) => setUpiTransactionId(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => window.open(upiData.upiLink, "_blank")}
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open UPI App
                                </Button>
                                <Button
                                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                                    onClick={handleConfirmUpiPayment}
                                    disabled={!upiTransactionId.trim() || isLoading}
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Confirm Payment
                                </Button>
                            </div>

                            {upiData.sellerPhone && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                                    <Phone className="h-4 w-4 text-blue-600" />
                                    <span className="text-muted-foreground">Seller Contact:</span>
                                    <a href={`tel:${upiData.sellerPhone}`} className="text-blue-600 font-medium">
                                        {upiData.sellerPhone}
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cash Booking View */}
                    {!isLoading && cashData && paymentStatus === "processing" && (
                        <div className="space-y-6 py-4">
                            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-teal-50 rounded-xl">
                                <div className="rounded-full bg-green-100 p-4 inline-block mb-4">
                                    <Banknote className="h-12 w-12 text-green-600" />
                                </div>
                                <h3 className="font-semibold text-lg mb-2">Cash on Delivery Booking</h3>
                                <p className="text-sm text-muted-foreground">
                                    {cashData.message}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Token Amount</span>
                                    <span className="font-bold text-lg text-green-700">
                                        {formatPrice(cashData.tokenAmount)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Pay on Delivery</span>
                                    <span className="font-semibold text-blue-700">
                                        {formatPrice(cashData.remainingAmount)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Booking Reference</span>
                                    <span className="font-mono text-xs">{cashData.bookingReference}</span>
                                </div>
                            </div>

                            {cashData.sellerPhone && (
                                <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-blue-600" />
                                        <span className="font-medium">Seller Details</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {cashData.sellerName}
                                    </p>
                                    <a
                                        href={`tel:${cashData.sellerPhone}`}
                                        className="text-blue-600 font-medium text-lg"
                                    >
                                        {cashData.sellerPhone}
                                    </a>
                                </div>
                            )}

                            <Button
                                className="w-full bg-gradient-to-r from-green-500 to-teal-500"
                                onClick={handleConfirmCashBooking}
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                I've Contacted the Seller - Confirm Booking
                            </Button>
                        </div>
                    )}

                    {/* Split Payment View */}
                    {!isLoading && splitData && paymentStatus === "processing" && (
                        <div className="space-y-6 py-4">
                            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl">
                                <div className="rounded-full bg-blue-100 p-3 inline-block mb-3">
                                    <Split className="h-8 w-8 text-blue-600" />
                                </div>
                                <h3 className="font-semibold text-lg">Split Payment</h3>
                                <p className="text-sm text-muted-foreground">
                                    {splitData.message}
                                </p>
                            </div>

                            {/* QR for split_qr */}
                            {splitData.paymentType === "split_qr" && splitData.upiLink && (
                                <div className="space-y-3">
                                    <div className="text-center">
                                        <div className="bg-white p-4 rounded-lg border-2 border-purple-200 inline-block">
                                            <QRCodeSVG value={splitData.upiLink} size={260} level="M" includeMargin />
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2">
                                            Scan this QR code to pay {formatPrice(splitData.manualAmount)}
                                        </p>
                                    </div>

                                    {splitData.upiId && (
                                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                            <span className="text-sm text-muted-foreground">UPI ID</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm">{splitData.upiId}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => copyToClipboard(splitData.upiId!)}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <span className="text-sm text-muted-foreground">Reference</span>
                                        <span className="font-mono text-xs">{splitData.reference}</span>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => window.open(splitData.upiLink!, "_blank")}
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            Open UPI App
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="splitUpiTxn">Enter UPI Transaction ID after payment</Label>
                                        <Input
                                            id="splitUpiTxn"
                                            placeholder="e.g., 123456789012"
                                            value={splitManualTxnId}
                                            onChange={(e) => {
                                                setSplitManualTxnId(e.target.value);
                                                setError("");
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">
                                        {splitData.manualPaymentType} Payment
                                    </span>
                                    <span className="font-bold text-lg text-blue-700">
                                        {formatPrice(splitData.manualAmount)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Card Payment</span>
                                    <span className="font-semibold text-blue-700">
                                        {formatPrice(splitData.remainingAmount)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <span className="text-sm text-muted-foreground">Reference</span>
                                    <span className="font-mono text-xs">{splitData.reference}</span>
                                </div>
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800">
                                    <strong>Step 1:</strong> Complete your {splitData.manualPaymentType.toLowerCase()} payment of {formatPrice(splitData.manualAmount)}
                                </p>
                                <p className="text-sm text-amber-800 mt-2">
                                    <strong>Step 2:</strong> Click Verify to confirm your {splitData.manualPaymentType.toLowerCase()} payment, then pay remaining {formatPrice(splitData.remainingAmount)} via Card
                                </p>
                            </div>

                            {error && (
                                <p className="text-sm text-red-500 text-center">{error}</p>
                            )}

                            <Button
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12"
                                onClick={handleVerifySplitManual}
                                disabled={isLoading || (splitData.paymentType === "split_qr" && !splitManualTxnId.trim()) || splitManualVerified}
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {splitManualVerified ? (
                                    <>
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Verified
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Verify {splitData.manualPaymentType}
                                    </>
                                )}
                            </Button>

                            <Button
                                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 h-12"
                                onClick={() => {
                                    if (splitData.checkoutUrl) {
                                        window.location.href = splitData.checkoutUrl;
                                    }
                                }}
                                disabled={!splitManualVerified}
                            >
                                <CreditCard className="h-5 w-5 mr-2" />
                                Pay {formatPrice(splitData.remainingAmount)} via Card
                                <ArrowRight className="h-5 w-5 ml-2" />
                            </Button>
                        </div>
                    )}

                    {/* Success State */}
                    {paymentStatus === "success" && (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <div className="rounded-full bg-green-100 p-4">
                                <CheckCircle className="h-12 w-12 text-green-600" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-lg">Booking Confirmed!</p>
                                <p className="text-muted-foreground">
                                    Your booking has been confirmed. Check your purchases for details.
                                </p>
                            </div>
                            <Button onClick={handleViewPurchases} className="mt-4">
                                View My Purchases
                            </Button>
                        </div>
                    )}

                    {/* Failed State */}
                    {paymentStatus === "failed" && (
                        <div className="flex flex-col items-center py-8 gap-4">
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
                                <Button onClick={() => {
                                    setSelectedMethod(null);
                                    setPaymentStatus("idle");
                                    setError("");
                                    setShowSplitInput(null);
                                    setSplitQrAmount("");
                                    setSplitCashAmount("");
                                }}>
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Back Button for UPI/Cash/Split processing */}
                    {selectedMethod && paymentStatus === "processing" && !isLoading && !splitData && (
                        <div className="pt-2 border-t">
                            <Button
                                variant="ghost"
                                className="w-full"
                                onClick={() => {
                                    setSelectedMethod(null);
                                    setPaymentStatus("idle");
                                    setUpiData(null);
                                    setCashData(null);
                                    setSplitData(null);
                                }}
                            >
                                ← Choose Different Payment Method
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

// Export with DodoCheckout alias for backwards compatibility
export { PaymentOptions as DodoCheckout };
