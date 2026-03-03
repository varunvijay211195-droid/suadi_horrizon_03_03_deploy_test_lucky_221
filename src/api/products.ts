export interface Product {
  _id: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  description: string;
  specs: Record<string, string>;
  specifications?: Record<string, string>;
  compatibility: string[];
  inStock: boolean;
  stock: number;
  rating: number;
  reviews: number;
  reviewCount?: number;
  oemCode: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

/**
 * Normalize a product from the API response.
 * Mongoose .populate() returns objects for brand/category/image,
 * but the UI expects plain strings. This flattens them.
 */
function normalizeProduct(p: any): Product {
  let brand = p.brand;
  if (brand && typeof brand === 'object') brand = brand.name || brand.slug || brand._id || '';

  let category = p.category;
  if (category && typeof category === 'object') category = category.name || category.slug || category._id || '';

  let image = p.image;
  if (image && typeof image === 'object') image = image.url || '';

  let images = p.images;
  if (Array.isArray(images)) {
    images = images.map((img: any) =>
      img && typeof img === 'object' ? (img.url || '') : (img || '')
    ).filter(Boolean);
  }

  return { ...p, brand, category, image, images };
}

export const getProducts = async (filters?: {
  category?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ products: Product[]; total: number }> => {
  const params = new URLSearchParams();
  if (filters?.category) params.append("category", filters.category);
  if (filters?.brand) params.append("brand", filters.brand);
  if (filters?.priceMin) params.append("priceMin", filters.priceMin.toString());
  if (filters?.priceMax) params.append("priceMax", filters.priceMax.toString());
  if (filters?.search) params.append("search", filters.search);
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());

  params.append("_t", Date.now().toString());

  const url = `${API_BASE_URL}/api/products?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const products = (data.products || []).map(normalizeProduct);

    return { ...data, products };
  } catch (error) {
    console.error('[getProducts] Network error:', error);
    throw error;
  }
};

export const getProductById = async (id: string): Promise<Product> => {
  const url = `${API_BASE_URL}/api/products/${encodeURIComponent(id)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch product by ID: ${response.status} ${response.statusText}`);
    }

    const product = await response.json();
    return normalizeProduct(product);
  } catch (error) {
    console.error('[getProductById] Network error:', error);
    throw error;
  }
};

export const getRelatedProducts = async (productId: string): Promise<Product[]> => {
  const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(productId)}/similar`);
  if (!response.ok) {
    throw new Error("Failed to fetch related products");
  }
  const data = await response.json();
  return Array.isArray(data) ? data.map(normalizeProduct) : [];
};
