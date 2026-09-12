export const MARKET_CATEGORIES = [
  "Ropa deportiva",
  "Calzado deportivo",
  "Equipamiento de entrenamiento",
  "Suplementos y nutrición",
  "Accesorios de gimnasio",
  "Electrónica deportiva",
  "Otros",
] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export interface MarketProduct {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  category: string;
  condition: "new" | "used";
  stock: number;
  status: "active" | "sold" | "paused";
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: "pending" | "confirmed" | "delivered" | "cancelled";
  total: number;
  platform_fee: number;
  delivery_type: "retiro" | "envio";
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface MarketOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
}

export interface MarketReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stock: number;
  seller_id: string;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);
}

export function commissionFor(total: number, rate: number): number {
  return Math.round(total * rate * 100) / 100;
}

export function conditionLabel(c: "new" | "used"): string {
  return c === "new" ? "Nuevo" : "Usado";
}

export function orderStatusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    delivered: "Entregada",
    cancelled: "Cancelada",
  };
  return map[s] ?? s;
}
