import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authClient } from "~/lib/auth-client";
import { ArrowLeft, Loader2, CheckCircle2, ExternalLink, Copy, Check } from "lucide-react";
import { AuthLayout } from "~/components/auth/AuthLayout";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [resetLink, setResetLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Fetch the reset link from dev endpoint after success
    useEffect(() => {
        if (isSuccess && email) {
            const fetchResetLink = async () => {
                try {
                    const response = await fetch(
                        `${API_URL}/api/dev/reset-link/${encodeURIComponent(email)}`
                    );
                    const data = await response.json();
                    if (data.success && data.url) {
                        setResetLink(data.url);
                    }
                } catch (err) {
                    console.log("Dev reset link not available");
                }
            };
            // Small delay to ensure backend has processed
            setTimeout(fetchResetLink, 500);
        }
    }, [isSuccess, email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        setResetLink(null);

        try {
            const result = await authClient.requestPasswordReset({
                email,
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (result.error) {
                setError(result.error.message || "Failed to send reset link");
            } else {
                setIsSuccess(true);
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async () => {
        if (resetLink) {
            await navigator.clipboard.writeText(resetLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <AuthLayout
            title={isSuccess ? "Reset Link Ready!" : "Forgot Password?"}
            description={
                isSuccess
                    ? "Use the link below to reset your password"
                    : "No worries, we'll send you reset instructions"
            }
        >
            <div className="grid gap-6">
                {isSuccess ? (
                    <div className="space-y-6">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                                <div className="text-sm text-green-700">
                                    <p className="font-medium">Reset link generated!</p>
                                    <p className="mt-1">
                                        A password reset link has been created for{" "}
                                        <span className="font-medium">{email}</span>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {resetLink ? (
                            <div className="space-y-3">
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                                        Your Reset Link (Development Mode)
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-xs bg-white p-2 rounded border break-all">
                                            {resetLink}
                                        </code>
                                        <button
                                            onClick={copyToClipboard}
                                            className="p-2 hover:bg-slate-100 rounded transition-colors shrink-0"
                                            title="Copy to clipboard"
                                        >
                                            {copied ? (
                                                <Check className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <Copy className="h-4 w-4 text-slate-500" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <Button className="w-full" asChild>
                                    <a
                                        href={resetLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Reset Password Now
                                    </a>
                                </Button>
                            </div>
                        ) : (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                                    <p className="text-sm text-amber-700">
                                        Loading reset link...
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="text-center text-sm text-muted-foreground">
                            Need to try a different email?{" "}
                            <Button
                                variant="link"
                                onClick={() => {
                                    setIsSuccess(false);
                                    setEmail("");
                                    setResetLink(null);
                                }}
                                className="text-primary hover:text-primary/80 font-medium p-0 h-auto underline-offset-4"
                            >
                                Try again
                            </Button>
                        </div>

                        <Link
                            to="/login"
                            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4">
                            {error && (
                                <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    className="bg-white"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full font-semibold"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Reset Link"
                                )}
                            </Button>

                            <Link
                                to="/login"
                                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </AuthLayout>
    );
}
