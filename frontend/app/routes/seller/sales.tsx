import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { useSession } from "~/lib/auth-client";
import { paymentsApi, type Transaction } from "~/lib/api";
import {
    DollarSign,
    Car,
    Phone,
    Mail,
    Calendar,
    CreditCard,
    CheckCircle,
    XCircle,
    Clock,
    ArrowLeft,
    User,
    TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

export default function SellerSales() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [sales, setSales] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState<string | null>(null);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchSales();
        }
    }, [session, isPending]);

    const fetchSales = async () => {
        setIsLoading(true);
        try {
            const data = await paymentsApi.getMySales();
            // Filter for COMPLETED sales only - no remaining balance
            // Any transaction with remaining balance goes to Bookings page
            const validSales = data.filter((s) => {
                // Exclude failed and cancelled
                if (s.status === "payment_failed" || s.status === "cancelled") return false;

                // Exclude any transaction with remaining balance (they go to bookings page)
                const hasRemaining = s.remainingAmount && parseFloat(s.remainingAmount) > 0;
                if (hasRemaining) return false;

                // Only show completed transactions (full payment received)
                return s.status === "payment_completed" || s.status === "completed";
            });
            setSales(validSales);
        } catch (error) {
            console.error("Failed to fetch sales:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmPayment = async (transactionId: string) => {
        if (!confirm("Are you sure you have received the full payment? This will complete the sale and mark the vehicle as sold.")) return;

        setIsConfirming(transactionId);
        try {
            await paymentsApi.confirmBooking(transactionId);
            // Refresh list
            await fetchSales();
        } catch (error) {
            console.error("Failed to confirm payment:", error);
            alert("Failed to confirm payment");
        } finally {
            setIsConfirming(null);
        }
    };

    const formatPrice = (price: string) => {
        const num = parseFloat(price);
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const getStatusBadge = (transaction: Transaction) => {
        const status = transaction.status;
        const hasRemaining = transaction.remainingAmount && parseFloat(transaction.remainingAmount) > 0;

        switch (status) {
            case "payment_completed":
            case "completed":
                if (hasRemaining) {
                    return (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Booking Confirmed
                        </Badge>
                    );
                }
                return (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sale Completed
                    </Badge>
                );
            case "payment_initiated":
            case "pending":
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

    // Calculate totals
    const completedSales = sales.filter(
        (s) => s.status === "payment_completed" || s.status === "completed"
    );
    const totalEarnings = completedSales.reduce(
        (sum, s) => sum + parseFloat(s.amount),
        0
    );

    if (isPending) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="flex-1 bg-slate-50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="sm" asChild>
                        <Link to="/seller/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <DollarSign className="h-8 w-8 text-green-600" />
                        My Sales
                    </h1>
                    <p className="text-muted-foreground">
                        Track all your vehicle sales and earnings
                    </p>
                </div>

                {/* Stats Cards */}
                {!isLoading && sales.length > 0 && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                                        <TrendingUp className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Earnings</p>
                                        <p className="text-2xl font-bold text-green-600">
                                            {formatPrice(totalEarnings.toString())}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                                        <CheckCircle className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Completed Sales</p>
                                        <p className="text-2xl font-bold">{completedSales.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500">
                                        <Car className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Transactions</p>
                                        <p className="text-2xl font-bold">{sales.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Sales List */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-48 rounded-lg" />
                        ))}
                    </div>
                ) : sales.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <DollarSign className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-xl font-medium mb-2">No Sales Yet</h3>
                            <p className="text-muted-foreground mb-6">
                                You haven't made any sales yet. List more vehicles to attract buyers!
                            </p>
                            <Button asChild>
                                <Link to="/seller/add-vehicle">Add New Vehicle</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {sales.map((sale) => (
                            <Card key={sale.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                <div className="flex flex-col md:flex-row">
                                    {/* Vehicle Image */}
                                    <div className="w-full md:w-64 h-48 md:h-auto bg-slate-100 shrink-0">
                                        {sale.vehicle?.images?.[0] ? (
                                            <img
                                                src={getImageUrl(sale.vehicle.images[0]) || ""}
                                                alt={`${sale.vehicle.make} ${sale.vehicle.model}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Car className="h-12 w-12 text-slate-300" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Sale Details */}
                                    <div className="flex-1 p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                            <div>
                                                <h3 className="text-xl font-semibold mb-1">
                                                    {sale.vehicle?.year} {sale.vehicle?.make} {sale.vehicle?.model}
                                                </h3>
                                                {sale.remainingAmount && parseFloat(sale.remainingAmount) > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Booking Paid:</span>
                                                            <span className="text-lg font-bold text-amber-600">
                                                                {formatPrice(sale.bookingAmount || "0")}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Remaining:</span>
                                                            <span className="text-lg font-bold text-slate-500">
                                                                {formatPrice(sale.remainingAmount)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Sale Amount:</span>
                                                        <p className="text-2xl font-bold text-green-600">
                                                            {formatPrice(sale.amount)}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {getStatusBadge(sale)}
                                                {/* Confirm Full Payment button - for full payments or balance payments */}
                                                {(sale.status === "payment_initiated" || sale.status === "pending") &&
                                                    (!sale.remainingAmount || parseFloat(sale.remainingAmount) === 0) && (
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all"
                                                            onClick={() => handleConfirmPayment(sale.id)}
                                                            disabled={isConfirming === sale.id}
                                                        >
                                                            {isConfirming === sale.id ? (
                                                                <>Confirming...</>
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Confirm Full Payment
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    {format(new Date(sale.createdAt), "MMM dd, yyyy")}
                                                </span>
                                            </div>
                                            {sale.paymentMethod && (
                                                <div className="flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                    <span className="capitalize">{sale.paymentMethod}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Buyer Info */}
                                        {sale.buyer && (
                                            <div className="pt-4 border-t">
                                                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <User className="h-4 w-4" />
                                                    Buyer Information
                                                </p>
                                                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <User className="h-4 w-4" />
                                                        {sale.buyer.name}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Mail className="h-4 w-4" />
                                                        {sale.buyer.email}
                                                    </div>
                                                    {sale.buyer.phone && (
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <Phone className="h-4 w-4" />
                                                            {sale.buyer.phone}
                                                        </div>
                                                    )}
                                                </div>
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
                <div className="grid sm:grid-cols-3 gap-4 mb-8">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-48 rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
}
