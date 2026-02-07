import { Link } from "react-router";
import { Card, CardContent, CardFooter } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Heart, Fuel, Gauge, Settings2, MapPin } from "lucide-react";
import type { Vehicle } from "~/lib/api";
import { useState } from "react";
import { favoritesApi } from "~/lib/api";
import { useSession } from "~/lib/auth-client";
import { cn } from "~/lib/utils";

interface VehicleCardProps {
    vehicle: Vehicle;
    showFavorite?: boolean;
    onFavoriteChange?: () => void;
}

export function VehicleCard({ vehicle, showFavorite = true, onFavoriteChange }: VehicleCardProps) {
    const { data: session } = useSession();
    const [isFavorited, setIsFavorited] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const formatPrice = (price: string) => {
        const num = parseFloat(price);
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)} Lakh`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const handleFavorite = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!session?.user) return;

        setIsLoading(true);
        try {
            if (isFavorited) {
                await favoritesApi.remove(vehicle.id);
                setIsFavorited(false);
            } else {
                await favoritesApi.add(vehicle.id);
                setIsFavorited(true);
            }
            onFavoriteChange?.();
        } catch (error) {
            console.error("Failed to update favorite:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "approved":
                return "bg-green-100 text-green-800";
            case "pending":
                return "bg-yellow-100 text-yellow-800";
            case "rejected":
                return "bg-red-100 text-red-800";
            case "sold":
                return "bg-gray-100 text-gray-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <Link to={`/vehicles/${vehicle.id}`} className="block group">
            <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-0 shadow-md">
                {/* Image */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {vehicle.images && vehicle.images.length > 0 ? (
                        <img
                            src={vehicle.images[0].startsWith("http") ? vehicle.images[0] : `http://localhost:3001${vehicle.images[0]}`}
                            alt={`${vehicle.make} ${vehicle.model}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                            <span className="text-slate-400 text-lg">No Image</span>
                        </div>
                    )}

                    {/* Status Badge */}
                    {vehicle.status !== "approved" && (
                        <Badge className={cn("absolute top-2 left-2", getStatusColor(vehicle.status))}>
                            {vehicle.status}
                        </Badge>
                    )}

                    {/* Favorite Button */}
                    {showFavorite && session?.user && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "absolute top-2 right-2 bg-white/80 hover:bg-white shadow-sm",
                                isFavorited && "text-red-500"
                            )}
                            onClick={handleFavorite}
                            disabled={isLoading}
                        >
                            <Heart className={cn("h-5 w-5", isFavorited && "fill-current")} />
                        </Button>
                    )}

                    {/* Featured Badge */}
                    {vehicle.views && vehicle.views > 100 && (
                        <Badge className="absolute bottom-2 left-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">
                            Popular
                        </Badge>
                    )}
                </div>

                <CardContent className="p-4">
                    {/* Title */}
                    <h3 className="font-semibold text-lg truncate group-hover:text-blue-600 transition-colors">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>

                    {/* Price */}
                    <p className="text-2xl font-bold text-primary mt-1">
                        {formatPrice(vehicle.price)}
                    </p>

                    {/* Specs */}
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-muted-foreground">
                        {vehicle.mileage && (
                            <div className="flex items-center gap-1">
                                <Gauge className="h-4 w-4" />
                                <span>{vehicle.mileage.toLocaleString()} km</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <Fuel className="h-4 w-4" />
                            <span className="capitalize">{vehicle.fuelType}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Settings2 className="h-4 w-4" />
                            <span className="capitalize">{vehicle.transmission}</span>
                        </div>
                        {vehicle.location && (
                            <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span className="truncate">{vehicle.location}</span>
                            </div>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="p-4 pt-0 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {vehicle.ownerCount && (
                            <span>{vehicle.ownerCount === 1 ? "1st Owner" : `${vehicle.ownerCount} Owners`}</span>
                        )}
                    </div>
                    <Button size="sm">
                        View Details
                    </Button>
                </CardFooter>
            </Card>
        </Link>
    );
}
