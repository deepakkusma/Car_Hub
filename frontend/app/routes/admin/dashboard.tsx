import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useSession } from "~/lib/auth-client";
import { adminApi } from "~/lib/api";
import {
    Users,
    Car,
    MessageSquare,
    ArrowRight,
    ShieldCheck,
    CreditCard,
    Flag,
    Truck,
    TrendingUp,
    Activity,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    BarChart3,
    PieChart as PieChartIcon,
    ExternalLink,
    RefreshCw,
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    Legend,
    AreaChart,
    Area,
} from "recharts";

export default function AdminDashboard() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

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
            fetchStats();
        }
    }, [session, isPending]);

    const fetchStats = async (refresh = false) => {
        if (refresh) setIsRefreshing(true);
        try {
            const data = await adminApi.getStats();
            setStats(data);
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const user = session?.user as any;

    const quickActions = [
        {
            title: "User Management",
            description: "View, verify, and manage user accounts",
            icon: Users,
            href: "/admin/users",
            color: "bg-blue-500/10 text-blue-600",
            badge: stats?.totalUsers,
        },
        {
            title: "Vehicle Listings",
            description: "Approve or reject vehicle listings",
            icon: Car,
            href: "/admin/listings",
            color: "bg-orange-500/10 text-orange-600",
            badge: stats?.pendingListings,
            badgeVariant: "warning" as const,
        },
        {
            title: "Payment Verification",
            description: "Verify and manage payment transactions",
            icon: CreditCard,
            href: "/admin/payments",
            color: "bg-emerald-500/10 text-emerald-600",
        },
        {
            title: "Delivery Management",
            description: "Track and update vehicle deliveries",
            icon: Truck,
            href: "/admin/deliveries",
            color: "bg-amber-500/10 text-amber-600",
        },
        {
            title: "Customer Inquiries",
            description: "View and respond to customer queries",
            icon: MessageSquare,
            href: "/admin/inquiries",
            color: "bg-purple-500/10 text-purple-600",
            badge: stats?.pendingInquiries,
            badgeVariant: "warning" as const,
        },
        {
            title: "Complaints",
            description: "Review and resolve user complaints",
            icon: Flag,
            href: "/admin/complaints",
            color: "bg-red-500/10 text-red-600",
        },
    ];

    const roleColors: Record<string, string> = {
        buyer: "#3b82f6",
        seller: "#f97316",
        admin: "#8b5cf6",
    };

    const statusColors: Record<string, string> = {
        pending: "#f59e0b",
        approved: "#10b981",
        rejected: "#ef4444",
        sold: "#6366f1",
    };

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <main>
                <div className="container mx-auto px-4 py-8 max-w-7xl">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-slate-900 shadow-lg">
                                <ShieldCheck className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                                <p className="text-muted-foreground">
                                    Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchStats(true)}
                            disabled={isRefreshing}
                            className="w-fit"
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                            Refresh Data
                        </Button>
                    </div>

                    {/* Stats Overview */}
                    {isLoading ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-28 rounded-xl" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <TooltipProvider>
                                {/* Total Users */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Card
                                            className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-white"
                                            onClick={() => navigate("/admin/users")}
                                        >
                                            <CardContent className="p-5">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                                                        <p className="text-3xl font-bold mt-1">{stats?.totalUsers || 0}</p>
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                                                            <span className="text-xs text-emerald-600 font-medium">Active platform</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                                                        <Users className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TooltipTrigger>
                                    <TooltipContent>Click to manage users</TooltipContent>
                                </Tooltip>

                                {/* Total Vehicles */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Card
                                            className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-white"
                                            onClick={() => navigate("/admin/listings")}
                                        >
                                            <CardContent className="p-5">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Total Vehicles</p>
                                                        <p className="text-3xl font-bold mt-1">{stats?.totalVehicles || 0}</p>
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <Activity className="h-3 w-3 text-blue-500" />
                                                            <span className="text-xs text-blue-600 font-medium">
                                                                {stats?.vehiclesByStatus?.pending || 0} pending
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="p-2.5 rounded-xl bg-blue-100 group-hover:bg-blue-200 transition-colors">
                                                        <Car className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TooltipTrigger>
                                    <TooltipContent>Click to manage listings</TooltipContent>
                                </Tooltip>

                                {/* Total Inquiries */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Card
                                            className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-white"
                                            onClick={() => navigate("/admin/inquiries")}
                                        >
                                            <CardContent className="p-5">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Inquiries</p>
                                                        <p className="text-3xl font-bold mt-1">{stats?.totalInquiries || 0}</p>
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <MessageSquare className="h-3 w-3 text-purple-500" />
                                                            <span className="text-xs text-purple-600 font-medium">Customer queries</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                                                        <MessageSquare className="h-5 w-5 text-purple-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TooltipTrigger>
                                    <TooltipContent>Click to view inquiries</TooltipContent>
                                </Tooltip>

                                {/* Total Transactions */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Card
                                            className="group cursor-pointer border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-white"
                                            onClick={() => navigate("/admin/payments")}
                                        >
                                            <CardContent className="p-5">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                                                        <p className="text-3xl font-bold mt-1">{stats?.totalTransactions || 0}</p>
                                                        <div className="flex items-center gap-1 mt-2">
                                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                            <span className="text-xs text-emerald-600 font-medium">Payment records</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                                                        <CreditCard className="h-5 w-5 text-emerald-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TooltipTrigger>
                                    <TooltipContent>Click to verify payments</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}

                    {/* Quick Actions Grid */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Quick Actions</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {quickActions.map((action) => (
                                <Card
                                    key={action.title}
                                    className="group cursor-pointer border shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200"
                                    onClick={() => navigate(action.href)}
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-xl ${action.color} transition-colors`}>
                                                <action.icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-sm group-hover:text-slate-900 transition-colors">
                                                        {action.title}
                                                    </h3>
                                                    {action.badge !== undefined && action.badge > 0 && (
                                                        <Badge
                                                            variant="secondary"
                                                            className={
                                                                action.badgeVariant === "warning"
                                                                    ? "bg-amber-100 text-amber-700 text-xs"
                                                                    : "text-xs"
                                                            }
                                                        >
                                                            {action.badge}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                    {action.description}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Analytics Section */}
                    {stats && (
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Users by Role - Donut Chart */}
                            <Card className="border shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                                                Users by Role
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                Distribution of platform users
                                            </CardDescription>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/users")}>
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-6">
                                        <div className="w-36 h-36">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={Object.entries(stats.usersByRole || {}).map(([role, count]) => ({
                                                            name: role.charAt(0).toUpperCase() + role.slice(1),
                                                            value: count as number,
                                                        }))}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={40}
                                                        outerRadius={65}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {Object.entries(stats.usersByRole || {}).map(([role], index) => (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={roleColors[role] || "#94a3b8"}
                                                                stroke="none"
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        contentStyle={{
                                                            borderRadius: "8px",
                                                            border: "none",
                                                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                                            fontSize: "12px",
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            {Object.entries(stats.usersByRole || {}).map(([role, count]) => (
                                                <div
                                                    key={role}
                                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: roleColors[role] || "#94a3b8" }}
                                                        />
                                                        <span className="capitalize text-sm font-medium">{role}s</span>
                                                    </div>
                                                    <span className="text-sm font-bold tabular-nums">{count as number}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Vehicles by Status - Bar Chart */}
                            <Card className="border shadow-sm">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                                Vehicle Status
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                Current listing statuses
                                            </CardDescription>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/listings")}>
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-52">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={Object.entries(stats.vehiclesByStatus || {}).map(([status, count]) => ({
                                                    name: status.charAt(0).toUpperCase() + status.slice(1),
                                                    count: count as number,
                                                    fill: statusColors[status] || "#94a3b8",
                                                }))}
                                                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                                            >
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 11 }}
                                                />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                                <RechartsTooltip
                                                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                                                    contentStyle={{
                                                        borderRadius: "8px",
                                                        border: "none",
                                                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                                        fontSize: "12px",
                                                    }}
                                                />
                                                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                                                    {Object.entries(stats.vehiclesByStatus || {}).map(([status], index) => (
                                                        <Cell key={`cell-${index}`} fill={statusColors[status] || "#94a3b8"} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {/* Status Legend */}
                                    <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t">
                                        {Object.entries(stats.vehiclesByStatus || {}).map(([status, count]) => (
                                            <div key={status} className="flex items-center gap-1.5">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-sm"
                                                    style={{ backgroundColor: statusColors[status] || "#94a3b8" }}
                                                />
                                                <span className="text-xs">
                                                    <span className="font-semibold">{count as number}</span>{" "}
                                                    <span className="text-muted-foreground capitalize">{status}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main >
        </div >
    );
}
