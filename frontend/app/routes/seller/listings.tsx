import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { useSession } from "~/lib/auth-client";
import { vehiclesApi, type Vehicle } from "~/lib/api";
import { Plus, MoreVertical, Trash2, Eye, Car, ArrowLeft, List, Gauge, Fuel, Settings2 } from "lucide-react";

export default function SellerListingsPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchVehicles();
        }
    }, [session, isPending]);

    const fetchVehicles = async () => {
        try {
            const data = await vehiclesApi.getMyVehicles();
            setVehicles(data);
        } catch (error) {
            console.error("Failed to fetch vehicles:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            await vehiclesApi.delete(deleteId);
            setVehicles(vehicles.filter((v) => v.id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            console.error("Failed to delete vehicle:", error);
        }
    };

    const formatPrice = (price: string) => {
        const num = parseFloat(price);
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)}L`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const getImageUrl = (url?: string) => {
        if (!url) return null;
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
        return url.startsWith("http") ? url : `${apiUrl}${url}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                        Live
                    </Badge>
                );
            case "pending":
                return (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                        Pending
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                        Rejected
                    </Badge>
                );
            case "sold":
                return (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
                        Sold
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-0 font-medium">
                        {status}
                    </Badge>
                );
        }
    };

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 mb-6">
                    <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-slate-900">
                        <Link to="/seller/dashboard">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>

                {/* Header */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-pink-100">
                                <List className="h-6 w-6 text-pink-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">My Listings</h1>
                                <p className="text-muted-foreground text-sm">
                                    Manage your {vehicles.length} vehicle listings
                                </p>
                            </div>
                        </div>
                        <Button asChild className="gap-2 bg-slate-900 hover:bg-slate-800 shadow-sm">
                            <Link to="/seller/add-vehicle">
                                <Plus className="h-4 w-4" />
                                Add Vehicle
                            </Link>
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-40 rounded-xl" />
                        ))}
                    </div>
                ) : vehicles.length === 0 ? (
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="py-16 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                                <Car className="h-10 w-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-slate-900">No listings yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                Start selling by adding your first vehicle to reach thousands of buyers
                            </p>
                            <Button asChild className="shadow-sm">
                                <Link to="/seller/add-vehicle">Add Your First Vehicle</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {vehicles.map((vehicle) => (
                            <Card
                                key={vehicle.id}
                                className="bg-white border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200"
                            >
                                <CardContent className="p-0">
                                    <div className="flex flex-col sm:flex-row">
                                        <Link to={`/vehicles/${vehicle.id}`} className="sm:w-72 shrink-0 relative group">
                                            <div className="aspect-[4/3] sm:h-full bg-slate-100 overflow-hidden">
                                                {vehicle.images?.[0] ? (
                                                    <img
                                                        src={getImageUrl(vehicle.images[0]) || ""}
                                                        alt=""
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Car className="h-12 w-12 text-slate-300" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
                                            </div>
                                        </Link>
                                        <div className="flex-1 p-6">
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <Link to={`/vehicles/${vehicle.id}`} className="hover:text-slate-600 transition-colors">
                                                        <h3 className="font-bold text-xl text-slate-900 mb-1">
                                                            {vehicle.year} {vehicle.make} {vehicle.model}
                                                        </h3>
                                                    </Link>
                                                    <p className="text-2xl font-bold text-emerald-600">
                                                        {formatPrice(vehicle.price)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {getStatusBadge(vehicle.status)}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                                <Link to={`/vehicles/${vehicle.id}`}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View Listing
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                                                onClick={() => setDeleteId(vehicle.id)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete Listing
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full">
                                                    <Gauge className="h-4 w-4 text-slate-400" />
                                                    <span>{vehicle.mileage?.toLocaleString()} km</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full">
                                                    <Fuel className="h-4 w-4 text-slate-400" />
                                                    <span className="capitalize">{vehicle.fuelType}</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full">
                                                    <Settings2 className="h-4 w-4 text-slate-400" />
                                                    <span className="capitalize">{vehicle.transmission}</span>
                                                </div>
                                            </div>

                                            <Separator className="my-4" />

                                            <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
                                                <span className="flex items-center gap-1.5">
                                                    <Eye className="h-3.5 w-3.5" />
                                                    {vehicle.views || 0} views
                                                </span>
                                                <span>
                                                    Listed {new Date(vehicle.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Vehicle?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your vehicle listing.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 rounded-lg">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
