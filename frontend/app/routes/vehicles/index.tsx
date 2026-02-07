import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";

import { Footer } from "~/components/layout/Footer";
import { VehicleCard } from "~/components/vehicles/VehicleCard";
import { VehicleFiltersComponent } from "~/components/vehicles/VehicleFilters";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { vehiclesApi, type Vehicle, type VehicleFilters } from "~/lib/api";
import { ChevronLeft, ChevronRight, Car, SlidersHorizontal } from "lucide-react";

export default function VehiclesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
    });

    const [filters, setFilters] = useState<VehicleFilters>({
        make: searchParams.get("make") || undefined,
        model: searchParams.get("model") || undefined,
        minPrice: searchParams.get("minPrice") || undefined,
        maxPrice: searchParams.get("maxPrice") || undefined,
        minYear: searchParams.get("minYear") || undefined,
        maxYear: searchParams.get("maxYear") || undefined,
        fuelType: searchParams.get("fuelType") || undefined,
        transmission: searchParams.get("transmission") || undefined,
        page: parseInt(searchParams.get("page") || "1"),
        limit: 12,
    });

    const [sortBy, setSortBy] = useState("newest");

    useEffect(() => {
        fetchVehicles();
    }, [filters, sortBy]);

    const fetchVehicles = async () => {
        setIsLoading(true);
        try {
            const response = await vehiclesApi.getAll({
                ...filters,
                status: "approved",
                sortBy,
            });
            setVehicles(response.vehicles);
            setPagination(response.pagination);

            // Update URL params
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== "") {
                    params.set(key, String(value));
                }
            });
            setSearchParams(params, { replace: true });
        } catch (error) {
            console.error("Failed to fetch vehicles:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFiltersChange = (newFilters: VehicleFilters) => {
        setFilters(newFilters);
    };

    const handleResetFilters = () => {
        setFilters({ page: 1, limit: 12 });
        setSearchParams({});
    };

    const handlePageChange = (newPage: number) => {
        setFilters({ ...filters, page: newPage });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">


            <main className="flex-1 container mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Browse Cars</h1>
                    <p className="text-muted-foreground">
                        {pagination.total} vehicles available
                    </p>
                </div>

                <div className="flex gap-6">
                    {/* Filters Sidebar */}
                    <VehicleFiltersComponent
                        filters={filters}
                        onFiltersChange={handleFiltersChange}
                        onReset={handleResetFilters}
                    />

                    {/* Main Content */}
                    <div className="flex-1">
                        {/* Sort Bar */}
                        <div className="flex items-center justify-between mb-6 bg-white rounded-lg border p-4">
                            <div className="flex items-center gap-4">
                                <div className="lg:hidden">
                                    <VehicleFiltersComponent
                                        filters={filters}
                                        onFiltersChange={handleFiltersChange}
                                        onReset={handleResetFilters}
                                    />
                                </div>
                                <span className="text-sm text-muted-foreground hidden sm:inline">
                                    Showing {vehicles.length} of {pagination.total} results
                                </span>
                            </div>

                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Sort by" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">Newest First</SelectItem>
                                    <SelectItem value="oldest">Oldest First</SelectItem>
                                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                                    <SelectItem value="year-new">Year: Newest</SelectItem>
                                    <SelectItem value="year-old">Year: Oldest</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Vehicles Grid */}
                        {isLoading ? (
                            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="rounded-lg overflow-hidden bg-white">
                                        <Skeleton className="aspect-[4/3] w-full" />
                                        <div className="p-4 space-y-3">
                                            <Skeleton className="h-6 w-3/4" />
                                            <Skeleton className="h-8 w-1/2" />
                                            <div className="grid grid-cols-2 gap-2">
                                                <Skeleton className="h-4" />
                                                <Skeleton className="h-4" />
                                                <Skeleton className="h-4" />
                                                <Skeleton className="h-4" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : vehicles.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-lg border">
                                <Car className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No vehicles found</h3>
                                <p className="text-muted-foreground mb-4">
                                    Try adjusting your filters to find what you're looking for.
                                </p>
                                <Button variant="outline" onClick={handleResetFilters}>
                                    Clear All Filters
                                </Button>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {vehicles.map((vehicle) => (
                                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={pagination.page === 1}
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                    .filter((page) => {
                                        const current = pagination.page;
                                        return (
                                            page === 1 ||
                                            page === pagination.totalPages ||
                                            Math.abs(page - current) <= 1
                                        );
                                    })
                                    .map((page, i, arr) => (
                                        <div key={page} className="flex items-center">
                                            {i > 0 && arr[i - 1] !== page - 1 && (
                                                <span className="px-2 text-muted-foreground">...</span>
                                            )}
                                            <Button
                                                variant={pagination.page === page ? "default" : "outline"}
                                                size="icon"
                                                onClick={() => handlePageChange(page)}
                                                className={
                                                    pagination.page === page
                                                        ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                                                        : ""
                                                }
                                            >
                                                {page}
                                            </Button>
                                        </div>
                                    ))}

                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={pagination.page === pagination.totalPages}
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
