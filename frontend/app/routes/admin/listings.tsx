import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { useSession } from "~/lib/auth-client";
import { adminApi, type Vehicle } from "~/lib/api";
import { Car, Check, X, Eye, Filter } from "lucide-react";

export default function AdminListingsPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentFilter, setCurrentFilter] = useState("all");
    const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(() => new Set());

    useEffect(() => {
        if (!isPending && !session?.user) {
            navigate("/login");
            return;
        }

        const user = session?.user as any;
        if (user && user.role !== "admin") {
            navigate("/");
            return;
        }

        if (session?.user) {
            fetchListings(currentFilter);
        }
    }, [session, isPending, currentFilter]);

    const fetchListings = async (status: string) => {
        setIsLoading(true);
        try {
            const data = await adminApi.getListings(status === "all" ? undefined : status);
            setVehicles(data.vehicles);
        } catch (error) {
            console.error("Failed to fetch listings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            await adminApi.updateListingStatus(id, status);
            setVehicles(vehicles.map((v) => (v.id === id ? { ...v, status: status as any } : v)));
        } catch (error) {
            console.error("Failed to update status:", error);
        }
    };

    const formatPrice = (price: string) => {
        const num = parseFloat(price);
        if (num >= 100000) {
            return `₹${(num / 100000).toFixed(2)}L`;
        }
        return `₹${num.toLocaleString("en-IN")}`;
    };

    const getImageUrl = (url: string) => {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
        return url.startsWith("http") ? url : `${API_URL}${url}`;
    };

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <main>
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-xl bg-orange-100">
                            <Car className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Listings Management</h1>
                            <p className="text-muted-foreground">
                                Approve or reject vehicle listings
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Filter className="h-5 w-5 text-muted-foreground" />
                            <Select value={currentFilter} onValueChange={setCurrentFilter}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Listings</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : vehicles.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">
                                    No {currentFilter === "all" ? "" : currentFilter} listings
                                </h3>
                                <p className="text-muted-foreground">
                                    {currentFilter === "pending"
                                        ? "No listings are waiting for approval"
                                        : currentFilter === "all"
                                            ? "No listings found"
                                            : `No ${currentFilter} listings found`}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="rounded-md border bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Image</TableHead>
                                        <TableHead>Vehicle Details</TableHead>
                                        <TableHead>Price</TableHead>
                                        <TableHead>Seller</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vehicles.map((vehicle) => (
                                        <TableRow key={vehicle.id}>
                                            <TableCell>
                                                <div className="relative h-12 w-20 overflow-hidden rounded-md bg-slate-100">
                                                    {vehicle.images?.[0] && !imageErrorIds.has(vehicle.id) ? (
                                                        <img
                                                            src={getImageUrl(vehicle.images[0])}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                            onError={() =>
                                                                setImageErrorIds((prev) =>
                                                                    new Set(prev).add(vehicle.id)
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center">
                                                            <Car className="h-6 w-6 text-slate-300" />
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {vehicle.mileage?.toLocaleString()} km •{" "}
                                                    <span className="capitalize">{vehicle.fuelType}</span> •{" "}
                                                    <span className="capitalize">{vehicle.transmission}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-orange-600">
                                                {formatPrice(vehicle.price)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">
                                                        {vehicle.seller?.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {vehicle.seller?.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={
                                                        vehicle.status === "approved"
                                                            ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                                                            : vehicle.status === "pending"
                                                                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200"
                                                                : vehicle.status === "sold"
                                                                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
                                                                    : "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                                                    }
                                                    variant="secondary"
                                                >
                                                    {vehicle.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link to={`/vehicles/${vehicle.id}`}>
                                                            <Eye className="h-4 w-4" />
                                                            <span className="sr-only">View</span>
                                                        </Link>
                                                    </Button>
                                                    {vehicle.status !== "approved" &&
                                                        vehicle.status !== "sold" && (
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                onClick={() =>
                                                                    handleStatusChange(vehicle.id, "approved")
                                                                }
                                                                title="Approve"
                                                            >
                                                                <Check className="h-4 w-4" />
                                                                <span className="sr-only">Approve</span>
                                                            </Button>
                                                        )}
                                                    {vehicle.status !== "rejected" &&
                                                        vehicle.status !== "sold" && (
                                                            <Button
                                                                variant="outline"
                                                                size="icon"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() =>
                                                                    handleStatusChange(vehicle.id, "rejected")
                                                                }
                                                                title="Reject"
                                                            >
                                                                <X className="h-4 w-4" />
                                                                <span className="sr-only">Reject</span>
                                                            </Button>
                                                        )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
