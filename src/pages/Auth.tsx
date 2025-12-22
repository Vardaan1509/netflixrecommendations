import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Film, Star, Tv, Clapperboard, Popcorn } from "lucide-react";

const FloatingIcon = ({ 
  Icon, 
  delay, 
  duration, 
  left, 
  size 
}: { 
  Icon: React.ElementType; 
  delay: number; 
  duration: number; 
  left: string; 
  size: number;
}) => (
  <div
    className="absolute text-primary/20 animate-float pointer-events-none"
    style={{
      left,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      bottom: '-50px',
    }}
  >
    <Icon size={size} />
  </div>
);

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Account created successfully. You can now sign in.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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

      toast({
        title: "Success!",
        description: "Signed in successfully.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const floatingIcons = [
    { Icon: Film, delay: 0, duration: 15, left: "5%", size: 32 },
    { Icon: Star, delay: 2, duration: 18, left: "15%", size: 24 },
    { Icon: Tv, delay: 4, duration: 20, left: "25%", size: 28 },
    { Icon: Clapperboard, delay: 1, duration: 16, left: "35%", size: 36 },
    { Icon: Popcorn, delay: 3, duration: 22, left: "55%", size: 30 },
    { Icon: Film, delay: 5, duration: 17, left: "65%", size: 26 },
    { Icon: Star, delay: 2.5, duration: 19, left: "75%", size: 34 },
    { Icon: Tv, delay: 4.5, duration: 21, left: "85%", size: 28 },
    { Icon: Clapperboard, delay: 1.5, duration: 14, left: "92%", size: 24 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-background">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20 animate-gradient" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/30 rounded-full blur-[120px] animate-pulse-slow animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] animate-breathe" />
      </div>

      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), 
                           linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Floating icons */}
      {floatingIcons.map((props, i) => (
        <FloatingIcon key={i} {...props} />
      ))}

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-primary rounded-3xl blur-xl opacity-30 animate-gradient-x" />
        
        <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
          {/* Top decorative bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary" />
          
          {/* Header */}
          <div className="pt-8 pb-4 px-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 mb-4 group hover:scale-110 transition-transform duration-300">
              <Sparkles className="w-8 h-8 text-primary group-hover:animate-spin" style={{ animationDuration: '2s' }} />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Sign in to unlock personalized recommendations
            </p>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50 p-1 rounded-xl mb-6">
                <TabsTrigger 
                  value="signin" 
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground transition-all duration-300"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground transition-all duration-300"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 animate-fade-in">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2 group">
                    <Label htmlFor="signin-email" className="text-sm font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                      Email
                    </Label>
                    <div className="relative">
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-secondary/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 h-12 rounded-xl"
                      />
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/0 to-accent/0 group-focus-within:from-primary/5 group-focus-within:to-accent/5 pointer-events-none transition-all duration-300" />
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <Label htmlFor="signin-password" className="text-sm font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="bg-secondary/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 h-12 rounded-xl"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-6" 
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 animate-fade-in">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2 group">
                    <Label htmlFor="signup-email" className="text-sm font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                      Email
                    </Label>
                    <div className="relative">
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-secondary/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 h-12 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <Label htmlFor="signup-password" className="text-sm font-medium text-muted-foreground group-focus-within:text-primary transition-colors">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="bg-secondary/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 h-12 rounded-xl"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Must be at least 6 characters
                    </p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 mt-6" 
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Creating account...
                      </span>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Features list */}
            <div className="mt-8 pt-6 border-t border-border/30">
              <p className="text-xs text-center text-muted-foreground mb-4">What you'll unlock</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: Star, label: "Rate Shows" },
                  { icon: Film, label: "Save List" },
                  { icon: Sparkles, label: "Smart AI" },
                ].map(({ icon: ItemIcon, label }) => (
                  <div 
                    key={label}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 border border-transparent hover:border-primary/20 transition-all duration-300 group cursor-default"
                  >
                    <ItemIcon className="w-5 h-5 text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all duration-300" />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Back to home link */}
        <button 
          onClick={() => navigate("/")}
          className="w-full text-center mt-6 text-sm text-muted-foreground hover:text-primary transition-colors duration-300"
        >
          ← Back to recommendations
        </button>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
          }
        }

        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes breathe {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 0.2;
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-float {
          animation: float linear infinite;
        }

        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }

        .animate-breathe {
          animation: breathe 8s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animate-gradient {
          animation: gradient-shift 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Auth;
