import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { useSession } from "~/lib/auth-client";
import { complaintsApi, type Complaint } from "~/lib/api";
import { Flag, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { ComplaintModal } from "~/components/complaint-modal";
import { format } from "date-fns";

export default function BuyerIssuesPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchComplaints();
        }
    }, [session, isPending]);

    const fetchComplaints = async () => {
        setIsLoading(true);
        try {
            const data = await complaintsApi.getMyComplaints();
            setComplaints(data);
        } catch (error) {
            console.error("Failed to fetch complaints:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case "pending":
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex gap-1 items-center"><Clock className="w-3 h-3" /> Pending</Badge>;
            case "reviewed":
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex gap-1 items-center"><CheckCircle className="w-3 h-3" /> Reviewed</Badge>;
            case "resolved":
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex gap-1 items-center"><CheckCircle className="w-3 h-3" /> Resolved</Badge>;
            case "dismissed":
                return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 flex gap-1 items-center"><XCircle className="w-3 h-3" /> Dismissed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isPending) return null;

    return (
        <div className="flex-1 bg-slate-50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                <div className="mb-6">
                    <Button variant="ghost" size="sm" asChild className="mb-4">
                        <Link to="/buyer/dashboard">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-lg">
                                    <Flag className="h-6 w-6 text-red-600" />
                                </div>
                                My Issues
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Track the status of your reported issues
                            </p>
                        </div>

                        <ComplaintModal
                            reporterId={session?.user?.id as string}
                            trigger={
                                <Button className="bg-red-600 hover:bg-red-700">
                                    <Flag className="mr-2 h-4 w-4" />
                                    Report New Issue
                                </Button>
                            }
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-32 w-full rounded-xl" />
                        ))}
                    </div>
                ) : complaints.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="p-4 rounded-full bg-slate-100 mb-4">
                                <CheckCircle className="h-8 w-8 text-green-500" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No Issues Reported</h3>
                            <p className="text-muted-foreground max-w-sm mb-6">
                                You haven't reported any issues yet. If you encounter any problems, please let us know.
                            </p>
                            <ComplaintModal
                                reporterId={session?.user?.id as string}
                                trigger={
                                    <Button variant="outline">
                                        Report an Issue
                                    </Button>
                                }
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {complaints.map((complaint) => (
                            <Card key={complaint.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                <div className={`h-full w-1.5 absolute left-0 top-0 ${complaint.status === 'resolved' ? 'bg-green-500' :
                                    complaint.status === 'dismissed' ? 'bg-gray-300' :
                                        complaint.status === 'reviewed' ? 'bg-blue-500' : 'bg-yellow-500'
                                    }`} />
                                <CardContent className="p-6 pl-8">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-semibold text-lg">{complaint.subject}</h3>
                                                <StatusBadge status={complaint.status} />
                                            </div>
                                            <p className="text-slate-600 leading-relaxed">
                                                {complaint.description}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mt-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    <span>Reported on {format(new Date(complaint.createdAt), "PPP")}</span>
                                                </div>
                                                {complaint.reportedUser && (
                                                    <div className="flex items-center gap-1.5">
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                        <span>Reported User: <span className="font-medium text-slate-700">{complaint.reportedUser.name}</span></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
