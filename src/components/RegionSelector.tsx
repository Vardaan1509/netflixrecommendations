import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, ChevronDown } from "lucide-react";

interface RegionSelectorProps {
  region: string;
  onRegionChange: (region: string) => void;
}

const regions = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
];

const RegionSelector = ({ region, onRegionChange }: RegionSelectorProps) => {
  const selectedRegion = regions.find(r => r.name === region);
  
  return (
    <div className="relative">
      {/* Subtle glow */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl blur-lg opacity-50" />
      
      <div className="relative glass-strong rounded-xl p-6 hover-lift">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Netflix Region</h3>
              <p className="text-sm text-muted-foreground">Content varies by location</p>
            </div>
          </div>
          
          <Select value={region} onValueChange={onRegionChange}>
            <SelectTrigger className="w-[200px] bg-secondary/50 border-border/50 rounded-xl hover:bg-secondary/80 transition-colors">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{selectedRegion?.flag}</span>
                  <span>{selectedRegion?.name || region}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="glass-strong border-border/50 rounded-xl">
              {regions.map((r) => (
                <SelectItem 
                  key={r.code} 
                  value={r.name}
                  className="rounded-lg hover:bg-primary/10 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{r.flag}</span>
                    <span>{r.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default RegionSelector;
