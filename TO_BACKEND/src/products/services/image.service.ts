// ============================================================
// src/products/services/image.service.ts - PRODUCTION COMPLETE
// ============================================================
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { unlink, access, constants } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { UPLOAD_CONFIG, getFilePath, getFileUrl, validateImageDimensions } from '../config/multer.config';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  /**
   * Process uploaded image file
   * Returns the filename (stored in database)
   */
  async processUpload(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Optional: Validate dimensions
      await validateImageDimensions(file.path);

      this.logger.log(`Image uploaded successfully: ${file.filename}`);
      
      // Return just the filename (not full path)
      return file.filename;
    } catch (error) {
      // If validation fails, delete the uploaded file
      await this.deleteFile(file.filename).catch(() => {});
      throw error;
    }
  }

  /**
   * Replace existing image with new one
   * Deletes old image and returns new filename
   */
  async replaceImage(
    oldFilename: string | null,
    newFile: Express.Multer.File,
  ): Promise<string> {
    // Process new upload first
    const newFilename = await this.processUpload(newFile);

    // Delete old file if exists
    if (oldFilename) {
      await this.deleteFile(oldFilename).catch((error) => {
        this.logger.warn(`Failed to delete old image: ${oldFilename}`, error.message);
      });
    }

    return newFilename;
  }

  /**
   * Delete image file from filesystem
   */
  async deleteFile(filename: string | null): Promise<void> {
    if (!filename) return;

    const filePath = getFilePath(filename);

    try {
      // Check if file exists first
      await access(filePath, constants.F_OK);
      
      // Delete the file
      await unlink(filePath);
      
      this.logger.log(`Image deleted: ${filename}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`Image file not found: ${filename}`);
        // Don't throw - file already doesn't exist
        return;
      }
      throw error;
    }
  }

  /**
   * Check if image file exists
   */
  async fileExists(filename: string): Promise<boolean> {
    if (!filename) return false;
    
    const filePath = getFilePath(filename);
    return existsSync(filePath);
  }

  /**
   * Get public URL for image
   */
  getImageUrl(filename: string | null): string | null {
    if (!filename) return null;
    return getFileUrl(filename);
  }

  /**
   * Validate file before processing
   */
  validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size === 0) {
      throw new BadRequestException('File is empty');
    }

    if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Max size: ${UPLOAD_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * Cleanup orphaned images
   * Should be called periodically (e.g., via cron)
   */
  async cleanupOrphanedImages(activeFilenames: string[]): Promise<number> {
    const uploadPath = join(UPLOAD_CONFIG.UPLOAD_DIR, UPLOAD_CONFIG.PRODUCTS_SUBDIR);
    
    try {
      const fs = require('fs').promises;
      const files = await fs.readdir(uploadPath);
      
      let deletedCount = 0;
      const activeSet = new Set(activeFilenames);

      for (const file of files) {
        // Skip if file is in active set
        if (activeSet.has(file)) continue;

        // Skip non-image files
        const ext = file.split('.').pop()?.toLowerCase();
        if (!ext || !UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(`.${ext}`)) continue;

        // Delete orphaned file
        try {
          await this.deleteFile(file);
          deletedCount++;
        } catch (error) {
          this.logger.error(`Failed to delete orphaned file: ${file}`, error.message);
        }
      }

      this.logger.log(`Cleanup completed: ${deletedCount} orphaned images deleted`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup orphaned images', error.message);
      throw error;
    }
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(filename: string): Promise<{
    filename: string;
    size: number;
    exists: boolean;
    url: string;
  }> {
    const filePath = getFilePath(filename);
    const exists = await this.fileExists(filename);

    let size = 0;
    if (exists) {
      const fs = require('fs').promises;
      const stats = await fs.stat(filePath);
      size = stats.size;
    }

    return {
      filename,
      size,
      exists,
      url: this.getImageUrl(filename) || '',
    };
  }
}