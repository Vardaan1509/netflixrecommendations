import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REGIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "India",
  "Germany",
  "France",
  "Japan",
  "Brazil",
  "Mexico",
  "Spain",
  "Italy",
  "South Korea",
  "Netherlands",
  "Sweden",
];

interface Props {
  region: string;
  onRegionChange: (region: string) => void;
}

const RegionSelector = ({ region, onRegionChange }: Props) => (
  <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur p-6 space-y-3">
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">Netflix region</span>
    </div>
    <Select value={region} onValueChange={onRegionChange}>
      <SelectTrigger className="bg-background/60">
        <SelectValue placeholder="Select your Netflix region" />
      </SelectTrigger>
      <SelectContent>
        {REGIONS.map((r) => (
          <SelectItem key={r} value={r}>
            {r}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default RegionSelector;
