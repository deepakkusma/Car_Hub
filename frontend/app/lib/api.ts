const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface RequestOptions {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
}

export class ApiError extends Error {
    status: number;
    data: any;
    constructor(message: string, status: number, data?: any) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

export async function api<T>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const config: RequestInit = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        credentials: "include",
        // Avoid any browser/proxy caching so chat polling always sees the newest messages.
        cache: "no-store",
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        const msg = error?.error || error?.message || "Request failed";
        throw new ApiError(`${msg} (HTTP ${response.status})`, response.status, error);
    }

    return response.json();
}

// Vehicle types
export interface Vehicle {
    id: string;
    sellerId: string;
    make: string;
    model: string;
    year: number;
    price: string;
    mileage: number | null;
    fuelType: "petrol" | "diesel" | "electric" | "hybrid" | "cng";
    transmission: "manual" | "automatic";
    color: string | null;
    description: string | null;
    images: string[];
    status: "pending" | "approved" | "rejected" | "sold";
    registrationNumber: string | null;
    engineNumber: string | null;
    chassisNumber: string | null;
    ownerCount: number | null;
    location: string | null;
    views: number | null;
    createdAt: string;
    updatedAt: string;
    seller?: {
        id: string;
        name: string;
        image: string | null;
        phone?: string | null;
        emailVerified?: boolean;
    };
}

export interface VehicleFilters {
    make?: string;
    model?: string;
    minPrice?: string;
    maxPrice?: string;
    minYear?: string;
    maxYear?: string;
    fuelType?: string;
    transmission?: string;
    status?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
}

export interface PaginatedResponse<T> {
    vehicles: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: "admin" | "buyer" | "seller";
    phone: string | null;
    image: string | null;
    emailVerified: boolean;
    suspended: boolean;
    createdAt: string;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
}

export interface InquiryMessage {
    id: string;
    inquiryId: string;
    senderId: string;
    message: string;
    createdAt: string;
    sender?: { id: string; name: string; role?: string };
}

export interface Inquiry {
    id: string;
    vehicleId: string;
    buyerId: string;
    sellerId: string;
    message: string;
    status: "pending" | "responded" | "closed";
    sellerResponse: string | null;
    createdAt: string;
    updatedAt: string;
    vehicle?: Partial<Vehicle>;
    buyer?: { id: string; name: string; email: string };
    seller?: { id: string; name: string; email: string };
    messages?: InquiryMessage[];
}

export interface Complaint {
    id: string;
    subject: string;
    description: string;
    status: "pending" | "reviewed" | "resolved" | "dismissed";
    reporterId: string;
    reportedUserId?: string | null;
    createdAt: string;
    updatedAt: string;
    reporter?: { id: string; name: string; email: string };
    reportedUser?: { id: string; name: string; email: string; role: string };
}

// API functions
export const vehiclesApi = {
    getAll: (filters?: VehicleFilters) => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== "") {
                    params.set(key, String(value));
                }
            });
        }
        return api<PaginatedResponse<Vehicle>>(`/api/vehicles?${params}`);
    },
    getById: (id: string) => api<Vehicle>(`/api/vehicles/${id}`),
    create: (data: Partial<Vehicle>) =>
        api<Vehicle>("/api/vehicles", { method: "POST", body: data }),
    update: (id: string, data: Partial<Vehicle>) =>
        api<Vehicle>(`/api/vehicles/${id}`, { method: "PUT", body: data }),
    delete: (id: string) =>
        api<{ message: string }>(`/api/vehicles/${id}`, { method: "DELETE" }),
    getMyVehicles: () => api<Vehicle[]>("/api/vehicles/seller/my-vehicles"),
};

export const favoritesApi = {
    getAll: () => api<Vehicle[]>("/api/favorites"),
    add: (vehicleId: string) =>
        api<{ id: string }>(`/api/favorites/${vehicleId}`, { method: "POST" }),
    remove: (vehicleId: string) =>
        api<{ message: string }>(`/api/favorites/${vehicleId}`, { method: "DELETE" }),
    check: (vehicleId: string) =>
        api<{ isFavorited: boolean }>(`/api/favorites/${vehicleId}/check`),
};

export const inquiriesApi = {
    getAll: (type?: "all" | "sent" | "received") =>
        api<Inquiry[]>(`/api/inquiries${type ? `?type=${type}` : ""}`),
    getById: (id: string) =>
        api<Inquiry>(`/api/inquiries/${id}`),
    create: (data: { vehicleId: string; message: string }) =>
        api<Inquiry>("/api/inquiries", { method: "POST", body: data }),
    sendMessage: (inquiryId: string, message: string) =>
        api<InquiryMessage>(`/api/inquiries/${inquiryId}/messages`, { method: "POST", body: { message } }),
    respond: (id: string, response: string) =>
        api<Inquiry>(`/api/inquiries/${id}/respond`, { method: "PUT", body: { response } }),
    close: (id: string) =>
        api<Inquiry>(`/api/inquiries/${id}/close`, { method: "PUT" }),
};

