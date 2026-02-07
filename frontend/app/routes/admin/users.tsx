import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
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
import { adminApi, type User } from "~/lib/api";
import { Users, Trash2, CheckCircle, XCircle, Shield, ShoppingCart, Store, Ban, UserCheck } from "lucide-react";

export default function AdminUsersPage() {
    const { data: session, isPending } = useSession();
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [updatingVerification, setUpdatingVerification] = useState<string | null>(null);
    const [updatingSuspension, setUpdatingSuspension] = useState<string | null>(null);

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
            fetchUsers();
        }
    }, [session, isPending]);

    const fetchUsers = async (page = 1) => {
        setIsLoading(true);
        try {
            const data = await adminApi.getUsers(page);
            setUsers(data.users);
            setPagination(data.pagination);
        } catch (error) {
            console.error("Failed to fetch users:", error);
            toast.error("Failed to fetch users");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerificationToggle = async (userId: string, currentVerified: boolean) => {
        setUpdatingVerification(userId);
        try {
            const newVerified = !currentVerified;
            const updatedUser = await adminApi.updateUserVerification(userId, newVerified);
            setUsers(users.map((u) => (u.id === userId ? { ...u, emailVerified: updatedUser.emailVerified } : u)));
            toast.success(`User ${newVerified ? "verified" : "unverified"} successfully`);
        } catch (error: any) {
            console.error("Failed to update verification:", error);
            toast.error(error?.message || "Failed to update verification status");
        } finally {
            setUpdatingVerification(null);
        }
    };

    const handleSuspensionToggle = async (userId: string, currentSuspended: boolean) => {
        setUpdatingSuspension(userId);
        try {
            const newSuspended = !currentSuspended;
            const updatedUser = await adminApi.updateUserSuspension(userId, newSuspended);
            setUsers(users.map((u) => (u.id === userId ? { ...u, suspended: updatedUser.suspended } : u)));
            toast.success(`User ${newSuspended ? "suspended" : "activated"} successfully`);
        } catch (error: any) {
            console.error("Failed to update suspension:", error);
            toast.error(error?.message || "Failed to update suspension status");
        } finally {
            setUpdatingSuspension(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        try {
            await adminApi.deleteUser(deleteId);
            setUsers(users.filter((u) => u.id !== deleteId));
            setDeleteId(null);
            toast.success("User deleted successfully");
        } catch (error: any) {
            console.error("Failed to delete user:", error);
            toast.error(error?.message || "Failed to delete user");
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "admin":
                return (
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 flex items-center gap-1 w-fit">
                        <Shield className="h-3 w-3" />
                        Admin
                    </Badge>
                );
            case "seller":
                return (
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 flex items-center gap-1 w-fit">
                        <Store className="h-3 w-3" />
                        Seller
                    </Badge>
                );
            case "buyer":
            default:
                return (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 flex items-center gap-1 w-fit">
                        <ShoppingCart className="h-3 w-3" />
                        Buyer
                    </Badge>
                );
        }
    };

    return (
        <div className="flex-1 bg-slate-50/50 min-h-full">
            <main>
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-xl bg-blue-100">
                            <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">User Management</h1>
                            <p className="text-muted-foreground">
                                {pagination.total} users registered
                            </p>
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-4 space-y-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <Skeleton key={i} className="h-12" />
                                    ))}
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Account</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead className="w-[100px]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow key={user.id} className={user.suspended ? "bg-red-50" : ""}>
                                                <TableCell className="font-medium">{user.name}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>
                                                    {getRoleBadge(user.role)}
                                                </TableCell>
                                                <TableCell>
                                                    {user.role === "admin" ? (
                                                        <Badge className="bg-purple-100 text-purple-700">
                                                            <Shield className="h-3 w-3 mr-1" />
                                                            Protected
                                                        </Badge>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="p-0 h-auto hover:bg-transparent"
                                                            onClick={() => handleVerificationToggle(user.id, user.emailVerified)}
                                                            disabled={updatingVerification === user.id}
                                                        >
                                                            <Badge
                                                                variant={user.emailVerified ? "default" : "secondary"}
                                                                className={`cursor-pointer flex items-center gap-1 ${user.emailVerified
                                                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                                    }`}
                                                            >
                                                                {user.emailVerified ? (
                                                                    <>
                                                                        <CheckCircle className="h-3 w-3" />
                                                                        Verified
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <XCircle className="h-3 w-3" />
                                                                        Unverified
                                                                    </>
                                                                )}
                                                            </Badge>
                                                        </Button>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {user.role !== "admin" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="p-0 h-auto hover:bg-transparent"
                                                            onClick={() => handleSuspensionToggle(user.id, user.suspended)}
                                                            disabled={updatingSuspension === user.id}
                                                        >
                                                            <Badge
                                                                className={`cursor-pointer flex items-center gap-1 ${user.suspended
                                                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                                                    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                                    }`}
                                                            >
                                                                {user.suspended ? (
                                                                    <>
                                                                        <Ban className="h-3 w-3" />
                                                                        Suspended
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <UserCheck className="h-3 w-3" />
                                                                        Active
                                                                    </>
                                                                )}
                                                            </Badge>
                                                        </Button>
                                                    )}
                                                    {user.role === "admin" && (
                                                        <Badge className="bg-purple-100 text-purple-700">
                                                            <Shield className="h-3 w-3 mr-1" />
                                                            Protected
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(user.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => setDeleteId(user.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this user and all their data.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
