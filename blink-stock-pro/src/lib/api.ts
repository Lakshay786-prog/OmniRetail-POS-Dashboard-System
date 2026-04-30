import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "manager" | "cashier";

export interface Store {
  id: string;
  name: string;
  is_online: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  price: number;
  cost: number;
  image: string | null;
}

export interface ProductWithStock extends Product {
  stock: Record<string, number>; // storeName -> qty
  totalStock: number;
}

export interface Order {
  id: string;
  number: string;
  channel: "in-store" | "online";
  status: "pending" | "completed" | "cancelled";
  customer: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment: "cash" | "card" | "wallet";
  store_id: string | null;
  store_name?: string;
  cashier_id: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  sku: string;
  price: number;
  qty: number;
}

export interface InventoryLogEntry {
  id: string;
  product_name: string;
  store_name: string;
  movement: "received" | "sold" | "transferred" | "adjusted";
  qty: number;
  user_name: string | null;
  note: string | null;
  created_at: string;
}

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from("stores").select("*").order("is_online").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchProductsWithStock(): Promise<ProductWithStock[]> {
  const [{ data: products, error: pe }, { data: stocks, error: se }, { data: stores, error: ste }] =
    await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("product_stock").select("product_id, store_id, qty"),
      supabase.from("stores").select("id, name"),
    ]);
  if (pe) throw pe;
  if (se) throw se;
  if (ste) throw ste;
  const storeNameById = new Map((stores ?? []).map((s) => [s.id, s.name]));
  return (products ?? []).map((p) => {
    const stock: Record<string, number> = {};
    let total = 0;
    for (const row of stocks ?? []) {
      if (row.product_id === p.id) {
        const name = storeNameById.get(row.store_id) ?? row.store_id;
        stock[name] = row.qty;
        total += row.qty;
      }
    }
    return { ...p, stock, totalStock: total } as ProductWithStock;
  });
}

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, stores(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    ...o,
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    tax: Number(o.tax),
    total: Number(o.total),
    store_name: o.stores?.name ?? "—",
  }));
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase.from("order_items").select("*").eq("order_id", orderId);
  if (error) throw error;
  return (data ?? []).map((i: any) => ({ ...i, price: Number(i.price) }));
}

export async function updateOrderStatus(id: string, status: Order["status"]) {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchInventoryLog(): Promise<InventoryLogEntry[]> {
  const { data, error } = await supabase
    .from("inventory_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function transferStock(args: {
  productId: string;
  productName: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  qty: number;
  userId: string;
  userName: string;
}) {
  const { productId, fromStoreId, toStoreId, qty } = args;

  const { data: fromRow, error: fe } = await supabase
    .from("product_stock")
    .select("qty")
    .eq("product_id", productId)
    .eq("store_id", fromStoreId)
    .maybeSingle();
  if (fe) throw fe;
  if (!fromRow || fromRow.qty < qty) throw new Error("Not enough stock at source store");

  const { data: toRow, error: te } = await supabase
    .from("product_stock")
    .select("qty")
    .eq("product_id", productId)
    .eq("store_id", toStoreId)
    .maybeSingle();
  if (te) throw te;

  const { error: u1 } = await supabase
    .from("product_stock")
    .update({ qty: fromRow.qty - qty })
    .eq("product_id", productId)
    .eq("store_id", fromStoreId);
  if (u1) throw u1;

  if (toRow) {
    const { error: u2 } = await supabase
      .from("product_stock")
      .update({ qty: toRow.qty + qty })
      .eq("product_id", productId)
      .eq("store_id", toStoreId);
    if (u2) throw u2;
  } else {
    const { error: i2 } = await supabase
      .from("product_stock")
      .insert({ product_id: productId, store_id: toStoreId, qty });
    if (i2) throw i2;
  }

  await supabase.from("inventory_log").insert([
    {
      product_id: productId,
      product_name: args.productName,
      store_id: fromStoreId,
      store_name: args.fromStoreName,
      movement: "transferred",
      qty: -qty,
      user_id: args.userId,
      user_name: args.userName,
      note: `→ ${args.toStoreName}`,
    },
    {
      product_id: productId,
      product_name: args.productName,
      store_id: toStoreId,
      store_name: args.toStoreName,
      movement: "transferred",
      qty: qty,
      user_id: args.userId,
      user_name: args.userName,
      note: `← ${args.fromStoreName}`,
    },
  ]);
}

export async function createProduct(p: Omit<Product, "id">) {
  const { error } = await supabase.from("products").insert(p);
  if (error) throw error;
}

export async function updateProduct(id: string, p: Partial<Product>) {
  const { error } = await supabase.from("products").update(p).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}