import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
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
    DialogTrigger,
} from "~/components/ui/dialog";
import { useSession } from "~/lib/auth-client";
import { adminApi, complaintsApi, type Complaint } from "~/lib/api";
import { Flag, Shield, User, Store, ShoppingCart, Ban, CheckCircle, AlertTriangle } from "lucide-react";

export default function AdminComplaintsPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

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
            fetchComplaints();
        }
    }, [session, isPending, statusFilter]);

    const fetchComplaints = async (page = 1) => {
        setIsLoading(true);
        try {
            const filter = statusFilter === "all" ? undefined : statusFilter;
            const data = await complaintsApi.getAll(filter, page);
            setComplaints(data.complaints);
            setPagination(data.pagination);
        } catch (error) {
            console.error("Failed to fetch complaints:", error);
            toast.error("Failed to fetch complaints");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        setUpdatingStatus(id);
        try {
            const updated = await complaintsApi.updateStatus(id, newStatus);
            setComplaints(complaints.map(c => c.id === id ? { ...c, status: updated.status } : c));
            toast.success("Complaint status updated");
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("Failed to update status");
        } finally {
            setUpdatingStatus(null);
        }
    };

    const handleSuspendUser = async (userId: string, currentSuspended: boolean = false) => {
        if (confirm(`Are you sure you want to ${currentSuspended ? "unsuspend" : "suspend"} this user?`)) {
            try {
                await adminApi.updateUserSuspension(userId, !currentSuspended);
                toast.success(`User ${!currentSuspended ? "suspended" : "activated"} successfully`);
                // Ideally refresh user status if we were displaying it, but here we just show success
            } catch (error) {
                console.error("Failed to suspend user:", error);
                toast.error("Failed to update suspension");
            }
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">Pending</Badge>;
            case "reviewed":
                return <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Reviewed</Badge>;
            case "resolved":
                return <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Resolved</Badge>;
            case "dismissed":
                return <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">Dismissed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getRoleIcon = (role?: string) => {
        switch (role) {
            case "admin": return <Shield className="h-3 w-3" />;
            case "seller": return <Store className="h-3 w-3" />;
            case "buyer": return <ShoppingCart className="h-3 w-3" />;
            default: return <User className="h-3 w-3" />;
        }
    };

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <main>
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-xl bg-red-100">
                            <Flag className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Complaints</h1>
                            <p className="text-muted-foreground">
                                Manage user reports and issues
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Filter Status:</span>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="reviewed">Reviewed</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="dismissed">Dismissed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-4 space-y-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton key={i} className="h-16" />
                                    ))}
                                </div>
                            ) : complaints.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground">
                                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                    <p>No complaints found</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Subject</TableHead>
                                            <TableHead>Reporter</TableHead>
                                            <TableHead>Reported User</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {complaints.map((complaint) => (
                                            <TableRow key={complaint.id}>
                                                <TableCell>
                                                    <div className="font-medium">{complaint.subject}</div>
                                                    <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                                                        {complaint.description}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{complaint.reporter?.name || "Unknown"}</span>
                                                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-5 gap-1">
                                                            {/* We don't have role on reporter currently, assuming buyer/seller based on context or add to API */}
                                                            Reporter
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{complaint.reporter?.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {complaint.reportedUser ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm">{complaint.reportedUser.name}</span>
                                                                {complaint.reportedUser.role && (
                                                                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-5 gap-1">
                                                                        {getRoleIcon(complaint.reportedUser.role)}
                                                                        {complaint.reportedUser.role}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">{complaint.reportedUser.email}</div>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                className="h-6 text-xs px-2"
                                                                onClick={() => handleSuspendUser(complaint.reportedUserId!)}
                                                            >
                                                                <Ban className="h-3 w-3 mr-1" />
                                                                Suspend
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {new Date(complaint.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Select
                                                        value={complaint.status}
                                                        onValueChange={(val) => handleStatusUpdate(complaint.id, val)}
                                                        disabled={updatingStatus === complaint.id}
                                                    >
                                                        <SelectTrigger className="w-[130px] ml-auto h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending">Pending</SelectItem>
                                                            <SelectItem value="reviewed">Reviewed</SelectItem>
                                                            <SelectItem value="resolved">Resolved</SelectItem>
                                                            <SelectItem value="dismissed">Dismissed</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
