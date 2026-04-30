import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders, fetchProductsWithStock } from "@/lib/api";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { DollarSign, ShoppingBag, Boxes, Users, Loader2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(162 47% 18%)", "hsl(18 88% 62%)", "hsl(158 55% 38%)", "hsl(38 92% 50%)", "hsl(160 10% 38%)"];
const LOW = 5;

export default function Dashboard() {
  const { data: orders = [], isLoading: lo } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });
  const { data: products = [], isLoading: lp } = useQuery({ queryKey: ["products-stock"], queryFn: fetchProductsWithStock });

  const { series, todaysRev, totalRev, totalOrders } = useMemo(() => {
    const days: { day: string; revenue: number; orders: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({ day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), revenue: 0, orders: 0 });
    }
    const start = new Date(today);
    start.setDate(today.getDate() - 13);
    for (const o of orders) {
      if (o.status !== "completed") continue;
      const dt = new Date(o.created_at);
      if (dt < start) continue;
      const idx = Math.floor((dt.getTime() - start.getTime()) / 86400000);
      if (idx >= 0 && idx < 14) {
        days[idx].revenue += o.total;
        days[idx].orders += 1;
      }
    }
    return {
      series: days,
      todaysRev: days.at(-1)?.revenue ?? 0,
      totalRev: days.reduce((s, d) => s + d.revenue, 0),
      totalOrders: days.reduce((s, d) => s + d.orders, 0),
    };
  }, [orders]);

  const categoryShare = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.category, (map.get(p.category) ?? 0) + p.totalStock);
    return Array.from(map, ([name, value]) => ({ name, value })).filter((x) => x.value > 0);
  }, [products]);

  const lowStock = products.filter((p) => Object.values(p.stock).some((v) => v > 0 && v <= LOW)).length;

  if (lo || lp) {
    return <div className="p-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1500px] mx-auto">
      <PageHeader
        eyebrow="Today"
        title="Good morning, let's open the doors."
        description="A snapshot of revenue, orders, and inventory across your locations."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's revenue" value={`$${todaysRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} delta={`${series.at(-1)?.orders ?? 0} orders today`} icon={DollarSign} accent />
        <StatCard label="14-day revenue" value={`$${totalRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={ShoppingBag} />
        <StatCard label="Orders (14d)" value={totalOrders.toLocaleString()} icon={Users} />
        <StatCard label="SKUs in catalog" value={String(products.length)} delta={`${lowStock} low-stock`} icon={Boxes} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Revenue trend</h3>
              <p className="text-xs text-muted-foreground">Daily completed-order revenue, last 14 days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(158 55% 38%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(158 55% 38%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 18% 88%)" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(160 10% 38%)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(160 10% 38%)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(40 18% 88%)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(162 47% 18%)" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-semibold">Inventory by category</h3>
          <p className="text-xs text-muted-foreground mb-4">Units on hand</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={categoryShare} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {categoryShare.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Recent orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 font-medium">Order</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Channel</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No orders yet — head to POS to ring up your first sale.</td></tr>
              )}
              {orders.slice(0, 8).map((o) => (
                <tr key={o.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 font-mono-num">{o.number}</td>
                  <td className="py-3 pr-4">{o.customer}</td>
                  <td className="py-3 pr-4 capitalize text-muted-foreground">{o.channel}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                      o.status === "completed" ? "bg-success/15 text-success" :
                      o.status === "pending" ? "bg-warning/20 text-warning-foreground" :
                      "bg-destructive/15 text-destructive"
                    }`}>{o.status}</span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono-num">${o.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}