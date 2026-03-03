import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/shared/ui/Modal";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { Product } from "@/shared/types/product";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productsApi } from "../api/product.api";
import { categoriesApi } from "@/features/categories/api/categories.api";
import { toast } from "@/shared/ui/Toast";
import { ImageUpload } from "./ImageUpload";
import { Category } from "@/shared/types/categoriy";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category is required"),

  // Eng to'g'ri usul: coerce
  purchasePrice: z.string().min(1, "Purchase price is required"),
salePrice: z.string().min(1, "Sale price is required"),
stockQty: z.string().min(1, "Stock qty is required"),

  image: z.any().optional(),
});

// Eng muhim qism:
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

export function ProductFormModal({ isOpen, onClose, productToEdit }: Props) {
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.getAll,
  });

  const form = useForm<FormInput, any, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
  name: "",
  categoryId: "",
  purchasePrice: "",
  salePrice: "",
  stockQty: "",
  image: undefined,
}
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (!isOpen) return;

    if (productToEdit) {
      reset({
  name: productToEdit.name,
  categoryId: productToEdit.categoryId,
  purchasePrice: String(productToEdit.purchasePrice),
  salePrice: String(productToEdit.salePrice),
  stockQty: String(productToEdit.stockQty),
  image: undefined,
});
    } else {
      reset({
  name: "",
  categoryId: "",
  purchasePrice: "",
  salePrice: "",
  stockQty: "",
  image: undefined,
});
    }
  }, [productToEdit, reset, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: FormInput) => {
    const payload = {
      ...data,
      purchasePrice: Number(data.purchasePrice),
      salePrice: Number(data.salePrice),
      stockQty: Number(data.stockQty),
      image: data.image as File | undefined,
    };

    if (productToEdit) {
      return productsApi.update(productToEdit.id, payload);
    }

    return productsApi.create(payload);
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(productToEdit ? "Product updated" : "Product created");
      onClose();
    },
    onError: () => toast.error("Failed to save product"),
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
      size="lg"
    >
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-6"
      >
        <div className="flex gap-8">
  {/* IMAGE SECTION */}
  <div className="flex-shrink-0">
    <Controller
      control={control}
      name="image"
      render={({ field: { onChange } }) => (
        <ImageUpload
          initialImage={productToEdit?.imageUrl}
          onChange={onChange}
          error={errors.image?.message?.toString()}
        />
      )}
    />
  </div>

  {/* FORM SECTION */}
  <div className="flex-1 space-y-6">

    {/* NAME */}
    <Input
      label="Mahsulot nomi"
      {...register("name")}
      error={errors.name?.message}
    />

    {/* CATEGORY */}
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">
        Kategoriya
      </label>

      <select
        {...register("categoryId")}
        className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">Kategoriya tanlash</option>
        {(categories || []).map((cat: Category) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      {errors.categoryId && (
        <p className="text-xs text-red-500">
          {errors.categoryId.message}
        </p>
      )}
    </div>

    {/* PRICES */}
    <div className="grid grid-cols-2 gap-4">

      <Input
        label="Sotib olish narxi"
        type="number"
        step="0.01"
        min="0"
        className="h-11"
        {...register("purchasePrice")}
        error={errors.purchasePrice?.message as string | undefined}
      />

      <Input
        label="Sotuv narxi"
        type="number"
        step="0.01"
        min="0"
        className="h-11"
        {...register("salePrice")}
        error={errors.salePrice?.message as string | undefined}
      />
    </div>

    {/* STOCK */}
    <Input
      label="Ombor miqdori"
      type="number"
      min="0"
      className="h-11"
      {...register("stockQty")}
      error={errors.stockQty?.message as string | undefined}
    />
  </div>
</div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Bekor qilish
          </Button>

          <Button type="submit" isLoading={mutation.isPending}>
            {productToEdit ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