export const usersApi = {
    getMe: () => api<User>("/api/users/me"),
    updateMe: (data: { name?: string; phone?: string; image?: string; city?: string; state?: string; pincode?: string }) =>
        api<User>("/api/users/me", { method: "PUT", body: data }),
    getById: (id: string) => api<Partial<User>>(`/api/users/${id}`),
};

export const complaintsApi = {
    getAll: (status?: string, page = 1, limit = 20) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (status) params.set("status", status);
        return api<{ complaints: Complaint[]; pagination: any }>(`/api/complaints?${params}`);
    },
    create: (data: { subject: string; description: string; reportedUserId?: string }) =>
        api<Complaint>("/api/complaints", { method: "POST", body: data }),
    updateStatus: (id: string, status: string) =>
        api<Complaint>(`/api/complaints/${id}/status`, { method: "PUT", body: { status } }),
    getMyComplaints: () => api<Complaint[]>("/api/complaints/my-complaints"),
};

export const adminApi = {
    getUsers: (page = 1, limit = 20) =>
        api<{ users: User[]; pagination: any }>(`/api/admin/users?page=${page}&limit=${limit}`),
    updateUserRole: (id: string, role: string) =>
        api<User>(`/api/admin/users/${id}/role`, { method: "PUT", body: { role } }),
    updateUserVerification: (id: string, verified: boolean) =>
        api<User>(`/api/admin/users/${id}/verify`, { method: "PUT", body: { verified } }),
    updateUserSuspension: (id: string, suspended: boolean) =>
        api<User>(`/api/admin/users/${id}/suspend`, { method: "PUT", body: { suspended } }),
    deleteUser: (id: string) =>
        api<{ message: string }>(`/api/admin/users/${id}`, { method: "DELETE" }),
    getListings: (status?: string, page = 1, limit = 20) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (status) params.set("status", status);
        return api<{ vehicles: Vehicle[]; pagination: any }>(`/api/admin/listings?${params}`);
    },
    updateListingStatus: (id: string, status: string) =>
        api<Vehicle>(`/api/admin/listings/${id}/status`, { method: "PUT", body: { status } }),
    getStats: () =>
        api<{
            totalUsers: number;
            totalVehicles: number;
            pendingVehicles: number;
            totalInquiries: number;
            usersByRole: Record<string, number>;
            vehiclesByStatus: Record<string, number>;
        }>("/api/admin/stats"),
    getPayments: (status?: string, page = 1, limit = 20) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (status) params.set("status", status);
        return api<{ transactions: Transaction[]; pagination: any }>(`/api/admin/payments?${params}`);
    },
    updatePaymentStatus: (id: string, status: string) =>
        api<Transaction>(`/api/admin/payments/${id}/status`, { method: "PUT", body: { status } }),
    getInquiries: (status?: string, page = 1, limit = 20) => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (status) params.set("status", status);
        return api<{ inquiries: Inquiry[]; pagination: any }>(`/api/admin/inquiries?${params}`);
    },
};

export const uploadApi = {
    uploadImage: async (file: File) => {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(`${API_URL}/api/upload/image`, {
            method: "POST",
            credentials: "include",
            body: formData,
        });

        if (!response.ok) {
            throw new Error("Failed to upload image");
        }

        return response.json() as Promise<{ url: string; filename: string }>;
    },
    uploadImages: async (files: File[]) => {
        const formData = new FormData();
        files.forEach((file) => formData.append("images", file));

        const response = await fetch(`${API_URL}/api/upload/images`, {
            method: "POST",
            credentials: "include",
            body: formData,
        });

        if (!response.ok) {
            throw new Error("Failed to upload images");
        }

        return response.json() as Promise<{ urls: string[] }>;
    },
};

// Transaction/Payment types
export type PaymentType = "full_card" | "advance_upi" | "cash_booking" | "split_qr" | "split_cash";
export type DeliveryStatus = "processing" | "inspection" | "documentation" | "ready_for_collection" | "collected";

