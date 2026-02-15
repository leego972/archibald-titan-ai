import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, Plus, Loader2, Users, Target } from "lucide-react";
import { toast } from "sonner";

export default function CrowdfundingPage() {
  const utils = trpc.useUtils();
  const { data: companies } = trpc.companies.list.useQuery();
  const { data: campaigns, isLoading } = trpc.crowdfunding.list.useQuery();
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [form, setForm] = useState({ title: "", description: "", goalAmount: "", companyId: "", category: "technology", startDate: today, endDate: defaultEnd });

  const createMutation = trpc.crowdfunding.create.useMutation({
    onSuccess: () => { toast.success("Campaign created!"); setOpen(false); utils.crowdfunding.list.invalidate(); },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const progressPercent = (raised: number, goal: number) => Math.min(100, Math.round((raised / goal) * 100));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Crowdfund My Project</h1>
          <p className="text-zinc-400 mt-1">Create and manage crowdfunding campaigns</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="My Project" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Goal ($) *</Label><Input type="number" value={form.goalAmount} onChange={e => setForm(f => ({ ...f, goalAmount: e.target.value }))} /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="health">Health</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
                <div><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
              </div>
              {companies && companies.length > 0 && (
                <div><Label>Company (optional)</Label>
                  <Select value={form.companyId} onValueChange={v => setForm(f => ({ ...f, companyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Link to company..." /></SelectTrigger>
                    <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full" onClick={() => {
                if (!form.title || !form.goalAmount || !form.startDate || !form.endDate) return toast.error("Title, goal, and dates required");
                createMutation.mutate({
                  title: form.title,
                  description: form.description || undefined,
                  goalAmount: parseInt(form.goalAmount),
                  startDate: form.startDate,
                  endDate: form.endDate,
                  companyId: form.companyId ? parseInt(form.companyId) : undefined,
                  category: form.category,
                });
              }} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />} Launch
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : !campaigns || campaigns.length === 0 ? (
        <div className="text-center py-20">
          <Rocket className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No campaigns yet</h3>
          <p className="text-zinc-500 mt-1">Create your first crowdfunding campaign</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className={c.status === "active" ? "bg-green-600/20 text-green-400" : ""}>{c.status}</Badge>
                </div>
                <CardTitle className="text-lg text-white">{c.title}</CardTitle>
                {c.description && <CardDescription>{c.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-zinc-400">Raised</span><span className="text-white font-medium">${(c.currentAmount || 0).toLocaleString()} / ${c.goalAmount.toLocaleString()}</span></div>
                  <div className="w-full bg-zinc-800 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${progressPercent(c.currentAmount || 0, c.goalAmount)}%` }} /></div>
                </div>
                <div className="flex gap-4 text-sm text-zinc-400">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.backerCount || 0} backers</span>
                  {c.category && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {c.category}</span>}
                </div>
                <div className="text-xs text-zinc-600">
                  {c.startDate && <span>Starts: {new Date(c.startDate).toLocaleDateString()}</span>}
                  {c.endDate && <span className="ml-3">Ends: {new Date(c.endDate).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
