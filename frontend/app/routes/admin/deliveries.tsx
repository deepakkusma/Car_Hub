import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { Card, CardContent } from "~/components/ui/card";
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
    Truck,
    ArrowLeft,
    CheckCircle,
    Calendar,
    MapPin,
    Car,
    User,
    RefreshCw,
    Clock,
    FileCheck,
    ClipboardCheck,
    Bell,
    PartyPopper,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { format } from "date-fns";

export default function AdminDeliveries() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

    // Delivery Update State
    const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
    const [selectedDeliveryTxn, setSelectedDeliveryTxn] = useState<Transaction | null>(null);
    const [deliveryStatus, setDeliveryStatus] = useState<string>("processing");
    const [estimatedDate, setEstimatedDate] = useState<string>("");
    const [deliveryNotes, setDeliveryNotes] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);

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
            fetchDeliveries();
        }
    }, [session, isPending, statusFilter, pagination.page]);

    const fetchDeliveries = async () => {
        setIsLoading(true);
        try {
            // Fetch all transactions
            const data = await adminApi.getPayments(undefined, 1, 1000);

            // Filter for only COMPLETED payments (ready for delivery management)
            const completedTransactions = data.transactions.filter(
                (t: Transaction) =>
                    (t.status === "payment_completed" || t.status === "completed") &&
                    (!t.remainingAmount || parseFloat(t.remainingAmount) <= 0)
            );

            // Group by vehicleId to deduplicate if needed (though completed usually means final)
            // Just strictly take the valid completed ones
            let finalTransactions = completedTransactions;

            // Apply specific delivery status filters
            if (statusFilter !== "all") {
                finalTransactions = finalTransactions.filter((t: Transaction) =>
                    (t.deliveryStatus || "processing") === statusFilter
                );
            }

            // Sort by date (newest first)
            finalTransactions.sort((a: Transaction, b: Transaction) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setTransactions(finalTransactions);
            setPagination({
                ...data.pagination,
                total: finalTransactions.length,
                totalPages: 1
            });
        } catch (error) {
            console.error("Failed to fetch deliveries:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeliveryUpdate = async () => {
        if (!selectedDeliveryTxn) return;

        setIsUpdating(true);
        try {
            await paymentsApi.updateDeliveryStatus(selectedDeliveryTxn.id, {
                deliveryStatus: deliveryStatus as any,
                estimatedReadyDate: estimatedDate ? new Date(estimatedDate).toISOString() : undefined,
                deliveryNotes: deliveryNotes
            });

            await fetchDeliveries();
            setDeliveryDialogOpen(false);
            setSelectedDeliveryTxn(null);
        } catch (error) {
            console.error("Failed to update delivery status:", error);
        } finally {
            setIsUpdating(false);
        }
    };

    const openDeliveryDialog = (transaction: Transaction) => {
        setSelectedDeliveryTxn(transaction);
        setDeliveryStatus(transaction.deliveryStatus || "processing");
        // Format for input type="date"
        setEstimatedDate(transaction.estimatedReadyDate ? new Date(transaction.estimatedReadyDate).toISOString().split('T')[0] : "");
        setDeliveryNotes(transaction.deliveryNotes || "");
        setDeliveryDialogOpen(true);
    };

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    const getDeliveryBadge = (status: string | null) => {
        switch (status) {
            case "processing":
                return (
                    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                        <Clock className="h-3 w-3 mr-1" /> Processing
                    </Badge>
                );
            case "inspection":
                return (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <ClipboardCheck className="h-3 w-3 mr-1" /> Inspection
                    </Badge>
                );
            case "documentation":
                return (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        <FileCheck className="h-3 w-3 mr-1" /> Documentation
                    </Badge>
                );
            case "ready_for_collection":
                return (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse">
                        <Bell className="h-3 w-3 mr-1" /> Ready for Collection
                    </Badge>
                );
            case "collected":
                return (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <PartyPopper className="h-3 w-3 mr-1" /> Collected
                    </Badge>
                );
            default:
                return <Badge variant="secondary">Unknown</Badge>;
        }
    };

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
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-slate-600">
                                <Truck className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold">Manage Deliveries</h1>
                                <p className="text-muted-foreground">
                                    Update shipping/delivery status for sold vehicles
                                </p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-3">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[250px]">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Deliveries</SelectItem>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="inspection">Inspection</SelectItem>
                                    <SelectItem value="documentation">Documentation</SelectItem>
                                    <SelectItem value="ready_for_collection">Ready for Collection</SelectItem>
                                    <SelectItem value="collected">Collected</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="outline" onClick={fetchDeliveries}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Deliveries List */}
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 rounded-lg" />
                            ))}
                        </div>
                    ) : transactions.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-medium mb-2">No Deliveries Found</h3>
                                <p className="text-muted-foreground">
                                    No completed purchases found requiring delivery management.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map((transaction) => (
                                <Card key={transaction.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                                    <div className="flex flex-col lg:flex-row">
                                        {/* Vehicle Image */}
                                        <div className="w-full lg:w-48 h-36 lg:h-auto bg-slate-100 shrink-0 relative">
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
                                            {/* Status Badge Overlay for Quick View */}
                                            <div className="absolute top-2 right-2 lg:hidden">
                                                {getDeliveryBadge(transaction.deliveryStatus || "processing")}
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 p-6">
                                            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold mb-1">
                                                        {transaction.vehicle?.year} {transaction.vehicle?.make} {transaction.vehicle?.model}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <MapPin className="h-3.5 w-3.5" />
                                                        {transaction.vehicle?.location || "Location N/A"}
                                                    </div>
                                                </div>
                                                <div className="hidden lg:block">
                                                    {getDeliveryBadge(transaction.deliveryStatus || "processing")}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Purchased On</span>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-slate-400" />
                                                        {format(new Date(transaction.createdAt), "MMM dd, yyyy")}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Buyer</span>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-slate-400" />
                                                        {transaction.buyer?.name || "N/A"}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Estimated Ready</span>
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-slate-400" />
                                                        {transaction.estimatedReadyDate ? (
                                                            format(new Date(transaction.estimatedReadyDate), "MMM dd, yyyy")
                                                        ) : (
                                                            <span className="text-slate-400 italic">Not set</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {transaction.deliveryNotes && (
                                                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                                                    <span className="font-semibold">Note:</span> {transaction.deliveryNotes}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-end pt-4 border-t">
                                                <Button
                                                    onClick={() => openDeliveryDialog(transaction)}
                                                    className="bg-orange-600 hover:bg-orange-700"
                                                >
                                                    <Truck className="h-4 w-4 mr-2" />
                                                    Update Status
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Delivery Update Dialog */}
            <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Delivery Status</DialogTitle>
                        <DialogDescription>
                            Update the tracking status for this vehicle. This will be visible to the buyer immediately.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="status">Current Status</Label>
                            <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="processing">Processing</SelectItem>
                                    <SelectItem value="inspection">Inspection</SelectItem>
                                    <SelectItem value="documentation">Documentation</SelectItem>
                                    <SelectItem value="ready_for_collection">Ready for Collection</SelectItem>
                                    {/* Collected is usually automatic but good to have manual override */}
                                    <SelectItem value="collected">Collected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="estimatedDate">Estimated Ready Date</Label>
                            <Input
                                id="estimatedDate"
                                type="date"
                                value={estimatedDate}
                                onChange={(e) => setEstimatedDate(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Add notes for the buyer (e.g., 'Please bring your ID for collection')"
                                value={deliveryNotes}
                                onChange={(e) => setDeliveryNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleDeliveryUpdate} disabled={isUpdating}>
                            {isUpdating ? "Updating..." : "Update Status"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
