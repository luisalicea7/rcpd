import rawProducts from "../data/products.json";
import type { Product } from "../types/product.js";
import { productsQuerySchema, productsSchema } from "../schemas/product.js";

const PRODUCTS: Product[] = productsSchema.parse(rawProducts);

const seenIds = new Set<string>();
const duplicateIds = new Set<string>();

for (const product of PRODUCTS) {
  if (seenIds.has(product.id)) duplicateIds.add(product.id);
  seenIds.add(product.id);
}

if (duplicateIds.size > 0) {
  throw new Error(
    `Duplicate product IDs found: ${Array.from(duplicateIds).sort().join(", ")}`,
  );
}

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p] as const));

const PRECOMPUTED_CATALOG = {
  totalProducts: PRODUCTS.length,
  categories: Array.from(new Set(PRODUCTS.map((p) => p.category))).sort(),
} as const;

export function getProductById(id: string): Product | null {
  return PRODUCTS_BY_ID.get(id) ?? null;
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
  return {
    totalProducts: PRECOMPUTED_CATALOG.totalProducts,
    categories: [...PRECOMPUTED_CATALOG.categories],
  };
}

export function listProductsByCategory(category: string, limit = 12): Product[] {
  return PRODUCTS.filter((p) => p.category.toLowerCase() === category.toLowerCase()).slice(
    0,
    limit,
  );
}
