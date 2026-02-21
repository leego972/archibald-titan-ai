import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, ArrowLeft, CheckCircle, Clock, XCircle } from "lucide-react";
import { useLocation, useSearch } from "wouter";

export default function GrantApplicationsPage() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const preselectedCompanyId = params.get("companyId");
  const { data: companies } = trpc.companies.list.useQuery();
  const [selectedCompanyId, setSelectedCompanyId] = useState(preselectedCompanyId || "");
  const { data: applications, isLoading } = trpc.grantApplications.list.useQuery(
    { companyId: parseInt(selectedCompanyId) },
    { enabled: !!selectedCompanyId }
  );

  const statusIcon = (status: string) => {
    if (status === "submitted" || status === "awarded") return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/companies")} className="gap-2 text-zinc-400"><ArrowLeft className="w-4 h-4" /> Back to Companies</Button>
      <div>
        <h1 className="text-2xl font-bold text-white">Grant Applications</h1>
        <p className="text-zinc-400 mt-1">Track your AI-generated grant applications</p>
      </div>

      <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
        <SelectTrigger className="max-w-sm"><SelectValue placeholder="Select company..." /></SelectTrigger>
        <SelectContent>{companies?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
      </Select>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : !selectedCompanyId ? (
        <div className="text-center py-20"><FileText className="w-12 h-12 mx-auto text-zinc-600 mb-4" /><h3 className="text-lg font-medium text-zinc-400">Select a company to view applications</h3></div>
      ) : !applications || applications.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">No applications yet</h3>
          <p className="text-zinc-500 mt-1">Go to a grant detail page to generate an application</p>
          <Button variant="outline" onClick={() => navigate("/grants")} className="mt-4">Browse Grants</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcon(app.status)}
                    <CardTitle className="text-base text-white">Application #{app.id}</CardTitle>
                  </div>
                  <div className="flex gap-2 items-center">
                    {app.successProbability != null && (
                      <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">Success: {app.successProbability}%</Badge>
                    )}
                    {app.qualityScore != null && (
                      <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30">Quality: {app.qualityScore}/100</Badge>
                    )}
                    <Badge variant="secondary">{app.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {app.technicalAbstract && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Technical Abstract</p>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{app.technicalAbstract}</p>
                  </div>
                )}
                {app.projectDescription && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Project Description</p>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{app.projectDescription}</p>
                  </div>
                )}
                {app.specificAims && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Specific Aims</p>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{app.specificAims}</p>
                  </div>
                )}
                {app.budget && (
                  <div>
                    <p className="text-xs text-zinc-500 font-medium mb-1">Budget</p>
                    <p className="text-zinc-300 text-sm whitespace-pre-wrap max-h-24 overflow-y-auto">{app.budget}</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-zinc-600">
                  {app.expectedValue != null && <span>Expected Value: ${app.expectedValue.toLocaleString()}</span>}
                  <span>Created: {new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
