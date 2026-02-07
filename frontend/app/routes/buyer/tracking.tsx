import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { useSession } from "~/lib/auth-client";
import { paymentsApi, type Transaction, type DeliveryStatus } from "~/lib/api";
import {
    Package,
    Car,
    Phone,
    MapPin,
    Calendar,
    CheckCircle,
    Clock,
    ArrowLeft,
    Loader2,
    Truck,
    FileCheck,
    ClipboardCheck,
    PartyPopper,
    Bell,
} from "lucide-react";
import { format } from "date-fns";

interface TrackingStep {
    status: DeliveryStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const trackingSteps: TrackingStep[] = [
    {
        status: "processing",
        label: "Processing",
        description: "Your purchase is being processed",
        icon: <Package className="h-5 w-5" />,
    },
    {
        status: "inspection",
        label: "Inspection",
        description: "Vehicle undergoing quality inspection",
        icon: <ClipboardCheck className="h-5 w-5" />,
    },
    {
        status: "documentation",
        label: "Documentation",
        description: "Preparing ownership documents",
        icon: <FileCheck className="h-5 w-5" />,
    },
    {
        status: "ready_for_collection",
        label: "Ready for Collection",
        description: "Visit the store to collect your vehicle",
        icon: <Bell className="h-5 w-5" />,
    },
    {
        status: "collected",
        label: "Collected",
        description: "Vehicle successfully collected",
        icon: <PartyPopper className="h-5 w-5" />,
    },
];

export default function BuyerTracking() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [purchases, setPurchases] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchPurchases();
        }
    }, [session, isPending]);

    const fetchPurchases = async () => {
        setIsLoading(true);
        try {
            const data = await paymentsApi.getMyPurchases();
            // Filter to only show completed purchases (for tracking)
            const completedPurchases = data.filter((txn) => {
                const isCompleted = txn.status === "payment_completed" || txn.status === "completed";
                const hasNoRemaining = !txn.remainingAmount || parseFloat(txn.remainingAmount) <= 0;
                return isCompleted && hasNoRemaining;
            });

            // Deduplicate by vehicleId
            const vehicleMap = new Map<string, Transaction>();
            for (const purchase of completedPurchases) {
                const existing = vehicleMap.get(purchase.vehicleId);
                if (!existing || new Date(purchase.createdAt) > new Date(existing.createdAt)) {
                    vehicleMap.set(purchase.vehicleId, purchase);
                }
            }

            setPurchases(Array.from(vehicleMap.values()));
        } catch (error) {
            console.error("Failed to fetch purchases:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmCollection = async (transactionId: string) => {
        setConfirmingId(transactionId);
        try {
            const result = await paymentsApi.confirmCollection(transactionId);
            if (result.success) {
                setSuccessMessage(result.message);
                await fetchPurchases();
                setTimeout(() => setSuccessMessage(null), 5000);
            }
        } catch (error) {
            console.error("Failed to confirm collection:", error);
        } finally {
            setConfirmingId(null);
        }
    };

    const getStepStatus = (currentStatus: DeliveryStatus | null, stepStatus: DeliveryStatus): "completed" | "current" | "pending" => {
        const statusOrder = ["processing", "inspection", "documentation", "ready_for_collection", "collected"];
        const currentIndex = statusOrder.indexOf(currentStatus || "processing");
        const stepIndex = statusOrder.indexOf(stepStatus);

        if (stepIndex < currentIndex) return "completed";
        if (stepIndex === currentIndex) return "current";
        return "pending";
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

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    const getDeliveryBadge = (status: DeliveryStatus | null) => {
        switch (status) {
            case "ready_for_collection":
                return (
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse">
                        <Bell className="h-3 w-3 mr-1" />
                        Ready for Collection!
                    </Badge>
                );
            case "collected":
                return (
                    <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Collected
                    </Badge>
                );
            case "inspection":
                return (
                    <Badge className="bg-yellow-100 text-yellow-700">
                        <ClipboardCheck className="h-3 w-3 mr-1" />
                        Under Inspection
                    </Badge>
                );
            case "documentation":
                return (
                    <Badge className="bg-purple-100 text-purple-700">
                        <FileCheck className="h-3 w-3 mr-1" />
                        Documentation
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-slate-100 text-slate-700">
                        <Clock className="h-3 w-3 mr-1" />
                        Processing
                    </Badge>
                );
        }
    };

    if (isPending) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-full">
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

                {/* Success Message */}
                {successMessage && (
                    <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 flex items-center gap-3">
                        <PartyPopper className="h-6 w-6 text-green-600" />
                        <span className="font-medium text-green-700">{successMessage}</span>
                    </div>
                )}

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            <Truck className="h-7 w-7" />
                        </div>
                        Track Your Cars
                    </h1>
                    <p className="text-muted-foreground">
                        Monitor the status of your purchased vehicles and get notified when they're ready for collection
                    </p>
                </div>

                {/* Tracking Cards */}
                {isLoading ? (
                    <div className="space-y-6">
                        {[1, 2].map((i) => (
                            <Skeleton key={i} className="h-80 rounded-2xl" />
                        ))}
                    </div>
                ) : purchases.length === 0 ? (
                    <Card className="rounded-2xl shadow-lg border-0">
                        <CardContent className="py-16 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                <Package className="h-10 w-10 text-blue-500" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">No Purchases to Track</h3>
                            <p className="text-muted-foreground mb-6">
                                You haven't purchased any vehicles yet. Browse our collection to find your perfect car!
                            </p>
                            <Button asChild className="rounded-full px-6">
                                <Link to="/vehicles">Browse Vehicles</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {purchases.map((purchase) => (
                            <Card key={purchase.id} className="overflow-hidden rounded-2xl shadow-lg border-0 hover:shadow-xl transition-all duration-300">
                                <div className="flex flex-col lg:flex-row">
                                    {/* Vehicle Image */}
                                    <div className="w-full lg:w-72 h-56 lg:h-auto bg-gradient-to-br from-slate-100 to-slate-200 shrink-0 relative">
                                        {purchase.vehicle?.images?.[0] ? (
                                            <img
                                                src={getImageUrl(purchase.vehicle.images[0]) || ""}
                                                alt={`${purchase.vehicle.make} ${purchase.vehicle.model}`}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Car className="h-16 w-16 text-slate-300" />
                                            </div>
                                        )}
                                        {/* Ready for Collection Overlay */}
                                        {purchase.deliveryStatus === "ready_for_collection" && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-green-600/90 to-transparent flex items-end justify-center pb-4">
                                                <span className="text-white font-bold text-lg flex items-center gap-2">
                                                    <Bell className="h-5 w-5 animate-bounce" />
                                                    Ready for Collection!
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 p-6">
                                        {/* Header */}
                                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold mb-1">
                                                    {purchase.vehicle?.year} {purchase.vehicle?.make} {purchase.vehicle?.model}
                                                </h3>
                                                <p className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                                    {formatPrice(purchase.amount)}
                                                </p>
                                            </div>
                                            {getDeliveryBadge(purchase.deliveryStatus)}
                                        </div>

                                        {/* Info Row */}
                                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4" />
                                                <span>Purchased: {format(new Date(purchase.createdAt), "MMM dd, yyyy")}</span>
                                            </div>
                                            {purchase.estimatedReadyDate && (
                                                <div className="flex items-center gap-2 text-blue-600">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Est. Ready: {format(new Date(purchase.estimatedReadyDate), "MMM dd, yyyy")}</span>
                                                </div>
                                            )}
                                            {purchase.vehicle?.location && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>{purchase.vehicle.location}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Tracking Timeline */}
                                        <div className="mb-6">
                                            <div className="flex items-center justify-between relative">
                                                {/* Progress Line */}
                                                <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 rounded-full z-0">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${(trackingSteps.findIndex(s => s.status === (purchase.deliveryStatus || "processing")) / (trackingSteps.length - 1)) * 100}%`
                                                        }}
                                                    />
                                                </div>

                                                {trackingSteps.map((step, index) => {
                                                    const stepState = getStepStatus(purchase.deliveryStatus, step.status);
                                                    return (
                                                        <div key={step.status} className="flex flex-col items-center z-10 relative">
                                                            <div
                                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${stepState === "completed"
                                                                    ? "bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-200"
                                                                    : stepState === "current"
                                                                        ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-200 ring-4 ring-blue-100"
                                                                        : "bg-white border-2 border-slate-200 text-slate-400"
                                                                    }`}
                                                            >
                                                                {stepState === "completed" ? (
                                                                    <CheckCircle className="h-5 w-5" />
                                                                ) : (
                                                                    step.icon
                                                                )}
                                                            </div>
                                                            <span className={`text-xs mt-2 text-center font-medium ${stepState === "current" ? "text-blue-600" : stepState === "completed" ? "text-green-600" : "text-slate-400"
                                                                }`}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Delivery Notes */}
                                        {purchase.deliveryNotes && (
                                            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                                                <strong>Note from seller:</strong> {purchase.deliveryNotes}
                                            </div>
                                        )}

                                        {/* Seller Contact & Actions */}
                                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
                                            {purchase.vehicle?.seller && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                                        {purchase.vehicle.seller.image ? (
                                                            <img src={purchase.vehicle.seller.image} alt="" className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            <span className="text-sm font-bold text-slate-500">
                                                                {purchase.vehicle.seller.name?.charAt(0).toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium">{purchase.vehicle.seller.name}</p>
                                                        {purchase.vehicle.seller.phone && (
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {purchase.vehicle.seller.phone}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Confirm Collection Button */}
                                            {purchase.deliveryStatus === "ready_for_collection" && (
                                                <Button
                                                    onClick={() => handleConfirmCollection(purchase.id)}
                                                    disabled={confirmingId === purchase.id}
                                                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-full px-6 shadow-lg shadow-green-200"
                                                >
                                                    {confirmingId === purchase.id ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Confirming...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="h-4 w-4 mr-2" />
                                                            Confirm Collection
                                                        </>
                                                    )}
                                                </Button>
                                            )}

                                            {purchase.deliveryStatus === "collected" && purchase.collectedAt && (
                                                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full">
                                                    <PartyPopper className="h-4 w-4" />
                                                    <span>Collected on {format(new Date(purchase.collectedAt), "MMM dd, yyyy")}</span>
                                                </div>
                                            )}
                                        </div>
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
                <Skeleton className="h-5 w-96 mb-8" />
                <div className="space-y-6">
                    {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-80 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
