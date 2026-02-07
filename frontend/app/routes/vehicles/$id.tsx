import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { Header } from "~/components/layout/Header";
import { Footer } from "~/components/layout/Footer";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "~/components/ui/carousel";
import {
    Heart,
    Share2,
    Fuel,
    Gauge,
    Settings2,
    Calendar,
    MapPin,
    User,
    MessageSquare,
    Phone,
    ChevronLeft,
    CheckCircle,
    Palette,
    Users,
    FileText,
    ShoppingCart,
    Hash,
    Clock,
    Shield,
} from "lucide-react";
import { vehiclesApi, favoritesApi, inquiriesApi, type Vehicle } from "~/lib/api";
import { useSession } from "~/lib/auth-client";
import { cn } from "~/lib/utils";

export default function VehicleDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: session } = useSession();

    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFavorited, setIsFavorited] = useState(false);
    const [isInquiryOpen, setIsInquiryOpen] = useState(false);
    const [inquiryMessage, setInquiryMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    useEffect(() => {
        if (id) {
            fetchVehicle();
            if (session?.user) {
                checkFavorite();
            }
        }
    }, [id, session]);

    const fetchVehicle = async () => {
        setIsLoading(true);
        try {
            const data = await vehiclesApi.getById(id!);
            setVehicle(data);
        } catch (error) {
            console.error("Failed to fetch vehicle:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkFavorite = async () => {
        try {
            const { isFavorited } = await favoritesApi.check(id!);
            setIsFavorited(isFavorited);
        } catch (error) {
            console.error("Failed to check favorite:", error);
        }
    };

    const handleFavorite = async () => {
        if (!session?.user) {
            navigate("/login");
            return;
        }

        try {
            if (isFavorited) {
                await favoritesApi.remove(id!);
                setIsFavorited(false);
            } else {
                await favoritesApi.add(id!);
                setIsFavorited(true);
            }
        } catch (error) {
            console.error("Failed to update favorite:", error);
        }
    };

    const handleInquiry = async () => {
        if (!session?.user) {
            navigate("/login");
            return;
        }

        const trimmed = inquiryMessage.trim();
        if (!trimmed) {
            alert("Please enter a message for your inquiry.");
            return;
        }

        if (trimmed.length < 10) {
            alert("Inquiry message must be at least 10 characters so the seller has enough details.");
            return;
        }

        setIsSubmitting(true);
        try {
            await inquiriesApi.create({
                vehicleId: id!,
                message: trimmed,
            });
            setIsInquiryOpen(false);
            setInquiryMessage("");
            alert("Inquiry sent successfully!");
        } catch (error) {
            console.error("Failed to send inquiry:", error);
            alert(error instanceof Error ? error.message : "Failed to send inquiry. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatPrice = (price: string) => {
        const num = parseFloat(price);
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const getImageUrl = (url: string) => {
        return url.startsWith("http") ? url : `http://localhost:3001${url}`;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col">
                {/* Header removed */}
                <main className="flex-1 container mx-auto px-4 py-8">
                    <div className="grid lg:grid-cols-2 gap-8">
                        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-3/4" />
                            <Skeleton className="h-12 w-1/2" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-48 w-full" />
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    if (!vehicle) {
        return (
            <div className="min-h-screen flex flex-col">
                {/* Header removed */}
                <main className="flex-1 container mx-auto px-4 py-16 text-center">
                    <h1 className="text-2xl font-bold mb-4">Vehicle Not Found</h1>
                    <p className="text-muted-foreground mb-6">
                        The vehicle you're looking for doesn't exist or has been removed.
                    </p>
                    <Button asChild>
                        <Link to="/vehicles">Browse Vehicles</Link>
                    </Button>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50/50">
            {/* Header removed for premium, distraction-free experience */}

            <main className="flex-1">
                {/* Minimal breadcrumb / Back navigation */}
                <div className="bg-white border-b sticky top-0 z-10 w-full">
                    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                        <Link
                            to="/vehicles"
                            className="flex items-center text-slate-500 hover:text-slate-900 transition-colors font-medium"
                        >
                            <ChevronLeft className="h-5 w-5 mr-1" />
                            Back to Marketplace
                        </Link>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleFavorite}
                                className={cn("hover:bg-slate-100", isFavorited && "text-red-500 hover:text-red-600")}
                            >
                                <Heart className={cn("h-5 w-5", isFavorited && "fill-current")} />
                            </Button>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100">
                                <Share2 className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-8">
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Main Content */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Image Gallery */}
                            <div className="bg-slate-100 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                                <div className="relative aspect-[16/10] bg-slate-200">
                                    {vehicle.images && vehicle.images.length > 0 ? (
                                        <>
                                            <img
                                                src={getImageUrl(vehicle.images[selectedImageIndex])}
                                                alt={`${vehicle.make} ${vehicle.model}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {vehicle.images.length > 1 && (
                                                <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
                                                    <Palette className="w-3.5 h-3.5" />
                                                    {selectedImageIndex + 1} / {vehicle.images.length}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-slate-400 font-medium">No Images Available</span>
                                        </div>
                                    )}
                                </div>

                                {/* Thumbnails */}
                                {vehicle.images && vehicle.images.length > 1 && (
                                    <div className="p-4 flex gap-3 overflow-x-auto border-t border-slate-200 bg-white">
                                        {vehicle.images.map((img, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedImageIndex(idx)}
                                                className={cn(
                                                    "shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all",
                                                    selectedImageIndex === idx
                                                        ? "border-blue-500 ring-2 ring-blue-100"
                                                        : "border-slate-100 opacity-70 hover:opacity-100 hover:border-slate-300"
                                                )}
                                            >
                                                <img
                                                    src={getImageUrl(img)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Vehicle Info */}
                            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full w-fit">
                                            <CheckCircle className="w-4 h-4" />
                                            Certified Pre-Owned
                                        </div>
                                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                        </h1>
                                        <div className="flex items-center gap-4 text-slate-500 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-4 h-4" />
                                                {vehicle.location || "Location N/A"}
                                            </div>
                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-4 h-4" />
                                                Listed recently
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-3">
                                        <p className="text-4xl font-bold text-slate-900">
                                            {formatPrice(vehicle.price)}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleFavorite}
                                                className={cn("h-10 px-4 gap-2", isFavorited ? "text-red-500 border-red-200 bg-red-50" : "text-slate-600")}
                                            >
                                                <Heart className={cn("h-4 w-4", isFavorited && "fill-current")} />
                                                {isFavorited ? "Saved" : "Save"}
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-10 px-4 gap-2 text-slate-600">
                                                <Share2 className="h-4 w-4" />
                                                Share
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Key Specs Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: "Odometer", value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "N/A", icon: Gauge, color: "text-blue-600", bg: "bg-blue-50" },
                                        { label: "Fuel Type", value: vehicle.fuelType, icon: Fuel, color: "text-emerald-600", bg: "bg-emerald-50" },
                                        { label: "Transmission", value: vehicle.transmission, icon: Settings2, color: "text-purple-600", bg: "bg-purple-50" },
                                        { label: "Model Year", value: vehicle.year, icon: Calendar, color: "text-amber-600", bg: "bg-amber-50" },
                                    ].map((spec, i) => (
                                        <div key={i} className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                                            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-3", spec.bg, spec.color)}>
                                                <spec.icon className="w-5 h-5" />
                                            </div>
                                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{spec.label}</p>
                                            <p className="text-base font-semibold text-slate-900 capitalize">{spec.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Additional Details & Description */}
                            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 mt-6">
                                <h3 className="font-bold text-xl text-slate-900 mb-6">Vehicle Details</h3>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-8">
                                    {vehicle.color && (
                                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <Palette className="h-4 w-4" /> Color
                                            </span>
                                            <span className="font-medium text-slate-900">{vehicle.color}</span>
                                        </div>
                                    )}
                                    {vehicle.ownerCount && (
                                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <Users className="h-4 w-4" /> Owners
                                            </span>
                                            <span className="font-medium text-slate-900">
                                                {vehicle.ownerCount === 1 ? "1st Owner" : `${vehicle.ownerCount} Owners`}
                                            </span>
                                        </div>
                                    )}
                                    {vehicle.registrationNumber && (
                                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <FileText className="h-4 w-4" /> Reg No
                                            </span>
                                            <span className="font-medium text-slate-900 uppercase">{vehicle.registrationNumber}</span>
                                        </div>
                                    )}
                                    {vehicle.engineNumber && (
                                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <Hash className="h-4 w-4" /> Engine No
                                            </span>
                                            <span className="font-medium text-slate-900 uppercase">{vehicle.engineNumber}</span>
                                        </div>
                                    )}
                                    {vehicle.chassisNumber && (
                                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <Hash className="h-4 w-4" /> Chassis No
                                            </span>
                                            <span className="font-medium text-slate-900 uppercase">{vehicle.chassisNumber}</span>
                                        </div>
                                    )}
                                    {vehicle.location && (
                                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <MapPin className="h-4 w-4" /> Location
                                            </span>
                                            <span className="font-medium text-slate-900">{vehicle.location}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                {vehicle.description && (
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-900 mb-4">Description</h3>
                                        <div className="prose prose-slate max-w-none text-slate-600">
                                            <p className="whitespace-pre-line leading-relaxed">{vehicle.description}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Seller Card */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                <h3 className="font-bold text-lg text-slate-900 mb-4">Seller Information</h3>
                                <div className="flex items-center gap-4 mb-6">
                                    <Avatar className="h-16 w-16 border-2 border-slate-100 transition-transform hover:scale-105">
                                        <AvatarImage src={vehicle.seller?.image || undefined} className="object-cover" />
                                        <AvatarFallback className="bg-gradient-to-br from-orange-400 to-red-500 text-white text-xl font-bold">
                                            {vehicle.seller?.name?.charAt(0).toUpperCase() || "S"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-lg text-slate-900">{vehicle.seller?.name || "Seller"}</p>
                                        {vehicle.seller?.emailVerified ? (
                                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 gap-1 pl-1 pr-2 mt-1 font-normal border-emerald-100">
                                                <CheckCircle className="h-3.5 w-3.5 fill-emerald-100" />
                                                Verified Seller
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-500 gap-1 mt-1 font-normal">
                                                Unverified
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {vehicle.seller?.phone && (
                                        <Button variant="outline" className="w-full justify-start gap-3 h-11 text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900">
                                            <Phone className="h-4 w-4 text-slate-400" />
                                            {vehicle.seller.phone}
                                        </Button>
                                    )}

                                    {/* Hide inquiry button for admins and the seller themselves */}
                                    {(session?.user as any)?.role !== "admin" && (session?.user as any)?.id !== vehicle.sellerId && (
                                        <Dialog open={isInquiryOpen} onOpenChange={setIsInquiryOpen}>
                                            <DialogTrigger asChild>
                                                <Button className="w-full gap-2 h-11 bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-md hover:shadow-lg">
                                                    <MessageSquare className="h-4 w-4" />
                                                    Send Inquiry
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>Send an Inquiry</DialogTitle>
                                                    <DialogDescription>
                                                        Send a message to the seller about this vehicle.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 pt-2">
                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                                        </p>
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            {formatPrice(vehicle.price)}
                                                        </p>
                                                    </div>
                                                    <Textarea
                                                        placeholder="Hi, I'm interested in this vehicle. Is it still available?"
                                                        value={inquiryMessage}
                                                        onChange={(e) => setInquiryMessage(e.target.value)}
                                                        rows={4}
                                                        className="resize-none"
                                                    />
                                                    <Button
                                                        onClick={handleInquiry}
                                                        disabled={!inquiryMessage.trim() || isSubmitting}
                                                        className="w-full bg-slate-900 hover:bg-slate-800"
                                                    >
                                                        {isSubmitting ? "Sending..." : "Send Inquiry"}
                                                    </Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                            </div>

                            {/* Purchase Card - Show only for approved vehicles and non-sellers */}
                            {vehicle.status === "approved" && session?.user && (session.user as any).id !== vehicle.sellerId && (session.user as any).role !== "seller" && (session.user as any).role !== "admin" && (
                                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                                    <h3 className="font-bold text-xl text-slate-900 mb-2">Ready to Buy?</h3>
                                    <p className="text-slate-500 text-sm mb-6">
                                        Secure this car today with our protected payment system.
                                    </p>

                                    <div className="space-y-3">
                                        <Button
                                            onClick={() => navigate(`/vehicles/${id}/payment`)}
                                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm transition-all"
                                        >
                                            Buy Now for {formatPrice(vehicle.price)}
                                        </Button>

                                        <Button
                                            variant="outline"
                                            onClick={() => navigate(`/vehicles/${id}/payment?mode=booking`)}
                                            className="w-full h-12 border-slate-200 text-slate-700 hover:bg-slate-50"
                                        >
                                            Book for 5% & {formatPrice(String(Math.round(parseFloat(vehicle.price) * 0.05)))}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Vehicle Sold Notice */}
                            {vehicle.status === "sold" && (
                                <Card className="border-gray-300 bg-gray-50">
                                    <CardContent className="py-6 text-center">
                                        <Badge variant="secondary" className="mb-2 text-lg px-4 py-1">
                                            SOLD
                                        </Badge>
                                        <p className="text-muted-foreground">
                                            This vehicle has been sold.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Safety Tips */}
                            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield className="h-5 w-5 text-blue-600" />
                                    <h3 className="font-bold text-blue-800">Safety Tips</h3>
                                </div>
                                <ul className="text-sm text-blue-700 space-y-2 pl-1">
                                    <li className="flex items-start gap-2">
                                        <span className="block w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                                        Meet in a safe, public place for test drives.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="block w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                                        Verify all documents before manual payment.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="block w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                                        Never share OTPs or banking details.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div >
            </main >

            <Footer />
        </div >
    );
}
