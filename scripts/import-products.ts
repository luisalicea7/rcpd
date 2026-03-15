/**
 * One-time import: fetches products from DummyJSON and writes to src/data/products.json
 * Run with: bun run scripts/import-products.ts
 */

const CATEGORY_MAP: Record<string, string> = {
  'beauty':                'beauty',
  'skin-care':             'beauty',
  'fragrances':            'beauty',
  'smartphones':           'electronics',
  'laptops':               'electronics',
  'tablets':               'electronics',
  'mobile-accessories':    'electronics',
  'mens-shirts':           'fashion',
  'womens-dresses':        'fashion',
  'tops':                  'fashion',
  'mens-shoes':            'fashion',
  'womens-shoes':          'fashion',
  'womens-bags':           'fashion',
  'sunglasses':            'fashion',
  'mens-watches':          'fashion',
  'womens-watches':        'fashion',
  'womens-jewellery':      'fashion',
  'furniture':             'home',
  'home-decoration':       'home',
  'kitchen-accessories':   'home',
  'sports-accessories':    'sports',
  'groceries':             'food',
  'motorcycle':            'automotive',
  'vehicle':               'automotive',
};

function priceRange(price: number): 'budget' | 'mid' | 'premium' {
  if (price < 30) return 'budget';
  if (price < 100) return 'mid';
  return 'premium';
}

type DummyProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  thumbnail: string;
  images: string[];
  tags: string[];
  stock: number;
  brand?: string;
};

async function fetchAll(): Promise<DummyProduct[]> {
  const res = await fetch('https://dummyjson.com/products?limit=200&select=id,title,description,category,price,thumbnail,images,tags,stock,brand');
  const data = await res.json() as { products: DummyProduct[] };
  return data.products;
}

const raw = await fetchAll();

const products = raw
  .filter((p) => CATEGORY_MAP[p.category] !== undefined)
  .map((p) => ({
    id: `djson-${p.id}`,
    name: p.title,
    category: CATEGORY_MAP[p.category],
    price: Math.round(p.price * 100) / 100,
    description: p.description,
    priceRange: priceRange(p.price),
    tags: [...(p.tags ?? []), p.category, ...(p.brand ? [p.brand.toLowerCase()] : [])],
    stock: p.stock,
    imageUrl: p.thumbnail,
  }));

const outPath = new URL('../src/data/products.json', import.meta.url).pathname;
await Bun.write(outPath, JSON.stringify(products, null, 2));

const counts: Record<string, number> = {};
for (const p of products) counts[p.category] = (counts[p.category] ?? 0) + 1;

console.log(`✓ Imported ${products.length} products to src/data/products.json`);
for (const [cat, n] of Object.entries(counts).sort()) {
  console.log(`  ${cat}: ${n}`);
}