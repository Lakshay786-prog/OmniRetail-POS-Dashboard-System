import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OnlineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => { setOnline(true); toast.success("Back online", { description: "Syncing local cart..." }); };
    const off = () => { setOnline(false); toast.warning("You are offline", { description: "Cart will save locally." }); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${online ? "bg-success/10 text-success" : "bg-warning/15 text-warning-foreground"}`}>
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? "Online" : "Offline"}
    </div>
  );
}