import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "../api/product.api";
import { categoriesApi } from "../../categories/api/categories.api";
import { Modal } from "../../../shared/ui/Modal";
import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/Input";
import { toast } from "../../../shared/ui/Toast";
import { Upload, X } from "lucide-react";
import { Product, ProductFormValues } from "../../../shared/types/product";

const UNIT_OPTIONS = [
  { value: "piece", label: "dona" },
  { value: "meter", label: "metr" },
  { value: "kg", label: "kg" },
  { value: "litre", label: "litr" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

const EMPTY: ProductFormValues = {
  name: "",
  categoryId: "",
  purchasePrice: 0,
  salePrice: 0,
  unit: "piece",
  stockQty: 0,
  minStockLimit: 0,
  image: null,
};

export function ProductFormModal({ isOpen, onClose, productToEdit }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProductFormValues>(EMPTY);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  useEffect(() => {
    if (productToEdit) {
      setForm({
        name: productToEdit.name || "",
        categoryId: productToEdit.categoryId || "",
        purchasePrice: Number(productToEdit.purchasePrice) || 0,
        salePrice: Number(productToEdit.salePrice) || 0,
        unit: productToEdit.unit || "piece",
        stockQty: Number(productToEdit.stockQuantity) || 0,
        minStockLimit: Number(productToEdit.minStockLimit) || 0,
        image: null,
      });
      setImagePreview(productToEdit.imageUrl || null);
    } else {
      setForm(EMPTY);
      setImagePreview(null);
    }
  }, [productToEdit, isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, image: file }));
    setImagePreview(URL.createObjectURL(file));
  };

  const createMutation = useMutation({
    mutationFn: (values: ProductFormValues) => productsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Mahsulot qo'shildi");
      onClose();
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  const updateMutation = useMutation({
    mutationFn: (values: Partial<ProductFormValues>) =>
      productsApi.update(productToEdit!.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Mahsulot yangilandi");
      onClose();
    },
    onError: () => toast.error("Xatolik yuz berdi"),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("Mahsulot nomini kiriting");
    if (!form.purchasePrice) return toast.error("Kelish narxini kiriting");
    if (!form.salePrice) return toast.error("Sotuv narxini kiriting");

    if (productToEdit) {
      updateMutation.mutate(form);
    } else {
      createMutation.mutate(form);
    }
  };

  const setField = <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
      size="md"
    >
      <div className="space-y-4">
        {/* Rasm + Nom + Kategoriya */}
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0">
            <div
              onClick={() => fileRef.current?.click()}
              className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors overflow-hidden"
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <Upload size={20} className="text-gray-400" />
                  <span className="text-xs text-gray-400 mt-1">Rasm</span>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
            {imagePreview && (
              <button
                onClick={() => {
                  setField("image", null);
                  setImagePreview(null);
                }}
                className="mt-1 w-full text-xs text-red-500 hover:text-red-700 flex items-center justify-center gap-1"
              >
                <X size={12} /> O'chirish
              </button>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mahsulot nomi
              </label>
              <Input
                placeholder="Mahsulot nomi"
                value={form.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setField("name", v.charAt(0).toUpperCase() + v.slice(1));
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategoriya
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => setField("categoryId", e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Kategoriya tanlash</option>
                {(categories || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Narxlar */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sotib olish narxi
            </label>
            <Input
              type="number"
              placeholder="0"
              value={form.purchasePrice || ""}
              onChange={(e) =>
                setField("purchasePrice", Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sotuv narxi
            </label>
            <Input
              type="number"
              placeholder="0"
              value={form.salePrice || ""}
              onChange={(e) => setField("salePrice", Number(e.target.value))}
            />
          </div>
        </div>

        {/* O'lchov birligi + Ombor */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              O'lchov birligi
            </label>
            <select
              value={form.unit}
              onChange={(e) => setField("unit", e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ombor miqdori
            </label>
            <Input
              type="number"
              placeholder="0"
              value={form.stockQty || ""}
              onChange={(e) => setField("stockQty", Number(e.target.value))}
            />
          </div>
        </div>

        {/* Minimal qoldiq */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimal qoldiq chegarasi
          </label>
          <Input
            type="number"
            placeholder="5"
            value={form.minStockLimit || ""}
            onChange={(e) => setField("minStockLimit", Number(e.target.value))}
          />
          <p className="text-xs text-gray-400 mt-1">
            Bu miqdordan kam bo'lsa ogohlantirish chiqadi
          </p>
        </div>

        {/* Tugmalar */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button isLoading={isPending} onClick={handleSubmit}>
            {productToEdit ? "Saqlash" : "Qo'shish"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
