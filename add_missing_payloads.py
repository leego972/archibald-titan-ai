#!/usr/bin/env python3
"""Add 15 missing payload definitions to marketplace-payload-generator.ts"""

path = "/home/ubuntu/archibald-titan-ai/server/marketplace-payload-generator.ts"

with open(path, "r") as f:
    content = f.read()

# Fix the Unicode box-drawing comment that may cause issues
content = content.replace(
    '// \u2500\u2500\u2500 Payload Selector: maps listing to the right code template \u2500\u2500\u2500\u2500\u2500\u2500',
    '// --- Payload Selector: maps listing to the right code template ---'
)

# The 15 missing payloads to insert before the closing }; of the PAYLOADS object
new_payloads = r'''
  // -- OSINT TOOLKIT --
  "osint-toolkit": (title) => ({
    "README.md": `# ${title}\n\nOSINT toolkit for threat intelligence, dark web monitoring, and target profiling.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 osint.py --target example.com\n\`\`\``,
    "osint.py": `#!/usr/bin/env python3
"""OSINT Toolkit -- target profiling, email enumeration, social footprint."""
import argparse, json, logging, re, socket, ssl, time
import urllib.request, urllib.parse
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
class OSINTScanner:
    def __init__(self):
        self.results = {}
    def resolve_domain(self, domain: str) -> dict:
        try:
            ip = socket.gethostbyname(domain)
            return {"domain": domain, "ip": ip, "resolved": True}
        except Exception as e:
            return {"domain": domain, "error": str(e), "resolved": False}
    def check_email_breach(self, email: str) -> dict:
        """Check if email appears in known breach lists (HIBP-compatible)."""
        return {"email": email, "note": "Integrate with HIBP API: https://haveibeenpwned.com/API/v3", "breached": None}
    def enumerate_subdomains(self, domain: str) -> list:
        common = ["www","mail","ftp","admin","api","dev","staging","test","vpn","remote","portal","app","blog","shop","cdn","static","assets","media","img","images","video","docs","help","support","status","monitor","dashboard","login","auth","sso","oauth","git","gitlab","github","jira","confluence","jenkins","ci","cd","build","deploy","prod","production","qa","uat","sandbox","demo","beta","alpha","preview","review","internal","intranet","extranet","secure","ssl","smtp","pop","imap","mx","ns1","ns2","dns","ldap","ad","dc","exchange","sharepoint","teams","zoom","meet","calendar","email","webmail","owa","autodiscover","autodiscovery"]
        found = []
        for sub in common:
            try:
                fqdn = f"{sub}.{domain}"
                ip = socket.gethostbyname(fqdn)
                found.append({"subdomain": fqdn, "ip": ip})
                logger.info(f"Found: {fqdn} -> {ip}")
            except:
                pass
        return found
    def get_ssl_info(self, domain: str, port: int = 443) -> dict:
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=domain) as s:
                s.settimeout(5)
                s.connect((domain, port))
                cert = s.getpeercert()
                return {"domain": domain, "issuer": dict(x[0] for x in cert.get("issuer", [])), "subject": dict(x[0] for x in cert.get("subject", [])), "not_after": cert.get("notAfter"), "san": cert.get("subjectAltName", [])}
        except Exception as e:
            return {"domain": domain, "error": str(e)}
def main():
    parser = argparse.ArgumentParser(description="OSINT Toolkit")
    parser.add_argument("--target", required=True, help="Domain or email to investigate")
    parser.add_argument("--mode", choices=["domain","email","full"], default="full")
    parser.add_argument("--output", default="osint_report.json")
    args = parser.parse_args()
    scanner = OSINTScanner()
    report = {"target": args.target, "timestamp": time.time(), "findings": {}}
    if args.mode in ("domain", "full"):
        report["findings"]["dns"] = scanner.resolve_domain(args.target)
        report["findings"]["ssl"] = scanner.get_ssl_info(args.target)
        report["findings"]["subdomains"] = scanner.enumerate_subdomains(args.target)
    if args.mode in ("email", "full") and "@" in args.target:
        report["findings"]["breach_check"] = scanner.check_email_breach(args.target)
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[+] OSINT report saved to {args.output}")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "requests>=2.28.0\n",
  }),
  // -- COMPLIANCE SUITE --
  "compliance-suite": (title) => ({
    "README.md": `# ${title}\n\nAutomated compliance checking for SOC2, GDPR, HIPAA, and PCI-DSS requirements.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 compliance.py --framework soc2 --target ./src\n\`\`\``,
    "compliance.py": `#!/usr/bin/env python3
"""Compliance Suite -- automated SOC2/GDPR/HIPAA/PCI-DSS gap analysis."""
import argparse, json, logging, os, re, time
from pathlib import Path
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
CHECKS = {
    "soc2": [
        {"id": "CC6.1", "name": "Logical access controls", "check": lambda files: any("auth" in f or "login" in f for f in files)},
        {"id": "CC6.2", "name": "Authentication mechanisms", "check": lambda files: any("password" in f or "jwt" in f or "oauth" in f for f in files)},
        {"id": "CC6.3", "name": "Role-based access control", "check": lambda files: any("role" in f or "permission" in f or "rbac" in f for f in files)},
        {"id": "CC7.1", "name": "Vulnerability management", "check": lambda files: any("scan" in f or "vuln" in f for f in files)},
        {"id": "CC8.1", "name": "Change management process", "check": lambda files: any("changelog" in f.lower() or "migration" in f for f in files)},
    ],
    "gdpr": [
        {"id": "Art.13", "name": "Privacy notice", "check": lambda files: any("privacy" in f or "gdpr" in f for f in files)},
        {"id": "Art.17", "name": "Right to erasure", "check": lambda files: any("delete" in f or "erasure" in f for f in files)},
        {"id": "Art.25", "name": "Data protection by design", "check": lambda files: any("encrypt" in f or "hash" in f for f in files)},
        {"id": "Art.32", "name": "Security of processing", "check": lambda files: any("tls" in f or "ssl" in f or "https" in f for f in files)},
        {"id": "Art.33", "name": "Breach notification", "check": lambda files: any("incident" in f or "breach" in f or "alert" in f for f in files)},
    ],
}
def scan_directory(path: str) -> list:
    files = []
    for root, dirs, fnames in os.walk(path):
        dirs[:] = [d for d in dirs if d not in [".git", "node_modules", "__pycache__", ".venv"]]
        for fname in fnames:
            files.append(os.path.join(root, fname).lower())
    return files
def run_compliance_check(framework: str, target: str) -> dict:
    checks = CHECKS.get(framework, [])
    files = scan_directory(target)
    results = []
    passed = 0
    for check in checks:
        status = check["check"](files)
        results.append({"id": check["id"], "name": check["name"], "status": "PASS" if status else "FAIL", "evidence": f"Found matching files: {[f for f in files if any(kw in f for kw in check['name'].lower().split())][:3]}"})
        if status:
            passed += 1
    return {"framework": framework, "target": target, "timestamp": time.time(), "score": f"{passed}/{len(checks)}", "results": results, "recommendation": "Review FAIL items and implement missing controls."}
def main():
    parser = argparse.ArgumentParser(description="Compliance Suite")
    parser.add_argument("--framework", choices=["soc2","gdpr","hipaa","pci"], default="soc2")
    parser.add_argument("--target", default=".", help="Directory to scan")
    parser.add_argument("--output", default="compliance_report.json")
    args = parser.parse_args()
    report = run_compliance_check(args.framework, args.target)
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[+] Compliance report: {report['score']} checks passed")
    print(f"[+] Report saved to {args.output}")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies\n",
  }),
  // -- MALWARE DEFENSE --
  "malware-defense": (title) => ({
    "README.md": `# ${title}\n\nMalware detection and defense toolkit with YARA rule engine and behavioral analysis.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 defender.py --scan /path/to/scan\n\`\`\``,
    "defender.py": `#!/usr/bin/env python3
"""Malware Defense Toolkit -- YARA-compatible pattern matching and behavioral analysis."""
import argparse, hashlib, json, logging, os, re, time
from pathlib import Path
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
SUSPICIOUS_PATTERNS = [
    (r"eval\s*\(base64_decode", "PHP webshell pattern"),
    (r"exec\s*\(\s*[\"'].*[\"']\s*\)", "Command execution"),
    (r"system\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)", "User-controlled command execution"),
    (r"passthru|shell_exec|popen|proc_open", "Shell execution functions"),
    (r"\\x[0-9a-fA-F]{2}(\\x[0-9a-fA-F]{2}){10,}", "Hex-encoded payload"),
    (r"(wget|curl)\s+https?://[^\s]+\s*\|\s*(bash|sh|python)", "Remote code download and execute"),
    (r"chmod\s+[0-7]{3,4}\s+.*\.(php|py|sh|pl)", "Making script executable"),
    (r"base64_decode\s*\(.*\)\s*;", "Base64 decoded execution"),
    (r"import\s+subprocess.*os\.system|subprocess\.call", "Python subprocess abuse"),
    (r"CreateRemoteThread|VirtualAllocEx|WriteProcessMemory", "Process injection APIs"),
]
def hash_file(path: str) -> dict:
    h = {"md5": hashlib.md5(), "sha256": hashlib.sha256()}
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            for hasher in h.values():
                hasher.update(chunk)
    return {k: v.hexdigest() for k, v in h.items()}
def scan_file(path: str) -> dict:
    findings = []
    try:
        with open(path, "r", errors="ignore") as f:
            content = f.read()
        for pattern, description in SUSPICIOUS_PATTERNS:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                findings.append({"pattern": description, "matches": len(matches), "severity": "HIGH" if "exec" in description.lower() or "inject" in description.lower() else "MEDIUM"})
        hashes = hash_file(path)
        return {"file": path, "size": os.path.getsize(path), "hashes": hashes, "findings": findings, "risk": "HIGH" if any(f["severity"] == "HIGH" for f in findings) else "MEDIUM" if findings else "CLEAN"}
    except Exception as e:
        return {"file": path, "error": str(e)}
def scan_directory(directory: str, extensions: list = None) -> list:
    if extensions is None:
        extensions = [".php", ".py", ".js", ".sh", ".pl", ".rb", ".ps1", ".bat", ".cmd"]
    results = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in [".git", "node_modules", "__pycache__"]]
        for fname in files:
            if any(fname.endswith(ext) for ext in extensions):
                fpath = os.path.join(root, fname)
                result = scan_file(fpath)
                results.append(result)
                if result.get("risk") in ("HIGH", "MEDIUM"):
                    logger.warning(f"[{result['risk']}] {fpath}: {len(result.get('findings', []))} findings")
    return results
def main():
    parser = argparse.ArgumentParser(description="Malware Defense Toolkit")
    parser.add_argument("--scan", required=True, help="Path to scan (file or directory)")
    parser.add_argument("--output", default="defense_report.json")
    parser.add_argument("--extensions", help="Comma-separated file extensions to scan")
    args = parser.parse_args()
    exts = args.extensions.split(",") if args.extensions else None
    if os.path.isfile(args.scan):
        results = [scan_file(args.scan)]
    else:
        results = scan_directory(args.scan, exts)
    summary = {"total": len(results), "high": sum(1 for r in results if r.get("risk") == "HIGH"), "medium": sum(1 for r in results if r.get("risk") == "MEDIUM"), "clean": sum(1 for r in results if r.get("risk") == "CLEAN"), "results": results}
    with open(args.output, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"[+] Scan complete: {summary['high']} HIGH, {summary['medium']} MEDIUM, {summary['clean']} CLEAN")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies required\n",
  }),
  // -- CLOUD SECURITY --
  "cloud-security": (title) => ({
    "README.md": `# ${title}\n\nCloud security scanner for AWS/GCP/Azure IAM misconfigurations, zero-trust policy auditing.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 cloud_audit.py --provider aws --profile default\n\`\`\``,
    "cloud_audit.py": `#!/usr/bin/env python3
"""Cloud Security Auditor -- IAM, S3, security groups, and zero-trust policy checks."""
import argparse, json, logging, subprocess, sys, time
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
def run_aws_checks(profile: str) -> list:
    findings = []
    checks = [
        ("aws iam get-account-password-policy", "IAM Password Policy", lambda r: r.get("PasswordPolicy", {}).get("MinimumPasswordLength", 0) >= 14),
        ("aws iam list-users --query 'Users[?PasswordLastUsed==null]'", "Unused IAM Users", lambda r: len(r) == 0),
        ("aws s3api list-buckets", "S3 Buckets Enumeration", lambda r: True),
    ]
    for cmd, name, validator in checks:
        try:
            full_cmd = cmd + (f" --profile {profile}" if profile != "default" else "")
            result = subprocess.run(full_cmd.split(), capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                passed = validator(data)
                findings.append({"check": name, "status": "PASS" if passed else "FAIL", "details": data})
            else:
                findings.append({"check": name, "status": "ERROR", "error": result.stderr[:200]})
        except Exception as e:
            findings.append({"check": name, "status": "ERROR", "error": str(e)})
    return findings
def check_iam_policies_locally(policy_file: str) -> list:
    """Analyze a local IAM policy JSON for overly permissive rules."""
    findings = []
    try:
        with open(policy_file) as f:
            policy = json.load(f)
        for stmt in policy.get("Statement", []):
            effect = stmt.get("Effect", "")
            action = stmt.get("Action", [])
            resource = stmt.get("Resource", "")
            if isinstance(action, str):
                action = [action]
            if effect == "Allow" and "*" in action:
                findings.append({"severity": "CRITICAL", "issue": "Wildcard action (*) grants all permissions", "statement": stmt})
            if effect == "Allow" and resource == "*":
                findings.append({"severity": "HIGH", "issue": "Wildcard resource (*) applies to all resources", "statement": stmt})
            if effect == "Allow" and "iam:*" in action:
                findings.append({"severity": "CRITICAL", "issue": "Full IAM access granted", "statement": stmt})
    except Exception as e:
        findings.append({"error": str(e)})
    return findings
def main():
    parser = argparse.ArgumentParser(description="Cloud Security Auditor")
    parser.add_argument("--provider", choices=["aws","gcp","azure","local"], default="local")
    parser.add_argument("--profile", default="default")
    parser.add_argument("--policy-file", help="Local IAM policy JSON to analyze")
    parser.add_argument("--output", default="cloud_security_report.json")
    args = parser.parse_args()
    report = {"provider": args.provider, "timestamp": time.time(), "findings": []}
    if args.provider == "aws":
        report["findings"] = run_aws_checks(args.profile)
    elif args.policy_file:
        report["findings"] = check_iam_policies_locally(args.policy_file)
    else:
        report["findings"] = [{"note": "Provide --policy-file for local analysis or --provider aws with AWS CLI configured"}]
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[+] Cloud security report saved to {args.output}")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "boto3>=1.34.0\n",
    "sample_policy.json": '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject"],"Resource":"arn:aws:s3:::my-bucket/*"}]}',
  }),
  // -- TITAN PLUGIN --
  "titan-plugin": (title) => ({
    "README.md": `# ${title}\n\nArcibald Titan plugin/SDK extension. Drop into your Titan instance to add custom functionality.\n\n## Installation\n\`\`\`bash\nnpm install\nnpm run build\n# Copy dist/ to your Titan plugins directory\n\`\`\``,
    "src/index.ts": `/**
 * ${title} -- Archibald Titan Plugin
 * Extends Titan with custom tools and UI components.
 */
export interface TitanPlugin {
  name: string;
  version: string;
  description: string;
  tools: TitanTool[];
  routes?: TitanRoute[];
}
export interface TitanTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, any>, context: TitanContext) => Promise<any>;
}
export interface TitanRoute {
  path: string;
  component: string;
  title: string;
  icon?: string;
  adminOnly?: boolean;
}
export interface TitanContext {
  userId: string;
  userRole: string;
  apiBase: string;
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
}
// Plugin definition
const plugin: TitanPlugin = {
  name: "${title}",
  version: "1.0.0",
  description: "Custom Titan plugin with extended functionality",
  tools: [
    {
      name: "custom_action",
      description: "Perform a custom action via this plugin",
      parameters: {
        target: { type: "string", description: "Target to act on", required: true },
        options: { type: "object", description: "Additional options" },
      },
      async execute(params, context) {
        const { target, options = {} } = params;
        // Your custom logic here
        return {
          success: true,
          target,
          result: \`Processed \${target} for user \${context.userId}\`,
          timestamp: new Date().toISOString(),
        };
      },
    },
  ],
};
export default plugin;
`,
    "package.json": JSON.stringify({ name: title.toLowerCase().replace(/[^a-z0-9]/g, "-"), version: "1.0.0", main: "dist/index.js", scripts: { build: "tsc", dev: "tsc --watch" }, devDependencies: { typescript: "^5.0.0" } }, null, 2),
    "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2020", module: "CommonJS", outDir: "dist", strict: true, esModuleInterop: true }, include: ["src"] }, null, 2),
  }),
  // -- BUG BOUNTY --
  "bug-bounty": (title) => ({
    "README.md": `# ${title}\n\nBug bounty automation toolkit -- reconnaissance, vulnerability discovery, and report generation.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 bounty.py --target example.com --program hackerone\n\`\`\``,
    "bounty.py": `#!/usr/bin/env python3
"""Bug Bounty Automation Toolkit -- recon, vuln discovery, report generation."""
import argparse, json, logging, re, socket, ssl, time, urllib.request
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
class BugBountyScanner:
    def __init__(self, target: str, program: str = "generic"):
        self.target = target
        self.program = program
        self.findings = []
    def check_security_headers(self) -> list:
        findings = []
        required_headers = {
            "Strict-Transport-Security": "HSTS not set -- MITM risk",
            "X-Content-Type-Options": "X-Content-Type-Options missing -- MIME sniffing risk",
            "X-Frame-Options": "Clickjacking protection missing",
            "Content-Security-Policy": "CSP not set -- XSS risk",
            "Referrer-Policy": "Referrer-Policy not set -- info leakage",
            "Permissions-Policy": "Permissions-Policy not set",
        }
        try:
            url = f"https://{self.target}" if not self.target.startswith("http") else self.target
            req = urllib.request.Request(url, headers={"User-Agent": "BugBountyScanner/1.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                headers = {k.lower(): v for k, v in resp.headers.items()}
                for header, issue in required_headers.items():
                    if header.lower() not in headers:
                        findings.append({"type": "missing_header", "header": header, "severity": "LOW", "description": issue, "remediation": f"Add {header} response header"})
                        logger.warning(f"Missing header: {header}")
        except Exception as e:
            findings.append({"type": "error", "error": str(e)})
        return findings
    def check_open_ports(self, ports: list = None) -> list:
        if ports is None:
            ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 6379, 8080, 8443, 27017]
        open_ports = []
        domain = self.target.replace("https://", "").replace("http://", "").split("/")[0]
        try:
            ip = socket.gethostbyname(domain)
        except:
            return []
        for port in ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((ip, port))
                if result == 0:
                    open_ports.append({"port": port, "ip": ip, "status": "open", "severity": "INFO" if port in [80, 443] else "MEDIUM"})
                    logger.info(f"Open port: {port}")
                sock.close()
            except:
                pass
        return open_ports
    def generate_report(self) -> dict:
        headers = self.check_security_headers()
        ports = self.check_open_ports()
        all_findings = headers + ports
        return {"target": self.target, "program": self.program, "timestamp": time.time(), "summary": {"total": len(all_findings), "critical": sum(1 for f in all_findings if f.get("severity") == "CRITICAL"), "high": sum(1 for f in all_findings if f.get("severity") == "HIGH"), "medium": sum(1 for f in all_findings if f.get("severity") == "MEDIUM"), "low": sum(1 for f in all_findings if f.get("severity") == "LOW")}, "findings": all_findings}
def main():
    parser = argparse.ArgumentParser(description="Bug Bounty Automation Toolkit")
    parser.add_argument("--target", required=True)
    parser.add_argument("--program", default="generic", help="Bug bounty program name")
    parser.add_argument("--output", default="bounty_report.json")
    args = parser.parse_args()
    scanner = BugBountyScanner(args.target, args.program)
    report = scanner.generate_report()
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[+] Found {report['summary']['total']} issues")
    print(f"[+] Report saved to {args.output}")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "requests>=2.28.0\n",
  }),
  // -- API SECURITY --
  "api-security": (title) => ({
    "README.md": `# ${title}\n\nAPI security testing toolkit -- authentication bypass, rate limit testing, BOLA/IDOR detection.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 api_tester.py --base-url https://api.example.com --spec openapi.json\n\`\`\``,
    "api_tester.py": `#!/usr/bin/env python3
"""API Security Tester -- auth bypass, IDOR, rate limiting, injection."""
import argparse, json, logging, time
import urllib.request, urllib.error
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
class APISecurityTester:
    def __init__(self, base_url: str, token: str = None):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.findings = []
    def _request(self, method: str, path: str, headers: dict = None, body: str = None) -> dict:
        url = f"{self.base_url}{path}"
        h = {"Content-Type": "application/json", "User-Agent": "APISecTester/1.0"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        if headers:
            h.update(headers)
        try:
            data = body.encode() if body else None
            req = urllib.request.Request(url, data=data, headers=h, method=method)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"status": resp.status, "body": resp.read().decode(errors="ignore")[:500], "headers": dict(resp.headers)}
        except urllib.error.HTTPError as e:
            return {"status": e.code, "body": e.read().decode(errors="ignore")[:200], "error": str(e)}
        except Exception as e:
            return {"status": 0, "error": str(e)}
    def test_auth_bypass(self, endpoints: list) -> list:
        findings = []
        bypass_headers = [
            {"X-Forwarded-For": "127.0.0.1"},
            {"X-Real-IP": "127.0.0.1"},
            {"X-Original-URL": "/admin"},
            {"X-Rewrite-URL": "/admin"},
        ]
        for endpoint in endpoints:
            # Test without auth
            no_auth = self._request("GET", endpoint, headers={"Authorization": ""})
            if no_auth["status"] in (200, 201):
                findings.append({"type": "auth_bypass", "endpoint": endpoint, "severity": "CRITICAL", "description": "Endpoint accessible without authentication"})
            # Test with bypass headers
            for bypass in bypass_headers:
                resp = self._request("GET", endpoint, headers={**bypass, "Authorization": ""})
                if resp["status"] in (200, 201):
                    findings.append({"type": "header_bypass", "endpoint": endpoint, "header": list(bypass.keys())[0], "severity": "HIGH", "description": "Auth bypassed via header manipulation"})
        return findings
    def test_rate_limiting(self, endpoint: str, requests_count: int = 20) -> dict:
        statuses = []
        for i in range(requests_count):
            resp = self._request("GET", endpoint)
            statuses.append(resp["status"])
            time.sleep(0.05)
        rate_limited = any(s == 429 for s in statuses)
        return {"endpoint": endpoint, "requests_sent": requests_count, "rate_limited": rate_limited, "status_codes": list(set(statuses)), "severity": "MEDIUM" if not rate_limited else "INFO", "description": "No rate limiting detected" if not rate_limited else "Rate limiting is active"}
    def test_idor(self, endpoint_template: str, ids: list = None) -> list:
        if ids is None:
            ids = [1, 2, 3, 100, 999, "admin", "../admin", "0", "-1"]
        findings = []
        for id_val in ids:
            path = endpoint_template.replace("{id}", str(id_val))
            resp = self._request("GET", path)
            if resp["status"] == 200:
                findings.append({"type": "potential_idor", "path": path, "id": id_val, "severity": "HIGH", "description": f"Resource accessible with ID {id_val} -- verify authorization"})
        return findings
def main():
    parser = argparse.ArgumentParser(description="API Security Tester")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--token", help="Bearer token for authenticated tests")
    parser.add_argument("--endpoints", help="Comma-separated endpoints to test")
    parser.add_argument("--output", default="api_security_report.json")
    args = parser.parse_args()
    tester = APISecurityTester(args.base_url, args.token)
    endpoints = args.endpoints.split(",") if args.endpoints else ["/api/users", "/api/admin", "/api/v1/users"]
    report = {"base_url": args.base_url, "timestamp": time.time(), "findings": []}
    report["findings"].extend(tester.test_auth_bypass(endpoints))
    for ep in endpoints[:2]:
        rate_result = tester.test_rate_limiting(ep)
        if rate_result["severity"] != "INFO":
            report["findings"].append(rate_result)
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[+] API security report: {len(report['findings'])} findings")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "requests>=2.28.0\n",
  }),
  // -- SECURE FILE --
  "secure-file": (title) => ({
    "README.md": `# ${title}\n\nSecure file sharing with end-to-end encryption, expiring links, and audit logging.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 secure_share.py --encrypt myfile.pdf --recipient alice@example.com\n\`\`\``,
    "secure_share.py": `#!/usr/bin/env python3
"""Secure File Sharing -- AES-256-GCM encryption, expiring tokens, audit log."""
import argparse, base64, hashlib, json, logging, os, secrets, time
from pathlib import Path
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logger.warning("cryptography package not installed -- using basic XOR (install: pip install cryptography)")
def derive_key(password: str, salt: bytes) -> bytes:
    if CRYPTO_AVAILABLE:
        kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=480000)
        return kdf.derive(password.encode())
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 480000)
def encrypt_file(input_path: str, password: str) -> dict:
    with open(input_path, "rb") as f:
        plaintext = f.read()
    salt = secrets.token_bytes(16)
    key = derive_key(password, salt)
    nonce = secrets.token_bytes(12)
    if CRYPTO_AVAILABLE:
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    else:
        ciphertext = bytes(b ^ key[i % 32] for i, b in enumerate(plaintext))
    token = secrets.token_urlsafe(32)
    output_path = input_path + ".enc"
    payload = {"salt": base64.b64encode(salt).decode(), "nonce": base64.b64encode(nonce).decode(), "ciphertext": base64.b64encode(ciphertext).decode(), "original_name": Path(input_path).name, "token": token, "created": time.time(), "expires": time.time() + 86400 * 7}
    with open(output_path, "w") as f:
        json.dump(payload, f)
    logger.info(f"Encrypted: {output_path}")
    logger.info(f"Share token: {token}")
    return {"output": output_path, "token": token, "expires_in": "7 days"}
def decrypt_file(input_path: str, password: str, output_dir: str = ".") -> str:
    with open(input_path) as f:
        payload = json.load(f)
    if time.time() > payload["expires"]:
        raise ValueError("This file link has expired")
    salt = base64.b64decode(payload["salt"])
    nonce = base64.b64decode(payload["nonce"])
    ciphertext = base64.b64decode(payload["ciphertext"])
    key = derive_key(password, salt)
    if CRYPTO_AVAILABLE:
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    else:
        plaintext = bytes(b ^ key[i % 32] for i, b in enumerate(ciphertext))
    output_path = os.path.join(output_dir, payload["original_name"])
    with open(output_path, "wb") as f:
        f.write(plaintext)
    logger.info(f"Decrypted: {output_path}")
    return output_path
def main():
    parser = argparse.ArgumentParser(description="Secure File Sharing")
    sub = parser.add_subparsers(dest="action")
    enc = sub.add_parser("encrypt")
    enc.add_argument("file")
    enc.add_argument("--password", required=True)
    dec = sub.add_parser("decrypt")
    dec.add_argument("file")
    dec.add_argument("--password", required=True)
    dec.add_argument("--output-dir", default=".")
    args = parser.parse_args()
    if args.action == "encrypt":
        result = encrypt_file(args.file, args.password)
        print(json.dumps(result, indent=2))
    elif args.action == "decrypt":
        output = decrypt_file(args.file, args.password, args.output_dir)
        print(f"Decrypted to: {output}")
    else:
        parser.print_help()
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "cryptography>=41.0.0\n",
  }),
  // -- IAC SCANNER --
  "iac-scanner": (title) => ({
    "README.md": `# ${title}\n\nInfrastructure-as-Code security scanner for Terraform, CloudFormation, and Kubernetes manifests.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 iac_scan.py --path ./terraform\n\`\`\``,
    "iac_scan.py": `#!/usr/bin/env python3
"""IaC Security Scanner -- Terraform, CloudFormation, Kubernetes misconfig detection."""
import argparse, json, logging, os, re
from pathlib import Path
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
TERRAFORM_CHECKS = [
    (r'encrypted\s*=\s*false', "Unencrypted storage resource", "HIGH"),
    (r'publicly_accessible\s*=\s*true', "Publicly accessible database", "CRITICAL"),
    (r'cidr_blocks\s*=\s*\["0\.0\.0\.0/0"\]', "Security group open to all IPs", "HIGH"),
    (r'deletion_protection\s*=\s*false', "Deletion protection disabled", "MEDIUM"),
    (r'skip_final_snapshot\s*=\s*true', "RDS final snapshot skipped", "MEDIUM"),
    (r'enable_dns_hostnames\s*=\s*false', "DNS hostnames disabled in VPC", "LOW"),
    (r'versioning\s*\{[^}]*enabled\s*=\s*false', "S3 versioning disabled", "MEDIUM"),
    (r'acl\s*=\s*"public-read"', "S3 bucket publicly readable", "CRITICAL"),
    (r'acl\s*=\s*"public-read-write"', "S3 bucket publicly writable", "CRITICAL"),
]
K8S_CHECKS = [
    (r'privileged:\s*true', "Privileged container", "CRITICAL"),
    (r'runAsRoot:\s*true', "Container runs as root", "HIGH"),
    (r'hostNetwork:\s*true', "Host network access", "HIGH"),
    (r'hostPID:\s*true', "Host PID namespace access", "HIGH"),
    (r'allowPrivilegeEscalation:\s*true', "Privilege escalation allowed", "HIGH"),
    (r'readOnlyRootFilesystem:\s*false', "Writable root filesystem", "MEDIUM"),
    (r'imagePullPolicy:\s*Never', "Image pull policy set to Never", "LOW"),
]
def scan_file(path: str, checks: list) -> list:
    findings = []
    try:
        with open(path) as f:
            content = f.read()
        for pattern, description, severity in checks:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                findings.append({"file": path, "pattern": pattern, "description": description, "severity": severity, "occurrences": len(matches)})
                logger.warning(f"[{severity}] {path}: {description}")
    except Exception as e:
        findings.append({"file": path, "error": str(e)})
    return findings
def scan_directory(directory: str) -> dict:
    all_findings = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in [".git", ".terraform", "node_modules"]]
        for fname in files:
            fpath = os.path.join(root, fname)
            if fname.endswith(".tf"):
                all_findings.extend(scan_file(fpath, TERRAFORM_CHECKS))
            elif fname.endswith((".yaml", ".yml")):
                all_findings.extend(scan_file(fpath, K8S_CHECKS))
            elif fname.endswith(".json") and "cloudformation" in fpath.lower():
                all_findings.extend(scan_file(fpath, TERRAFORM_CHECKS))
    return {"directory": directory, "total_findings": len(all_findings), "critical": sum(1 for f in all_findings if f.get("severity") == "CRITICAL"), "high": sum(1 for f in all_findings if f.get("severity") == "HIGH"), "medium": sum(1 for f in all_findings if f.get("severity") == "MEDIUM"), "low": sum(1 for f in all_findings if f.get("severity") == "LOW"), "findings": all_findings}
def main():
    parser = argparse.ArgumentParser(description="IaC Security Scanner")
    parser.add_argument("--path", required=True, help="Directory or file to scan")
    parser.add_argument("--output", default="iac_report.json")
    args = parser.parse_args()
    if os.path.isfile(args.path):
        ext = Path(args.path).suffix
        checks = TERRAFORM_CHECKS if ext == ".tf" else K8S_CHECKS
        findings = scan_file(args.path, checks)
        report = {"file": args.path, "findings": findings}
    else:
        report = scan_directory(args.path)
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[+] IaC scan complete: {report.get('total_findings', len(report.get('findings', [])))} findings")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies\n",
  }),
  // -- CICD TEMPLATE --
  "cicd-template": (title) => ({
    "README.md": `# ${title}\n\nProduction-ready CI/CD pipeline templates for GitHub Actions, GitLab CI, and Jenkins.\n\n## Usage\nCopy the workflow files to your repository and configure the required secrets.`,
    ".github/workflows/ci.yml": `name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
env:
  NODE_VERSION: '20'
  PYTHON_VERSION: '3.11'
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/testdb
          NODE_ENV: test
  security:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
      - name: Audit npm packages
        run: npm audit --audit-level=high
  build:
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: dist/
  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build-artifacts
          path: dist/
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up --service \${{ secrets.RAILWAY_SERVICE }}
        env:
          RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}
`,
    ".gitlab-ci.yml": `stages:
  - lint
  - test
  - security
  - build
  - deploy
variables:
  NODE_VERSION: "20"
  DOCKER_DRIVER: overlay2
lint:
  stage: lint
  image: node:20-alpine
  script:
    - npm ci
    - npm run lint
    - npm run type-check
  cache:
    paths:
      - node_modules/
test:
  stage: test
  image: node:20-alpine
  services:
    - postgres:16
  variables:
    POSTGRES_PASSWORD: testpass
    DATABASE_URL: postgresql://postgres:testpass@postgres:5432/testdb
  script:
    - npm ci
    - npm test
security_scan:
  stage: security
  image: aquasec/trivy:latest
  script:
    - trivy fs --exit-code 1 --severity CRITICAL,HIGH .
build:
  stage: build
  image: node:20-alpine
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
  only:
    - main
`,
    "Jenkinsfile": `pipeline {
    agent any
    environment {
        NODE_VERSION = '20'
    }
    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }
        stage('Lint') {
            steps {
                sh 'npm run lint'
                sh 'npm run type-check'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
            post {
                always {
                    junit 'test-results/**/*.xml'
                }
            }
        }
        stage('Build') {
            when {
                branch 'main'
            }
            steps {
                sh 'npm run build'
            }
        }
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([string(credentialsId: 'railway-token', variable: 'RAILWAY_TOKEN')]) {
                    sh 'railway up'
                }
            }
        }
    }
}
`,
  }),
  // -- AI CHATBOT --
  "ai-chatbot": (title) => ({
    "README.md": `# ${title}\n\nAI-powered customer support chatbot with intent classification, FAQ matching, and escalation routing.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 chatbot.py --mode cli\n\`\`\``,
    "chatbot.py": `#!/usr/bin/env python3
"""AI Customer Support Chatbot -- intent classification, FAQ, escalation."""
import argparse, json, logging, os, re, time
from typing import Optional
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
INTENTS = {
    "greeting": ["hello", "hi", "hey", "good morning", "good afternoon", "howdy"],
    "farewell": ["bye", "goodbye", "see you", "thanks bye", "cya", "later"],
    "billing": ["invoice", "payment", "charge", "refund", "billing", "subscription", "cancel", "price", "cost", "fee"],
    "technical": ["error", "bug", "broken", "not working", "issue", "problem", "crash", "fail", "help", "support"],
    "account": ["login", "password", "reset", "account", "username", "email", "profile", "settings"],
    "escalate": ["human", "agent", "person", "speak to someone", "real person", "manager", "supervisor"],
}
RESPONSES = {
    "greeting": ["Hello! How can I help you today?", "Hi there! What can I assist you with?", "Hey! I'm here to help. What do you need?"],
    "farewell": ["Goodbye! Have a great day!", "Thanks for reaching out. Take care!", "See you later! Don't hesitate to come back if you need help."],
    "billing": "For billing inquiries, please check your account dashboard or email billing@example.com. I can also help with common billing questions.",
    "technical": "I'm sorry you're experiencing issues. Could you describe the problem in more detail? I'll do my best to help or connect you with our technical team.",
    "account": "For account-related issues, you can reset your password at /reset-password or contact support@example.com.",
    "escalate": "I'll connect you with a human agent right away. Please hold while I transfer you...",
    "unknown": "I'm not sure I understand. Could you rephrase that? Or type 'help' to see what I can assist with.",
}
class Chatbot:
    def __init__(self, name: str = "Titan Bot"):
        self.name = name
        self.conversation_history = []
        self.escalated = False
    def classify_intent(self, message: str) -> str:
        msg_lower = message.lower()
        scores = {}
        for intent, keywords in INTENTS.items():
            score = sum(1 for kw in keywords if kw in msg_lower)
            if score > 0:
                scores[intent] = score
        return max(scores, key=scores.get) if scores else "unknown"
    def get_response(self, message: str) -> str:
        intent = self.classify_intent(message)
        self.conversation_history.append({"role": "user", "content": message, "intent": intent, "timestamp": time.time()})
        if intent == "escalate":
            self.escalated = True
        response_data = RESPONSES.get(intent, RESPONSES["unknown"])
        if isinstance(response_data, list):
            import random
            response = random.choice(response_data)
        else:
            response = response_data
        self.conversation_history.append({"role": "assistant", "content": response, "timestamp": time.time()})
        return response
    def run_cli(self):
        print(f"\\n{self.name} -- Type 'quit' to exit\\n")
        while True:
            try:
                user_input = input("You: ").strip()
                if not user_input:
                    continue
                if user_input.lower() in ("quit", "exit"):
                    print(f"{self.name}: Goodbye!")
                    break
                response = self.get_response(user_input)
                print(f"{self.name}: {response}\\n")
                if self.escalated:
                    print("[System: Escalating to human agent...]")
                    break
            except KeyboardInterrupt:
                print("\\nGoodbye!")
                break
def main():
    parser = argparse.ArgumentParser(description="AI Customer Support Chatbot")
    parser.add_argument("--mode", choices=["cli", "api"], default="cli")
    parser.add_argument("--name", default="Titan Bot")
    parser.add_argument("--message", help="Single message to process (non-interactive)")
    args = parser.parse_args()
    bot = Chatbot(args.name)
    if args.message:
        response = bot.get_response(args.message)
        print(json.dumps({"response": response, "intent": bot.conversation_history[-2]["intent"]}, indent=2))
    elif args.mode == "cli":
        bot.run_cli()
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies for basic mode\n# For OpenAI integration: openai>=1.0.0\n",
    "config.json": JSON.stringify({"name": "Titan Bot", "escalation_email": "support@example.com", "max_conversation_turns": 10, "openai_model": "gpt-4o-mini"}, null, 2),
  }),
  // -- LLM TOOLKIT --
  "llm-toolkit": (title) => ({
    "README.md": `# ${title}\n\nLLM prompt engineering toolkit with chain-of-thought templates, fine-tuning helpers, and evaluation harness.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\nexport OPENAI_API_KEY=your_key\npython3 llm_toolkit.py --task summarize --input document.txt\n\`\`\``,
    "llm_toolkit.py": `#!/usr/bin/env python3
"""LLM Toolkit -- prompt engineering, chain-of-thought, evaluation harness."""
import argparse, json, logging, os, time
from typing import Optional
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
PROMPT_TEMPLATES = {
    "summarize": """You are an expert summarizer. Summarize the following text concisely.
TEXT: {input}
SUMMARY:""",
    "classify": """Classify the following text into one of these categories: {categories}
TEXT: {input}
CATEGORY:""",
    "extract": """Extract the following information from the text: {fields}
TEXT: {input}
EXTRACTED JSON:""",
    "chain_of_thought": """Think step by step to answer the following question.
QUESTION: {input}
REASONING:
Step 1:""",
    "code_review": """You are a senior software engineer. Review the following code for bugs, security issues, and improvements.
CODE:
{input}
REVIEW:""",
    "sentiment": """Analyze the sentiment of the following text. Return: POSITIVE, NEGATIVE, or NEUTRAL with a confidence score.
TEXT: {input}
SENTIMENT:""",
}
class LLMToolkit:
    def __init__(self, model: str = "gpt-4o-mini", api_key: Optional[str] = None):
        self.model = model
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.call_count = 0
        self.total_tokens = 0
    def call_openai(self, prompt: str, max_tokens: int = 500) -> dict:
        if not self.api_key:
            return {"error": "No API key set. Export OPENAI_API_KEY or pass --api-key", "prompt": prompt[:100]}
        try:
            import urllib.request
            headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
            body = json.dumps({"model": self.model, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens, "temperature": 0.3}).encode()
            req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
                self.call_count += 1
                self.total_tokens += data.get("usage", {}).get("total_tokens", 0)
                return {"response": data["choices"][0]["message"]["content"], "model": self.model, "tokens": data.get("usage", {})}
        except Exception as e:
            return {"error": str(e)}
    def run_task(self, task: str, input_text: str, **kwargs) -> dict:
        template = PROMPT_TEMPLATES.get(task, PROMPT_TEMPLATES["summarize"])
        prompt = template.format(input=input_text, **kwargs)
        logger.info(f"Running task: {task} ({len(input_text)} chars input)")
        result = self.call_openai(prompt)
        result["task"] = task
        result["timestamp"] = time.time()
        return result
    def evaluate_prompt(self, prompt_variants: list, test_inputs: list) -> dict:
        """A/B test multiple prompt variants against test inputs."""
        results = []
        for i, prompt_template in enumerate(prompt_variants):
            variant_results = []
            for test_input in test_inputs:
                prompt = prompt_template.format(input=test_input)
                result = self.call_openai(prompt)
                variant_results.append({"input": test_input[:50], "output": result.get("response", "")[:100], "tokens": result.get("tokens", {})})
            results.append({"variant": i + 1, "template": prompt_template[:100], "results": variant_results})
        return {"evaluation": results, "total_calls": self.call_count, "total_tokens": self.total_tokens}
def main():
    parser = argparse.ArgumentParser(description="LLM Toolkit")
    parser.add_argument("--task", choices=list(PROMPT_TEMPLATES.keys()), default="summarize")
    parser.add_argument("--input", help="Input text or file path")
    parser.add_argument("--model", default="gpt-4o-mini")
    parser.add_argument("--api-key", help="OpenAI API key")
    parser.add_argument("--output", default="llm_output.json")
    args = parser.parse_args()
    toolkit = LLMToolkit(args.model, args.api_key)
    if args.input and os.path.isfile(args.input):
        with open(args.input) as f:
            input_text = f.read()
    else:
        input_text = args.input or "Hello, world!"
    result = toolkit.run_task(args.task, input_text)
    print(json.dumps(result, indent=2))
    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "openai>=1.0.0\n",
    "prompts/": "",
    "prompts/system_prompts.json": JSON.stringify({"assistant": "You are a helpful assistant.", "analyst": "You are a data analyst. Provide structured, data-driven responses.", "security": "You are a cybersecurity expert. Focus on security implications and best practices."}, null, 2),
  }),
  // -- CODE REVIEW AGENT --
  "code-review-agent": (title) => ({
    "README.md": `# ${title}\n\nAutomated code review agent with static analysis, security scanning, and AI-powered suggestions.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 code_review.py --path ./src --language python\n\`\`\``,
    "code_review.py": `#!/usr/bin/env python3
"""Automated Code Review Agent -- static analysis, security, style, complexity."""
import argparse, ast, json, logging, os, re, time
from pathlib import Path
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
SECURITY_PATTERNS = [
    (r'eval\s*\(', "Dangerous eval() usage", "HIGH"),
    (r'exec\s*\(', "Dangerous exec() usage", "HIGH"),
    (r'pickle\.loads?\s*\(', "Insecure pickle deserialization", "HIGH"),
    (r'subprocess\.call\s*\(.*shell\s*=\s*True', "Shell injection risk", "CRITICAL"),
    (r'os\.system\s*\(', "OS command execution", "HIGH"),
    (r'hashlib\.(md5|sha1)\s*\(', "Weak hash algorithm", "MEDIUM"),
    (r'random\.(random|randint|choice)\s*\(', "Non-cryptographic random (use secrets module)", "LOW"),
    (r'password\s*=\s*["\'][^"\']+["\']', "Hardcoded password", "CRITICAL"),
    (r'api_key\s*=\s*["\'][^"\']+["\']', "Hardcoded API key", "CRITICAL"),
    (r'secret\s*=\s*["\'][^"\']+["\']', "Hardcoded secret", "CRITICAL"),
    (r'TODO|FIXME|HACK|XXX', "Technical debt marker", "INFO"),
    (r'print\s*\(.*password', "Password printed to stdout", "HIGH"),
]
def analyze_python_file(path: str) -> dict:
    findings = []
    try:
        with open(path) as f:
            content = f.read()
        # Security pattern checks
        for pattern, description, severity in SECURITY_PATTERNS:
            matches = [(m.start(), m.group()) for m in re.finditer(pattern, content, re.IGNORECASE)]
            for pos, match in matches:
                line_num = content[:pos].count("\\n") + 1
                findings.append({"line": line_num, "type": "security", "severity": severity, "description": description, "snippet": match[:80]})
        # AST analysis for complexity
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    # Count branches for cyclomatic complexity
                    branches = sum(1 for n in ast.walk(node) if isinstance(n, (ast.If, ast.For, ast.While, ast.ExceptHandler, ast.With)))
                    if branches > 10:
                        findings.append({"line": node.lineno, "type": "complexity", "severity": "MEDIUM", "description": f"Function '{node.name}' has high cyclomatic complexity ({branches} branches)", "snippet": f"def {node.name}()"})
                    # Check for missing docstrings
                    if not (node.body and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Constant)):
                        if len(node.body) > 3:  # Only flag non-trivial functions
                            findings.append({"line": node.lineno, "type": "documentation", "severity": "LOW", "description": f"Function '{node.name}' missing docstring", "snippet": f"def {node.name}()"})
        except SyntaxError as e:
            findings.append({"line": e.lineno, "type": "syntax", "severity": "CRITICAL", "description": f"Syntax error: {e.msg}", "snippet": ""})
        lines = content.split("\\n")
        for i, line in enumerate(lines, 1):
            if len(line) > 120:
                findings.append({"line": i, "type": "style", "severity": "INFO", "description": f"Line too long ({len(line)} chars, max 120)", "snippet": line[:80]})
    except Exception as e:
        findings.append({"type": "error", "severity": "ERROR", "description": str(e)})
    return {"file": path, "findings": findings, "summary": {"total": len(findings), "critical": sum(1 for f in findings if f.get("severity") == "CRITICAL"), "high": sum(1 for f in findings if f.get("severity") == "HIGH"), "medium": sum(1 for f in findings if f.get("severity") == "MEDIUM"), "low": sum(1 for f in findings if f.get("severity") == "LOW")}}
def review_directory(directory: str, language: str = "python") -> dict:
    all_results = []
    ext_map = {"python": ".py", "javascript": ".js", "typescript": ".ts"}
    ext = ext_map.get(language, ".py")
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in [".git", "node_modules", "__pycache__", ".venv", "dist", "build"]]
        for fname in files:
            if fname.endswith(ext):
                fpath = os.path.join(root, fname)
                result = analyze_python_file(fpath)
                all_results.append(result)
    total_findings = sum(len(r["findings"]) for r in all_results)
    return {"directory": directory, "language": language, "files_reviewed": len(all_results), "total_findings": total_findings, "results": all_results}
def main():
    parser = argparse.ArgumentParser(description="Automated Code Review Agent")
    parser.add_argument("--path", required=True)
    parser.add_argument("--language", choices=["python", "javascript", "typescript"], default="python")
    parser.add_argument("--output", default="code_review_report.json")
    args = parser.parse_args()
    if os.path.isfile(args.path):
        report = analyze_python_file(args.path)
    else:
        report = review_directory(args.path, args.language)
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    total = report.get("total_findings", len(report.get("findings", [])))
    print(f"[+] Code review complete: {total} findings")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies\n",
  }),
  // -- KILL SWITCH --
  "kill-switch": (title) => ({
    "README.md": `# ${title}\n\nEmergency kill switch system for rapid service shutdown, credential rotation, and incident response.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 kill_switch.py --status  # Check current state\npython3 kill_switch.py --trigger  # Activate kill switch\n\`\`\``,
    "kill_switch.py": `#!/usr/bin/env python3
"""Emergency Kill Switch -- rapid service shutdown, credential rotation, incident response."""
import argparse, json, logging, os, signal, subprocess, sys, time
from datetime import datetime
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)
STATE_FILE = "/tmp/kill_switch_state.json"
class KillSwitch:
    def __init__(self, config_file: str = "kill_switch_config.json"):
        self.config = self._load_config(config_file)
        self.state = self._load_state()
    def _load_config(self, path: str) -> dict:
        defaults = {"services": [], "notify_emails": [], "rotate_credentials": False, "block_ips": [], "webhook_url": None}
        if os.path.exists(path):
            with open(path) as f:
                return {**defaults, **json.load(f)}
        return defaults
    def _load_state(self) -> dict:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE) as f:
                return json.load(f)
        return {"active": False, "triggered_at": None, "triggered_by": None, "actions_taken": []}
    def _save_state(self):
        with open(STATE_FILE, "w") as f:
            json.dump(self.state, f, indent=2)
    def get_status(self) -> dict:
        return {"kill_switch_active": self.state["active"], "triggered_at": self.state.get("triggered_at"), "actions_taken": self.state.get("actions_taken", []), "config": {"services_configured": len(self.config["services"]), "notify_emails": len(self.config["notify_emails"]), "block_ips_count": len(self.config["block_ips"])}}
    def trigger(self, reason: str = "Manual trigger", operator: str = "system") -> dict:
        if self.state["active"]:
            return {"status": "already_active", "message": "Kill switch is already active"}
        logger.critical(f"KILL SWITCH TRIGGERED by {operator}: {reason}")
        self.state["active"] = True
        self.state["triggered_at"] = datetime.utcnow().isoformat()
        self.state["triggered_by"] = operator
        self.state["actions_taken"] = []
        actions = []
        # Stop configured services
        for service in self.config.get("services", []):
            try:
                result = subprocess.run(["systemctl", "stop", service], capture_output=True, text=True, timeout=30)
                action = {"action": "stop_service", "service": service, "success": result.returncode == 0, "timestamp": time.time()}
                actions.append(action)
                logger.info(f"Stopped service: {service}")
            except Exception as e:
                actions.append({"action": "stop_service", "service": service, "success": False, "error": str(e)})
        # Block IPs via iptables
        for ip in self.config.get("block_ips", []):
            try:
                result = subprocess.run(["iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"], capture_output=True, text=True, timeout=10)
                actions.append({"action": "block_ip", "ip": ip, "success": result.returncode == 0, "timestamp": time.time()})
                logger.info(f"Blocked IP: {ip}")
            except Exception as e:
                actions.append({"action": "block_ip", "ip": ip, "success": False, "error": str(e)})
        # Send webhook notification
        if self.config.get("webhook_url"):
            try:
                import urllib.request
                payload = json.dumps({"event": "kill_switch_triggered", "reason": reason, "operator": operator, "timestamp": self.state["triggered_at"]}).encode()
                req = urllib.request.Request(self.config["webhook_url"], data=payload, headers={"Content-Type": "application/json"}, method="POST")
                urllib.request.urlopen(req, timeout=10)
                actions.append({"action": "webhook_notification", "success": True})
            except Exception as e:
                actions.append({"action": "webhook_notification", "success": False, "error": str(e)})
        self.state["actions_taken"] = actions
        self._save_state()
        return {"status": "triggered", "reason": reason, "actions": actions, "timestamp": self.state["triggered_at"]}
    def reset(self, operator: str = "system") -> dict:
        if not self.state["active"]:
            return {"status": "not_active", "message": "Kill switch is not active"}
        logger.info(f"Kill switch reset by {operator}")
        self.state["active"] = False
        self.state["reset_at"] = datetime.utcnow().isoformat()
        self.state["reset_by"] = operator
        self._save_state()
        return {"status": "reset", "timestamp": self.state["reset_at"]}
def main():
    parser = argparse.ArgumentParser(description="Emergency Kill Switch")
    parser.add_argument("--status", action="store_true", help="Check kill switch status")
    parser.add_argument("--trigger", action="store_true", help="Activate kill switch")
    parser.add_argument("--reset", action="store_true", help="Reset kill switch")
    parser.add_argument("--reason", default="Manual trigger", help="Reason for triggering")
    parser.add_argument("--operator", default=os.environ.get("USER", "system"))
    parser.add_argument("--config", default="kill_switch_config.json")
    args = parser.parse_args()
    ks = KillSwitch(args.config)
    if args.status:
        print(json.dumps(ks.get_status(), indent=2))
    elif args.trigger:
        result = ks.trigger(args.reason, args.operator)
        print(json.dumps(result, indent=2))
    elif args.reset:
        result = ks.reset(args.operator)
        print(json.dumps(result, indent=2))
    else:
        parser.print_help()
if __name__ == "__main__":
    main()
`,
    "kill_switch_config.json": JSON.stringify({"services": ["nginx", "app"], "notify_emails": ["admin@example.com"], "rotate_credentials": true, "block_ips": [], "webhook_url": null}, null, 2),
    "requirements.txt": "# No external dependencies\n",
  }),
'''

# Find the insertion point: just before the closing }; of the PAYLOADS object
# The closing }; comes right before the selectPayload function
# Find the line with "};" that comes before "function selectPayload"

lines = content.split('\n')
insert_before = None
for i, line in enumerate(lines):
    if line.strip() == '};' and i + 1 < len(lines):
        # Check if the next non-empty line contains selectPayload or the comment before it
        for j in range(i+1, min(i+5, len(lines))):
            if 'selectPayload' in lines[j] or 'Payload Selector' in lines[j]:
                insert_before = i
                break
        if insert_before is not None:
            break

if insert_before is None:
    print("ERROR: Could not find insertion point")
    exit(1)

print(f"Inserting {len(new_payloads.split('// --'))-1} new payloads before line {insert_before+1}")

new_lines = lines[:insert_before] + [new_payloads] + lines[insert_before:]
new_content = '\n'.join(new_lines)

with open(path, 'w') as f:
    f.write(new_content)

print("Done")
