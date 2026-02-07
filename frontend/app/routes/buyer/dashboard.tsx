import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { VehicleCard } from "~/components/vehicles/VehicleCard";
import { useSession } from "~/lib/auth-client";
import { favoritesApi, inquiriesApi, paymentsApi, analyticsApi, type Vehicle, type Inquiry, type AnalyticsData } from "~/lib/api";
import { Heart, MessageSquare, ShoppingBag, CalendarClock, ArrowRight, Truck, AlertCircle, PenTool, TrendingUp, Sparkles } from "lucide-react";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from "recharts";

export default function BuyerDashboard() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState<Vehicle[]>([]);
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [purchaseCount, setPurchaseCount] = useState(0);
    const [bookingCount, setBookingCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchData();
        }
    }, [session, isPending]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [favs, inqs, purchases, analyticsData] = await Promise.all([
                favoritesApi.getAll(),
                inquiriesApi.getAll("sent"),
                paymentsApi.getMyPurchases(),
                analyticsApi.getBuyerAnalytics(),
            ]);
            setFavorites(favs.slice(0, 4));
            setInquiries(inqs.slice(0, 5));

            // Process transactions to determine accurate counts
            const uniqueVehicles = new Map<string, any>();

            // Group/Deduplicate by vehicleId to find the latest/most relevant status for each car
            purchases.forEach((txn) => {
                const existing = uniqueVehicles.get(txn.vehicleId);
                if (!existing) {
                    uniqueVehicles.set(txn.vehicleId, txn);
                    return;
                }

                // Prioritize active/completed statuses over failed/cancelled
                const isTxnValid = txn.status !== "payment_failed" && txn.status !== "cancelled" && txn.status !== "refunded";
                const isExistingValid = existing.status !== "payment_failed" && existing.status !== "cancelled" && existing.status !== "refunded";

                if (isTxnValid && !isExistingValid) {
                    uniqueVehicles.set(txn.vehicleId, txn);
                } else if (isTxnValid && isExistingValid) {
                    // If both valid, prefer completed/paid
                    const isTxnCompleted = txn.status === "payment_completed" || txn.status === "completed";
                    const isExistingCompleted = existing.status === "payment_completed" || existing.status === "completed";

                    if (isTxnCompleted && !isExistingCompleted) {
                        uniqueVehicles.set(txn.vehicleId, txn);
                    } else if (new Date(txn.createdAt) > new Date(existing.createdAt)) {
                        // If same status 'weight', pick newer
                        uniqueVehicles.set(txn.vehicleId, txn);
                    }
                }
            });

            let validPurchases = 0;
            let validBookings = 0;

            uniqueVehicles.forEach((txn) => {
                // Ignore if the best we have is a failed transaction
                if (txn.status === "payment_failed" || txn.status === "cancelled" || txn.status === "refunded") return;

                const isCompleted = txn.status === "payment_completed" || txn.status === "completed";
                const hasRemaining = txn.remainingAmount && parseFloat(txn.remainingAmount) > 0;

                if (isCompleted && !hasRemaining) {
                    validPurchases++;
                } else if (txn.status === "payment_initiated" || txn.status === "pending" || (isCompleted && hasRemaining)) {
                    validBookings++;
                }
            });

            setPurchaseCount(validPurchases);
            setBookingCount(validBookings);
            setAnalytics(analyticsData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isPending) {
        return <LoadingSkeleton />;
    }

    const user = session?.user as any;
    const initials = user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U";

    return (
        <TooltipProvider>
            <div className="flex-1 bg-slate-50/50 min-h-full">
                <div className="container mx-auto px-4 py-8">
                    {/* Welcome Header */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 border-2 border-slate-100 shadow-sm">
                                    <AvatarImage src={user?.image || undefined} alt={user?.name} />
                                    <AvatarFallback className="bg-slate-900 text-white text-lg font-semibold">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm text-muted-foreground font-medium mb-1">Welcome back</p>
                                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                                        {user?.name?.split(" ")[0]}! 👋
                                    </h1>
                                    <p className="text-muted-foreground text-sm mt-1">
                                        Find your perfect vehicle from our collection
                                    </p>
                                </div>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                                <div className="flex items-center gap-2 text-emerald-600 mb-1">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-xs font-semibold uppercase tracking-wide">Total Spent</span>
                                </div>
                                <p className="text-3xl font-bold text-emerald-600">
                                    ₹{analytics?.summary.totalSpent?.toLocaleString('en-IN') || "0"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
                        <StatCard
                            icon={Heart}
                            iconBg="bg-pink-100"
                            iconColor="text-pink-600"
                            title="Favorites"
                            subtitle={`${favorites.length} saved`}
                            onClick={() => navigate("/buyer/favorites")}
                            tooltip="View your saved vehicles"
                        />
                        <StatCard
                            icon={MessageSquare}
                            iconBg="bg-blue-100"
                            iconColor="text-blue-600"
                            title="Inquiries"
                            subtitle={`${inquiries.length} messages`}
                            onClick={() => navigate("/buyer/inquiries")}
                            tooltip="View your inquiries"
                        />
                        <StatCard
                            icon={CalendarClock}
                            iconBg="bg-purple-100"
                            iconColor="text-purple-600"
                            title="Bookings"
                            subtitle={`${bookingCount} active`}
                            onClick={() => navigate("/buyer/bookings")}
                            tooltip="View your bookings"
                        />
                        <StatCard
                            icon={ShoppingBag}
                            iconBg="bg-emerald-100"
                            iconColor="text-emerald-600"
                            title="Purchases"
                            subtitle={`${purchaseCount} vehicles`}
                            onClick={() => navigate("/buyer/purchases")}
                            tooltip="View your purchased vehicles"
                        />
                        <StatCard
                            icon={Truck}
                            iconBg="bg-blue-100"
                            iconColor="text-blue-600"
                            title="Tracking"
                            subtitle="Delivery status"
                            onClick={() => navigate("/buyer/tracking")}
                            tooltip="Track your deliveries"
                        />
                        <StatCard
                            icon={AlertCircle}
                            iconBg="bg-red-100"
                            iconColor="text-red-600"
                            title="Issues"
                            subtitle="Report & track"
                            onClick={() => navigate("/buyer/issues")}
                            tooltip="Report issues or complaints"
                            highlight
                        />
                        <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded-lg bg-indigo-100">
                                        <PenTool className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <span className="font-semibold text-sm text-slate-700">Signature</span>
                                </div>
                                <div className="py-2 px-2 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden">
                                    <p className="text-xl text-indigo-900 whitespace-nowrap truncate" style={{ fontFamily: "'Great Vibes', cursive" }}>
                                        {user?.name || "Signature"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Analytics Section */}
                    {analytics && (
                        <Card className="mb-8 bg-white border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="pb-2 border-b border-slate-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-emerald-100">
                                            <Sparkles className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <CardTitle className="text-base font-semibold">Spending Analytics</CardTitle>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-medium bg-slate-100 px-2 py-1 rounded-full">Last 7 Days</span>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={analytics.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="spentFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#64748B' }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(value) => `₹${value / 1000}k`}
                                                tick={{ fontSize: 12, fill: '#64748B' }}
                                            />
                                            <RechartsTooltip
                                                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Spent']}
                                                contentStyle={{
                                                    borderRadius: '12px',
                                                    border: '1px solid #E2E8F0',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                    padding: '12px'
                                                }}
                                                cursor={{ strokeDasharray: '3 3', stroke: '#94A3B8' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="totalAmount"
                                                stroke="#10B981"
                                                strokeWidth={2}
                                                fill="url(#spentFill)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <Separator className="my-4" />
                                <div className="flex items-center justify-center gap-8 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <span className="text-muted-foreground">Total Spent:</span>
                                        <span className="font-semibold text-slate-900">₹{analytics.summary.totalSpent?.toLocaleString('en-IN') || "0"}</span>
                                    </div>
                                    <div className="h-4 w-px bg-slate-200" />
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Vehicles:</span>
                                        <span className="font-semibold text-slate-900">{analytics.summary.totalBought || 0}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Saved Vehicles */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-pink-100">
                                    <Heart className="h-4 w-4 text-pink-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">Saved Vehicles</h2>
                            </div>
                            <Button variant="ghost" asChild className="gap-1 text-muted-foreground hover:text-slate-900">
                                <Link to="/buyer/favorites">
                                    View All <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>

                        {isLoading ? (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
                                ))}
                            </div>
                        ) : favorites.length === 0 ? (
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardContent className="py-12 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-50 flex items-center justify-center">
                                        <Heart className="h-8 w-8 text-pink-400" />
                                    </div>
                                    <h3 className="font-semibold text-lg mb-2 text-slate-900">No saved vehicles yet</h3>
                                    <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                                        Start browsing and save vehicles you like to see them here
                                    </p>
                                    <Button asChild className="shadow-sm">
                                        <Link to="/vehicles">Browse Cars</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {favorites.map((vehicle) => (
                                    <VehicleCard key={vehicle.id} vehicle={vehicle} showFavorite={false} />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </TooltipProvider>
    );
}

interface StatCardProps {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    title: string;
    subtitle: string;
    onClick: () => void;
    tooltip?: string;
    highlight?: boolean;
}

function StatCard({ icon: Icon, iconBg, iconColor, title, subtitle, onClick, tooltip, highlight }: StatCardProps) {
    const card = (
        <Card
            className={`
                bg-white border-slate-200 shadow-sm cursor-pointer
                hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5
                transition-all duration-200 group
                ${highlight ? 'ring-1 ring-red-100' : ''}
            `}
            onClick={onClick}
        >
            <CardContent className="p-4 flex flex-col gap-3">
                <div className={`p-2 w-fit rounded-lg ${iconBg} transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div>
                    <h3 className="font-semibold text-sm text-slate-700">{title}</h3>
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
            </CardContent>
        </Card>
    );

    if (tooltip) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{card}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                    {tooltip}
                </TooltipContent>
            </Tooltip>
        );
    }

    return card;
}

function LoadingSkeleton() {
    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl border p-6 mb-8">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <div>
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-8 w-48 mb-2" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-28 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
