import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { signUp } from "~/lib/auth-client";
import { Loader2, ShoppingCart, Store } from "lucide-react";
import { AuthLayout } from "~/components/auth/AuthLayout";

export default function RegisterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const defaultRole = searchParams.get("role") || "buyer";

    const [formData, setFormData] = useState({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        role: defaultRole as "buyer" | "seller",
    });
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        // Validate phone number (basic validation for 10 digits)
        const phoneDigits = formData.phone.replace(/\D/g, "");
        if (phoneDigits.length < 10) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }

        setIsLoading(true);

        try {
            const fullName = [formData.firstName, formData.middleName, formData.lastName]
                .filter(Boolean)
                .join(" ");

            const result = await signUp.email({
                email: formData.email,
                password: formData.password,
                name: fullName,
                role: formData.role,
                phone: formData.phone.replace(/\D/g, ""), // Store only digits
            } as any);

            if (result.error) {
                setError(result.error.message || "Registration failed");
            } else {
                navigate("/login");
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Create an account"
            description="Enter your information to get started"
        >
            <div className="grid gap-6">
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4">
                        {error && (
                            <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* Role Selection */}
                        <div className="grid gap-2">
                            <Label>I want to</Label>
                            <RadioGroup
                                value={formData.role}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, role: value as "buyer" | "seller" })
                                }
                                className="grid grid-cols-2 gap-4"
                            >
                                <Label
                                    htmlFor="buyer"
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg border cursor-pointer transition-all ${formData.role === "buyer"
                                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                                        }`}
                                >
                                    <RadioGroupItem value="buyer" id="buyer" className="sr-only" />
                                    <ShoppingCart
                                        className={`h-6 w-6 mb-2 ${formData.role === "buyer" ? "text-blue-600" : "text-slate-400"
                                            }`}
                                    />
                                    <span className="font-medium">Buy a Car</span>
                                </Label>
                                <Label
                                    htmlFor="seller"
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg border cursor-pointer transition-all ${formData.role === "seller"
                                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                                        }`}
                                >
                                    <RadioGroupItem value="seller" id="seller" className="sr-only" />
                                    <Store
                                        className={`h-6 w-6 mb-2 ${formData.role === "seller" ? "text-blue-600" : "text-slate-400"
                                            }`}
                                    />
                                    <span className="font-medium">Sell a Car</span>
                                </Label>
                            </RadioGroup>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    placeholder="John"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    disabled={isLoading}
                                    className="bg-white"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="middleName">Middle Name</Label>
                                <Input
                                    id="middleName"
                                    name="middleName"
                                    placeholder=""
                                    value={formData.middleName}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    className="bg-white"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    placeholder="Doe"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    disabled={isLoading}
                                    className="bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                                className="bg-white"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="phone">Mobile Number</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                                    +91
                                </span>
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    placeholder="9876543210"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    disabled={isLoading}
                                    className="pl-12 bg-white"
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                                className="bg-white"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                disabled={isLoading}
                                className="bg-white"
                            />
                        </div>

                        <Button
                            disabled={isLoading}
                            className="w-full font-semibold bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Create Account
                        </Button>
                    </div>
                </form>

                <div className="text-center text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link
                        to="/login"
                        className="underline underline-offset-4 hover:text-blue-600 font-medium"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        </AuthLayout>
    );
}
