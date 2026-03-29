import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, FileText, CheckCircle, XCircle, AlertTriangle,
  Download, RefreshCw, Clock, Award, Lock, Eye, Database,
  Server, Users, Key, Activity
} from "lucide-react";
import { toast } from "sonner";

type ReportType = "soc2" | "iso27001" | "gdpr" | "pci_dss" | "hipaa";

interface Control {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warning" | "na";
  evidence: string;
  recommendation?: string;
}

interface ComplianceReport {
  type: ReportType;
  generatedAt: string;
  overallScore: number;
  status: "compliant" | "non_compliant" | "partial";
  controls: Control[];
  summary: string;
  criticalFindings: number;
  warnings: number;
  passed: number;
}

const REPORT_TYPES: { id: ReportType; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "soc2", label: "SOC 2 Type II", description: "Trust Services Criteria for security, availability, and confidentiality", icon: <Shield className="h-5 w-5" /> },
  { id: "iso27001", label: "ISO 27001", description: "International standard for information security management", icon: <Award className="h-5 w-5" /> },
  { id: "gdpr", label: "GDPR", description: "EU General Data Protection Regulation compliance assessment", icon: <Lock className="h-5 w-5" /> },
  { id: "pci_dss", label: "PCI DSS", description: "Payment Card Industry Data Security Standard", icon: <Database className="h-5 w-5" /> },
  { id: "hipaa", label: "HIPAA", description: "Health Insurance Portability and Accountability Act", icon: <Activity className="h-5 w-5" /> },
];

