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
  purchasePrice: z.coerce.number().min(0, "Purchase price must be >= 0"),
  salePrice: z.coerce.number().min(0, "Sale price must be >= 0"),
  stockQty: z.coerce.number().int().min(0, "Stock qty must be >= 0"),

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
      purchasePrice: 0,
      salePrice: 0,
      stockQty: 0,
      image: undefined,
    },
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
        purchasePrice: Number(productToEdit.purchasePrice),
        salePrice: Number(productToEdit.salePrice),
        stockQty: Number(productToEdit.stockQty),
        image: undefined,
      });
    } else {
      reset({
        name: "",
        categoryId: "",
        purchasePrice: 0,
        salePrice: 0,
        stockQty: 0,
        image: undefined,
      });
    }
  }, [productToEdit, reset, isOpen]);

  const mutation = useMutation({
    mutationFn: (data: FormOutput) => {
      const payload = {
        ...data,
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
        <div className="flex gap-6">
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

          <div className="flex-1 space-y-4">
            <Input
              label="Mahsulot nomi"
              {...register("name")}
              error={errors.name?.message}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Kategoriya
              </label>

              <select
                {...register("categoryId")}
                className="flex h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Sotib olish narxi"
                type="number"
                {...register("purchasePrice")}
                error={errors.purchasePrice?.message as string | undefined}
              />

              <Input
                label="Sotuv narxi"
                type="number"
                {...register("salePrice")}
                error={errors.salePrice?.message as string | undefined}
              />
            </div>

            <Input
              label="Ombor miqdori"
              type="number"
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
