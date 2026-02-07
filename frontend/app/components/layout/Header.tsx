import { Link, useNavigate } from "react-router";
import { useSession, signOut } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Car, User, LogOut, LayoutDashboard, Heart, List, Settings, ShoppingBag, MessageSquare, Calendar } from "lucide-react";

export function Header() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate("/");
    };

    const user = session?.user as any;
    const userRole = user?.role;
    const isSeller = userRole === "seller";
    const isAdmin = userRole === "admin";

    const getInitials = (name: string) => {
        return name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "U";
    };

    const getDashboardLink = () => {
        if (!user) return "/login";
        switch (user.role) {
            case "admin":
                return "/admin/dashboard";
            case "seller":
                return "/seller/dashboard";
            default:
                return "/buyer/dashboard";
        }
    };


    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-3">
                    <img src="/logo.png" alt="CarHub Logo" className="h-10 w-auto object-contain" />
                    <span className="font-bold text-2xl tracking-tight text-slate-900">CarHub</span>
                </Link>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-6">
                    {!isAdmin && (
                        <Link to="/vehicles" className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
                            Browse Cars
                        </Link>
                    )}
                    {isSeller && (
                        <Link to="/seller/add-vehicle" className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
                            Sell Your Car
                        </Link>
                    )}
                    {!isAdmin && (
                        <Link to="/how-it-works" className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
                            How it Works
                        </Link>
                    )}
                </nav>

                {/* Auth Section */}
                <div className="flex items-center gap-4">
                    {isPending ? (
                        <div className="h-9 w-24 animate-pulse bg-slate-100 rounded-md" />
                    ) : session?.user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-slate-100 dark:ring-slate-800">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={session.user.image || ""} alt={session.user.name || ""} />
                                        <AvatarFallback className="bg-blue-600 text-white font-semibold">
                                            {getInitials(session.user.name || "")}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 bg-white border-slate-200 text-slate-900" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium">{user.name}</p>
                                        <p className="text-xs text-slate-500">{user.email}</p>
                                        <p className="text-xs text-blue-600 capitalize">
                                            Role: {user.role || "buyer"}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-900 cursor-pointer">
                                    <Link to={getDashboardLink()}>
                                        <LayoutDashboard className="mr-2 h-4 w-4" />
                                        Dashboard
                                    </Link>
                                </DropdownMenuItem>
                                {/* Buyer-specific menu items - hide for admin */}
                                {user.role !== "admin" && (
                                    <>
                                        <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-900 cursor-pointer">
                                            <Link to="/buyer/inquiries">
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                My Inquiries
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-900 cursor-pointer">
                                            <Link to="/buyer/favorites">
                                                <Heart className="mr-2 h-4 w-4" />
                                                Favorites
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-900 cursor-pointer">
                                            <Link to="/buyer/bookings">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                My Bookings
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-900 cursor-pointer">
                                            <Link to="/buyer/purchases">
                                                <ShoppingBag className="mr-2 h-4 w-4" />
                                                My Purchases
                                            </Link>
                                        </DropdownMenuItem>
                                        {user.role === "seller" && (
                                            <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-900 cursor-pointer">
                                                <Link to="/seller/listings">
                                                    <List className="mr-2 h-4 w-4" />
                                                    My Listings
                                                </Link>
                                            </DropdownMenuItem>
                                        )}
                                    </>
                                )}
                                <DropdownMenuSeparator className="bg-slate-100" />
                                <DropdownMenuItem
                                    className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                                    onClick={handleSignOut}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" asChild className="text-slate-600 hover:text-slate-900 hover:bg-slate-100">
                                <Link to="/login">Sign In</Link>
                            </Button>
                            <Button
                                asChild
                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 border-0"
                            >
                                <Link to="/register">Get Started</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </header >
    );
}
