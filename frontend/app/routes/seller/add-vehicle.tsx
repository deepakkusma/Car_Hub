import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { useSession } from "~/lib/auth-client";
import { vehiclesApi, uploadApi } from "~/lib/api";
import { Loader2, Upload, X, ImagePlus } from "lucide-react";

const MAKES = [
    "Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Toyota", "Honda",
    "Kia", "MG", "Skoda", "Volkswagen", "Ford", "Renault", "Nissan",
    "BMW", "Mercedes-Benz", "Audi", "Jeep", "Volvo", "Lexus"
];

const FUEL_TYPES = ["petrol", "diesel", "electric", "hybrid", "cng"];
const TRANSMISSIONS = ["manual", "automatic"];

export default function AddVehiclePage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();

    const [formData, setFormData] = useState({
        make: "",
        model: "",
        year: currentYear,
        price: "",
        mileage: "",
        fuelType: "petrol" as const,
        transmission: "manual" as const,
        color: "",
        description: "",
        registrationNumber: "",
        engineNumber: "",
        chassisNumber: "",
        ownerCount: 1,
        location: "",
    });

    const [images, setImages] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isPending) {
            if (!session?.user) {
                navigate("/login");
                return;
            }
            if ((session.user as any).role === "buyer") {
                navigate("/");
                return;
            }
        }
    }, [session, isPending]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            const fileArray = Array.from(files);
            const { urls } = await uploadApi.uploadImages(fileArray);
            setImages([...images, ...urls]);
        } catch (error) {
            console.error("Failed to upload images:", error);
            setError("Failed to upload images. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!formData.make || !formData.model || !formData.price ||
            !formData.mileage || !formData.color || !formData.registrationNumber ||
            !formData.engineNumber || !formData.chassisNumber || !formData.location) {
            setError("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        try {
            await vehiclesApi.create({
                ...formData,
                year: Number(formData.year),
                price: formData.price,
                mileage: Number(formData.mileage),
                ownerCount: Number(formData.ownerCount),
                images,
            });

            navigate("/seller/listings");
        } catch (error: any) {
            console.error("Failed to create vehicle:", error);
            setError(error.message || "Failed to create listing. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 bg-slate-50 min-h-full">
            <div className="container mx-auto px-4 py-8 max-w-3xl">
                <h1 className="text-3xl font-bold mb-2">Add New Vehicle</h1>
                <p className="text-muted-foreground mb-8">
                    Fill in the details to list your vehicle
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Vehicle Images */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Vehicle Images</CardTitle>
                            <CardDescription>
                                Upload up to 10 images. First image will be the cover.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {images.map((url, index) => (
                                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                                        <img
                                            src={`http://localhost:3001${url}`}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                        <Button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                        {index === 0 && (
                                            <span className="absolute bottom-1 left-1 px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                                                Cover
                                            </span>
                                        )}
                                    </div>
                                ))}

                                {images.length < 10 && (
                                    <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-orange-500 flex flex-col items-center justify-center cursor-pointer transition-colors">
                                        {isUploading ? (
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        ) : (
                                            <>
                                                <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                                                <span className="text-xs text-muted-foreground">Add</span>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            disabled={isUploading}
                                        />
                                    </label>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="make">Brand *</Label>
                                    <Select
                                        value={formData.make}
                                        onValueChange={(value) => setFormData({ ...formData, make: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select brand" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MAKES.map((make) => (
                                                <SelectItem key={make} value={make}>
                                                    {make}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="model">Model *</Label>
                                    <Input
                                        id="model"
                                        name="model"
                                        placeholder="e.g., Swift, i20"
                                        value={formData.model}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="year">Year *</Label>
                                    <Select
                                        value={String(formData.year)}
                                        onValueChange={(value) => setFormData({ ...formData, year: Number(value) })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 25 }, (_, i) => currentYear - i).map((year) => (
                                                <SelectItem key={year} value={String(year)}>
                                                    {year}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="price">Price (₹) *</Label>
                                    <Input
                                        id="price"
                                        name="price"
                                        type="number"
                                        placeholder="e.g., 500000"
                                        value={formData.price}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Technical Specs */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Technical Specifications</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="mileage">Odometer (km) *</Label>
                                    <Input
                                        id="mileage"
                                        name="mileage"
                                        type="number"
                                        placeholder="e.g., 45000"
                                        value={formData.mileage}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="fuelType">Fuel Type *</Label>
                                    <Select
                                        value={formData.fuelType}
                                        onValueChange={(value: any) => setFormData({ ...formData, fuelType: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FUEL_TYPES.map((fuel) => (
                                                <SelectItem key={fuel} value={fuel}>
                                                    <span className="capitalize">{fuel}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="transmission">Transmission *</Label>
                                    <Select
                                        value={formData.transmission}
                                        onValueChange={(value: any) => setFormData({ ...formData, transmission: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRANSMISSIONS.map((trans) => (
                                                <SelectItem key={trans} value={trans}>
                                                    <span className="capitalize">{trans}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="color">Color *</Label>
                                    <Input
                                        id="color"
                                        name="color"
                                        placeholder="e.g., White"
                                        value={formData.color}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ownerCount">Number of Owners *</Label>
                                    <Select
                                        value={String(formData.ownerCount)}
                                        onValueChange={(value) => setFormData({ ...formData, ownerCount: Number(value) })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[1, 2, 3, 4, 5].map((num) => (
                                                <SelectItem key={num} value={String(num)}>
                                                    {num === 1 ? "1st Owner" : `${num} Owners`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="registrationNumber">Registration Number *</Label>
                                    <Input
                                        id="registrationNumber"
                                        name="registrationNumber"
                                        placeholder="e.g., MH12AB1234"
                                        value={formData.registrationNumber}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="engineNumber">Engine Number *</Label>
                                    <Input
                                        id="engineNumber"
                                        name="engineNumber"
                                        placeholder="e.g., XYZ1234567890"
                                        value={formData.engineNumber}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="chassisNumber">Chassis Number *</Label>
                                    <Input
                                        id="chassisNumber"
                                        name="chassisNumber"
                                        placeholder="e.g., MA1ZY123456789012"
                                        value={formData.chassisNumber}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="location">Location *</Label>
                                <Input
                                    id="location"
                                    name="location"
                                    placeholder="e.g., Mumbai, Maharashtra"
                                    value={formData.location}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Description */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Describe your vehicle, highlight key features..."
                                value={formData.description}
                                onChange={handleChange}
                                rows={5}
                            />
                        </CardContent>
                    </Card>

                    {/* Submit */}
                    <div className="flex gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate("/seller/listings")}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Listing"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
