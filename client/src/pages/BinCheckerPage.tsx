/**
 * Titan BIN Checker & Card Validator
 * Zero-charge passive checks only — no live transactions, no auth requests.
 * Features: BIN lookup, card validator, bulk check, reverse BIN search with country picker.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CreditCard, Search, CheckCircle2, XCircle, Loader2,
  Globe, Building2, Info, Shield, ChevronDown, ChevronUp,
  Copy, AlertTriangle
} from "lucide-react";

// ─── Country Picker ───────────────────────────────────────────────────────────

interface Country { code: string; name: string; emoji: string; }

function CountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const countriesQuery = trpc.binChecker.getCountries.useQuery();
  const countries: Country[] = countriesQuery.data?.countries ?? [];

  const filtered = useMemo(() =>
    countries.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    ), [countries, search]);

  const selected = countries.find(c => c.code === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 hover:border-zinc-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          {selected ? (
            <><span className="text-lg">{selected.emoji}</span><span>{selected.name}</span></>
          ) : (
            <span className="text-zinc-500">Select country...</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-800">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="bg-zinc-800 border-zinc-700 h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
            >
              All countries
            </button>
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800 transition-colors ${value === c.code ? "bg-zinc-800 text-white" : "text-zinc-300"}`}
              >
                <span className="text-lg">{c.emoji}</span>
                <span>{c.name}</span>
                <span className="ml-auto text-zinc-500 text-xs">{c.code}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-4 text-sm text-zinc-500 text-center">No countries found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result display helpers ───────────────────────────────────────────────────

function NetworkBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    visa: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    mastercard: "bg-red-500/20 text-red-300 border-red-500/30",
    amex: "bg-green-500/20 text-green-300 border-green-500/30",
    discover: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    unionpay: "bg-red-600/20 text-red-200 border-red-600/30",
    jcb: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  };
  const key = name.toLowerCase().replace(/\s/g, "");
  return <Badge variant="outline" className={colors[key] ?? "text-zinc-300"}>{name}</Badge>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined | boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-zinc-800/50 last:border-0">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className="text-zinc-200 text-sm font-medium text-right max-w-[60%]">{String(value)}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BinCheckerPage() {
  const [tab, setTab] = useState("bin");

  // BIN Lookup
  const [binInput, setBinInput] = useState("");

  // Card Validator
  const [cardInput, setCardInput] = useState("");

  // Bulk Validator
  const [bulkInput, setBulkInput] = useState("");

  // Reverse Search
  const [reverseQuery, setReverseQuery] = useState("");
  const [reverseCountry, setReverseCountry] = useState("");
  const [reverseNetwork, setReverseNetwork] = useState("");

  const lookupBin = trpc.binChecker.lookupBin.useMutation({ onError: (e) => toast.error(e.message) });
  const validateCard = trpc.binChecker.validateCard.useMutation({ onError: (e) => toast.error(e.message) });
  const bulkValidate = trpc.binChecker.bulkValidate.useMutation({ onError: (e) => toast.error(e.message) });
  const reverseSearch = trpc.binChecker.reverseBinSearch.useMutation({ onError: (e) => toast.error(e.message) });
  const bulkBinLookup = trpc.binChecker.bulkBinLookup.useMutation({ onError: (e) => toast.error(e.message) });
  const [bulkBinInput, setBulkBinInput] = useState("");
  const [networkPrefix, setNetworkPrefix] = useState("");
  const { data: networkData, isLoading: networkLoading } = trpc.binChecker.detectNetwork.useQuery(
    { prefix: networkPrefix },
    { enabled: networkPrefix.length >= 1 }
  );

  const formatCard = (val: string) => val.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim().slice(0, 19);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <CreditCard className="w-6 h-6 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">BIN Checker</h1>
          <p className="text-sm text-zinc-400">BIN lookup, card validator, reverse search — zero-charge passive only</p>
        </div>
      </div>

      {/* Zero-charge notice */}
      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 flex gap-2 text-sm text-green-300">
        <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-400" />
        <span><strong>Zero-charge methods only.</strong> All checks are passive — no transactions, no authorisation requests, no balance checks. Cards are never touched.</span>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="bin">BIN Lookup</TabsTrigger>
          <TabsTrigger value="validate">Card Validator</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Check</TabsTrigger>
          <TabsTrigger value="bulkbin">Bulk BIN</TabsTrigger>
          <TabsTrigger value="network">Network ID</TabsTrigger>
          <TabsTrigger value="reverse">Reverse Search</TabsTrigger>
        </TabsList>

        {/* ── BIN Lookup ── */}
        <TabsContent value="bin" className="mt-4 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">BIN Lookup</CardTitle>
              <CardDescription>Enter the first 6–8 digits of a card to identify the bank, card type, and country.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={binInput}
                  onChange={e => setBinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Enter BIN (first 6-8 digits)"
                  className="bg-zinc-800 border-zinc-700 font-mono text-lg tracking-widest"
                  maxLength={8}
                />
                <Button
                  onClick={() => lookupBin.mutate({ bin: binInput })}
                  disabled={lookupBin.isPending || binInput.length < 6}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                >
                  {lookupBin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {lookupBin.data?.success && (
                <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700 space-y-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-mono font-bold text-white">{lookupBin.data.bin}</span>
                    {lookupBin.data.network && <NetworkBadge name={lookupBin.data.network.name} />}
                    {lookupBin.data.type && <Badge variant="outline" className="capitalize">{lookupBin.data.type}</Badge>}
                    {lookupBin.data.prepaid && <Badge variant="outline" className="text-orange-300 border-orange-500/30">Prepaid</Badge>}
                  </div>
                  <InfoRow label="Bank" value={lookupBin.data.bank?.name} />
                  <InfoRow label="Bank City" value={lookupBin.data.bank?.city} />
                  <InfoRow label="Bank Phone" value={lookupBin.data.bank?.phone} />
                  <InfoRow label="Country" value={lookupBin.data.country?.name ? `${lookupBin.data.country.emoji ?? ""} ${lookupBin.data.country.name}`.trim() : null} />
                  <InfoRow label="Currency" value={lookupBin.data.country?.currency} />
                  <InfoRow label="Brand" value={lookupBin.data.brand} />
                  <InfoRow label="Luhn Check" value={lookupBin.data.luhnEnabled ? "Required" : "Not required"} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Card Validator ── */}
        <TabsContent value="validate" className="mt-4 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Card Validator</CardTitle>
              <CardDescription>Validates using Luhn algorithm + card network rules. Completely offline — no network request.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={cardInput}
                  onChange={e => setCardInput(formatCard(e.target.value))}
                  placeholder="4111 1111 1111 1111"
                  className="bg-zinc-800 border-zinc-700 font-mono text-lg tracking-widest"
                  maxLength={19}
                />
                <Button
                  onClick={() => validateCard.mutate({ cardNumber: cardInput })}
                  disabled={validateCard.isPending || cardInput.replace(/\D/g, "").length < 13}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                >
                  {validateCard.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                </Button>
              </div>

              {validateCard.data && (
                <div className={`p-4 rounded-lg border space-y-1 ${validateCard.data.valid ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {validateCard.data.valid
                      ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                      : <XCircle className="w-5 h-5 text-red-400" />}
                    <span className={`font-semibold ${validateCard.data.valid ? "text-green-300" : "text-red-300"}`}>
                      {validateCard.data.message}
                    </span>
                  </div>
                  <InfoRow label="Masked Number" value={validateCard.data.maskedNumber} />
                  <InfoRow label="Network" value={validateCard.data.network?.name} />
                  <InfoRow label="Card Length" value={`${validateCard.data.cardLength} digits`} />
                  <InfoRow label="CVV Length" value={validateCard.data.network?.cvvLength ? `${validateCard.data.network.cvvLength} digits` : null} />
                  <InfoRow label="Luhn Valid" value={validateCard.data.luhnValid ? "✓ Yes" : "✗ No"} />
                  <InfoRow label="Length Valid" value={validateCard.data.lengthValid ? "✓ Yes" : "✗ No"} />
                  <InfoRow label="Bank" value={validateCard.data.bank?.name} />
                  <InfoRow label="Country" value={validateCard.data.country?.name} />
                  <InfoRow label="Type" value={validateCard.data.type} />
                  <InfoRow label="Prepaid" value={validateCard.data.prepaid === true ? "Yes" : validateCard.data.prepaid === false ? "No" : null} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bulk Check ── */}
        <TabsContent value="bulk" className="mt-4 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bulk Card Validator</CardTitle>
              <CardDescription>Paste up to 100 card numbers (one per line). Luhn check only — instant, offline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                placeholder={"4111111111111111\n5500005555555559\n378282246310005"}
                className="bg-zinc-800 border-zinc-700 font-mono text-sm min-h-[120px]"
              />
              <Button
                onClick={() => {
                  const cards = bulkInput.split("\n").map(l => l.trim()).filter(l => l.length >= 13);
                  if (cards.length === 0) { toast.error("No valid card numbers found"); return; }
                  bulkValidate.mutate({ cards: cards.slice(0, 100) });
                }}
                disabled={bulkValidate.isPending || !bulkInput.trim()}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
              >
                {bulkValidate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Validate All
              </Button>

              {bulkValidate.data && (
                <div className="space-y-2">
                  <div className="flex gap-3 text-sm">
                    <span className="text-green-400">✓ {bulkValidate.data.validCount} valid</span>
                    <span className="text-red-400">✗ {bulkValidate.data.invalidCount} invalid</span>
                    <span className="text-zinc-500">{bulkValidate.data.total} total</span>
                  </div>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {bulkValidate.data.results.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded text-sm ${r.valid ? "bg-green-500/5 border border-green-500/20" : "bg-red-500/5 border border-red-500/20"}`}>
                        {r.valid ? <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" /> : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        <span className="font-mono text-zinc-300">{r.card}</span>
                        {r.network && <Badge variant="outline" className="text-xs py-0">{r.network}</Badge>}
                        {r.error && <span className="text-red-400 text-xs">{r.error}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reverse Search ── */}
        <TabsContent value="reverse" className="mt-4 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reverse BIN Search</CardTitle>
              <CardDescription>Search by bank name or card product name to find BIN numbers. Select a country first to narrow results.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Country picker */}
              <div className="space-y-1">
                <Label className="text-zinc-300">1. Select Country (optional but recommended)</Label>
                <CountryPicker value={reverseCountry} onChange={setReverseCountry} />
              </div>

              {/* Search */}
              <div className="space-y-1">
                <Label className="text-zinc-300">2. Enter bank or card name</Label>
                <div className="flex gap-2">
                  <Input
                    value={reverseQuery}
                    onChange={e => setReverseQuery(e.target.value)}
                    placeholder={reverseCountry ? "e.g. ANZ Business Platinum" : "e.g. Chase Sapphire, ANZ Business Platinum"}
                    className="bg-zinc-800 border-zinc-700"
                    onKeyDown={e => e.key === "Enter" && reverseQuery.length >= 2 && reverseSearch.mutate({ query: reverseQuery, country: reverseCountry || undefined, network: reverseNetwork || undefined })}
                  />
                  <Button
                    onClick={() => reverseSearch.mutate({ query: reverseQuery, country: reverseCountry || undefined, network: reverseNetwork || undefined })}
                    disabled={reverseSearch.isPending || reverseQuery.length < 2}
                    className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                  >
                    {reverseSearch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {reverseSearch.data && (
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">{reverseSearch.data.message}</div>
                  {reverseSearch.data.results.length > 0 && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {reverseSearch.data.results.map((r, i) => (
                        <div key={i} className="p-3 rounded-lg bg-zinc-800 border border-zinc-700 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-yellow-300 text-lg">{r.bin}</span>
                            {r.network && <NetworkBadge name={r.network} />}
                            {r.type && <Badge variant="outline" className="capitalize text-xs">{r.type}</Badge>}
                            {r.prepaid && <Badge variant="outline" className="text-orange-300 border-orange-500/30 text-xs">Prepaid</Badge>}
                          </div>
                          <div className="text-sm text-zinc-300 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-zinc-500" />
                            {r.bank}
                          </div>
                          {r.country && (
                            <div className="text-xs text-zinc-500 flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {r.country} {r.countryCode && `(${r.countryCode})`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Bulk BIN Lookup ── */}
        <TabsContent value="bulkbin" className="mt-4 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bulk BIN Lookup</CardTitle>
              <CardDescription>Look up bank, country, and card type for up to 50 BIN numbers at once. 1 credit per lookup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={bulkBinInput}
                onChange={e => setBulkBinInput(e.target.value)}
                placeholder={"411111\n552000\n378282"}
                className="bg-zinc-800 border-zinc-700 font-mono text-sm min-h-[120px]"
              />
              <Button
                onClick={() => {
                  const bins = bulkBinInput.split("\n").map(l => l.trim().replace(/\D/g, "").slice(0, 8)).filter(l => l.length >= 6);
                  if (bins.length === 0) { toast.error("No valid BINs found (6-8 digits each)"); return; }
                  bulkBinLookup.mutate({ bins: bins.slice(0, 50) });
                }}
                disabled={bulkBinLookup.isPending || !bulkBinInput.trim()}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
              >
                {bulkBinLookup.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                Lookup All BINs
              </Button>
              {bulkBinLookup.data && (
                <div className="space-y-2">
                  <div className="text-sm text-zinc-400">{bulkBinLookup.data.count} results</div>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {bulkBinLookup.data.results.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded text-sm bg-zinc-800 border border-zinc-700">
                        <span className="font-mono text-yellow-300 font-bold">{r.bin}</span>
                        {r.network && <NetworkBadge name={r.network} />}
                        <span className="text-zinc-400 text-xs">{r.bank}</span>
                        <span className="text-zinc-500 text-xs ml-auto">{r.country}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Network Identification ── */}
        <TabsContent value="network" className="mt-4 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Card Network Identification</CardTitle>
              <CardDescription>Instantly identify the card network from any prefix. Offline — no API call needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={networkPrefix}
                  onChange={e => setNetworkPrefix(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="Enter card prefix (e.g. 4111, 5500, 3782)"
                  className="bg-zinc-800 border-zinc-700 font-mono"
                  maxLength={8}
                />
                {networkLoading && <Loader2 className="w-5 h-5 animate-spin text-zinc-500 self-center" />}
              </div>
              {networkData?.found && networkData.network && (
                <div className="p-4 rounded-lg bg-zinc-800 border border-zinc-700 space-y-3">
                  <div className="flex items-center gap-3">
                    <NetworkBadge name={networkData.network.name} />
                    <span className="text-sm text-zinc-400">Code: <span className="font-mono text-white">{networkData.network.code}</span></span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-zinc-500">Valid lengths:</span> <span className="font-mono text-white">{networkData.network.lengths.join(", ")}</span></div>
                    <div><span className="text-zinc-500">CVV length:</span> <span className="font-mono text-white">{networkData.network.cvvLength}</span></div>
                    <div><span className="text-zinc-500">Luhn check:</span> <span className={networkData.network.luhnCheck ? "text-green-400" : "text-red-400"}>{networkData.network.luhnCheck ? "Required" : "Not required"}</span></div>
                  </div>
                </div>
              )}
              {networkPrefix.length >= 1 && !networkLoading && !networkData?.found && (
                <p className="text-sm text-zinc-500">No network matched for prefix <span className="font-mono text-zinc-300">{networkPrefix}</span></p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