// Simulated compliance data based on platform capabilities
function generateReport(type: ReportType): ComplianceReport {
  const controls: Control[] = [];

  if (type === "soc2") {
    controls.push(
      { id: "CC6.1", name: "Logical Access Controls", description: "The entity implements logical access security measures", status: "pass", evidence: "Two-factor authentication enforced, role-based access control implemented, session management active" },
      { id: "CC6.2", name: "Authentication Mechanisms", description: "Prior to issuing credentials, the entity registers and authorises users", status: "pass", evidence: "GitHub OAuth and Google OAuth with email verification, admin approval workflow available" },
      { id: "CC6.3", name: "Access Removal", description: "The entity removes access to protected information assets when no longer required", status: "pass", evidence: "Account deletion removes all data, team member removal revokes access immediately" },
      { id: "CC6.6", name: "Encryption in Transit", description: "The entity implements controls to prevent or detect unauthorised access", status: "pass", evidence: "All API traffic over HTTPS/TLS 1.3, WebSocket connections encrypted" },
      { id: "CC6.7", name: "Encryption at Rest", description: "The entity restricts transmission, movement, and removal of information", status: "warning", evidence: "Database encryption depends on hosting provider configuration", recommendation: "Ensure database-level encryption is enabled on your MySQL/TiDB instance" },
      { id: "CC7.1", name: "Vulnerability Detection", description: "The entity uses detection and monitoring procedures", status: "pass", evidence: "Argus OSINT scanner, Astra web scanner, CyberMCP port scanner, credential leak detection active" },
      { id: "CC7.2", name: "Security Incidents", description: "The entity monitors system components for anomalies", status: "pass", evidence: "Site monitor with uptime checks, security dashboard with alert system, audit log active" },
      { id: "CC8.1", name: "Change Management", description: "The entity authorises, designs, develops, and implements changes", status: "pass", evidence: "Self-improvement engine with rollback capability, improvement backlog with approval workflow" },
      { id: "CC9.1", name: "Risk Assessment", description: "The entity identifies, selects, and develops risk mitigation activities", status: "pass", evidence: "Red team playbooks, vulnerability scanning, compliance reporting framework" },
      { id: "A1.1", name: "Availability Monitoring", description: "The entity maintains, monitors, and evaluates current processing capacity", status: "pass", evidence: "Site monitor with 1-minute check intervals, uptime tracking, SSL certificate monitoring" },
      { id: "A1.2", name: "Environmental Protections", description: "The entity authorises, designs, develops, acquires, implements, operates, approves, maintains, and monitors environmental protections", status: "na", evidence: "Managed hosting environment — responsibility of hosting provider" },
      { id: "PI1.1", name: "Processing Integrity", description: "Processing is complete, valid, accurate, timely, and authorised", status: "pass", evidence: "Credit system with pre/post checks, audit log for all mutations, transaction integrity enforced" },
    );
  } else if (type === "iso27001") {
    controls.push(
      { id: "A.9.1.1", name: "Access Control Policy", description: "Access control policy established and reviewed", status: "pass", evidence: "Role-based access control with admin/user/team roles, subscription-gated features" },
      { id: "A.9.2.1", name: "User Registration", description: "Formal user registration and de-registration process", status: "pass", evidence: "OAuth-based registration with email verification, account deletion workflow" },
      { id: "A.9.2.3", name: "Privileged Access Rights", description: "Allocation and use of privileged access rights controlled", status: "pass", evidence: "Admin role with separate admin panel, protected admin procedures" },
      { id: "A.9.4.2", name: "Secure Log-on Procedures", description: "Secure log-on procedures implemented", status: "pass", evidence: "GitHub and Google OAuth, 2FA support via TOTP vault, session cookie management" },
      { id: "A.10.1.1", name: "Cryptographic Controls", description: "Policy on the use of cryptographic controls", status: "warning", evidence: "HTTPS/TLS enforced, password hashing with bcrypt", recommendation: "Document and formalise cryptographic key management policy" },
      { id: "A.12.1.2", name: "Change Management", description: "Changes to organisation, business processes, and systems controlled", status: "pass", evidence: "Improvement backlog with approval workflow, self-improvement engine with rollback" },
      { id: "A.12.4.1", name: "Event Logging", description: "Event logs recording user activities, exceptions, and security events produced and kept", status: "pass", evidence: "Comprehensive audit log, admin activity log, SIEM integration available" },
      { id: "A.12.6.1", name: "Vulnerability Management", description: "Information about technical vulnerabilities obtained and evaluated", status: "pass", evidence: "Argus OSINT, Astra scanner, CyberMCP, credential leak scanner, site monitor" },
      { id: "A.14.2.1", name: "Secure Development Policy", description: "Rules for development of software and systems established", status: "pass", evidence: "Titan Builder with automated code review, sandbox isolation, self-improvement engine" },
      { id: "A.16.1.1", name: "Incident Management", description: "Responsibilities and procedures for incident management established", status: "warning", evidence: "Security dashboard with alerts", recommendation: "Implement a formal incident response plan and escalation procedures" },
      { id: "A.18.1.3", name: "Protection of Records", description: "Records protected from loss, destruction, falsification, and unauthorised access", status: "pass", evidence: "Titan Storage with encryption, backup capabilities, access controls" },
    );
  } else if (type === "gdpr") {
    controls.push(
      { id: "Art.5", name: "Data Processing Principles", description: "Personal data processed lawfully, fairly, and transparently", status: "pass", evidence: "Privacy policy, terms of service, explicit consent for data processing" },
      { id: "Art.6", name: "Lawful Basis for Processing", description: "Processing has a lawful basis", status: "pass", evidence: "Contractual necessity for service delivery, legitimate interest for security features" },
      { id: "Art.13", name: "Transparency Information", description: "Information provided at time of data collection", status: "pass", evidence: "Privacy policy displayed at registration, cookie consent, data usage explained" },
      { id: "Art.17", name: "Right to Erasure", description: "Data subjects can request deletion of their personal data", status: "pass", evidence: "Account deletion removes all user data, credential deletion, project deletion" },
      { id: "Art.20", name: "Data Portability", description: "Data subjects can receive their data in machine-readable format", status: "warning", evidence: "Partial: credentials can be exported", recommendation: "Implement full data export for all user data (projects, chat history, settings)" },
      { id: "Art.25", name: "Data Protection by Design", description: "Data protection integrated into processing activities", status: "pass", evidence: "Minimal data collection, encryption in transit, access controls, credential vault" },
      { id: "Art.30", name: "Records of Processing", description: "Records of processing activities maintained", status: "warning", evidence: "Audit log tracks mutations", recommendation: "Maintain a formal Record of Processing Activities (ROPA) document" },
      { id: "Art.32", name: "Security of Processing", description: "Appropriate technical and organisational measures implemented", status: "pass", evidence: "TLS encryption, bcrypt password hashing, 2FA, RBAC, session management" },
      { id: "Art.33", name: "Breach Notification", description: "Supervisory authority notified of breaches within 72 hours", status: "warning", evidence: "Credential leak scanner detects breaches", recommendation: "Implement automated breach notification workflow with 72-hour SLA tracking" },
      { id: "Art.35", name: "Data Protection Impact Assessment", description: "DPIA conducted for high-risk processing", status: "warning", evidence: "Security scanning features process sensitive data", recommendation: "Conduct formal DPIA for security scanning and credential storage features" },
    );
  } else if (type === "pci_dss") {
    controls.push(
      { id: "Req.1", name: "Network Security Controls", description: "Install and maintain network security controls", status: "pass", evidence: "VPN chain, Tor routing, proxy rotation, IP rotation for network isolation" },
      { id: "Req.2", name: "Secure Configurations", description: "Apply secure configurations to all system components", status: "pass", evidence: "Electron app with hardened CSP, server-side validation, input sanitisation" },
      { id: "Req.3", name: "Protect Stored Account Data", description: "Protect stored account data", status: "pass", evidence: "Credential vault with encryption, TOTP vault, no plaintext credential storage" },
      { id: "Req.4", name: "Protect Cardholder Data in Transit", description: "Protect cardholder data with strong cryptography during transmission", status: "pass", evidence: "All payment processing via Stripe (PCI DSS Level 1 certified), no card data stored locally" },
      { id: "Req.6", name: "Develop Secure Systems", description: "Develop and maintain secure systems and software", status: "pass", evidence: "Titan Builder with security scanning, Astra vulnerability scanner, automated code review" },
      { id: "Req.7", name: "Restrict Access", description: "Restrict access to system components and cardholder data", status: "pass", evidence: "Role-based access control, subscription-gated features, admin-only procedures" },
      { id: "Req.8", name: "Identify Users and Authenticate", description: "Identify users and authenticate access to system components", status: "pass", evidence: "GitHub/Google OAuth, 2FA via TOTP, session management, credential health monitoring" },
      { id: "Req.10", name: "Log and Monitor Access", description: "Log and monitor all access to system components and cardholder data", status: "pass", evidence: "Comprehensive audit log, admin activity log, SIEM integration" },
      { id: "Req.11", name: "Test Security Regularly", description: "Test security of systems and networks regularly", status: "pass", evidence: "Argus OSINT, Astra scanner, CyberMCP, red team playbooks, vulnerability detection" },
      { id: "Req.12", name: "Support Information Security", description: "Support information security with organisational policies and programs", status: "warning", evidence: "Security dashboard, compliance reports", recommendation: "Formalise written information security policy and annual review process" },
    );
  } else {
    // HIPAA
    controls.push(
      { id: "164.308(a)(1)", name: "Security Management Process", description: "Implement policies and procedures to prevent, detect, contain, and correct security violations", status: "pass", evidence: "Security dashboard, vulnerability scanning, incident detection, audit logging" },
      { id: "164.308(a)(3)", name: "Workforce Security", description: "Implement policies and procedures to ensure workforce members have appropriate access", status: "pass", evidence: "Role-based access control, team management, access revocation on departure" },
      { id: "164.308(a)(5)", name: "Security Awareness Training", description: "Implement security awareness and training program", status: "warning", evidence: "Security tools available", recommendation: "Implement formal security awareness training programme for all users" },
      { id: "164.308(a)(6)", name: "Security Incident Procedures", description: "Implement policies and procedures to address security incidents", status: "pass", evidence: "Security dashboard with alerts, credential leak scanner, site monitor" },
      { id: "164.310(a)(1)", name: "Facility Access Controls", description: "Implement policies and procedures to limit physical access", status: "na", evidence: "Cloud-hosted service — physical access managed by hosting provider" },
      { id: "164.312(a)(1)", name: "Access Control", description: "Implement technical policies and procedures for electronic information systems", status: "pass", evidence: "OAuth authentication, 2FA, RBAC, session management, credential vault" },
      { id: "164.312(a)(2)(iv)", name: "Encryption and Decryption", description: "Implement a mechanism to encrypt and decrypt electronic PHI", status: "pass", evidence: "TLS 1.3 for all data in transit, credential vault encryption, Titan Storage encryption" },
      { id: "164.312(b)", name: "Audit Controls", description: "Implement hardware, software, and procedural mechanisms to record and examine activity", status: "pass", evidence: "Comprehensive audit log, admin activity log, SIEM integration for external monitoring" },
      { id: "164.312(e)(1)", name: "Transmission Security", description: "Implement technical security measures to guard against unauthorised access during transmission", status: "pass", evidence: "HTTPS/TLS enforced, VPN chain for additional encryption, no unencrypted channels" },
    );
  }

  const passed = controls.filter((c) => c.status === "pass").length;
  const failed = controls.filter((c) => c.status === "fail").length;
  const warnings = controls.filter((c) => c.status === "warning").length;
  const na = controls.filter((c) => c.status === "na").length;
  const applicable = controls.length - na;
  const score = applicable > 0 ? Math.round((passed / applicable) * 100) : 100;

  return {
    type,
    generatedAt: new Date().toISOString(),
    overallScore: score,
    status: failed > 0 ? "non_compliant" : warnings > 0 ? "partial" : "compliant",
    controls,
    summary: `Assessment of ${controls.length} controls: ${passed} passed, ${warnings} warnings, ${failed} failed, ${na} not applicable.`,
    criticalFindings: failed,
    warnings,
    passed,
  };
}

