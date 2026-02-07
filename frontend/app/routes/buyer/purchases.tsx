import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
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
    FileDown,
    FileText,
    User,
} from "lucide-react";
import { downloadInvoice } from "~/lib/invoice";
import { downloadRegistrationDoc } from "~/lib/registration-document";
import { format } from "date-fns";

export default function BuyerPurchases() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [purchases, setPurchases] = useState<Transaction[]>([]);
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
                fetchPurchases();
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
            // Fetch purchases after verification attempt
            await fetchPurchases();

            // Clear the URL params after verification
            window.history.replaceState({}, '', '/buyer/purchases');

            // Clear the message after 5 seconds
            setTimeout(() => setVerificationMessage(null), 5000);
        }
    };

    const fetchPurchases = async () => {
        setIsLoading(true);
        try {
            const data = await paymentsApi.getMyPurchases();
            // Filter to only show completed full purchases (no remaining balance)
            const completedPurchases = data.filter((txn) => {
                const isCompleted =
                    txn.status === "payment_completed" || txn.status === "completed";

                if (!isCompleted) return false;

                // If there's a remaining balance, it's still a booking
                if (txn.remainingAmount && parseFloat(txn.remainingAmount) > 0) {
                    return false;
                }

                // It is completed and has no remaining balance -> it is a purchase
                return true;
            });

            // Deduplicate by vehicleId - keep only the most recent transaction per vehicle
            const vehicleMap = new Map<string, Transaction>();
            for (const purchase of completedPurchases) {
                const vehicleId = purchase.vehicleId;
                const existing = vehicleMap.get(vehicleId);

                // If no existing entry or this one is newer, use this transaction
                if (!existing || new Date(purchase.createdAt) > new Date(existing.createdAt)) {
                    vehicleMap.set(vehicleId, purchase);
                }
            }

            // Convert map values back to array
            const uniquePurchases = Array.from(vehicleMap.values());
            setPurchases(uniquePurchases);
        } catch (error) {
            console.error("Failed to fetch purchases:", error);
        } finally {
            setIsLoading(false);
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
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 font-medium">
                        <CheckCircle className="h-3 w-3 mr-1.5" />
                        Completed
                    </Badge>
                );
            case "payment_initiated":
            case "pending":
                return (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 font-medium">
                        <Clock className="h-3 w-3 mr-1.5" />
                        Pending
                    </Badge>
                );
            case "payment_failed":
            case "cancelled":
                return (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 font-medium">
                        <XCircle className="h-3 w-3 mr-1.5" />
                        Failed
                    </Badge>
                );
            case "refunded":
                return (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 font-medium">
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
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900">
                        <Link to="/buyer/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>

                {/* Verification Status Banner */}
                {(isVerifying || verificationMessage) && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${isVerifying
                        ? "bg-blue-50 border border-blue-200 text-blue-700"
                        : verificationMessage?.includes("successfully")
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border border-amber-200 text-amber-700"
                        }`}>
                        {isVerifying && <Loader2 className="h-5 w-5 animate-spin" />}
                        {!isVerifying && verificationMessage?.includes("successfully") && <CheckCircle className="h-5 w-5" />}
                        {!isVerifying && !verificationMessage?.includes("successfully") && <Clock className="h-5 w-5" />}
                        <span className="font-medium">{verificationMessage}</span>
                    </div>
                )}

                {/* Header */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-100">
                            <ShoppingBag className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">My Purchases</h1>
                            <p className="text-muted-foreground text-sm">
                                {purchases.length} purchased vehicle{purchases.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Purchases List */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-48 rounded-xl" />
                        ))}
                    </div>
                ) : purchases.length === 0 ? (
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="py-16 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
                                <ShoppingBag className="h-10 w-10 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-slate-900">No Purchases Yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                You haven't purchased any vehicles yet. Browse our collection to find your perfect car!
                            </p>
                            <Button asChild className="shadow-sm">
                                <Link to="/vehicles">Browse Vehicles</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {purchases.map((purchase) => (
                            <Card
                                key={purchase.id}
                                className="bg-white border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer"
                                onClick={() => purchase.vehicle?.id && navigate(`/vehicles/${purchase.vehicle.id}`)}
                            >
                                <div className="flex flex-col md:flex-row">
                                    {/* Vehicle Image */}
                                    <div className="w-full md:w-64 h-48 md:h-auto bg-slate-100 shrink-0 relative group overflow-hidden">
                                        {purchase.vehicle?.images?.[0] ? (
                                            <img
                                                src={getImageUrl(purchase.vehicle.images[0]) || ""}
                                                alt={`${purchase.vehicle.make} ${purchase.vehicle.model}`}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Car className="h-12 w-12 text-slate-300" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                    </div>

                                    {/* Purchase Details */}
                                    <div className="flex-1 p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-900 mb-1">
                                                    {purchase.vehicle?.year} {purchase.vehicle?.make} {purchase.vehicle?.model}
                                                </h3>
                                                <p className="text-2xl font-bold text-emerald-600">
                                                    {formatPrice(purchase.amount)}
                                                </p>
                                            </div>
                                            {getStatusBadge(purchase.status)}
                                        </div>

                                        <div className="flex flex-wrap gap-3 text-sm mb-4">
                                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full text-slate-600">
                                                <Calendar className="h-4 w-4 text-slate-400" />
                                                <span>{format(new Date(purchase.createdAt), "MMM dd, yyyy")}</span>
                                            </div>
                                            {purchase.paymentMethod && (
                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full text-slate-600">
                                                    <CreditCard className="h-4 w-4 text-slate-400" />
                                                    <span className="capitalize">{purchase.paymentMethod}</span>
                                                </div>
                                            )}
                                            {purchase.vehicle?.seller?.phone && (
                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full text-slate-600">
                                                    <Phone className="h-4 w-4 text-slate-400" />
                                                    <span>{purchase.vehicle.seller.phone}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Seller Info */}
                                        {purchase.vehicle?.seller && (
                                            <>
                                                <Separator className="my-4" />
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <User className="h-4 w-4 text-slate-400" />
                                                    <span className="text-muted-foreground">Seller:</span>
                                                    <span className="font-medium text-slate-900">{purchase.vehicle.seller.name}</span>
                                                </div>
                                            </>
                                        )}

                                        {/* Error Message */}
                                        {purchase.status === "payment_failed" && purchase.paymentErrorDescription && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                                                {purchase.paymentErrorDescription}
                                            </div>
                                        )}

                                        {/* Download Buttons for completed purchases */}
                                        {(purchase.status === "payment_completed" || purchase.status === "completed") && (
                                            <>
                                                <Separator className="my-4" />
                                                <div className="flex justify-end gap-3">
                                                    {(purchase.deliveryStatus === "ready_for_collection" || purchase.deliveryStatus === "collected") && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 rounded-lg"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                downloadRegistrationDoc(purchase);
                                                            }}
                                                        >
                                                            <FileText className="h-4 w-4 mr-2" />
                                                            Registration Document
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 rounded-lg"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            downloadInvoice(purchase);
                                                        }}
                                                    >
                                                        <FileDown className="h-4 w-4 mr-2" />
                                                        Download Invoice
                                                    </Button>
                                                </div>
                                            </>
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
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl border p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-xl" />
                        <div>
                            <Skeleton className="h-6 w-40 mb-2" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
