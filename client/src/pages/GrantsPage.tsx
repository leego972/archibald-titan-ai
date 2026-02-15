import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Globe, DollarSign, Building2, Loader2, Database, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const REGIONS = [
  { value: "all", label: "All Regions" },
  { value: "USA", label: "United States" },
  { value: "Oceania", label: "Australia & NZ" },
  { value: "Europe", label: "Europe" },
];

export default function GrantsPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");

  const { data: grants, isLoading, refetch } = trpc.grants.list.useQuery(
    region === "all" ? { search: search || undefined } : { region, search: search || undefined }
  );
  const { data: countData } = trpc.grantSeed.count.useQuery();
  const seedMutation = trpc.grantSeed.seed.useMutation({
    onSuccess: (data) => {
      toast.success(`Seeded ${data.count} grants successfully!`);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredGrants = useMemo(() => {
    if (!grants) return [];
    return grants;
  }, [grants]);

  const formatAmount = (amount: number | null) => {
    if (!amount) return "N/A";
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Grant Finder</h1>
          <p className="text-zinc-400 mt-1">
            Discover funding opportunities across USA, Australia, New Zealand & Europe
          </p>
        </div>
        {isAuthenticated && (!countData || countData.count === 0) && (
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            variant="outline"
            className="gap-2"
          >
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Load Grant Database
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search grants by name, agency, or focus area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Globe className="w-4 h-4 mr-2 text-zinc-500" />
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{filteredGrants.length}</p>
            <p className="text-xs text-zinc-500">Grants Found</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {filteredGrants.filter(g => g.status === "open").length}
            </p>
            <p className="text-xs text-zinc-500">Open Now</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">
              {new Set(filteredGrants.map(g => g.region)).size}
            </p>
            <p className="text-xs text-zinc-500">Regions</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">
              {new Set(filteredGrants.map(g => g.agency)).size}
            </p>
            <p className="text-xs text-zinc-500">Agencies</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filteredGrants.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No grants found</h3>
          <p className="text-zinc-500 mt-1">
            {countData?.count === 0
              ? "Click 'Load Grant Database' to populate grants"
              : "Try adjusting your search or filters"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGrants.map((grant) => (
            <Card
              key={grant.id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              onClick={() => navigate(`/grants/${grant.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{grant.region}</Badge>
                  <Badge
                    variant={grant.status === "open" ? "default" : "secondary"}
                    className={grant.status === "open" ? "bg-green-600/20 text-green-400 border-green-600/30" : ""}
                  >
                    {grant.status}
                  </Badge>
                </div>
                <CardTitle className="text-base text-white line-clamp-2">{grant.title}</CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  <Building2 className="w-3 h-3 inline mr-1" />
                  {grant.agency} — {grant.programName}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{grant.description}</p>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className="text-zinc-300">
                    {formatAmount(grant.minAmount)} — {formatAmount(grant.maxAmount)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <div className="flex flex-wrap gap-1">
                  {grant.focusAreas?.split(",").slice(0, 3).map((area, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-zinc-800 text-zinc-400">
                      {area.trim()}
                    </Badge>
                  ))}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
