import { useState, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface Props {
  initialImage?: string;
  onChange: (file: File | null) => void;
  error?: string;
}

export function ImageUpload({ initialImage, onChange, error }: Props) {
  const [preview, setPreview] = useState<string | null>(initialImage || null);

  useEffect(() => {
    if (initialImage) setPreview(initialImage);
  }, [initialImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      onChange(file);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Product Image</label>
      
      <div className={cn(
        "relative flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-xl transition-colors bg-gray-50 overflow-hidden",
        error ? "border-red-300 bg-red-50" : "border-gray-300 hover:bg-gray-100"
      )}>
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1 right-1 p-1 bg-white/80 rounded-full shadow-sm hover:bg-white text-gray-600 hover:text-red-600"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <p className="text-xs text-gray-500">Upload</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}