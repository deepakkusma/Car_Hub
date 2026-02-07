import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { useSession } from "~/lib/auth-client";
import { paymentsApi, type Transaction } from "~/lib/api";
import {
    ShoppingBag,
    Car,
    Phone,
    Calendar,
    CreditCard,
    CheckCircle,
    XCircle,
    Clock,
    ArrowLeft,
    Loader2,
    RefreshCw,
    FileDown,
    FileText,
} from "lucide-react";
import { downloadInvoice } from "~/lib/invoice";
import { downloadRegistrationDoc } from "~/lib/registration-document";
import { format } from "date-fns";

export default function BuyerBookings() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [bookings, setBookings] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            // Check if we're returning from Stripe checkout
            const success = searchParams.get("success");
            const sessionId = searchParams.get("session_id");

            if (success === "true" && sessionId) {
                verifyStripePayment(sessionId);
            } else {
                fetchBookings();
            }
        }
    }, [session, isPending, searchParams]);

    const verifyStripePayment = async (sessionId: string) => {
        setIsVerifying(true);
        setVerificationMessage("Verifying your payment...");

        try {
            const result = await paymentsApi.verifyPayment({
                sessionId: sessionId,
            });

            if (result.success) {
                setVerificationMessage("Payment verified successfully! 🎉");
            } else {
                setVerificationMessage("Payment is being processed...");
            }
        } catch (error) {
            console.error("Payment verification failed:", error);
            setVerificationMessage("Could not verify payment status. Please refresh the page.");
        } finally {
            setIsVerifying(false);
            // Fetch bookings after verification attempt
            await fetchBookings();

            // Clear the URL params after verification
            window.history.replaceState({}, '', '/buyer/bookings');

            // Clear the message after 5 seconds
            setTimeout(() => setVerificationMessage(null), 5000);
        }
    };

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            const data = await paymentsApi.getMyPurchases();

            // First, filter out invalid states like we did before
            const validTransactions = data.filter((txn) => {
                // Exclude failed/cancelled/refunded
                if (
                    txn.status === "payment_failed" ||
                    txn.status === "cancelled" ||
                    txn.status === "refunded"
                ) {
                    return false;
                }

                // If it's pending or initiated, it's definitely a booking/in-progress
                if (txn.status === "payment_initiated" || txn.status === "pending") {
                    return true;
                }

                // If it's completed, it's a booking ONLY if there is a remaining balance
                const hasRemainingBalance =
                    txn.remainingAmount && parseFloat(txn.remainingAmount) > 0;

                if ((txn.status === "payment_completed" || txn.status === "completed") && hasRemainingBalance) {
                    return true;
                }

                return false;
            });

            // Now deduplicate by vehicleId
            const uniqueBookingsMap = new Map<string, Transaction>();

            validTransactions.forEach((txn) => {
                const existing = uniqueBookingsMap.get(txn.vehicleId);

                if (!existing) {
                    uniqueBookingsMap.set(txn.vehicleId, txn);
                    return;
                }

                // Prioritize completed/confirmed transactions
                const istxnCompleted = txn.status === "payment_completed" || txn.status === "completed";
                const isExistingCompleted = existing.status === "payment_completed" || existing.status === "completed";

                if (istxnCompleted && !isExistingCompleted) {
                    uniqueBookingsMap.set(txn.vehicleId, txn);
                    return;
                }
                if (!istxnCompleted && isExistingCompleted) {
                    return; // Keep existing
                }

                // If completion status is same, prioritize one with higher paid amount (bookingAmount)
                const txnPaid = parseFloat(txn.bookingAmount || "0");
                const existingPaid = parseFloat(existing.bookingAmount || "0");

                if (txnPaid > existingPaid) {
                    uniqueBookingsMap.set(txn.vehicleId, txn);
                    return;
                }
                if (existingPaid > txnPaid) {
                    return; // Keep existing
                }

                // If amounts are same, prioritize the newer one
                if (new Date(txn.createdAt) > new Date(existing.createdAt)) {
                    uniqueBookingsMap.set(txn.vehicleId, txn);
                }
            });

            setBookings(Array.from(uniqueBookingsMap.values()));
        } catch (error) {
            console.error("Failed to fetch bookings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefreshStatus = async (transactionId: string) => {
        setIsRefreshing(transactionId);
        try {
            const result = await paymentsApi.verifyPayment({ transactionId });
            if (result.success) {
                setVerificationMessage("Payment verified! Refreshing...");
                await fetchBookings();
                setTimeout(() => setVerificationMessage(null), 3000);
            } else {
                setVerificationMessage(result.message || "Payment is still pending");
                setTimeout(() => setVerificationMessage(null), 5000);
            }
        } catch (error) {
            console.error("Failed to refresh status:", error);
            setVerificationMessage("Could not check payment status");
            setTimeout(() => setVerificationMessage(null), 3000);
        } finally {
            setIsRefreshing(null);
        }
    };

    const formatPrice = (price?: string | number) => {
        if (!price) return "₹0";
        const num = typeof price === "string" ? parseFloat(price) : price;
        if (isNaN(num)) return "₹0";
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const getStatusBadge = (status: Transaction["status"]) => {
        switch (status) {
            case "payment_completed":
            case "completed":
                return (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confimed
                    </Badge>
                );
            case "payment_initiated":
            case "pending":
                if (status === "payment_initiated") {
                    return (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            <Clock className="h-3 w-3 mr-1" />
                            Booking Pending
                        </Badge>
                    );
                }
                return (
                    <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </Badge>
                );
            case "payment_failed":
            case "cancelled":
                return (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                    </Badge>
                );
            case "refunded":
                return (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        Refunded
                    </Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    if (isPending) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="flex-1 bg-slate-50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="sm" asChild>
                        <Link to="/buyer/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>

                {/* Verification Status Banner */}
                {(isVerifying || verificationMessage) && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${isVerifying
                        ? "bg-blue-50 border border-blue-200 text-blue-700"
                        : verificationMessage?.includes("successfully")
                            ? "bg-green-50 border border-green-200 text-green-700"
                            : "bg-yellow-50 border border-yellow-200 text-yellow-700"
                        }`}>
                        {isVerifying && <Loader2 className="h-5 w-5 animate-spin" />}
                        {!isVerifying && verificationMessage?.includes("successfully") && <CheckCircle className="h-5 w-5" />}
                        {!isVerifying && !verificationMessage?.includes("successfully") && <Clock className="h-5 w-5" />}
                        <span className="font-medium">{verificationMessage}</span>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <ShoppingBag className="h-8 w-8 text-amber-600" />
                        My Bookings
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your vehicle bookings and complete payments
                    </p>
                </div>

                {/* Bookings List */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-40 rounded-lg" />
                        ))}
                    </div>
                ) : bookings.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-xl font-medium mb-2">No Bookings Yet</h3>
                            <p className="text-muted-foreground mb-6">
                                You haven't booked any vehicles yet.
                            </p>
                            <Button asChild>
                                <Link to="/vehicles">Browse Vehicles</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((booking) => (
                            <Card key={booking.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                <div className="flex flex-col md:flex-row">
                                    {/* Vehicle Image */}
                                    <div className="w-full md:w-64 h-48 md:h-auto bg-slate-100 shrink-0">
                                        {booking.vehicle?.images?.[0] ? (
                                            <img
                                                src={getImageUrl(booking.vehicle.images[0]) || ""}
                                                alt={`${booking.vehicle.make} ${booking.vehicle.model}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Car className="h-12 w-12 text-slate-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Booking Details */}
                                    <div className="flex-1 p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                            <div>
                                                <h3 className="text-xl font-semibold mb-1">
                                                    {booking.vehicle?.year} {booking.vehicle?.make} {booking.vehicle?.model}
                                                </h3>
                                                {booking.bookingAmount && parseFloat(booking.remainingAmount || "0") > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-muted-foreground">
                                                                {(booking.status === "payment_completed" || booking.status === "completed") ? "Booking Paid:" : "Booking Amount:"}
                                                            </span>
                                                            <span className="text-lg font-bold text-amber-600">
                                                                {formatPrice(booking.bookingAmount)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-muted-foreground">Remaining:</span>
                                                            <span className="text-lg font-bold text-slate-600">
                                                                {formatPrice(booking.remainingAmount || undefined)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-2xl font-bold text-green-600">
                                                        {formatPrice(booking.amount)}
                                                    </p>
                                                )}
                                            </div>
                                            {getStatusBadge(booking.status)}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    {format(new Date(booking.createdAt), "MMM dd, yyyy")}
                                                </span>
                                            </div>
                                            {booking.paymentMethod && (
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                    <span className="capitalize">{booking.paymentMethod}</span>
                                                </div>
                                            )}
                                            {booking.vehicle?.seller?.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                                    <span>{booking.vehicle.seller.phone}</span>
                                                </div>
                                            )}
                                            {booking.paymentType === "cash_booking" && (booking.status === "payment_initiated" || booking.status === "pending") && (
                                                <div className="col-span-full mt-2 text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex gap-2">
                                                    <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                                                    <span>Waiting for seller to confirm receipt of cash payment. Please contact the seller.</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons for Pending Payments / Bookings */}
                                        {(booking.status === "payment_initiated" || booking.status === "pending" || (booking.bookingAmount && parseFloat(booking.remainingAmount || "0") > 0)) && (
                                            <div className="mt-4 flex flex-wrap gap-3">
                                                {/* If it's a booking with remaining amount, show Pay Balance even if 'completed' (paid booking) */}
                                                {parseFloat(booking.remainingAmount || "0") > 0 && (
                                                    <Button size="sm" asChild className="bg-gradient-to-r from-blue-600 to-indigo-600">
                                                        <Link to={`/vehicles/${booking.vehicleId}/payment`}>
                                                            <CreditCard className="h-4 w-4 mr-2" />
                                                            Pay Balance {formatPrice(booking.remainingAmount || undefined)}
                                                        </Link>
                                                    </Button>
                                                )}

                                                {/* If pending and no split logic yet (just simple pending), show retry */}
                                                {booking.status === "payment_initiated" && !booking.bookingAmount && (
                                                    <Button size="sm" asChild>
                                                        <Link to={`/vehicles/${booking.vehicleId}/payment`}>
                                                            <CreditCard className="h-4 w-4 mr-1" />
                                                            Retry Booking
                                                        </Link>
                                                    </Button>
                                                )}

                                                {(booking.status === "payment_initiated" || booking.status === "pending") && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRefreshStatus(booking.id)}
                                                        disabled={isRefreshing === booking.id}
                                                    >
                                                        {isRefreshing === booking.id ? (
                                                            <>
                                                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                                Checking...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw className="h-4 w-4 mr-1" />
                                                                Refresh Status
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        )}

                                        {/* Download Receipt for Booking? Maybe not full invoice yet, but let's leave it if available */}
                                        {(booking.status === "payment_completed" || booking.status === "completed") && (
                                            <div className="mt-4 pt-4 border-t flex justify-end gap-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                                    onClick={() => downloadInvoice(booking)}
                                                >
                                                    <FileDown className="h-4 w-4 mr-2" />
                                                    Download Receipt
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="flex-1 bg-slate-50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                <Skeleton className="h-10 w-64 mb-2" />
                <Skeleton className="h-5 w-48 mb-8" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-40 rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
}
