import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, Sparkles, Building2, ArrowLeft } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";

export default function BusinessPlanPage() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const preselectedCompanyId = params.get("companyId");
  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const [selectedCompanyId, setSelectedCompanyId] = useState(preselectedCompanyId || "");
  const { data: plans, isLoading } = trpc.businessPlans.list.useQuery(
    { companyId: parseInt(selectedCompanyId) },
    { enabled: !!selectedCompanyId }
  );

  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState({ projectTitle: "", projectDescription: "", targetMarket: "", competitiveAdvantage: "" });

  const generateMutation = trpc.businessPlans.generate.useMutation({
    onSuccess: () => { toast.success("Business plan generated!"); setGenOpen(false); utils.businessPlans.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/companies")} className="gap-2 text-zinc-400"><ArrowLeft className="w-4 h-4" /> Back to Companies</Button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Business Plans</h1>
          <p className="text-zinc-400 mt-1">AI-generated business plans for grant applications</p>
        </div>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
            <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogTrigger asChild>
            <Button disabled={!selectedCompanyId} className="gap-2"><Sparkles className="w-4 h-4" /> Generate Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Generate Business Plan</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Project Title *</Label><Input value={genForm.projectTitle} onChange={e => setGenForm(f => ({ ...f, projectTitle: e.target.value }))} placeholder="AI-Powered Credential Manager" /></div>
              <div><Label>Project Description *</Label><Textarea value={genForm.projectDescription} onChange={e => setGenForm(f => ({ ...f, projectDescription: e.target.value }))} placeholder="Describe your project..." rows={3} /></div>
              <div><Label>Target Market</Label><Input value={genForm.targetMarket} onChange={e => setGenForm(f => ({ ...f, targetMarket: e.target.value }))} placeholder="Small businesses, enterprises..." /></div>
              <div><Label>Competitive Advantage</Label><Input value={genForm.competitiveAdvantage} onChange={e => setGenForm(f => ({ ...f, competitiveAdvantage: e.target.value }))} placeholder="What makes you unique?" /></div>
              <Button className="w-full" onClick={() => {
                if (!genForm.projectTitle || !genForm.projectDescription) return toast.error("Title and description required");
                generateMutation.mutate({
                  companyId: parseInt(selectedCompanyId),
                  projectTitle: genForm.projectTitle,
                  projectDescription: genForm.projectDescription,
                  targetMarket: genForm.targetMarket || undefined,
                  competitiveAdvantage: genForm.competitiveAdvantage || undefined,
                });
              }} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />} Generate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : !selectedCompanyId ? (
        <div className="text-center py-20">
          <Building2 className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">Select a company to view plans</h3>
        </div>
      ) : !plans || plans.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No business plans yet</h3>
          <p className="text-zinc-500 mt-1">Click "Generate Plan" to create an AI business plan</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">{plan.title}</CardTitle>
                  <Badge variant="secondary">{plan.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.executiveSummary && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Executive Summary</p>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">{plan.executiveSummary}</p>
                  </div>
                )}
                {plan.marketAnalysis && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Market Analysis</p>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{plan.marketAnalysis}</p>
                  </div>
                )}
                {plan.commercializationStrategy && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Commercialization Strategy</p>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{plan.commercializationStrategy}</p>
                  </div>
                )}
                <p className="text-xs text-zinc-600">v{plan.version} | Created {new Date(plan.createdAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
