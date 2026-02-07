import { Link } from "react-router";
import { Car } from "lucide-react";

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    description: string;
    showTestimonial?: boolean;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
            {/* Abstract background blobs for glass effect depth */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-sky-100/60 blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100/60 blur-[100px]" />

            {/* Logo above card */}
            <div className="mb-8 relative z-10">
                <Link to="/" className="flex items-center gap-4">
                    <img src="/logo.png" alt="CarHub Logo" className="h-20 w-auto object-contain" />
                    <span className="font-bold text-4xl tracking-tight text-slate-800">CarHub</span>
                </Link>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl p-8 shadow-2xl">
                    <div className="flex flex-col space-y-2 text-center mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            {title}
                        </h1>
                        <p className="text-sm text-slate-600 font-medium">
                            {description}
                        </p>
                    </div>
                    {children}
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-slate-500 font-medium relative z-10">
                &copy; {new Date().getFullYear()} CarHub. All rights reserved.
            </div>
        </div>
    );
}
