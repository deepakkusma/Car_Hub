import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { useSession } from "~/lib/auth-client";
import { adminApi, inquiriesApi, type Inquiry, type InquiryMessage } from "~/lib/api";
import { cn } from "~/lib/utils";
import {
    MessageSquare,
    Car,
    User,
    Send,
    ArrowLeft,
    Filter,
    Calendar,
    Mail,
    Clock,
    ChevronRight,
    X,
} from "lucide-react";

export default function AdminInquiriesPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

    // Conversation dialog state
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const statusFilter = searchParams.get("status") || "all";

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
            fetchInquiries();
        }
    }, [session, isPending, statusFilter]);

    const fetchInquiries = async () => {
        setIsLoading(true);
        try {
            const status = statusFilter === "all" ? undefined : statusFilter;
            const data = await adminApi.getInquiries(status, pagination.page, pagination.limit);
            setInquiries(data.inquiries);
            setPagination(data.pagination);
        } catch (error) {
            console.error("Failed to fetch inquiries:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusFilter = (value: string) => {
        if (value === "all") {
            searchParams.delete("status");
        } else {
            searchParams.set("status", value);
        }
        setSearchParams(searchParams);
    };

    const handleOpenConversation = async (inquiry: Inquiry) => {
        try {
            // Fetch full inquiry with messages
            const fullInquiry = await inquiriesApi.getById(inquiry.id);
            setSelectedInquiry(fullInquiry);
        } catch (error) {
            console.error("Failed to fetch inquiry details:", error);
            // Still show what we have
            setSelectedInquiry(inquiry);
        }
    };

    // While the conversation dialog is open, poll for new messages so participants see updates quickly.
    useEffect(() => {
        if (!selectedInquiry) return;
        let cancelled = false;

        const POLL_MS = 1000;
        const tick = async () => {
            try {
                const refreshed = await inquiriesApi.getById(selectedInquiry.id);
                if (!cancelled) setSelectedInquiry(refreshed);
            } catch {
                // ignore transient failures
            }
        };

        tick();
        const id = window.setInterval(tick, POLL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(id);
        };
    }, [selectedInquiry?.id]);

    const handleSendMessage = async () => {
        if (!selectedInquiry || !newMessage.trim()) return;

        setIsSending(true);
        try {
            const sentMessage = await inquiriesApi.sendMessage(selectedInquiry.id, newMessage);

            // Update the selected inquiry with the new message
            setSelectedInquiry({
                ...selectedInquiry,
                messages: [...(selectedInquiry.messages || []), sentMessage],
            });

            setNewMessage("");

            // Ensure we have the latest canonical state (timestamps/order/status)
            try {
                const refreshed = await inquiriesApi.getById(selectedInquiry.id);
                setSelectedInquiry(refreshed);
            } catch {
                // ignore
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            alert(error instanceof Error ? error.message : "Failed to send message. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    const conversationMessages = useMemo(() => {
        if (!selectedInquiry) return [];

        const msgs = selectedInquiry.messages ?? [];
        if (msgs.length > 0) return msgs;

        // Fallback for legacy inquiries (no messages table data)
        return [
            {
                id: "initial",
                senderId: selectedInquiry.buyerId,
                message: selectedInquiry.message,
                createdAt: selectedInquiry.createdAt,
                sender: selectedInquiry.buyer,
            } as any,
        ];
    }, [selectedInquiry]);

    // Auto-scroll to latest message whenever the conversation changes.
    useEffect(() => {
        if (!selectedInquiry) return;
        const id = window.setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 0);
        return () => window.clearTimeout(id);
    }, [selectedInquiry?.id, conversationMessages.length]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "responded":
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Responded</Badge>;
            case "pending":
                return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>;
            case "closed":
                return <Badge variant="secondary">Closed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const formatPrice = (price: string | undefined) => {
        if (!price) return "N/A";
        const num = parseFloat(price);
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const getImageUrl = (url: string) => {
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <main>
                <div className="container mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold">Customer Inquiries</h1>
                                <p className="text-muted-foreground">
                                    View and manage all customer inquiries about vehicles
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Select value={statusFilter} onValueChange={handleStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Inquiries</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="responded">Responded</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white border-0">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <Clock className="h-8 w-8 text-yellow-100" />
                                    <div>
                                        <p className="text-sm text-yellow-100">Pending</p>
                                        <p className="text-2xl font-bold">
                                            {inquiries.filter(i => i.status === "pending").length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white border-0">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <MessageSquare className="h-8 w-8 text-green-100" />
                                    <div>
                                        <p className="text-sm text-green-100">Responded</p>
                                        <p className="text-2xl font-bold">
                                            {inquiries.filter(i => i.status === "responded").length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-slate-500 to-slate-600 text-white border-0">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <X className="h-8 w-8 text-slate-200" />
                                    <div>
                                        <p className="text-sm text-slate-200">Closed</p>
                                        <p className="text-2xl font-bold">
                                            {inquiries.filter(i => i.status === "closed").length}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Inquiries List */}
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-40" />
                            ))}
                        </div>
                    ) : inquiries.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-lg border">
                            <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No inquiries found</h3>
                            <p className="text-muted-foreground">
                                {statusFilter !== "all"
                                    ? `No ${statusFilter} inquiries at the moment.`
                                    : "When customers send inquiries about vehicles, they'll appear here."}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {inquiries.map((inquiry) => (
                                <Card
                                    key={inquiry.id}
                                    className="hover:shadow-lg transition-all cursor-pointer group"
                                    onClick={() => handleOpenConversation(inquiry)}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex gap-6">
                                            {/* Vehicle Image */}
                                            <div className="shrink-0 w-40 h-28 rounded-lg bg-slate-100 overflow-hidden">
                                                {inquiry.vehicle?.images?.[0] ? (
                                                    <img
                                                        src={getImageUrl(inquiry.vehicle.images[0])}
                                                        alt=""
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Car className="h-12 w-12 text-slate-300" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Inquiry Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div>
                                                        <h3 className="font-semibold text-lg group-hover:text-orange-500 transition-colors">
                                                            {inquiry.vehicle?.year} {inquiry.vehicle?.make} {inquiry.vehicle?.model}
                                                        </h3>
                                                        <p className="text-orange-500 font-medium">
                                                            {formatPrice(inquiry.vehicle?.price)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {getStatusBadge(inquiry.status)}
                                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                                    </div>
                                                </div>

                                                {/* People involved */}
                                                <div className="flex flex-wrap gap-6 mb-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                                                                {inquiry.buyer?.name?.charAt(0) || "B"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">Buyer</p>
                                                            <p className="font-medium">{inquiry.buyer?.name}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarFallback className="bg-green-100 text-green-600 text-xs">
                                                                {inquiry.seller?.name?.charAt(0) || "S"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-muted-foreground text-xs">Seller</p>
                                                            <p className="font-medium">{inquiry.seller?.name}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Message preview */}
                                                <div className="p-3 bg-slate-50 rounded-lg">
                                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                                        {inquiry.message}
                                                    </p>
                                                </div>

                                                {/* Timestamp */}
                                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(inquiry.createdAt).toLocaleDateString()} at{" "}
                                                    {new Date(inquiry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-8">
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={pagination.page === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        setPagination({ ...pagination, page });
                                        fetchInquiries();
                                    }}
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Conversation Dialog */}
            <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-orange-500" />
                            Inquiry Conversation
                        </DialogTitle>
                        <DialogDescription>
                            View and participate in the conversation about this vehicle
                        </DialogDescription>
                    </DialogHeader>

                    {selectedInquiry && (
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Vehicle Info Header */}
                            <Card className="mb-4 bg-gradient-to-r from-slate-50 to-slate-100 border-0">
                                <CardContent className="p-4">
                                    <div className="flex gap-4">
                                        <div className="w-24 h-18 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                                            {selectedInquiry.vehicle?.images?.[0] ? (
                                                <img
                                                    src={getImageUrl(selectedInquiry.vehicle.images[0])}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Car className="h-8 w-8 text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <Link
                                                to={`/vehicles/${selectedInquiry.vehicleId}`}
                                                className="font-semibold text-lg hover:text-orange-500 transition-colors"
                                            >
                                                {selectedInquiry.vehicle?.year} {selectedInquiry.vehicle?.make} {selectedInquiry.vehicle?.model}
                                            </Link>
                                            <p className="text-orange-500 font-medium">
                                                {formatPrice(selectedInquiry.vehicle?.price)}
                                            </p>
                                            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <User className="h-4 w-4" />
                                                    Buyer: {selectedInquiry.buyer?.name}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="h-4 w-4" />
                                                    Seller: {selectedInquiry.seller?.name}
                                                </span>
                                            </div>
                                        </div>
                                        {getStatusBadge(selectedInquiry.status)}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Messages */}
                            <div className="h-[45vh] min-h-[320px] rounded-xl border bg-white">
                                <ScrollArea className="h-full">
                                    <div className="space-y-4 p-4">
                                        {conversationMessages.map((msg: any) => {
                                            const isBuyer = msg.senderId === selectedInquiry.buyerId;
                                            const isSeller = msg.senderId === selectedInquiry.sellerId;
                                            const isCurrentUserMessage = isSeller || (!isBuyer && !isSeller); // Seller or Admin on right

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex gap-3 ${isCurrentUserMessage ? "flex-row-reverse" : ""}`}
                                                >
                                                    <Avatar className="h-8 w-8 shrink-0">
                                                        <AvatarFallback
                                                            className={`text-sm ${isBuyer
                                                                ? "bg-blue-100 text-blue-600"
                                                                : isSeller
                                                                    ? "bg-green-100 text-green-600"
                                                                    : "bg-purple-100 text-purple-600"
                                                                }`}
                                                        >
                                                            {msg.sender?.name?.charAt(0) || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className={`flex-1 max-w-[80%] ${isCurrentUserMessage ? "text-right" : ""}`}>
                                                        <div className={`flex items-center gap-2 mb-1 ${isCurrentUserMessage ? "justify-end" : ""}`}>
                                                            <span className="font-medium text-sm">
                                                                {msg.sender?.name}
                                                                {isBuyer && <span className="text-blue-500 ml-1">(Buyer)</span>}
                                                                {isSeller && <span className="text-green-500 ml-1">(Seller)</span>}
                                                                {!isBuyer && !isSeller && <span className="text-purple-500 ml-1">(Admin)</span>}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(msg.createdAt).toLocaleDateString()} at{" "}
                                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={cn(
                                                                "px-4 py-2.5 inline-block text-left shadow-sm",
                                                                isBuyer
                                                                    ? "bg-slate-100 text-slate-900 rounded-2xl rounded-bl-sm"
                                                                    : isSeller
                                                                        ? "bg-green-500 text-white rounded-2xl rounded-br-sm"
                                                                        : "bg-purple-600 text-white rounded-2xl rounded-br-sm"
                                                            )}
                                                        >
                                                            <p className="text-sm">{msg.message}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={bottomRef} />

                                        {/* Legacy seller response display */}
                                        {selectedInquiry.sellerResponse && (!selectedInquiry.messages || selectedInquiry.messages.length <= 1) && (
                                            <div className="flex gap-3 flex-row-reverse">
                                                <Avatar className="h-8 w-8 shrink-0">
                                                    <AvatarFallback className="bg-green-100 text-green-600 text-sm">
                                                        {selectedInquiry.seller?.name?.charAt(0) || "S"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 max-w-[80%] text-right">
                                                    <div className="flex items-center gap-2 mb-1 justify-end">
                                                        <span className="font-medium text-sm">{selectedInquiry.seller?.name} <span className="text-green-500">(Seller)</span></span>
                                                    </div>
                                                    <div className="bg-green-500 text-white px-4 py-2.5 rounded-2xl rounded-br-sm inline-block text-left shadow-sm">
                                                        <p className="text-sm">{selectedInquiry.sellerResponse}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Reply Box */}
                            {selectedInquiry.status !== "closed" && (
                                <div className="mt-4 flex gap-2">
                                    <Textarea
                                        placeholder="Type a message as admin..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        rows={2}
                                        className="resize-none"
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim() || isSending}
                                        className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
                                    >
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
