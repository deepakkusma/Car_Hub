import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { VehicleCard } from "~/components/vehicles/VehicleCard";
import { Skeleton } from "~/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useSession } from "~/lib/auth-client";
import { favoritesApi, type Vehicle } from "~/lib/api";
import { Heart } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";

export default function FavoritesPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        if (session?.user) {
            fetchFavorites();
        }
    }, [session, isPending]);

    const fetchFavorites = async () => {
        try {
            const data = await favoritesApi.getAll();
            setFavorites(data);
        } catch (error) {
            console.error("Failed to fetch favorites:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-1 bg-slate-50 min-h-full">
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-3xl font-bold">My Favorites</h1>
                </div>
                <p className="text-muted-foreground mb-8 ml-14">
                    Vehicles you've saved for later
                </p>

                {isLoading ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="rounded-lg overflow-hidden bg-white">
                                <Skeleton className="aspect-[4/3] w-full" />
                                <div className="p-4 space-y-3">
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-8 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : favorites.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-lg border">
                        <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
                        <p className="text-muted-foreground mb-6">
                            Start browsing and save vehicles you like
                        </p>
                        <Button asChild>
                            <Link to="/vehicles">Browse Cars</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {favorites.map((vehicle) => (
                            <VehicleCard
                                key={vehicle.id}
                                vehicle={vehicle}
                                onFavoriteChange={fetchFavorites}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
