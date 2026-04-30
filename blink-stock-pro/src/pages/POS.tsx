import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsWithStock, fetchStores, type ProductWithStock } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { cartTotals, useCart } from "@/store/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ScanBarcode, Minus, Plus, Trash2, CreditCard, Wallet, Banknote, Percent, Keyboard, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function POS() {
  const { user } = useAuth();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products-stock"], queryFn: fetchProductsWithStock });
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: fetchStores });

  const { items, add, inc, dec, remove, discountPct, setDiscount, taxPct, clear } = useCart();
  const [q, setQ] = useState("");
  const [pay, setPay] = useState(false);
  const [method, setMethod] = useState<"cash" | "card" | "wallet">("card");
  const [storeId, setStoreId] = useState<string>("");
  const [customer, setCustomer] = useState("Walk-in");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!storeId && stores.length) {
      const downtown = stores.find((s) => s.name === "Downtown") ?? stores[0];
      setStoreId(downtown.id);
    }
  }, [stores, storeId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products.slice(0, 12);
    return products
      .filter((p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        (p.barcode ?? "").includes(s)
      )
      .slice(0, 18);
  }, [q, products]);

  const addToCart = (p: ProductWithStock) => {
    add({ id: p.id, sku: p.sku, name: p.name, price: Number(p.price), barcode: p.barcode, category: p.category, cost: Number(p.cost), image: p.image });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault(); document.getElementById("pos-search")?.focus();
      }
      if (e.key === "F2") { e.preventDefault(); if (items.length) setPay(true); }
      if (e.key === "Escape") { setPay(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Backspace") { e.preventDefault(); clear(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items.length, clear]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const exact = products.find((p) => p.barcode === q.trim() || p.sku.toLowerCase() === q.trim().toLowerCase());
      if (exact) { addToCart(exact); setQ(""); toast.success(`Added ${exact.name}`); }
    }
  };

  const t = cartTotals(items, discountPct, taxPct);

  const complete = async () => {
    if (!storeId) { toast.error("Select a store first"); return; }
    if (!user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("checkout", {
        body: {
          store_id: storeId,
          customer,
          payment: method,
          discount_pct: discountPct,
          tax_pct: taxPct,
          items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
        },
      });
      if (error) throw error;
      toast.success(`Sale ${data?.number ?? "completed"}`, { description: `$${t.total.toFixed(2)} via ${method}` });
      clear();
      setPay(false);
    } catch (err: any) {
      toast.error("Checkout failed", { description: err.message ?? "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] grid lg:grid-cols-[1fr_420px]">
      <div className="p-6 overflow-auto bg-gradient-surface">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="pos-search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search name, scan barcode, or SKU…  ( press / )"
              className="pl-9 h-11 bg-card border-border"
            />
          </div>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="h-11 w-40 bg-card"><SelectValue placeholder="Store" /></SelectTrigger>
            <SelectContent>
              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const storeName = stores.find((s) => s.id === storeId)?.name ?? "";
            const onHand = storeName ? (p.stock[storeName] ?? 0) : p.totalStock;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={onHand === 0}
                className="group text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="aspect-square rounded-lg bg-gradient-to-br from-secondary to-muted mb-3 flex items-center justify-center">
                  <span className="font-display text-2xl text-muted-foreground/50">{p.name[0]}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.category}</div>
                <div className="text-sm font-medium leading-snug line-clamp-2 mt-0.5">{p.name}</div>
                <div className="flex items-baseline justify-between mt-2">
                  <div className="font-mono-num font-semibold">${Number(p.price).toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{onHand} in stock</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="border-l border-border bg-card flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="text-[11px] uppercase tracking-[0.22em] text-accent font-medium">Current sale</div>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">Cart</h2>
            <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 && "s"}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-2">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-16">
              <ScanBarcode className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Scan a product or tap a tile to start</p>
              <p className="text-[11px] mt-2 inline-flex items-center gap-1.5"><Keyboard className="h-3 w-3" /> / search · F2 pay · ⌘⌫ clear</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li key={i.productId} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.name}</div>
                    <div className="text-[11px] text-muted-foreground">{i.sku} · ${i.price.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border">
                    <button onClick={() => dec(i.productId)} className="h-7 w-7 flex items-center justify-center hover:bg-muted"><Minus className="h-3 w-3" /></button>
                    <span className="w-7 text-center font-mono-num text-sm">{i.qty}</span>
                    <button onClick={() => inc(i.productId)} className="h-7 w-7 flex items-center justify-center hover:bg-muted"><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="w-16 text-right font-mono-num text-sm">${(i.price * i.qty).toFixed(2)}</div>
                  <button onClick={() => remove(i.productId)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-5 space-y-3 bg-secondary/40">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <Input
              type="number" min={0} max={100} value={discountPct}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="h-8 w-20 font-mono-num"
            />
            <span className="text-xs text-muted-foreground">discount</span>
            <span className="ml-auto text-xs text-muted-foreground">Tax {taxPct}%</span>
          </div>
          <div className="space-y-1 text-sm">
            <Row label="Subtotal" v={t.subtotal} />
            <Row label="Discount" v={-t.discount} muted />
            <Row label="Tax" v={t.tax} muted />
          </div>
          <div className="flex items-baseline justify-between pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-3xl font-semibold font-mono-num">${t.total.toFixed(2)}</span>
          </div>
          <Button
            disabled={!items.length}
            onClick={() => setPay(true)}
            className="w-full h-12 bg-gradient-primary hover:opacity-95 text-base"
          >
            Charge ${t.total.toFixed(2)} <span className="ml-2 text-xs opacity-70">F2</span>
          </Button>
        </div>
      </aside>

      <Dialog open={pay} onOpenChange={setPay}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Take payment</DialogTitle>
          </DialogHeader>
          <div className="text-center py-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Amount due</div>
            <div className="font-display text-5xl font-semibold font-mono-num mt-1">${t.total.toFixed(2)}</div>
          </div>
          <div className="space-y-3">
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" />
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "cash", label: "Cash", icon: Banknote },
                { id: "card", label: "Card", icon: CreditCard },
                { id: "wallet", label: "Wallet", icon: Wallet },
              ] as const).map((m) => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`rounded-lg border p-4 flex flex-col items-center gap-2 transition-smooth ${method === m.id ? "border-primary bg-secondary" : "border-border hover:border-primary/40"}`}>
                  <m.icon className="h-5 w-5" />
                  <span className="text-sm">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPay(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={complete} disabled={submitting} className="bg-gradient-primary">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, v, muted }: { label: string; v: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="font-mono-num">${v.toFixed(2)}</span>
    </div>
  );
}