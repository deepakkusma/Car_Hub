import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
}

export interface CloudinaryUploadOptions {
    folder?: string;
    transformation?: object;
}

/**
 * Upload a single image buffer to Cloudinary
 */
export const uploadImage = async (
    buffer: Buffer,
    options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> => {
    const { folder = "cars24", transformation } = options;

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
                transformation: transformation || [
                    { quality: "auto", fetch_format: "auto" },
                ],
            },
            (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
                if (error) {
                    reject(new Error(error.message));
                } else if (result) {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format,
                    });
                }
            }
        );

        uploadStream.end(buffer);
    });
};

/**
 * Upload multiple image buffers to Cloudinary
 */
export const uploadImages = async (
    buffers: Buffer[],
    options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult[]> => {
    const uploadPromises = buffers.map((buffer) => uploadImage(buffer, options));
    return Promise.all(uploadPromises);
};

/**
 * Delete an image from Cloudinary by public ID
 */
export const deleteImage = async (publicId: string): Promise<boolean> => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result.result === "ok";
    } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
        return false;
    }
};

/**
 * Delete multiple images from Cloudinary
 */
export const deleteImages = async (publicIds: string[]): Promise<boolean> => {
    try {
        await cloudinary.api.delete_resources(publicIds);
        return true;
    } catch (error) {
        console.error("Error deleting images from Cloudinary:", error);
        return false;
    }
};

export default cloudinary;
