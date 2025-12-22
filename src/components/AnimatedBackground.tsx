import { useEffect, useState, useMemo } from "react";

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface AnimatedBackgroundProps {
  variant?: "hero" | "page" | "subtle";
  showParticles?: boolean;
  particleCount?: number;
}

const AnimatedBackground = ({ 
  variant = "page", 
  showParticles = true,
  particleCount = 30 
}: AnimatedBackgroundProps) => {
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.5 + 0.1,
    }));
  }, [particleCount]);

  const getVariantStyles = () => {
    switch (variant) {
      case "hero":
        return {
          orb1: "w-[600px] h-[600px] bg-primary/40",
          orb2: "w-[500px] h-[500px] bg-accent/30",
          orb3: "w-[400px] h-[400px] bg-primary/20",
        };
      case "page":
        return {
          orb1: "w-96 h-96 bg-primary/30",
          orb2: "w-80 h-80 bg-accent/20",
          orb3: "w-64 h-64 bg-primary/15",
        };
      case "subtle":
        return {
          orb1: "w-64 h-64 bg-primary/20",
          orb2: "w-48 h-48 bg-accent/15",
          orb3: "w-32 h-32 bg-primary/10",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
      
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-gradient-shift" />
      
      {/* Floating orbs */}
      <div 
        className={`absolute -top-1/4 -left-1/4 ${styles.orb1} rounded-full blur-[120px] animate-float opacity-60`}
        style={{ animationDuration: "20s" }}
      />
      <div 
        className={`absolute -bottom-1/4 -right-1/4 ${styles.orb2} rounded-full blur-[100px] animate-float-reverse opacity-50`}
        style={{ animationDuration: "25s" }}
      />
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${styles.orb3} rounded-full blur-[150px] animate-morph opacity-40`}
      />
      
      {/* Additional accent orbs for hero */}
      {variant === "hero" && (
        <>
          <div 
            className="absolute top-1/4 right-1/4 w-72 h-72 bg-accent/20 rounded-full blur-[80px] animate-float"
            style={{ animationDuration: "15s", animationDelay: "5s" }}
          />
          <div 
            className="absolute bottom-1/3 left-1/3 w-48 h-48 bg-primary/25 rounded-full blur-[60px] animate-float-reverse"
            style={{ animationDuration: "18s", animationDelay: "3s" }}
          />
        </>
      )}

      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), 
                           linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Rising particles */}
      {showParticles && particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary animate-particle-rise"
          style={{
            left: `${particle.x}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      {/* Twinkling stars */}
      {variant === "hero" && Array.from({ length: 20 }).map((_, i) => (
        <div
          key={`star-${i}`}
          className="absolute w-1 h-1 bg-foreground/30 rounded-full animate-twinkle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${Math.random() * 2 + 2}s`,
          }}
        />
      ))}
    </div>
  );
};

export default AnimatedBackground;
