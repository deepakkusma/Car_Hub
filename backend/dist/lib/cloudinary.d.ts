import { v2 as cloudinary } from "cloudinary";
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
export declare const uploadImage: (buffer: Buffer, options?: CloudinaryUploadOptions) => Promise<CloudinaryUploadResult>;
/**
 * Upload multiple image buffers to Cloudinary
 */
export declare const uploadImages: (buffers: Buffer[], options?: CloudinaryUploadOptions) => Promise<CloudinaryUploadResult[]>;
/**
 * Delete an image from Cloudinary by public ID
 */
export declare const deleteImage: (publicId: string) => Promise<boolean>;
/**
 * Delete multiple images from Cloudinary
 */
export declare const deleteImages: (publicIds: string[]) => Promise<boolean>;
export default cloudinary;
