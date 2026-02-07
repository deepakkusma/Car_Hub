import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Header } from "~/components/layout/Header";
import { Footer } from "~/components/layout/Footer";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { authClient } from "~/lib/auth-client";
import { ArrowLeft, Car, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const errorParam = searchParams.get("error");

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        if (errorParam === "INVALID_TOKEN") {
            setError("This password reset link is invalid or has expired. Please request a new one.");
        }
    }, [errorParam]);

    const validatePassword = () => {
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long");
            return false;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!token) {
            setError("Invalid reset link. Please request a new password reset.");
            return;
        }

        if (!validatePassword()) {
            return;
        }

        setIsLoading(true);

        try {
            const result = await authClient.resetPassword({
                newPassword,
                token,
            });

            if (result.error) {
                setError(result.error.message || "Failed to reset password");
            } else {
                setIsSuccess(true);
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        // Token missing or invalid
        if (!token || errorParam === "INVALID_TOKEN") {
            return (
                <div className="space-y-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                            <div className="text-sm text-red-700">
                                <p className="font-medium">Invalid or Expired Link</p>
                                <p className="mt-1">
                                    This password reset link is no longer valid. Reset links expire
                                    after a short time for security reasons.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Link to="/forgot-password">
                            <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                                Request New Reset Link
                            </Button>
                        </Link>

                        <Link
                            to="/login"
                            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to login
                        </Link>
                    </div>
                </div>
            );
        }

        // Success state
        if (isSuccess) {
            return (
                <div className="space-y-6">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                            <div className="text-sm text-green-700">
                                <p className="font-medium">Password Reset Successfully!</p>
                                <p className="mt-1">
                                    Your password has been changed. You can now sign in with
                                    your new password.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Link to="/login">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                            Sign In Now
                        </Button>
                    </Link>
                </div>
            );
        }

        // Reset password form
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                        <Input
                            id="newPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            minLength={8}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Must be at least 8 characters
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            minLength={8}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting Password...
                        </>
                    ) : (
                        "Reset Password"
                    )}
                </Button>

                <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                </Link>
            </form>
        );
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header />

            <main className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 py-12 px-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            {isSuccess ? (
                                <CheckCircle2 className="h-8 w-8 text-white" />
                            ) : (
                                <Lock className="h-8 w-8 text-white" />
                            )}
                        </div>
                        <CardTitle className="text-2xl">
                            {!token || errorParam === "INVALID_TOKEN"
                                ? "Link Expired"
                                : isSuccess
                                    ? "Password Reset!"
                                    : "Create New Password"}
                        </CardTitle>
                        <CardDescription>
                            {!token || errorParam === "INVALID_TOKEN"
                                ? "Please request a new password reset link"
                                : isSuccess
                                    ? "Your password has been successfully changed"
                                    : "Enter your new password below"}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>{renderContent()}</CardContent>
                </Card>
            </main>

            <Footer />
        </div>
    );
}
