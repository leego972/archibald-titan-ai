import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, DollarSign, Building2, Globe, Target, ExternalLink, Loader2, FileText } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function GrantDetailPage() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const grantId = parseInt(params.id || "0");
  const { data: grant, isLoading } = trpc.grants.get.useQuery({ id: grantId });
  const { data: companies } = trpc.companies.list.useQuery(undefined, { enabled: isAuthenticated });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const applyMutation = trpc.grantApplications.generate.useMutation({
    onSuccess: () => { toast.success("Grant application generated!"); navigate("/grant-applications"); },
    onError: (err) => toast.error(err.message),
  });
  const formatAmount = (amount: number | null) => !amount ? "N/A" : `$${amount.toLocaleString()}`;

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  if (!grant) return <div className="p-6 text-center"><p className="text-zinc-400">Grant not found</p><Button variant="ghost" onClick={() => navigate("/grants")} className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/grants")} className="gap-2 text-zinc-400"><ArrowLeft className="w-4 h-4" /> Back to Grants</Button>
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{grant.region}</Badge>
          <Badge variant="outline">{grant.country}</Badge>
          <Badge className={grant.status === "open" ? "bg-green-600/20 text-green-400 border-green-600/30" : ""}>{grant.status}</Badge>
          {grant.competitiveness && <Badge variant="secondary">{grant.competitiveness} Competition</Badge>}
        </div>
        <h1 className="text-3xl font-bold text-white">{grant.title}</h1>
        <p className="text-zinc-400 flex items-center gap-2"><Building2 className="w-4 h-4" />{grant.agency} — {grant.programName}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="p-4"><div className="flex items-center gap-2 text-zinc-500 mb-1"><DollarSign className="w-4 h-4" /><span className="text-xs">Funding Range</span></div><p className="text-lg font-bold text-green-400">{formatAmount(grant.minAmount)} — {formatAmount(grant.maxAmount)}</p></CardContent></Card>
        <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="p-4"><div className="flex items-center gap-2 text-zinc-500 mb-1"><Globe className="w-4 h-4" /><span className="text-xs">Region</span></div><p className="text-lg font-bold text-blue-400">{grant.country}</p></CardContent></Card>
        <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="p-4"><div className="flex items-center gap-2 text-zinc-500 mb-1"><Target className="w-4 h-4" /><span className="text-xs">Phase</span></div><p className="text-lg font-bold text-amber-400">{grant.phase || "N/A"}</p></CardContent></Card>
      </div>
      <Card className="bg-zinc-900/50 border-zinc-800"><CardHeader><CardTitle className="text-white">Description</CardTitle></CardHeader><CardContent><p className="text-zinc-300 leading-relaxed">{grant.description}</p></CardContent></Card>
      {grant.focusAreas && <Card className="bg-zinc-900/50 border-zinc-800"><CardHeader><CardTitle className="text-white">Focus Areas</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{grant.focusAreas.split(",").map((area, i) => <Badge key={i} variant="secondary" className="bg-zinc-800 text-zinc-300">{area.trim()}</Badge>)}</div></CardContent></Card>}
      {grant.eligibilityCriteria && <Card className="bg-zinc-900/50 border-zinc-800"><CardHeader><CardTitle className="text-white">Eligibility Criteria</CardTitle></CardHeader><CardContent><p className="text-zinc-300">{grant.eligibilityCriteria}</p></CardContent></Card>}
      {grant.url && <a href={grant.url} target="_blank" rel="noopener noreferrer"><Button variant="outline" className="gap-2"><ExternalLink className="w-4 h-4" /> Visit Grant Website</Button></a>}
      {isAuthenticated && (
        <Card className="bg-blue-950/30 border-blue-800/50">
          <CardHeader><CardTitle className="text-blue-400 flex items-center gap-2"><FileText className="w-5 h-5" /> Generate AI Application</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-zinc-400 text-sm">Select a company profile and our AI will generate a tailored grant application.</p>
            {companies && companies.length > 0 ? (
              <div className="flex gap-3">
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}><SelectTrigger className="flex-1"><SelectValue placeholder="Select company..." /></SelectTrigger><SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent></Select>
                <Button onClick={() => { if (!selectedCompanyId) return toast.error("Select a company first"); applyMutation.mutate({ companyId: parseInt(selectedCompanyId), grantOpportunityId: grantId }); }} disabled={applyMutation.isPending || !selectedCompanyId} className="gap-2">{applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Generate</Button>
              </div>
            ) : (
              <div><p className="text-zinc-500 text-sm mb-2">You need a company profile first.</p><Button variant="outline" onClick={() => navigate("/companies")} className="gap-2"><Building2 className="w-4 h-4" /> Create Company Profile</Button></div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
