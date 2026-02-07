import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { useSession } from "~/lib/auth-client";
import { adminApi, paymentsApi, type Transaction } from "~/lib/api";
import {
    CreditCard,
    ArrowLeft,
    CheckCircle,
    XCircle,
    Clock,
    Car,
    User,
    Calendar,
    RefreshCw,
    AlertCircle,
    FileDown,
    FileText,
} from "lucide-react";
import { downloadInvoice } from "~/lib/invoice";
import { downloadRegistrationDoc } from "~/lib/registration-document";
import { format } from "date-fns";

export default function AdminPayments() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newStatus, setNewStatus] = useState<string>("");

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        const user = session?.user as any;
        if (user && user.role !== "admin") {
            navigate("/");
            return;
        }

        if (session?.user) {
            fetchPayments();
        }
    }, [session, isPending, statusFilter, pagination.page]);

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            // Fetch ALL transactions with high limit to properly deduplicate across all data
            const data = await adminApi.getPayments(undefined, 1, 1000);

            // Filter to only show payment_initiated and payment_completed statuses
            const relevantTransactions = data.transactions.filter(
                (t: Transaction) => t.status === "payment_initiated" || t.status === "payment_completed" || t.status === "completed"
            );

            // Group transactions by vehicleId
            const vehicleMap = new Map<string, Transaction[]>();
            relevantTransactions.forEach((txn: Transaction) => {
                const list = vehicleMap.get(txn.vehicleId) || [];
                list.push(txn);
                vehicleMap.set(txn.vehicleId, list);
            });

            // For each vehicle, pick the best transaction (payment_completed > payment_initiated)
            const uniqueTransactions: Transaction[] = [];
            vehicleMap.forEach((txnList) => {
                const completed = txnList.find(t => t.status === "payment_completed" || t.status === "completed");
                if (completed) {
                    uniqueTransactions.push(completed);
                } else {
                    // Get the most recent payment_initiated
                    const sorted = txnList.sort((a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );
                    uniqueTransactions.push(sorted[0]);
                }
            });

            // Apply filter based on payment type category
            let finalTransactions = uniqueTransactions;

            if (statusFilter === "booking_pending") {
                // Booking payments pending verification: has booking amount > 0 AND has remaining > 0 AND status is initiated
                finalTransactions = uniqueTransactions.filter(t =>
                    t.status === "payment_initiated" &&
                    t.bookingAmount &&
                    parseFloat(t.bookingAmount) > 0 &&
                    parseFloat(t.remainingAmount || "0") > 0
                );
            } else if (statusFilter === "full_pending") {
                // Full payments pending verification: either full payment OR balance payment (bookingAmount = 0)
                finalTransactions = uniqueTransactions.filter(t =>
                    t.status === "payment_initiated" &&
                    (!t.bookingAmount || parseFloat(t.bookingAmount) === 0 || parseFloat(t.remainingAmount || "0") === 0)
                );
            } else if (statusFilter === "verified") {
                // Already verified/completed payments
                finalTransactions = uniqueTransactions.filter(t => t.status === "payment_completed" || t.status === "completed");
            }
            // "all" shows everything

            // Sort by date (newest first)
            finalTransactions.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setTransactions(finalTransactions);
            // Update pagination with deduplicated count
            setPagination({
                ...data.pagination,
                total: finalTransactions.length,
                totalPages: 1
            });
        } catch (error) {
            console.error("Failed to fetch payments:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async () => {
        if (!selectedTransaction || !newStatus) return;

        setIsUpdating(true);
        try {
            await adminApi.updatePaymentStatus(selectedTransaction.id, newStatus);
            await fetchPayments();
            setDialogOpen(false);
            setSelectedTransaction(null);
            setNewStatus("");
        } catch (error) {
            console.error("Failed to update payment status:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const openStatusDialog = (transaction: Transaction, status: string) => {
        setSelectedTransaction(transaction);
        setNewStatus(status);
        setDialogOpen(true);
    };

    const formatPrice = (price: string) => {
        const num = parseFloat(price);
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
                        {status === "completed" ? "Completed" : "Payment Completed"}
                    </Badge>
                );
            case "payment_initiated":
            case "pending":
                return (
                    <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                        <Clock className="h-3 w-3 mr-1" />
                        {status === "pending" ? "Pending" : "Payment Initiated"}
                    </Badge>
                );
            case "payment_failed":
            case "cancelled":
                return (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                        <XCircle className="h-3 w-3 mr-1" />
                        {status === "cancelled" ? "Cancelled" : "Payment Failed"}
                    </Badge>
                );
            case "refunded":
                return (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        <RefreshCw className="h-3 w-3 mr-1" />
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

    const user = session?.user as any;

    if (isPending) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <main>
                <div className="container mx-auto px-4 py-8">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 mb-6">
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/admin/dashboard">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back to Dashboard
                            </Link>
                        </Button>
                    </div>

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                                <CreditCard className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold">Verify Payments</h1>
                                <p className="text-muted-foreground">
                                    View and manage all payment transactions
                                </p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-3">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[250px]">
                                    <SelectValue placeholder="Filter by type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Payments</SelectItem>
                                    <SelectItem value="booking_pending">🔶 Booking Verification</SelectItem>
                                    <SelectItem value="full_pending">🔷 Full Payment Verification</SelectItem>
                                    <SelectItem value="verified">✅ Verified Payments</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline" onClick={fetchPayments}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Payments List */}
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-32 rounded-lg" />
                            ))}
                        </div>
                    ) : transactions.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-medium mb-2">No Payments Found</h3>
                                <p className="text-muted-foreground">
                                    {statusFilter !== "all"
                                        ? `No ${statusFilter.replace("_", " ")} payments found.`
                                        : "There are no payment transactions yet."}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map((transaction) => (
                                <Card key={transaction.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                    <div className="flex flex-col lg:flex-row">
                                        {/* Vehicle Image */}
                                        <div className="w-full lg:w-48 h-36 lg:h-auto bg-slate-100 shrink-0">
                                            {transaction.vehicle?.images?.[0] ? (
                                                <img
                                                    src={getImageUrl(transaction.vehicle.images[0]) || ""}
                                                    alt={`${transaction.vehicle.make} ${transaction.vehicle.model}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Car className="h-12 w-12 text-slate-300" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Transaction Details */}
                                        <div className="flex-1 p-6">
                                            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-1">
                                                        {transaction.vehicle?.year} {transaction.vehicle?.make} {transaction.vehicle?.model}
                                                    </h3>
                                                    {/* Show payment type and amounts */}
                                                    {(() => {
                                                        const bookingAmt = parseFloat(transaction.bookingAmount || "0");
                                                        const remainingAmt = parseFloat(transaction.remainingAmount || "0");
                                                        const totalAmt = parseFloat(transaction.amount || "0");
                                                        const isCashBookingType = transaction.paymentType === "cash_booking";

                                                        // Initial booking: has token amount > 0 AND has remaining balance > 0
                                                        const isInitialBooking = bookingAmt > 0 && remainingAmt > 0;

                                                        // Balance payment: bookingAmount is 0 AND it's a cash_booking type (balance paid via cash)
                                                        // OR status is completed/payment_completed and remainingAmount is 0 with cash_booking type
                                                        const isBalancePayment = isCashBookingType && bookingAmt === 0 && remainingAmt === 0;

                                                        if (isInitialBooking) {
                                                            // Initial booking - show token paid + remaining
                                                            return (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge className="bg-amber-100 text-amber-700 text-xs">
                                                                            Booking Payment (5% Token)
                                                                        </Badge>
                                                                        <span className="text-xs text-muted-foreground capitalize">
                                                                            ({transaction.paymentType?.replace(/_/g, " ") || "N/A"})
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Total Price: <span className="font-semibold text-slate-700">{formatPrice(transaction.amount)}</span>
                                                                    </p>
                                                                    <p className="text-sm">
                                                                        Token Paid: <span className="font-bold text-green-600">{formatPrice(transaction.bookingAmount)}</span>
                                                                    </p>
                                                                    <p className="text-sm">
                                                                        Remaining (95%): <span className="font-bold text-amber-600">{formatPrice(transaction.remainingAmount || "0")}</span>
                                                                    </p>
                                                                </div>
                                                            );
                                                        } else if (isBalancePayment) {
                                                            // Balance payment via cash - remainingAmount is now 0
                                                            const tokenPaidEarlier = Math.round(totalAmt * 0.05);
                                                            const balancePaid = totalAmt - tokenPaidEarlier;
                                                            return (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge className="bg-blue-100 text-blue-700 text-xs">
                                                                            Balance Payment (Cash)
                                                                        </Badge>
                                                                        <span className="text-xs text-muted-foreground capitalize">
                                                                            (95% of total)
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Total Price: <span className="font-semibold text-slate-700">{formatPrice(transaction.amount)}</span>
                                                                    </p>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        Token Paid Earlier (5%): <span className="font-semibold text-slate-700">{formatPrice(String(tokenPaidEarlier))}</span>
                                                                    </p>
                                                                    <p className="text-lg font-bold text-green-600">
                                                                        Balance Paid (95%): {formatPrice(String(balancePaid))}
                                                                    </p>
                                                                </div>
                                                            );
                                                        } else {
                                                            // Full payment (direct full card payment, no booking)
                                                            return (
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge className="bg-green-100 text-green-700 text-xs">
                                                                            Full Payment
                                                                        </Badge>
                                                                        <span className="text-xs text-muted-foreground capitalize">
                                                                            ({transaction.paymentType?.replace(/_/g, " ") || "Card"})
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-2xl font-bold text-green-600">
                                                                        {formatPrice(transaction.amount)}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {getStatusBadge(transaction.status)}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span>
                                                        {format(new Date(transaction.createdAt), "MMM dd, yyyy HH:mm")}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate">
                                                        Buyer: {transaction.buyer?.name || "N/A"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate">
                                                        Seller: {transaction.seller?.name || "N/A"}
                                                    </span>
                                                </div>
                                                {transaction.razorpayPaymentId && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <CreditCard className="h-4 w-4" />
                                                        <span className="text-xs truncate">
                                                            {transaction.razorpayPaymentId}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Error Message */}
                                            {transaction.status === "payment_failed" && transaction.paymentErrorDescription && (
                                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                    {transaction.paymentErrorDescription}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="flex flex-wrap gap-2 pt-4 border-t">
                                                {transaction.status === "payment_initiated" && (
                                                    <>
                                                        {/* Show different button based on booking vs balance vs full payment */}
                                                        {(() => {
                                                            const bookingAmt = parseFloat(transaction.bookingAmount || "0");
                                                            const remainingAmt = parseFloat(transaction.remainingAmount || "0");
                                                            const isCashBookingType = transaction.paymentType === "cash_booking";

                                                            const isInitialBooking = bookingAmt > 0 && remainingAmt > 0;
                                                            const isBalancePayment = isCashBookingType && bookingAmt === 0;

                                                            if (isInitialBooking) {
                                                                return (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-amber-600 hover:bg-amber-700"
                                                                        onClick={() => openStatusDialog(transaction, "payment_completed")}
                                                                    >
                                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                                        Verify Booking (5% Token)
                                                                    </Button>
                                                                );
                                                            } else if (isBalancePayment) {
                                                                return (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-blue-600 hover:bg-blue-700"
                                                                        onClick={() => openStatusDialog(transaction, "payment_completed")}
                                                                    >
                                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                                        Verify Balance Payment (95%)
                                                                    </Button>
                                                                );
                                                            } else {
                                                                return (
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                        onClick={() => openStatusDialog(transaction, "payment_completed")}
                                                                    >
                                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                                        Verify Full Payment
                                                                    </Button>
                                                                );
                                                            }
                                                        })()}
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => openStatusDialog(transaction, "payment_failed")}
                                                        >
                                                            <XCircle className="h-4 w-4 mr-1" />
                                                            Reject
                                                        </Button>
                                                    </>
                                                )}
                                                {(transaction.status === "payment_completed" || transaction.status === "completed") && (
                                                    <>
                                                        {/* Only show Mark as Completed if not already completed status (though we merge them visually) */}
                                                        {transaction.status === "payment_completed" && (
                                                            <Button
                                                                size="sm"
                                                                className="bg-blue-600 hover:bg-blue-700"
                                                                onClick={() => openStatusDialog(transaction, "completed")}
                                                            >
                                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                                Finalize Transaction
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                                {(transaction.status === "pending" || transaction.status === "payment_failed") && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openStatusDialog(transaction, "cancelled")}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1" />
                                                        Cancel
                                                    </Button>
                                                )}

                                                {/* Download Buttons - visible for completed payments */}
                                                {(transaction.status === "payment_completed" || transaction.status === "completed") && (
                                                    <div className="ml-auto flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                                            onClick={() => downloadRegistrationDoc(transaction)}
                                                        >
                                                            <FileText className="h-4 w-4 mr-1" />
                                                            Registration Doc
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                                            onClick={() => downloadInvoice(transaction)}
                                                        >
                                                            <FileDown className="h-4 w-4 mr-1" />
                                                            Invoice
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-6">
                                    <Button
                                        variant="outline"
                                        disabled={pagination.page === 1}
                                        onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        disabled={pagination.page === pagination.totalPages}
                                        onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Status Update Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {newStatus === "payment_completed" && selectedTransaction ? (
                                selectedTransaction.bookingAmount &&
                                    parseFloat(selectedTransaction.bookingAmount) > 0 &&
                                    parseFloat(selectedTransaction.remainingAmount || "0") > 0
                                    ? "Verify Booking Payment"
                                    : "Verify Full Payment"
                            ) : (
                                "Update Payment Status"
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {newStatus === "payment_completed" && selectedTransaction ? (
                                selectedTransaction.bookingAmount &&
                                    parseFloat(selectedTransaction.bookingAmount) > 0 &&
                                    parseFloat(selectedTransaction.remainingAmount || "0") > 0 ? (
                                    <>
                                        Confirming this will verify the booking payment of <strong>₹{parseFloat(selectedTransaction.bookingAmount).toLocaleString("en-IN")}</strong>.
                                        <br /><br />
                                        The buyer will still need to pay the remaining balance of <strong>₹{parseFloat(selectedTransaction.remainingAmount || "0").toLocaleString("en-IN")}</strong>.
                                        <br /><br />
                                        Once they pay the full amount, it will appear in the <strong>Full Payment Verification</strong> section.
                                    </>
                                ) : (
                                    <>
                                        Confirming this will verify the <strong>full payment</strong> and mark the vehicle as <strong>SOLD</strong>.
                                        <br /><br />
                                        The transaction will move to the buyer's <strong>"My Purchases"</strong> section.
                                    </>
                                )
                            ) : newStatus === "payment_failed" ? (
                                "This payment will be marked as failed/rejected."
                            ) : (
                                <>Are you sure you want to update this transaction?</>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTransaction && (
                        <div className="py-4">
                            <p className="text-sm text-muted-foreground mb-2">Transaction Details:</p>
                            <p className="font-medium">
                                {selectedTransaction.vehicle?.year} {selectedTransaction.vehicle?.make} {selectedTransaction.vehicle?.model}
                            </p>
                            <p className="text-lg font-bold text-green-600">
                                {formatPrice(selectedTransaction.amount)}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleStatusUpdate}
                            disabled={isUpdating}
                            className={
                                newStatus === "payment_completed" || newStatus === "completed"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : newStatus === "refunded"
                                        ? "bg-blue-600 hover:bg-blue-700"
                                        : ""
                            }
                        >
                            {isUpdating ? "Updating..." : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <main>
                <div className="container mx-auto px-4 py-8">
                    <Skeleton className="h-10 w-64 mb-2" />
                    <Skeleton className="h-5 w-48 mb-8" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="h-32 rounded-lg" />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