export interface Transaction {
    id: string;
    vehicleId: string;
    buyerId: string;
    sellerId: string;
    amount: string;
    bookingAmount: string | null;
    remainingAmount: string | null;
    status: "pending" | "payment_initiated" | "payment_completed" | "payment_failed" | "completed" | "cancelled" | "refunded";
    paymentType: PaymentType | null;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    razorpaySignature: string | null;
    paymentMethod: string | null;
    upiReference: string | null;
    paymentErrorCode: string | null;
    paymentErrorDescription: string | null;
    // Delivery tracking fields
    deliveryStatus: DeliveryStatus | null;
    estimatedReadyDate: string | null;
    deliveryNotes: string | null;
    collectedAt: string | null;
    createdAt: string;
    updatedAt: string;
    vehicle?: Vehicle;
    buyer?: { id: string; name: string; email: string; phone?: string | null };
    seller?: { id: string; name: string; phone?: string | null };
}

// Checkout response types for different payment methods
export interface CardCheckoutResponse {
    paymentType: "full_card";
    checkoutUrl: string;
    sessionId: string;
    transactionId: string;
    vehicleName: string;
    amount: number;
    currency: string;
}

export interface UpiCheckoutResponse {
    paymentType: "advance_upi";
    transactionId: string;
    vehicleName: string;
    totalAmount: number;
    advanceAmount: number;
    remainingAmount: number;
    currency: string;
    upiLink: string;
    upiId: string;
    upiReference: string;
    sellerPhone?: string;
}

export interface CashBookingResponse {
    paymentType: "cash_booking";
    transactionId: string;
    vehicleName: string;
    totalAmount: number;
    tokenAmount: number;
    remainingAmount: number;
    currency: string;
    bookingReference: string;
    sellerName?: string;
    sellerPhone?: string;
    message: string;
}

export interface SplitPaymentResponse {
    paymentType: "split_qr" | "split_cash";
    transactionId: string;
    vehicleName: string;
    totalAmount: number;
    manualAmount: number;
    manualPaymentType: "QR/UPI" | "Cash";
    remainingAmount: number;
    currency: string;
    reference: string;
    checkoutUrl: string;
    sessionId: string;
    message: string;
    upiLink?: string;
    upiId?: string;
}

export type CreateCheckoutResponse = CardCheckoutResponse | UpiCheckoutResponse | CashBookingResponse | SplitPaymentResponse;

export const paymentsApi = {
    createCheckout: (vehicleId: string, paymentType: PaymentType = "full_card", options?: { qrAmount?: number; cashAmount?: number; bookingMethod?: "card" | "upi" | "cash"; previousTransactionId?: string }) =>
        api<CreateCheckoutResponse>("/api/payments/create-checkout", {
            method: "POST",
            body: { vehicleId, paymentType, ...options },
        }),
    verifyPayment: (data: {
        transactionId?: string;
        sessionId?: string;
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        razorpaySignature?: string;
    }) =>
        api<{ success: boolean; message: string; transactionId?: string }>(
            "/api/payments/verify",
            { method: "POST", body: data }
        ),
    confirmBooking: (transactionId: string, upiTransactionId?: string) =>
        api<{ success: boolean; message: string; transactionId: string }>(
            "/api/payments/confirm-booking",
            { method: "POST", body: { transactionId, upiTransactionId } }
        ),
    verifyManual: (transactionId: string, manualTransactionId?: string) =>
        api<{ success: boolean; message: string; transactionId: string }>(
            "/api/payments/verify-manual",
            { method: "POST", body: { transactionId, manualTransactionId } }
        ),
    recordFailure: (data: {
        transactionId: string;
        errorCode?: string;
        errorDescription?: string;
    }) =>
        api<{ success: boolean; message: string }>("/api/payments/failed", {
            method: "POST",
            body: data,
        }),
    getMyPurchases: () => api<Transaction[]>("/api/payments/my-purchases"),
    getMySales: () => api<Transaction[]>("/api/payments/my-sales"),
    getTransaction: (id: string) => api<Transaction>(`/api/payments/${id}`),
    // Tracking APIs
    updateDeliveryStatus: (transactionId: string, data: {
        deliveryStatus: DeliveryStatus;
        estimatedReadyDate?: string;
        deliveryNotes?: string
    }) =>
        api<{ success: boolean; message: string; transaction: Transaction }>(`/api/payments/${transactionId}/delivery-status`, {
            method: "PUT",
            body: data,
        }),
    confirmCollection: (transactionId: string) =>
        api<{ success: boolean; message: string; transaction: Transaction }>(`/api/payments/${transactionId}/confirm-collection`, {
            method: "POST",
        }),
};

export interface AnalyticsData {
    summary: {
        totalRevenue?: number;
        totalSold?: number;
        totalSpent?: number;
        totalBought?: number;
    };
    chartData: Array<{
        date: string;
        totalAmount: number;
        count: number;
    }>;
}

export const analyticsApi = {
    getSellerAnalytics: () => api<AnalyticsData>("/api/analytics/seller"),
    getBuyerAnalytics: () => api<AnalyticsData>("/api/analytics/buyer"),
};
