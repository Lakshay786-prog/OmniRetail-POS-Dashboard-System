import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, roleHome } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login, signup } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={roleHome[user.role]} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await login(email, password);
        if (error) {
          toast.error("Sign in failed", { description: error });
          return;
        }
        toast.success("Welcome back");
        nav("/");
      } else {
        const { error } = await signup(name || email.split("@")[0], email, password);
        if (error) {
          toast.error("Sign up failed", { description: error });
          return;
        }
        toast.success("Account created", { description: "You're signed in." });
        nav("/");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual panel */}
      <div className="hidden lg:flex relative bg-gradient-primary text-primary-foreground p-12 flex-col justify-between overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-lg bg-gradient-accent flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="font-display text-lg font-semibold">Hearth Retail OS</div>
        </div>
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.25em] text-primary-foreground/60 mb-4">Omnichannel · POS · Inventory</div>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] mb-5">
            One quiet system for every counter, stockroom, and storefront.
          </h1>
          <p className="text-primary-foreground/70 max-w-md">
            Ring up sales in seconds, reconcile stock across stores, and watch the day unfold — all in one calm, considered workspace.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-3 text-xs">
          {[
            ["12s", "Avg checkout"],
            ["4 stores", "Synced live"],
            ["99.98%", "Uptime"],
          ].map(([a, b]) => (
            <div key={a} className="rounded-lg border border-primary-foreground/10 bg-primary-foreground/5 p-3">
              <div className="font-display text-xl font-semibold">{a}</div>
              <div className="text-primary-foreground/60 text-[10px] uppercase tracking-[0.18em] mt-1">{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="mb-6">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
          </Tabs>

          <h2 className="font-display text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Get started"}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login"
              ? "Sign in with your email and password."
              : "The first account becomes Admin. New accounts join as Cashier."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Whitfield" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {mode === "signup" && (
                <p className="text-[11px] text-muted-foreground">At least 8 characters. Common leaked passwords are blocked.</p>
              )}
            </div>

            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary hover:opacity-95 transition-smooth h-11">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  {mode === "login" ? "Sign in" : "Create account"}
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}