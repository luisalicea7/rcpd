import rawProducts from "../data/products.json";
import type { Product } from "../types/product.js";
import { productsQuerySchema, productsSchema } from "../schemas/product.js";

const PRODUCTS: Product[] = productsSchema.parse(rawProducts);

export function getProductById(id: string): Product | null {
  return PRODUCTS.find((p) => p.id === id) ?? null;
}

export function listProducts(input: unknown): {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
} {
  const query = productsQuerySchema.parse(input);

  let filtered = PRODUCTS;

  if (query.category) {
    filtered = filtered.filter(
      (p) => p.category.toLowerCase() === query.category!.toLowerCase(),
    );
  }

  if (query.priceRange) {
    filtered = filtered.filter((p) => p.priceRange === query.priceRange);
  }

  if (query.minPrice !== undefined) {
    filtered = filtered.filter((p) => p.price >= query.minPrice!);
  }

  if (query.maxPrice !== undefined) {
    filtered = filtered.filter((p) => p.price <= query.maxPrice!);
  }

  if (query.q) {
    const q = query.q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }

  const total = filtered.length;
  const items = filtered.slice(query.offset, query.offset + query.limit);

  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export function getCatalogStats(): {
  totalProducts: number;
  categories: string[];
} {
  const categories = Array.from(new Set(PRODUCTS.map((p) => p.category))).sort();
  return { totalProducts: PRODUCTS.length, categories };
}
