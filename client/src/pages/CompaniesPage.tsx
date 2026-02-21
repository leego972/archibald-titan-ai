import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, Plus, MapPin, Users, DollarSign, Loader2, Trash2, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CompaniesPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: companies, isLoading } = trpc.companies.list.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", technologyArea: "", employeeCount: "", annualRevenue: "", foundedYear: "", location: "" });

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => { toast.success("Company created!"); setOpen(false); setForm({ name: "", industry: "", technologyArea: "", employeeCount: "", annualRevenue: "", foundedYear: "", location: "" }); utils.companies.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.companies.delete.useMutation({
    onSuccess: () => { toast.success("Company deleted"); utils.companies.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const matchMutation = trpc.grants.match.useMutation({
    onSuccess: (data) => { toast.success(`Found ${data.matchCount} matching grants!`); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Profiles</h1>
          <p className="text-zinc-400 mt-1">Manage your companies for grant matching and applications</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Company</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Company Profile</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Company Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Industry</Label><Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} placeholder="Technology" /></div>
                <div><Label>Technology Area</Label><Input value={form.technologyArea} onChange={e => setForm(f => ({ ...f, technologyArea: e.target.value }))} placeholder="AI/ML" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Employees</Label><Input type="number" value={form.employeeCount} onChange={e => setForm(f => ({ ...f, employeeCount: e.target.value }))} placeholder="50" /></div>
                <div><Label>Annual Revenue ($)</Label><Input type="number" value={form.annualRevenue} onChange={e => setForm(f => ({ ...f, annualRevenue: e.target.value }))} placeholder="1000000" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Founded Year</Label><Input type="number" value={form.foundedYear} onChange={e => setForm(f => ({ ...f, foundedYear: e.target.value }))} placeholder="2020" /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="San Francisco, CA" /></div>
              </div>
              <Button className="w-full" onClick={() => { if (!form.name) return toast.error("Name is required"); createMutation.mutate({ name: form.name, industry: form.industry || undefined, technologyArea: form.technologyArea || undefined, employeeCount: form.employeeCount ? parseInt(form.employeeCount) : undefined, annualRevenue: form.annualRevenue ? parseInt(form.annualRevenue) : undefined, foundedYear: form.foundedYear ? parseInt(form.foundedYear) : undefined, location: form.location || undefined }); }} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Company
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : !companies || companies.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No companies yet</h3>
          <p className="text-zinc-500 mt-1">Create a company profile to start matching with grants</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((company) => (
            <Card key={company.id} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">{company.name}</CardTitle>
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400" onClick={() => deleteMutation.mutate({ id: company.id })}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {company.industry && <Badge variant="secondary"><Building2 className="w-3 h-3 mr-1" />{company.industry}</Badge>}
                  {company.location && <Badge variant="outline"><MapPin className="w-3 h-3 mr-1" />{company.location}</Badge>}
                  {company.employeeCount && <Badge variant="outline"><Users className="w-3 h-3 mr-1" />{company.employeeCount} employees</Badge>}
                  {company.annualRevenue && <Badge variant="outline"><DollarSign className="w-3 h-3 mr-1" />${company.annualRevenue.toLocaleString()}</Badge>}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => matchMutation.mutate({ companyId: company.id })} disabled={matchMutation.isPending}>
                    {matchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI Match Grants
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/business-plans?companyId=${company.id}`)}>
                    <DollarSign className="w-3 h-3" /> Business Plans
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/grant-applications?companyId=${company.id}`)}>
                    Applications
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
