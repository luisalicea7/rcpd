export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  priceRange: "budget" | "mid" | "premium";
  tags: string[];
  stock: number;
  imageUrl?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Cart {
  sessionId: string;
  items: CartItem[];
  total: number;
  updatedAt: number;
}