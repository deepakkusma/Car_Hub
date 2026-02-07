import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "~/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import { useSession } from "~/lib/auth-client";
import { inquiriesApi, type Inquiry, type InquiryMessage } from "~/lib/api";
import { cn } from "~/lib/utils";
import {
    MessageSquare,
    Send,
    ArrowLeft,
    Car,
    ChevronRight,
    Reply,
    Clock,
    CheckCircle2,
    Circle,
    Search,
    Inbox,
    MessageCircle,
    ExternalLink,
} from "lucide-react";

export default function BuyerInquiriesPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchInquiries();
        }
    }, [session, isPending]);

    const fetchInquiries = async () => {
        try {
            const data = await inquiriesApi.getAll("sent");
            setInquiries(data);
        } catch (error) {
            console.error("Failed to fetch inquiries:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenConversation = async (inquiry: Inquiry) => {
        try {
            const fullInquiry = await inquiriesApi.getById(inquiry.id);
            setSelectedInquiry(fullInquiry);
        } catch (error) {
            console.error("Failed to fetch inquiry details:", error);
            setSelectedInquiry(inquiry);
        }
    };

    // While the conversation dialog is open, poll for new messages so both sides see updates quickly.
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

        // initial refresh + interval
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

        // Prefer canonical message thread if present
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
        // next tick so layout is ready
        const id = window.setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 0);
        return () => window.clearTimeout(id);
    }, [selectedInquiry?.id, conversationMessages.length]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "responded":
                return (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Responded
                    </Badge>
                );
            case "pending":
                return (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                        <Clock className="h-3 w-3 mr-1" />
                        Awaiting Reply
                    </Badge>
                );
            case "closed":
                return (
                    <Badge variant="secondary" className="bg-slate-100">
                        <Circle className="h-3 w-3 mr-1" />
                        Closed
                    </Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getImageUrl = (url: string) => {
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    const getLatestSellerMessage = (inquiry: Inquiry) => {
        const msgs = inquiry.messages ?? [];
        for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i];
            if (m?.senderId === inquiry.sellerId) return m;
        }
        return null;
    };

    const formatRelativeTime = (date: string) => {
        const now = new Date();
        const d = new Date(date);
        const diff = now.getTime() - d.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return d.toLocaleDateString();
    };

    const user = session?.user;

    const pendingCount = inquiries.filter(i => i.status === "pending").length;
    const respondedCount = inquiries.filter(i => i.status === "responded").length;

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight">My Inquiries</h1>
                        <p className="text-sm text-muted-foreground">
                            Track your messages to sellers about vehicles
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="border-0 shadow-sm bg-white cursor-default">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-amber-500/10">
                                                <Clock className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{pendingCount}</p>
                                                <p className="text-xs text-muted-foreground">Awaiting Reply</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>Inquiries waiting for seller response</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="border-0 shadow-sm bg-white cursor-default">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-emerald-500/10">
                                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{respondedCount}</p>
                                                <p className="text-xs text-muted-foreground">Responded</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>Inquiries with seller responses</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className="border-0 shadow-sm bg-white cursor-default">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-blue-500/10">
                                                <MessageCircle className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{inquiries.length}</p>
                                                <p className="text-xs text-muted-foreground">Total Sent</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>All inquiries you've sent</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Inquiries List */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-28 rounded-xl" />
                        ))}
                    </div>
                ) : inquiries.length === 0 ? (
                    <Card className="border shadow-sm">
                        <CardContent className="py-16 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                <Inbox className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No inquiries yet</h3>
                            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                                Send inquiries to sellers about vehicles you're interested in
                            </p>
                            <Button asChild>
                                <Link to="/vehicles">
                                    <Search className="h-4 w-4 mr-2" />
                                    Browse Cars
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {inquiries.map((inquiry) => {
                            const latestReply = getLatestSellerMessage(inquiry);
                            const hasUnread = inquiry.status === "responded" && latestReply;

                            return (
                                <Card
                                    key={inquiry.id}
                                    className={cn(
                                        "group cursor-pointer border shadow-sm hover:shadow-md transition-all duration-200",
                                        hasUnread && "border-l-4 border-l-emerald-500"
                                    )}
                                    onClick={() => handleOpenConversation(inquiry)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex gap-4">
                                            {/* Vehicle Image */}
                                            <Link
                                                to={`/vehicles/${inquiry.vehicleId}`}
                                                className="shrink-0"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="w-24 h-20 rounded-lg bg-slate-100 overflow-hidden">
                                                    {inquiry.vehicle?.images?.[0] ? (
                                                        <img
                                                            src={getImageUrl(inquiry.vehicle.images[0])}
                                                            alt=""
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Car className="h-8 w-8 text-slate-300" />
                                                        </div>
                                                    )}
                                                </div>
                                            </Link>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <div>
                                                        <Link
                                                            to={`/vehicles/${inquiry.vehicleId}`}
                                                            className="font-semibold text-sm hover:text-blue-600 transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {inquiry.vehicle?.year} {inquiry.vehicle?.make} {inquiry.vehicle?.model}
                                                        </Link>
                                                        <p className="text-xs text-muted-foreground">
                                                            To: <span className="font-medium">{inquiry.seller?.name}</span>
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {getStatusBadge(inquiry.status)}
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                                    </div>
                                                </div>

                                                {/* Message Preview */}
                                                <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                                                    {inquiry.message}
                                                </p>

                                                {/* Latest Reply */}
                                                {latestReply && (
                                                    <div className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg mt-2">
                                                        <Reply className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                                        <p className="text-xs text-emerald-700 line-clamp-1">
                                                            {latestReply.message}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Time */}
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {formatRelativeTime(inquiry.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Conversation Dialog */}
            <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                    {/* Dialog Header */}
                    <div className="px-6 py-4 border-b bg-slate-50">
                        <DialogHeader className="space-y-1">
                            <DialogTitle className="text-base font-semibold flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-blue-600" />
                                {selectedInquiry?.seller?.name}
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                {selectedInquiry?.vehicle?.year} {selectedInquiry?.vehicle?.make} {selectedInquiry?.vehicle?.model}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {selectedInquiry && (
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Vehicle Card */}
                            <div className="px-4 py-3 border-b bg-white">
                                <div className="flex gap-3 items-center">
                                    <div className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                                        {selectedInquiry.vehicle?.images?.[0] ? (
                                            <img
                                                src={getImageUrl(selectedInquiry.vehicle.images[0])}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Car className="h-5 w-5 text-slate-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            to={`/vehicles/${selectedInquiry.vehicleId}`}
                                            className="text-sm font-medium hover:text-blue-600 transition-colors flex items-center gap-1"
                                        >
                                            {selectedInquiry.vehicle?.year} {selectedInquiry.vehicle?.make} {selectedInquiry.vehicle?.model}
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                        <p className="text-xs text-muted-foreground">
                                            Seller: {selectedInquiry.seller?.name}
                                        </p>
                                    </div>
                                    {getStatusBadge(selectedInquiry.status)}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 min-h-0">
                                <ScrollArea className="h-[45vh]">
                                    <div className="space-y-4 p-4">
                                        {conversationMessages.map((msg: any) => {
                                            const isMe = msg.senderId === user?.id || msg.senderId === selectedInquiry.buyerId;
                                            const isSeller = msg.senderId === selectedInquiry.sellerId;

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
                                                >
                                                    <Avatar className="h-7 w-7 shrink-0">
                                                        <AvatarFallback
                                                            className={cn(
                                                                "text-xs font-medium",
                                                                isMe ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                                                            )}
                                                        >
                                                            {isMe ? "Y" : msg.sender?.name?.charAt(0) || "S"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className={`flex-1 max-w-[75%] ${isMe ? "text-right" : ""}`}>
                                                        <div className={`flex items-center gap-2 mb-0.5 ${isMe ? "justify-end" : ""}`}>
                                                            <span className="font-medium text-xs">
                                                                {isMe ? "You" : msg.sender?.name}
                                                            </span>
                                                            {isSeller && !isMe && (
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Seller</Badge>
                                                            )}
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {formatRelativeTime(msg.createdAt)}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={cn(
                                                                "px-3 py-2 inline-block text-left text-sm",
                                                                isMe
                                                                    ? "bg-blue-600 text-white rounded-2xl rounded-br-md"
                                                                    : "bg-slate-100 text-slate-900 rounded-2xl rounded-bl-md"
                                                            )}
                                                        >
                                                            <p className="whitespace-pre-wrap">{msg.message}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={bottomRef} />

                                        {/* Legacy seller response (if no messages array) */}
                                        {selectedInquiry.sellerResponse && (!selectedInquiry.messages || selectedInquiry.messages.length <= 1) && (
                                            <div className="flex gap-2.5">
                                                <Avatar className="h-7 w-7 shrink-0">
                                                    <AvatarFallback className="bg-slate-100 text-slate-700 text-xs">
                                                        {selectedInquiry.seller?.name?.charAt(0) || "S"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 max-w-[75%]">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-medium text-xs">{selectedInquiry.seller?.name}</span>
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Seller</Badge>
                                                    </div>
                                                    <div className="bg-slate-100 text-slate-900 px-3 py-2 rounded-2xl rounded-bl-md inline-block text-left text-sm">
                                                        <p className="whitespace-pre-wrap">{selectedInquiry.sellerResponse}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Reply Box */}
                            {selectedInquiry.status !== "closed" && (
                                <div className="p-4 border-t bg-white">
                                    <div className="flex gap-2">
                                        <Textarea
                                            placeholder="Type your message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            rows={2}
                                            className="resize-none text-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                        />
                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={!newMessage.trim() || isSending}
                                            size="icon"
                                            className="h-auto aspect-square shrink-0"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1.5">
                                        Press Enter to send, Shift+Enter for new line
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
