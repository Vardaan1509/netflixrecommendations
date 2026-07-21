import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkSession();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl },
      });

      if (error) throw error;

      toast({
        title: "Account created",
        description: "You can now sign in.",
      });
    } catch (error: unknown) {
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({ title: "Welcome back" });
      navigate("/");
    } catch (error: unknown) {
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4">
      {/* Subtle ambient glow — no aggressive gradients */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.14),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(40%_40%_at_50%_100%,hsl(var(--primary)/0.08),transparent_70%)]" />

      {/* Back to home */}
      <Link
        to="/"
        className="absolute top-5 left-5 z-20 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        {/* Wordmark */}
        <Link
          to="/"
          className="mx-auto mb-8 flex items-center justify-center gap-2 text-sm font-medium tracking-tight text-foreground/90 hover:text-foreground transition-colors"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/80" />
          smart.netflix
        </Link>

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-[-0.03em] leading-[1.05]">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to save your shows and unlock memory-powered recommendations.
          </p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card/60 backdrop-blur-xl p-6 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50 h-9">
              <TabsTrigger value="signin" className="text-xs">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-xs">
                Sign up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="text-xs text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 bg-background/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password" className="text-xs text-muted-foreground">
                    Password
                  </Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-10 bg-background/60"
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-10 text-sm font-medium"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-xs text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 bg-background/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-xs text-muted-foreground">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-10 bg-background/60"
                  />
                </div>
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-10 text-sm font-medium"
                  disabled={loading}
                >
                  {loading ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          By continuing you agree to our terms & privacy.
        </p>
      </div>
    </div>
  );
};

export default Auth;
