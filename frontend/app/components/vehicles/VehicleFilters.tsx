import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "~/components/ui/sheet";
import { Slider } from "~/components/ui/slider";
import { Filter, X } from "lucide-react";
import type { VehicleFilters } from "~/lib/api";

const MAKES = [
    "Maruti Suzuki",
    "Hyundai",
    "Tata",
    "Mahindra",
    "Toyota",
    "Honda",
    "Kia",
    "MG",
    "Skoda",
    "Volkswagen",
    "Ford",
    "Renault",
    "Nissan",
    "BMW",
    "Mercedes-Benz",
    "Audi",
];

const FUEL_TYPES = ["petrol", "diesel", "electric", "hybrid", "cng"];
const TRANSMISSIONS = ["manual", "automatic"];

interface VehicleFiltersProps {
    filters: VehicleFilters;
    onFiltersChange: (filters: VehicleFilters) => void;
    onReset: () => void;
}

export function VehicleFiltersComponent({
    filters,
    onFiltersChange,
    onReset,
}: VehicleFiltersProps) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 20 }, (_, i) => currentYear - i);

    const updateFilter = (key: keyof VehicleFilters, value: any) => {
        onFiltersChange({ ...filters, [key]: value, page: 1 });
    };

    const hasActiveFilters = Object.values(filters).some(
        (v) => v !== undefined && v !== "" && v !== 1
    );

    const FilterContent = () => (
        <div className="space-y-6">
            {/* Make */}
            <div className="space-y-2">
                <Label>Brand</Label>
                <Select
                    value={filters.make || "__all__"}
                    onValueChange={(value) => updateFilter("make", value === "__all__" ? undefined : value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Brands" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All Brands</SelectItem>
                        {MAKES.map((make) => (
                            <SelectItem key={make} value={make}>
                                {make}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
                <Label>Price Range</Label>
                <div className="flex gap-2">
                    <Input
                        type="number"
                        placeholder="Min"
                        value={filters.minPrice || ""}
                        onChange={(e) => updateFilter("minPrice", e.target.value || undefined)}
                        className="flex-1"
                    />
                    <Input
                        type="number"
                        placeholder="Max"
                        value={filters.maxPrice || ""}
                        onChange={(e) => updateFilter("maxPrice", e.target.value || undefined)}
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Year Range */}
            <div className="space-y-2">
                <Label>Year</Label>
                <div className="flex gap-2">
                    <Select
                        value={filters.minYear || "__all__"}
                        onValueChange={(value) => updateFilter("minYear", value === "__all__" ? undefined : value)}
                    >
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder="From" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Any</SelectItem>
                            {years.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.maxYear || "__all__"}
                        onValueChange={(value) => updateFilter("maxYear", value === "__all__" ? undefined : value)}
                    >
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder="To" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Any</SelectItem>
                            {years.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Fuel Type */}
            <div className="space-y-2">
                <Label>Fuel Type</Label>
                <Select
                    value={filters.fuelType || "__all__"}
                    onValueChange={(value) => updateFilter("fuelType", value === "__all__" ? undefined : value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Fuel Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All Fuel Types</SelectItem>
                        {FUEL_TYPES.map((fuel) => (
                            <SelectItem key={fuel} value={fuel}>
                                <span className="capitalize">{fuel}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Transmission */}
            <div className="space-y-2">
                <Label>Transmission</Label>
                <Select
                    value={filters.transmission || "__all__"}
                    onValueChange={(value) => updateFilter("transmission", value === "__all__" ? undefined : value)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="All Transmissions" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All Transmissions</SelectItem>
                        {TRANSMISSIONS.map((trans) => (
                            <SelectItem key={trans} value={trans}>
                                <span className="capitalize">{trans}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
                <Button variant="outline" onClick={onReset} className="w-full">
                    <X className="h-4 w-4 mr-2" />
                    Clear All Filters
                </Button>
            )}
        </div>
    );

    return (
        <>
            {/* Desktop Filters */}
            <div className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-20 bg-white rounded-lg border p-4 shadow-sm">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </h3>
                    <FilterContent />
                </div>
            </div>

            {/* Mobile Filters */}
            <div className="lg:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Filters
                            {hasActiveFilters && (
                                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                    Active
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                <Filter className="h-5 w-5" />
                                Filters
                            </SheetTitle>
                        </SheetHeader>
                        <div className="mt-6">
                            <FilterContent />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
