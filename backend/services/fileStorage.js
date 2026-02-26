import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Saves a Base64 string to a file on disk.
 * @param {string} base64Content - The raw base64 string
 * @param {string} originalName - Original filename for extension extraction
 * @returns {Promise<string>} - The relative path to the saved file
 */
export const saveFileFromBase64 = async (base64Content, originalName) => {
    if (!base64Content) return null;

    const buffer = Buffer.from(base64Content, 'base64');
    const extension = path.extname(originalName) || '.bin';
    const fileName = `${crypto.randomUUID()}${extension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    await fs.promises.writeFile(filePath, buffer);

    // Return relative path for static serving
    return `/uploads/${fileName}`;
};

/**
 * Deletes a file from disk.
 * @param {string} relativePath - The relative path stored in DB
 */
export const deleteFile = async (relativePath) => {
    if (!relativePath) return;
    const fullPath = path.join(__dirname, '../../', relativePath);
    if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
    }
};
