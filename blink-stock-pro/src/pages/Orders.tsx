import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrders, fetchOrderItems, updateOrderStatus, type Order } from "@/lib/api";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUSES = ["all", "pending", "completed", "cancelled"] as const;

export default function Orders() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const [status, setStatus] = useState<typeof STATUSES[number]>("all");
  const [open, setOpen] = useState<Order | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["order-items", open?.id],
    queryFn: () => fetchOrderItems(open!.id),
    enabled: !!open,
  });

  const filtered = useMemo(() => orders.filter((o) => status === "all" || o.status === status), [orders, status]);

  const setOrderStatus = async (id: string, s: Order["status"]) => {
    try {
      await updateOrderStatus(id, s);
      setOpen((o) => (o ? { ...o, status: s } : o));
      toast.success(`Order ${s}`);
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e: any) {
      toast.error("Update failed", { description: e.message });
    }
  };

  if (isLoading) {
    return <div className="p-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto">
      <PageHeader eyebrow="Operations" title="Orders" description="Every sale across in-store and online channels in one stream." />

      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-smooth ${status === s ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/70"}`}
          >
            {s} <span className="opacity-60 ml-1">{s === "all" ? orders.length : orders.filter((o) => o.status === s).length}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Channel</th>
              <th className="px-3 py-3 font-medium">Store</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">No orders yet. Ring up a sale on the POS.</td></tr>
            )}
            {filtered.map((o) => (
              <tr key={o.id} onClick={() => setOpen(o)} className="border-t border-border hover:bg-secondary/30 cursor-pointer transition-smooth">
                <td className="px-5 py-3 font-mono-num">{o.number}</td>
                <td className="px-3 py-3 font-medium">{o.customer}</td>
                <td className="px-3 py-3 text-muted-foreground capitalize">{o.channel}</td>
                <td className="px-3 py-3 text-muted-foreground">{o.store_name}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                    o.status === "completed" ? "bg-success/15 text-success" :
                    o.status === "pending" ? "bg-warning/20 text-warning-foreground" :
                    "bg-destructive/15 text-destructive"
                  }`}>{o.status}</span>
                </td>
                <td className="px-3 py-3 text-muted-foreground text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right font-mono-num">${o.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {open && (
            <>
              <SheetHeader>
                <div className="text-[11px] uppercase tracking-[0.22em] text-accent">Order</div>
                <SheetTitle className="font-display text-2xl">{open.number}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <Field k="Customer" v={open.customer} />
                <Field k="Channel" v={open.channel} />
                <Field k="Store" v={open.store_name ?? "—"} />
                <Field k="Payment" v={open.payment} />
                <Field k="Placed" v={new Date(open.created_at).toLocaleString()} />
              </div>
              <div className="mt-6">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Items</div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{i.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono-num">{i.sku} × {i.qty}</div>
                      </div>
                      <div className="font-mono-num">${(i.price * i.qty).toFixed(2)}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 space-y-1 text-sm">
                <Field k="Subtotal" v={`$${open.subtotal.toFixed(2)}`} />
                <Field k="Discount" v={`-$${open.discount.toFixed(2)}`} />
                <Field k="Tax" v={`$${open.tax.toFixed(2)}`} />
                <div className="flex items-baseline justify-between border-t border-border pt-3 mt-2">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-2xl font-semibold font-mono-num">${open.total.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-8">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Update status</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant={open.status === "pending" ? "default" : "outline"} onClick={() => setOrderStatus(open.id, "pending")}>Pending</Button>
                  <Button size="sm" variant={open.status === "completed" ? "default" : "outline"} onClick={() => setOrderStatus(open.id, "completed")}>Complete</Button>
                  <Button size="sm" variant={open.status === "cancelled" ? "default" : "outline"} onClick={() => setOrderStatus(open.id, "cancelled")}>Cancel</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="capitalize">{v}</span>
    </div>
  );
}