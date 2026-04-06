import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, Plus, MapPin, Users, DollarSign, Loader2, Trash2, Sparkles, Pencil } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Company = {
  id: number;
  name: string;
  industry?: string | null;
  technologyArea?: string | null;
  employeeCount?: number | null;
  annualRevenue?: number | null;
  foundedYear?: number | null;
  location?: string | null;
};

type EditForm = {
  name: string;
  industry: string;
  technologyArea: string;
  employeeCount: string;
  annualRevenue: string;
  foundedYear: string;
  location: string;
};

const emptyForm: EditForm = {
  name: "", industry: "", technologyArea: "",
  employeeCount: "", annualRevenue: "", foundedYear: "", location: "",
};

export default function CompaniesPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: companies, isLoading } = trpc.companies.list.useQuery();

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<EditForm>(emptyForm);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      toast.success("Company created!");
      setCreateOpen(false);
      setCreateForm(emptyForm);
      utils.companies.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.companies.update.useMutation({
    onSuccess: () => {
      toast.success("Company updated!");
      setEditOpen(false);
      setEditingId(null);
      utils.companies.list.invalidate();
    },
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

  function openEdit(company: Company) {
    setEditingId(company.id);
    setEditForm({
      name: company.name ?? "",
      industry: company.industry ?? "",
      technologyArea: company.technologyArea ?? "",
      employeeCount: company.employeeCount != null ? String(company.employeeCount) : "",
      annualRevenue: company.annualRevenue != null ? String(company.annualRevenue) : "",
      foundedYear: company.foundedYear != null ? String(company.foundedYear) : "",
      location: company.location ?? "",
    });
    setEditOpen(true);
  }

  function handleUpdate() {
    if (!editingId) return;
    if (!editForm.name) return toast.error("Company name is required");
    updateMutation.mutate({
      id: editingId,
      name: editForm.name,
      industry: editForm.industry || undefined,
      technologyArea: editForm.technologyArea || undefined,
      employeeCount: editForm.employeeCount ? parseInt(editForm.employeeCount) : undefined,
      annualRevenue: editForm.annualRevenue ? parseInt(editForm.annualRevenue) : undefined,
      foundedYear: editForm.foundedYear ? parseInt(editForm.foundedYear) : undefined,
      location: editForm.location || undefined,
    });
  }

  function handleCreate() {
    if (!createForm.name) return toast.error("Name is required");
    createMutation.mutate({
      name: createForm.name,
      industry: createForm.industry || undefined,
      technologyArea: createForm.technologyArea || undefined,
      employeeCount: createForm.employeeCount ? parseInt(createForm.employeeCount) : undefined,
      annualRevenue: createForm.annualRevenue ? parseInt(createForm.annualRevenue) : undefined,
      foundedYear: createForm.foundedYear ? parseInt(createForm.foundedYear) : undefined,
      location: createForm.location || undefined,
    });
  }

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Company Profiles</h1>
          <p className="text-zinc-400 mt-1">Manage your companies for grant matching and applications</p>
        </div>

        {/* Add Company Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Add Company</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Company Profile</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Company Name *</Label><Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Industry</Label><Input value={createForm.industry} onChange={e => setCreateForm(f => ({ ...f, industry: e.target.value }))} placeholder="Technology" /></div>
                <div><Label>Technology Area</Label><Input value={createForm.technologyArea} onChange={e => setCreateForm(f => ({ ...f, technologyArea: e.target.value }))} placeholder="AI/ML" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Employees</Label><Input type="number" value={createForm.employeeCount} onChange={e => setCreateForm(f => ({ ...f, employeeCount: e.target.value }))} placeholder="50" /></div>
                <div><Label>Annual Revenue ($)</Label><Input type="number" value={createForm.annualRevenue} onChange={e => setCreateForm(f => ({ ...f, annualRevenue: e.target.value }))} placeholder="1000000" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Founded Year</Label><Input type="number" value={createForm.foundedYear} onChange={e => setCreateForm(f => ({ ...f, foundedYear: e.target.value }))} placeholder="2020" /></div>
                <div><Label>Location</Label><Input value={createForm.location} onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))} placeholder="San Francisco, CA" /></div>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Company
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Company Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Company Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Company Name *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Industry</Label><Input value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} placeholder="Technology" /></div>
              <div><Label>Technology Area</Label><Input value={editForm.technologyArea} onChange={e => setEditForm(f => ({ ...f, technologyArea: e.target.value }))} placeholder="AI/ML" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Employees</Label><Input type="number" value={editForm.employeeCount} onChange={e => setEditForm(f => ({ ...f, employeeCount: e.target.value }))} placeholder="50" /></div>
              <div><Label>Annual Revenue ($)</Label><Input type="number" value={editForm.annualRevenue} onChange={e => setEditForm(f => ({ ...f, annualRevenue: e.target.value }))} placeholder="1000000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Founded Year</Label><Input type="number" value={editForm.foundedYear} onChange={e => setEditForm(f => ({ ...f, foundedYear: e.target.value }))} placeholder="2020" /></div>
              <div><Label>Location</Label><Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="San Francisco, CA" /></div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save Changes
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zinc-500 hover:text-blue-400"
                      onClick={() => openEdit(company)}
                      title="Edit company"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zinc-500 hover:text-red-400"
                      onClick={() => deleteMutation.mutate({ id: company.id })}
                      title="Delete company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
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
