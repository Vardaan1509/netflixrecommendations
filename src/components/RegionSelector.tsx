import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";

interface RegionSelectorProps {
  region: string;
  onRegionChange: (region: string) => void;
}

const regions = [
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

const RegionSelector = ({ region, onRegionChange }: RegionSelectorProps) => {
  return (
    <Card className="glass-effect hover-lift overflow-hidden">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Globe className="h-5 w-5 text-accent" />
          Netflix Region
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={region} onValueChange={onRegionChange}>
          <SelectTrigger className="bg-background/50 focus-ring-glow transition-all hover-scale">
            <SelectValue placeholder="Select your Netflix region" />
          </SelectTrigger>
          <SelectContent className="animate-fade-in">
            {regions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

export default RegionSelector;
