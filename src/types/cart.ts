export interface CartItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  addedAt: number;
  updatedAt: number;
}

export interface Cart {
  sessionId: string;
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  updatedAt: number;
}