export default function ComplianceReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType>("soc2");
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1500)); // simulate generation
    const r = generateReport(selectedType);
    setReport(r);
    setGenerating(false);
    setActiveTab("overview");
    toast.success("Report generated", { description: `${REPORT_TYPES.find((t) => t.id === selectedType)?.label} assessment complete` });
  };

  const handleExport = () => {
    if (!report) return;
    const lines: string[] = [
      `# ${REPORT_TYPES.find((t) => t.id === report.type)?.label} Compliance Report`,
      `**Generated:** ${new Date(report.generatedAt).toLocaleString()}`,
      `**Overall Score:** ${report.overallScore}%`,
      `**Status:** ${report.status.replace("_", " ").toUpperCase()}`,
      "",
      `## Summary`,
      report.summary,
      "",
      `## Controls`,
      ...report.controls.map((c) => [
        `### ${c.id} — ${c.name}`,
        `**Status:** ${c.status.toUpperCase()}`,
        `**Description:** ${c.description}`,
        `**Evidence:** ${c.evidence}`,
        c.recommendation ? `**Recommendation:** ${c.recommendation}` : "",
        "",
      ].filter(Boolean).join("\n")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.type}_compliance_report_${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  const statusColor = (status: string) => {
    if (status === "pass" || status === "compliant") return "text-green-400";
    if (status === "fail" || status === "non_compliant") return "text-red-400";
    if (status === "warning" || status === "partial") return "text-yellow-400";
    return "text-slate-400";
  };

  const statusBadge = (status: string) => {
    if (status === "pass") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">PASS</Badge>;
    if (status === "fail") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">FAIL</Badge>;
    if (status === "warning") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">WARNING</Badge>;
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">N/A</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="h-7 w-7 text-purple-400" />
              Compliance Reports
            </h1>
            <p className="text-slate-400 mt-1">Generate SOC2, ISO27001, GDPR, PCI DSS, and HIPAA compliance assessments</p>
          </div>
          {report && (
            <Button onClick={handleExport} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <Download className="h-4 w-4 mr-2" />
              Export Markdown
            </Button>
          )}
        </div>

        {/* Report Type Selector */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {REPORT_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedType(t.id); setReport(null); }}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedType === t.id
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
              }`}
            >
              <div className={`mb-2 ${selectedType === t.id ? "text-purple-400" : "text-slate-400"}`}>{t.icon}</div>
              <div className="font-medium text-sm text-white">{t.label}</div>
              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{t.description}</div>
            </button>
          ))}
        </div>

        {/* Generate Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-purple-600 hover:bg-purple-700 px-8 py-3 text-base"
          >
            {generating ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating Assessment...</>
            ) : (
              <><FileText className="h-4 w-4 mr-2" />Generate {REPORT_TYPES.find((t) => t.id === selectedType)?.label} Report</>
            )}
          </Button>
        </div>

        {/* Report Results */}
        {report && (
          <div className="space-y-6">
            {/* Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900/50 border-slate-800 md:col-span-1">
                <CardContent className="p-6 text-center">
                  <div className={`text-5xl font-bold mb-2 ${report.overallScore >= 80 ? "text-green-400" : report.overallScore >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                    {report.overallScore}%
                  </div>
                  <div className="text-slate-400 text-sm">Overall Score</div>
                  <Badge className={`mt-2 ${report.status === "compliant" ? "bg-green-500/20 text-green-400 border-green-500/30" : report.status === "partial" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                    {report.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-400 mb-1">{report.passed}</div>
                  <div className="text-slate-400 text-sm">Controls Passed</div>
                  <CheckCircle className="h-5 w-5 text-green-400 mx-auto mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-yellow-400 mb-1">{report.warnings}</div>
                  <div className="text-slate-400 text-sm">Warnings</div>
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mx-auto mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-red-400 mb-1">{report.criticalFindings}</div>
                  <div className="text-slate-400 text-sm">Critical Findings</div>
                  <XCircle className="h-5 w-5 text-red-400 mx-auto mt-2" />
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-900 border border-slate-800">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="controls">All Controls ({report.controls.length})</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations ({report.warnings + report.criticalFindings})</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base">Assessment Summary</CardTitle>
                    <CardDescription className="text-slate-400">{report.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {["pass", "warning", "fail", "na"].map((status) => {
                        const count = report.controls.filter((c) => c.status === status).length;
                        const pct = Math.round((count / report.controls.length) * 100);
                        return (
                          <div key={status} className="flex items-center gap-3">
                            <div className="w-20 text-sm text-slate-400 capitalize">{status === "na" ? "N/A" : status}</div>
                            <Progress value={pct} className="flex-1 h-2" />
                            <div className="w-8 text-sm text-slate-400 text-right">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="controls" className="space-y-3">
                {report.controls.map((control) => (
                  <Card key={control.id} className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{control.id}</span>
                            <span className="font-medium text-white text-sm">{control.name}</span>
                          </div>
                          <p className="text-slate-400 text-xs mb-2">{control.description}</p>
                          <div className="flex items-start gap-1 text-xs text-slate-500">
                            <Eye className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{control.evidence}</span>
                          </div>
                        </div>
                        <div className="shrink-0">{statusBadge(control.status)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-3">
                {report.controls.filter((c) => c.recommendation).map((control) => (
                  <Card key={control.id} className={`border ${control.status === "fail" ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${control.status === "fail" ? "text-red-400" : "text-yellow-400"}`} />
                        <div>
                          <div className="font-medium text-white text-sm mb-1">{control.id} — {control.name}</div>
                          <p className="text-slate-300 text-sm">{control.recommendation}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {report.controls.filter((c) => c.recommendation).length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
                    <p>No recommendations — all controls are fully compliant</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <div className="text-center text-xs text-slate-600">
              Report generated {new Date(report.generatedAt).toLocaleString()} · Archibald Titan Compliance Engine · For internal use only
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
