import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { complaintsApi } from "~/lib/api";

interface ComplaintModalProps {
    reporterId: string; // Just to clarify usage, though we use auth context/token usually
    reportedUserId?: string; // Optional: if reporting a specific user
    trigger?: React.ReactNode;
}

export function ComplaintModal({ reportedUserId, trigger }: ComplaintModalProps) {
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await complaintsApi.create({
                subject,
                description,
                reportedUserId
            });

            toast.success("Complaint submitted successfully");
            setOpen(false);
            setSubject("");
            setDescription("");
        } catch (error) {
            console.error("Error submitting complaint:", error);
            toast.error("Failed to submit complaint");
        } finally {
            setLoading(false);
        }
    };


    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Flag className="h-4 w-4" />
                        Report Issue
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>File a Complaint</DialogTitle>
                    <DialogDescription>
                        Describe the issue you are facing. {reportedUserId ? "This will be linked to the user you are reporting." : "Your feedback helps us keep the platform safe."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                            id="subject"
                            placeholder="Brief summary of the issue"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Provide detailed information about the incident..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} variant="destructive">
                            {loading ? "Submitting..." : "Submit Complaint"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
