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
    Reply,
    Send,
    ArrowLeft,
    Car,
    ChevronRight,
    Clock,
    CheckCircle2,
    Circle,
    Inbox,
    MessageCircle,
    ExternalLink,
    User,
    Mail,
} from "lucide-react";

export default function SellerInquiriesPage() {
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
            const data = await inquiriesApi.getAll("received");
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
            const updatedInquiry = {
                ...selectedInquiry,
                status: "responded" as const,
                messages: [...(selectedInquiry.messages || []), sentMessage],
            };
            setSelectedInquiry(updatedInquiry);

            // Update in the list as well
            setInquiries(inquiries.map(inq =>
                inq.id === selectedInquiry.id ? { ...inq, status: "responded" as const } : inq
            ));

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
                        Needs Reply
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
                    <Button variant="ghost" size="icon" onClick={() => navigate("/seller/dashboard")} className="shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight">Customer Inquiries</h1>
                        <p className="text-sm text-muted-foreground">
                            Respond to potential buyers interested in your vehicles
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Card className={cn(
                                    "border-0 shadow-sm bg-white cursor-default transition-all",
                                    pendingCount > 0 && "ring-2 ring-amber-200"
                                )}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2.5 rounded-xl",
                                                pendingCount > 0 ? "bg-amber-500 text-white" : "bg-amber-500/10"
                                            )}>
                                                <Clock className={cn("h-5 w-5", pendingCount > 0 ? "text-white" : "text-amber-600")} />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold">{pendingCount}</p>
                                                <p className="text-xs text-muted-foreground">Needs Reply</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>Inquiries waiting for your response</TooltipContent>
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
                            <TooltipContent>Inquiries you've responded to</TooltipContent>
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
                                                <p className="text-xs text-muted-foreground">Total Received</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TooltipTrigger>
                            <TooltipContent>All inquiries from buyers</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Inquiries List */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
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
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                                When buyers contact you about your listings, they'll appear here
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {inquiries.map((inquiry) => {
                            const needsReply = inquiry.status === "pending";

                            return (
                                <Card
                                    key={inquiry.id}
                                    className={cn(
                                        "group cursor-pointer border shadow-sm hover:shadow-md transition-all duration-200",
                                        needsReply && "border-l-4 border-l-amber-500 bg-amber-50/30"
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
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    {/* Buyer Info */}
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                                                                {inquiry.buyer?.name?.charAt(0) || "B"}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-semibold text-sm">{inquiry.buyer?.name}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Mail className="h-3 w-3" />
                                                                {inquiry.buyer?.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {getStatusBadge(inquiry.status)}
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                                    </div>
                                                </div>

                                                {/* Vehicle Info */}
                                                <p className="text-xs text-muted-foreground mb-1">
                                                    About: <span className="font-medium text-foreground">
                                                        {inquiry.vehicle?.year} {inquiry.vehicle?.make} {inquiry.vehicle?.model}
                                                    </span>
                                                </p>

                                                {/* Message Preview */}
                                                <div className="p-2.5 bg-slate-100 rounded-lg">
                                                    <p className="text-sm text-slate-700 line-clamp-2">{inquiry.message}</p>
                                                </div>

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
                                <User className="h-4 w-4 text-blue-600" />
                                {selectedInquiry?.buyer?.name}
                            </DialogTitle>
                            <DialogDescription className="text-xs flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {selectedInquiry?.buyer?.email}
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
                                        <p className="text-xs text-muted-foreground">Your listing</p>
                                    </div>
                                    {getStatusBadge(selectedInquiry.status)}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 min-h-0">
                                <ScrollArea className="h-[45vh]">
                                    <div className="space-y-4 p-4">
                                        {conversationMessages.map((msg: any) => {
                                            const isMe = msg.senderId === user?.id;
                                            const isBuyer = msg.senderId === selectedInquiry.buyerId;

                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
                                                >
                                                    <Avatar className="h-7 w-7 shrink-0">
                                                        <AvatarFallback
                                                            className={cn(
                                                                "text-xs font-medium",
                                                                isMe ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                                            )}
                                                        >
                                                            {isMe ? "Y" : msg.sender?.name?.charAt(0) || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className={`flex-1 max-w-[75%] ${isMe ? "text-right" : ""}`}>
                                                        <div className={`flex items-center gap-2 mb-0.5 ${isMe ? "justify-end" : ""}`}>
                                                            <span className="font-medium text-xs">
                                                                {isMe ? "You" : msg.sender?.name}
                                                            </span>
                                                            {isBuyer && !isMe && (
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Buyer</Badge>
                                                            )}
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {formatRelativeTime(msg.createdAt)}
                                                            </span>
                                                        </div>
                                                        <div
                                                            className={cn(
                                                                "px-3 py-2 inline-block text-left text-sm",
                                                                isMe
                                                                    ? "bg-emerald-600 text-white rounded-2xl rounded-br-md"
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
                                            <div className="flex gap-2.5 flex-row-reverse">
                                                <Avatar className="h-7 w-7 shrink-0">
                                                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                                                        Y
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 max-w-[75%] text-right">
                                                    <div className="flex items-center gap-2 mb-0.5 justify-end">
                                                        <span className="font-medium text-xs">You</span>
                                                    </div>
                                                    <div className="bg-emerald-600 text-white px-3 py-2 rounded-2xl rounded-br-md inline-block text-left text-sm">
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
                                            placeholder="Type your reply..."
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
                                            className="h-auto aspect-square shrink-0 bg-emerald-600 hover:bg-emerald-700"
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
