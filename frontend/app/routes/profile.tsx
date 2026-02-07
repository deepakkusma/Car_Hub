import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useSession } from "~/lib/auth-client";
import { usersApi, type User } from "~/lib/api";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Loader2, User as UserIcon, Phone, Mail, MapPin, Calendar, CheckCircle2, Edit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";

export default function ProfilePage() {
    const { data: session } = useSession();
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const userData = await usersApi.getMe();
            setUser(userData);
        } catch (error) {
            console.error("Failed to fetch profile:", error);
            toast.error("Failed to load profile details");
        } finally {
            setIsLoading(false);
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

    const joinDate = new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });

    return (
        <div className="container mx-auto py-10 px-4 max-w-3xl">
            <h1 className="text-3xl font-bold mb-2">My Profile</h1>
            <p className="text-muted-foreground mb-8">
                View your personal information and verification status.
            </p>

            <div className="grid gap-8">
                {/* Profile Information Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>
                            Your current profile details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Profile Picture & Header */}
                        <div className="flex flex-col items-center sm:flex-row gap-6">
                            <Avatar className="h-24 w-24 border-2 border-border">
                                <AvatarImage src={user.image || undefined} alt={user.name} />
                                <AvatarFallback className="text-2xl">
                                    {user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>

                            <div className="space-y-1 text-center sm:text-left flex-1">
                                <h3 className="font-medium text-lg">{user.name}</h3>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-2">
                                    <Badge variant="secondary" className="capitalize">
                                        {user.role} Account
                                    </Badge>
                                    <Badge variant="outline" className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Member since {joinDate}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="grid gap-6 sm:grid-cols-2">
                            {/* Full Name */}
                            <div className="space-y-1">
                                <span className="text-sm font-medium text-muted-foreground">Full Name</span>
                                <div className="flex items-center gap-2">
                                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                                    <span>{user.name}</span>
                                </div>
                            </div>

                            {/* Mobile Number */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">Mobile Number</span>
                                    {user.phone && (
                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-100 text-green-700 hover:bg-green-100">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Verified
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{user.phone || "Not provided"}</span>
                                </div>
                            </div>

                            {/* Email Address */}
                            <div className="space-y-1 sm:col-span-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground">Email Address</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-100 text-green-700 hover:bg-green-100">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Verified
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span>{user.email}</span>
                                </div>
                            </div>

                            {/* Address Section */}
                            <div className="sm:col-span-2 mt-2">
                                <Separator className="mb-4" />
                                <span className="text-sm font-medium text-muted-foreground block mb-2">Address Details</span>
                            </div>

                            {/* City */}
                            <div className="space-y-1">
                                <span className="text-sm font-medium text-muted-foreground">City</span>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span>{user.city || "Not provided"}</span>
                                </div>
                            </div>

                            {/* State */}
                            <div className="space-y-1">
                                <span className="text-sm font-medium text-muted-foreground">State</span>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span>{user.state || "Not provided"}</span>
                                </div>
                            </div>

                            {/* Pincode */}
                            <div className="space-y-1">
                                <span className="text-sm font-medium text-muted-foreground">Pincode</span>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span>{user.pincode || "Not provided"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6">
                            <Button asChild>
                                <Link to="/profile/edit">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Profile
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
