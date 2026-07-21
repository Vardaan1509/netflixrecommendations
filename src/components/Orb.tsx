import { cn } from "@/lib/utils";

interface OrbProps {
  size?: number;
  halo?: boolean;
  className?: string;
}

/**
 * Pure-CSS iridescent orb. Multi-layer for a real 3D read:
 *  - outer conic spectrum spinning one way (atmosphere)
 *  - inner conic spinning the opposite way with mix-blend screen (movement inside)
 *  - fixed specular highlight + shadow gradient on top (light source illusion)
 *  - halo behind (optional)
 *
 * No dependencies, no WebGL. GPU-cheap.
 */
const Orb = ({ size = 96, halo = false, className }: OrbProps) => (
  <div className={cn("relative inline-block", className)} style={{ width: size, height: size }}>
    {halo && <span className="orb-halo" aria-hidden />}
    <span className={cn("orb block h-full w-full", size <= 40 && "orb--sm")} aria-hidden>
      <span className="orb-inner" />
    </span>
  </div>
);

export default Orb;
