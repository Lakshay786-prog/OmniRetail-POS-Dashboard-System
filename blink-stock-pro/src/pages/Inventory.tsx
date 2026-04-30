import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProductsWithStock, fetchStores, fetchInventoryLog, transferStock } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowRightLeft, Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const LOW = 5;

export default function Inventory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products-stock"], queryFn: fetchProductsWithStock });
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: fetchStores });
  const { data: log = [] } = useQuery({ queryKey: ["inventory-log"], queryFn: fetchInventoryLog });

  const [q, setQ] = useState("");
  const [transferP, setTransferP] = useState<string | null>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return products.filter((p) => !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
  }, [products, q]);

  const lowStock = products.filter((p) => Object.values(p.stock).some((v) => v > 0 && v <= LOW)).length;
  const outStock = products.filter((p) => Object.values(p.stock).every((v) => v === 0)).length;

  const submitTransfer = async () => {
    if (!transferP || !from || !to || !user) return;
    if (from === to) { toast.error("Source and destination must differ"); return; }
    const product = products.find((p) => p.id === transferP);
    const fromStore = stores.find((s) => s.id === from);
    const toStore = stores.find((s) => s.id === to);
    if (!product || !fromStore || !toStore) return;
    setBusy(true);
    try {
      await transferStock({
        productId: product.id,
        productName: product.name,
        fromStoreId: fromStore.id,
        fromStoreName: fromStore.name,
        toStoreId: toStore.id,
        toStoreName: toStore.name,
        qty,
        userId: user.id,
        userName: user.name,
      });
      toast.success(`Transferred ${qty} units`, { description: `${fromStore.name} → ${toStore.name}` });
      setTransferP(null); setQty(1);
      qc.invalidateQueries({ queryKey: ["products-stock"] });
      qc.invalidateQueries({ queryKey: ["inventory-log"] });
    } catch (e: any) {
      toast.error("Transfer failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <div className="p-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Stockroom"
        title="Inventory"
        description="Real-time stock across every store. Transfer units, watch low-stock signals."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stores.map((s) => {
          const total = products.reduce((sum, p) => sum + (p.stock[s.name] || 0), 0);
          return (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{s.name}</div>
              <div className="font-display text-2xl font-semibold font-mono-num mt-1">{total}</div>
              <div className="text-[11px] text-muted-foreground">units on hand</div>
            </div>
          );
        })}
      </div>

      {(lowStock > 0 || outStock > 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 mb-6">
          <AlertTriangle className="h-5 w-5 text-warning-foreground" />
          <div className="text-sm">
            <span className="font-medium">{lowStock} SKUs running low</span>
            <span className="text-muted-foreground"> · {outStock} fully out at one or more stores</span>
          </div>
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU or product…" className="pl-9 bg-card" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Product</th>
              {stores.map((s) => <th key={s.id} className="px-3 py-3 font-medium text-right">{s.name}</th>)}
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-5 py-3">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono-num">{p.sku}</div>
                </td>
                {stores.map((s) => {
                  const v = p.stock[s.name] || 0;
                  const cls = v === 0 ? "text-destructive" : v <= LOW ? "text-warning-foreground" : "text-foreground";
                  return (
                    <td key={s.id} className={`px-3 py-3 text-right font-mono-num ${cls}`}>{v}</td>
                  );
                })}
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => {
                    setTransferP(p.id);
                    if (stores.length >= 2) { setFrom(stores[0].id); setTo(stores[1].id); }
                  }}>
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Transfer
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="font-display text-xl font-semibold mt-10 mb-3">Activity log</h3>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {log.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No activity yet.</div>}
        {log.map((l) => (
          <div key={l.id} className="flex items-center gap-4 px-5 py-3 text-sm">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
              l.movement === "received" ? "bg-success/15 text-success" :
              l.movement === "sold" ? "bg-secondary text-foreground" :
              l.movement === "transferred" ? "bg-accent/15 text-accent" :
              "bg-warning/20 text-warning-foreground"
            }`}>{l.movement}</span>
            <span className="flex-1 truncate">{l.product_name}</span>
            <span className="text-muted-foreground text-xs">{l.store_name}</span>
            <span className="font-mono-num text-xs w-10 text-right">{l.qty > 0 ? `+${l.qty}` : l.qty}</span>
            <span className="text-muted-foreground text-xs hidden sm:inline">{new Date(l.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <Dialog open={!!transferP} onOpenChange={(o) => !o && setTransferP(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Transfer stock</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferP(null)} disabled={busy}>Cancel</Button>
            <Button onClick={submitTransfer} disabled={busy} className="bg-gradient-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}