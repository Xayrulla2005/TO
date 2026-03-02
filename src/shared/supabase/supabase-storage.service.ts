import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const bucket = process.env.SUPABASE_BUCKET;

    if (!url) throw new Error('SUPABASE_URL is missing in .env');
    if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is missing in .env');
    if (!bucket) throw new Error('SUPABASE_BUCKET is missing in .env');

    this.client = createClient(url, secretKey);
    this.bucket = bucket;
  }

  async uploadPublicFile(params: {
    path: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ publicUrl: string; path: string }> {
    const { path, buffer, contentType } = params;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new InternalServerErrorException('Failed to generate public URL');
    }

    return { publicUrl: data.publicUrl, path };
  }

  async removeFile(path: string): Promise<void> {
    if (!path) return;

    const { error } = await this.client.storage.from(this.bucket).remove([path]);

    // remove da "not found" bo‘lsa ham error qaytishi mumkin
    // shuning uchun bu joyda errorni qat'iy qilmaymiz
    if (error) {
      // log qilsangiz ham bo‘ladi
      return;
    }
  }
}
