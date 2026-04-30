import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProductsWithStock, createProduct, updateProduct, deleteProduct } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE = 10;

interface EditState {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  cost: number;
}

export default function Products() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products-stock"], queryFn: fetchProductsWithStock });

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);

  const cats = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return products.filter((p) =>
      (cat === "all" || p.category === cat) &&
      (!s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))
    );
  }, [products, q, cat]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice((page - 1) * PAGE, page * PAGE);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) {
        await updateProduct(editing.id, {
          name: editing.name, sku: editing.sku, barcode: editing.barcode || null,
          category: editing.category, price: editing.price, cost: editing.cost,
        });
        toast.success("Product updated");
      } else {
        await createProduct({
          name: editing.name, sku: editing.sku, barcode: editing.barcode || null,
          category: editing.category, price: editing.price, cost: editing.cost, image: null,
        });
        toast.success("Product created");
      }
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["products-stock"] });
    } catch (e: any) {
      toast.error("Save failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["products-stock"] });
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
  };

  if (isLoading) {
    return <div className="p-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Browse, search and manage every SKU across the storefront."
        action={isAdmin ? (
          <Button onClick={() => setEditing({ name: "", sku: "", barcode: "", category: cats[0] || "Apparel", price: 0, cost: 0 })} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-1" /> New product
          </Button>
        ) : undefined}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name or SKU…" className="pl-9 bg-card" />
        </div>
        <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1); }}>
          <SelectTrigger className="w-48 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">SKU</th>
              <th className="px-3 py-3 font-medium text-right">Price</th>
              <th className="px-3 py-3 font-medium text-right">Stock</th>
              {isAdmin && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody>
            {view.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-secondary/30 transition-smooth">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-gradient-to-br from-secondary to-muted flex items-center justify-center font-display text-sm">{p.name[0]}</div>
                    <span className="font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{p.category}</td>
                <td className="px-3 py-3 font-mono-num text-xs">{p.sku}</td>
                <td className="px-3 py-3 text-right font-mono-num">${Number(p.price).toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-mono-num">{p.totalStock}</td>
                {isAdmin && (
                  <td className="px-5 py-3 text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode ?? "", category: p.category, price: Number(p.price), cost: Number(p.cost) })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
          <span className="text-muted-foreground text-xs">{filtered.length} products · page {page} of {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">{editing?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>SKU</Label><Input value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Barcode</Label><Input value={editing.barcode} onChange={(e) => setEditing({ ...editing, barcode: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Price</Label><Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div className="space-y-1.5"><Label>Cost</Label><Input type="number" step="0.01" value={editing.cost} onChange={(e) => setEditing({ ...editing, cost: Number(e.target.value) })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="bg-gradient-primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}