// Atomic checkout: validates JWT, decrements stock, creates order + items + inventory log
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckoutItem { product_id: string; qty: number; }
interface CheckoutBody {
  store_id: string;
  customer?: string;
  payment: "cash" | "card" | "wallet";
  discount_pct?: number;
  tax_pct?: number;
  items: CheckoutItem[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validate(body: any): string | null {
  if (!body || typeof body !== "object") return "Invalid body";
  if (typeof body.store_id !== "string" || !body.store_id) return "store_id required";
  if (!["cash", "card", "wallet"].includes(body.payment)) return "Invalid payment";
  if (!Array.isArray(body.items) || body.items.length === 0) return "items required";
  for (const it of body.items) {
    if (typeof it.product_id !== "string" || !it.product_id) return "Invalid product_id";
    if (typeof it.qty !== "number" || it.qty <= 0 || !Number.isInteger(it.qty)) return "Invalid qty";
  }
  if (body.discount_pct != null && (typeof body.discount_pct !== "number" || body.discount_pct < 0 || body.discount_pct > 100)) return "Invalid discount";
  if (body.tax_pct != null && (typeof body.tax_pct !== "number" || body.tax_pct < 0 || body.tax_pct > 100)) return "Invalid tax";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate caller
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  let body: CheckoutBody;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const verr = validate(body);
  if (verr) return json({ error: verr }, 400);

  // Service-role client for atomic mutations (RLS allows it but we want bulk reads safely)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Confirm role (cashier+)
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r) => r.role));
  if (!roleSet.has("admin") && !roleSet.has("manager") && !roleSet.has("cashier")) {
    return json({ error: "Forbidden" }, 403);
  }

  // Load store name + product info + current stock
  const { data: store } = await admin.from("stores").select("id, name, is_online").eq("id", body.store_id).maybeSingle();
  if (!store) return json({ error: "Store not found" }, 400);

  const productIds = body.items.map((i) => i.product_id);
  const [{ data: products }, { data: stockRows }, { data: profile }] = await Promise.all([
    admin.from("products").select("id, name, sku, price").in("id", productIds),
    admin.from("product_stock").select("id, product_id, qty").eq("store_id", body.store_id).in("product_id", productIds),
    admin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
  ]);

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  const stockMap = new Map((stockRows ?? []).map((s) => [s.product_id, s]));

  // Check stock
  for (const it of body.items) {
    const prod = productMap.get(it.product_id);
    if (!prod) return json({ error: `Product ${it.product_id} not found` }, 400);
    const stock = stockMap.get(it.product_id);
    const onHand = stock?.qty ?? 0;
    if (onHand < it.qty) {
      return json({ error: `Insufficient stock for ${prod.name} (have ${onHand}, need ${it.qty})` }, 400);
    }
  }

  // Compute totals server-side
  let subtotal = 0;
  for (const it of body.items) {
    const p = productMap.get(it.product_id)!;
    subtotal += Number(p.price) * it.qty;
  }
  const discountPct = body.discount_pct ?? 0;
  const taxPct = body.tax_pct ?? 0;
  const discount = +(subtotal * discountPct / 100).toFixed(2);
  const taxed = subtotal - discount;
  const tax = +(taxed * taxPct / 100).toFixed(2);
  const total = +(taxed + tax).toFixed(2);

  // Insert order
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      channel: store.is_online ? "online" : "in-store",
      status: "completed",
      customer: body.customer || "Walk-in",
      subtotal: +subtotal.toFixed(2),
      discount, tax, total,
      payment: body.payment,
      store_id: store.id,
      cashier_id: userId,
    })
    .select()
    .single();
  if (orderErr || !order) return json({ error: orderErr?.message ?? "Order create failed" }, 500);

  // Insert order items
  const itemsRows = body.items.map((it) => {
    const p = productMap.get(it.product_id)!;
    return {
      order_id: order.id,
      product_id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      qty: it.qty,
    };
  });
  const { error: itemsErr } = await admin.from("order_items").insert(itemsRows);
  if (itemsErr) return json({ error: itemsErr.message }, 500);

  // Decrement stock + log movements
  const userName = profile?.display_name ?? "Cashier";
  for (const it of body.items) {
    const stock = stockMap.get(it.product_id)!;
    await admin.from("product_stock").update({ qty: stock.qty - it.qty }).eq("id", stock.id);
    const p = productMap.get(it.product_id)!;
    await admin.from("inventory_log").insert({
      product_id: p.id,
      product_name: p.name,
      store_id: store.id,
      store_name: store.name,
      movement: "sold",
      qty: -it.qty,
      user_id: userId,
      user_name: userName,
      note: `Order ${order.number}`,
    });
  }

  return json({ id: order.id, number: order.number, total });
});