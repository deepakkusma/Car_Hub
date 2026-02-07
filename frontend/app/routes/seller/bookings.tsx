import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useSession } from "~/lib/auth-client";
import { paymentsApi, type Transaction } from "~/lib/api";
import {
    Bookmark,
    Car,
    Phone,
    Mail,
    Calendar,
    CreditCard,
    CheckCircle,
    Clock,
    ArrowLeft,
    User,
    AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

export default function SellerBookings() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [allBookings, setAllBookings] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("pending");

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchBookings();
        }
    }, [session, isPending]);

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            const data = await paymentsApi.getMySales();
            // Filter for bookings with remaining balance (both pending and confirmed)
            const bookingsWithBalance = data.filter((s) => {
                // Exclude failed and cancelled
                if (s.status === "payment_failed" || s.status === "cancelled") return false;

                // Only include transactions with remaining balance
                const hasRemaining = s.remainingAmount && parseFloat(s.remainingAmount) > 0;
                return hasRemaining;
            });
            setAllBookings(bookingsWithBalance);
        } catch (error) {
            console.error("Failed to fetch bookings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Split bookings into pending and confirmed
    const pendingBookings = allBookings.filter(
        (b) => b.status === "payment_initiated" || b.status === "pending"
    );
    const confirmedBookings = allBookings.filter(
        (b) => b.status === "payment_completed" || b.status === "completed"
    );

    const handleConfirmBooking = async (transactionId: string) => {
        if (!confirm("Are you sure you have received the booking payment? This will confirm the booking.")) return;

        setIsConfirming(transactionId);
        try {
            await paymentsApi.confirmBooking(transactionId);
            // Refresh list
            await fetchBookings();
        } catch (error) {
            console.error("Failed to confirm booking:", error);
            alert("Failed to confirm booking");
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

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    if (isPending) {
        return <LoadingSkeleton />;
    }

    const renderBookingCard = (booking: Transaction, showConfirmButton: boolean) => (
        <Card key={booking.id} className={`overflow-hidden hover:shadow-lg transition-shadow border-l-4 ${showConfirmButton ? 'border-l-amber-500' : 'border-l-green-500'}`}>
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
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Booking Amount:</span>
                                    <span className="text-lg font-bold text-amber-600">
                                        {formatPrice(booking.bookingAmount || "0")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Remaining:</span>
                                    <span className="text-lg font-bold text-slate-500">
                                        {formatPrice(booking.remainingAmount || "0")}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total:</span>
                                    <span className="text-lg font-bold text-slate-700">
                                        {formatPrice(booking.amount)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {showConfirmButton ? (
                                <>
                                    <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Awaiting Confirmation
                                    </Badge>
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg transition-all"
                                        onClick={() => handleConfirmBooking(booking.id)}
                                        disabled={isConfirming === booking.id}
                                    >
                                        {isConfirming === booking.id ? (
                                            <>Confirming...</>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Confirm Booking
                                            </>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Booking Confirmed
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {format(new Date(booking.createdAt), "MMM dd, yyyy")}
                            </span>
                        </div>
                        {booking.paymentType && (
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <span className="capitalize">{booking.paymentType.replace(/_/g, " ")}</span>
                            </div>
                        )}
                    </div>

                    {/* Buyer Info */}
                    {booking.buyer && (
                        <div className="pt-4 border-t">
                            <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Buyer Information
                            </p>
                            <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-4 w-4" />
                                    {booking.buyer.name}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    {booking.buyer.email}
                                </div>
                                {booking.buyer.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="h-4 w-4" />
                                        {booking.buyer.phone}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );

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
                        <Bookmark className="h-8 w-8 text-amber-600" />
                        Bookings
                    </h1>
                    <p className="text-muted-foreground">
                        Manage all vehicle bookings from buyers
                    </p>
                </div>

                {/* Stats */}
                {!isLoading && (
                    <div className="grid sm:grid-cols-3 gap-4 mb-8">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                                        <Clock className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Pending</p>
                                        <p className="text-2xl font-bold text-amber-600">{pendingBookings.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                                        <CheckCircle className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Confirmed</p>
                                        <p className="text-2xl font-bold text-green-600">{confirmedBookings.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                                        <AlertCircle className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Booking Amount</p>
                                        <p className="text-2xl font-bold">
                                            {formatPrice(allBookings.reduce((sum, b) => sum + parseFloat(b.bookingAmount || "0"), 0).toString())}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Tabs for Pending and Confirmed */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-48 rounded-lg" />
                        ))}
                    </div>
                ) : allBookings.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-medium mb-2">No Active Bookings</h3>
                            <p className="text-muted-foreground mb-6">
                                No bookings with pending balance at the moment.
                            </p>
                            <Button asChild variant="outline">
                                <Link to="/seller/sales">View Completed Sales</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                            <TabsTrigger value="pending" className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Pending ({pendingBookings.length})
                            </TabsTrigger>
                            <TabsTrigger value="confirmed" className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                Confirmed ({confirmedBookings.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="pending">
                            {pendingBookings.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                                        <h3 className="text-lg font-medium mb-2">All Caught Up!</h3>
                                        <p className="text-muted-foreground">
                                            No pending booking confirmations.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {pendingBookings.map((booking) => renderBookingCard(booking, true))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="confirmed">
                            {confirmedBookings.length === 0 ? (
                                <Card>
                                    <CardContent className="py-12 text-center">
                                        <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-medium mb-2">No Confirmed Bookings</h3>
                                        <p className="text-muted-foreground">
                                            Confirmed bookings awaiting full payment will appear here.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {confirmedBookings.map((booking) => renderBookingCard(booking, false))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
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
