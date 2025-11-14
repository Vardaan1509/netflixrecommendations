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
    <Card className="bg-gradient-to-br from-card to-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Netflix Region
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={region} onValueChange={onRegionChange}>
          <SelectTrigger className="bg-background/50">
            <SelectValue placeholder="Select your Netflix region" />
          </SelectTrigger>
          <SelectContent>
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
