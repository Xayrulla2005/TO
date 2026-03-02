export interface Category {
  products: any;
  id: string;
  name: string;
  _count?: {
    products: number;
  };
}

export interface CreateCategoryDto {
  name: string;
}

export interface UpdateCategoryDto {
  name: string;
}