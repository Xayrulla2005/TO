// ============================================================
// src/products/config/multer.config.ts - PRODUCTION COMPLETE
// ============================================================
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

// ─── Configuration Constants ────────────────────────────────
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), // 5MB default
  ALLOWED_MIME_TYPES: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp').split(','),
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  PRODUCTS_SUBDIR: 'products',
};

// Ensure upload directory exists
const uploadPath = join(UPLOAD_CONFIG.UPLOAD_DIR, UPLOAD_CONFIG.PRODUCTS_SUBDIR);
if (!existsSync(uploadPath)) {
  mkdirSync(uploadPath, { recursive: true });
}

// ─── File Filter (Validation) ───────────────────────────────
export const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  // Check MIME type
  if (!UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `Invalid file type. Allowed types: ${UPLOAD_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`,
      ),
      false,
    );
  }

  // Check file extension
  const ext = extname(file.originalname).toLowerCase();
  if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
    return callback(
      new BadRequestException(
        `Invalid file extension. Allowed extensions: ${UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`,
      ),
      false,
    );
  }

  // Validate filename (prevent directory traversal)
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return callback(
      new BadRequestException('Invalid filename'),
      false,
    );
  }

  callback(null, true);
};

// ─── Storage Configuration ──────────────────────────────────
export const storage = diskStorage({
  destination: (req: Request, file: Express.Multer.File, callback) => {
    callback(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, callback) => {
    // Generate unique filename: uuid + original extension
    const ext = extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    callback(null, filename);
  },
});

// ─── Multer Options ─────────────────────────────────────────
export const multerOptions = {
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
    files: 1, // Only one file per upload
  },
};

// ─── Helper Functions ───────────────────────────────────────

/**
 * Get full file path from filename
 */
export function getFilePath(filename: string): string {
  return join(uploadPath, filename);
}

/**
 * Get public URL for file
 */
export function getFileUrl(filename: string): string {
  return `/uploads/${UPLOAD_CONFIG.PRODUCTS_SUBDIR}/${filename}`;
}

/**
 * Validate image dimensions (optional - requires sharp)
 */
export async function validateImageDimensions(
  filePath: string,
  maxWidth = 2000,
  maxHeight = 2000,
): Promise<void> {
  try {
    // Optional: If sharp is installed, validate dimensions
    const sharp = require('sharp');
    const metadata = await sharp(filePath).metadata();
    
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      throw new BadRequestException(
        `Image dimensions too large. Max: ${maxWidth}x${maxHeight}px`,
      );
    }
  } catch (error) {
    // If sharp is not installed, skip dimension validation
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
  }
}