// ============================================================
// src/shared/ui/ImageUpload.tsx
// ============================================================
import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Props {
  initialImage?: string | null;
  onChange:      (file: File | null) => void;
  error?:        string;
  disabled?:     boolean;
  className?:    string;
}

export function ImageUpload({
  initialImage,
  onChange,
  error,
  disabled = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // initialImage — tashqi URL (https://...), blob URL emas
  const [preview, setPreview]     = useState<string | null>(initialImage ?? null);
  const [blobUrl, setBlobUrl]     = useState<string | null>(null);

  // initialImage o'zgarganda (edit modal ochilganda) yangilash
  useEffect(() => {
    setPreview(initialImage ?? null);
  }, [initialImage]);

  // ✅ Blob URL tozalash — memory leak oldini olish
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Eski blob URL ni tozalash
      if (blobUrl) URL.revokeObjectURL(blobUrl);

      const newBlobUrl = URL.createObjectURL(file);
      setBlobUrl(newBlobUrl);
      setPreview(newBlobUrl);
      onChange(file);

      // Input ni reset qilish — xuddi shunday faylni qayta tanlash imkonini berish
      e.target.value = "";
    },
    [blobUrl, onChange],
  );

  const handleRemove = useCallback(() => {
    // Blob URL ni tozalash
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setPreview(null);
    onChange(null);
    // Input ni tozalash
    if (inputRef.current) inputRef.current.value = "";
  }, [blobUrl, onChange]);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-sm font-medium text-gray-700">
        Mahsulot rasmi
      </label>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={preview ? "Rasmni almashtirish" : "Rasm yuklash"}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex flex-col items-center justify-center w-32 h-32",
          "border-2 border-dashed rounded-xl transition-colors overflow-hidden",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
          error
            ? "border-red-300 bg-red-50"
            : disabled
            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-indigo-400 cursor-pointer",
        )}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Mahsulot rasmi"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Rasm yuklanmasa placeholder ko'rsatish
                (e.currentTarget as HTMLImageElement).style.display = "none";
                setPreview(null);
              }}
            />
            {/* O'chirish tugmasi */}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation(); // div click ni to'xtatish
                  handleRemove();
                }}
                className={cn(
                  "absolute top-1 right-1 p-1",
                  "bg-white/90 hover:bg-white rounded-full shadow-sm",
                  "text-gray-500 hover:text-red-600 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-red-500",
                )}
                aria-label="Rasmni o'chirish"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 p-3 text-center pointer-events-none">
            <Upload size={22} className="text-gray-400" aria-hidden="true" />
            <span className="text-xs text-gray-400 leading-tight">
              Rasm yuklash
            </span>
            <span className="text-[10px] text-gray-300">
              JPG, PNG, WEBP
            </span>
          </div>
        )}
      </div>

      {/* Yashirin file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Xato xabari */}
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Yordam matni */}
      {!error && preview && (
        <p className="text-xs text-gray-400">
          Rasmni almashtirish uchun bosing
        </p>
      )}
    </div>
  );
}