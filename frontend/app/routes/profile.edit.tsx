import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useSession, getSession } from "~/lib/auth-client";
import { usersApi, uploadApi, type User } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Loader2, Camera, User as UserIcon, Phone, Mail, Save, MapPin, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export default function EditProfilePage() {
    const navigate = useNavigate();
    const { data: session } = useSession();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [pincode, setPincode] = useState("");
    const [isFetchingPincode, setIsFetchingPincode] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const userData = await usersApi.getMe();
            setUser(userData);
            setName(userData.name);
            setPhone(userData.phone || "");
            setCity(userData.city || "");
            setState(userData.state || "");
            setPincode(userData.pincode || "");
        } catch (error) {
            console.error("Failed to fetch profile:", error);
            toast.error("Failed to load profile details");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const code = e.target.value.replace(/\D/g, '').slice(0, 6);
        setPincode(code);

        if (code.length === 6) {
            setIsFetchingPincode(true);
            try {
                const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
                const data = await response.json();

                if (data[0].Status === "Success" && data[0].PostOffice.length > 0) {
                    const postOffice = data[0].PostOffice[0];
                    setCity(postOffice.District);
                    setState(postOffice.State);
                    toast.success(`Location detected: ${postOffice.District}, ${postOffice.State}`);
                } else {
                    toast.error("Invalid Pincode");
                }
            } catch (error) {
                console.error("Failed to fetch pincode details:", error);
            } finally {
                setIsFetchingPincode(false);
            }
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { url } = await uploadApi.uploadImage(file);

            // Immediately update profile with new image
            const updatedUser = await usersApi.updateMe({ image: url });
            setUser(updatedUser);
            await getSession(); // Refresh session to update sidebar
            toast.success("Profile photo updated");
        } catch (error) {
            console.error("Failed to upload image:", error);
            toast.error("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const updatedUser = await usersApi.updateMe({
                name,
                phone: phone || undefined,
                city: city || undefined,
                state: state || undefined,
                pincode: pincode || undefined,
            });
            setUser(updatedUser);
            await getSession(); // Refresh session
            toast.success("Profile updated successfully");
            window.location.href = "/profile"; // Force reload to ensure all components update
        } catch (error) {
            console.error("Failed to update profile:", error);
            toast.error("Failed to update profile details");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="container mx-auto py-10 text-center">
                <h2 className="text-2xl font-bold">Failed to load profile</h2>
                <Button onClick={() => window.location.reload()} className="mt-4">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-10 px-4 max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/profile">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold">Edit Profile</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Edit Personal Information</CardTitle>
                    <CardDescription>
                        Update your details below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Profile Picture */}
                        <div className="flex flex-col items-center sm:flex-row gap-6">
                            <div className="relative group">
                                <Avatar className="h-24 w-24 cursor-pointer border-2 border-border group-hover:border-primary transition-colors">
                                    <AvatarImage src={user.image || undefined} alt={user.name} />
                                    <AvatarFallback className="text-2xl">
                                        {user.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <label
                                    htmlFor="avatar-upload"
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-opacity"
                                >
                                    <Camera className="h-6 w-6" />
                                </label>
                                <input
                                    id="avatar-upload"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                    disabled={isUploading}
                                />
                            </div>

                            <div className="space-y-1 text-center sm:text-left">
                                <h3 className="font-medium text-lg">{user.name}</h3>
                                <p className="text-sm text-muted-foreground">Click image to change</p>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="pl-9"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Mobile Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="pl-9"
                                        placeholder="+91 9999999999"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 sm:col-span-2">
                                <Label>Address Details</Label>
                                <Separator className="mt-1 mb-2" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pincode">Pincode</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="pincode"
                                        value={pincode}
                                        onChange={handlePincodeChange}
                                        className="pl-9"
                                        placeholder="Enter Pincode"
                                        maxLength={6}
                                    />
                                    {isFetchingPincode && (
                                        <div className="absolute right-3 top-2.5">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="city"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        className="pl-9"
                                        placeholder="Enter City"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="state">State</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="state"
                                        value={state}
                                        onChange={(e) => setState(e.target.value)}
                                        className="pl-9"
                                        placeholder="Enter State"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 gap-4">
                            <Button type="button" variant="outline" asChild>
                                <Link to="/profile">Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
