#!/usr/bin/env python3
"""
Fix the corrupted marketplace-payload-generator.ts file.
The seo-automation payload was truncated at line 2775 and the generic-py
payload was never properly defined.
"""

path = "/home/ubuntu/archibald-titan-ai/server/marketplace-payload-generator.ts"

with open(path, "r") as f:
    lines = f.readlines()

# Find the corruption point: line with "parser.add_" followed by a line starting with '"README.md"'
corrupt_start = None
corrupt_end = None

for i, line in enumerate(lines):
    if '    parser.add_\n' == line or '    parser.add_' in line and line.strip() == 'parser.add_':
        corrupt_start = i
    if corrupt_start and i > corrupt_start and '"README.md"' in line and '`# ${title}' in line:
        corrupt_end = i
        break

print(f"Corruption starts at line {corrupt_start + 1}, ends at line {corrupt_end + 1}")

# The replacement: complete the seo-automation payload properly, then add generic-py
replacement = '''    parser.add_argument("--domain", required=True)
    parser.add_argument("--keywords", help="Comma-separated seed keywords")
    parser.add_argument("--output", default="seo_report.json")
    args = parser.parse_args()
    researcher = SEOResearcher()
    report = {}
    if args.keywords:
        seeds = [k.strip() for k in args.keywords.split(",")]
        report["keyword_opportunities"] = researcher.find_keyword_opportunities(args.domain, seeds)
    report["page_analysis"] = researcher.analyze_page(f"https://{args.domain}")
    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    print(f"[+] SEO report saved to {args.output}")
if __name__ == "__main__":
    main()
`,
    "requirements.txt": "requests>=2.28.0\\n",
  }),
  // ── GENERIC PYTHON ────────────────────────────────────────────────
  "generic-py": (title, description) => ({
    "README.md": `# ${title}\\n\\n${description}\\n\\n## Quick Start\\n\\`\\`\\`bash\\npip install -r requirements.txt\\npython3 main.py --help\\n\\`\\`\\``,
    "main.py": `#!/usr/bin/env python3
"""
${title}
${description}
"""
import argparse, json, logging, sys, time, os
from typing import Any, Optional, List, Dict
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

class Engine:
    """Main engine class."""
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.results: List[Any] = []
        self.errors: List[str] = []
        logger.info(f"Initialized {self.__class__.__name__}")

    def validate_config(self) -> bool:
        """Validate configuration before running."""
        required = self.config.get("required_fields", [])
        for field in required:
            if field not in self.config:
                logger.error(f"Missing required config field: {field}")
                return False
        return True

    def run(self, target: str, **kwargs) -> Dict[str, Any]:
        """Main execution method."""
        logger.info(f"Running against: {target}")
        start = time.time()
        try:
            result = self._execute(target, **kwargs)
            self.results.append(result)
            return result
        except Exception as e:
            self.errors.append(str(e))
            logger.error(f"Execution error: {e}")
            return {"error": str(e), "target": target}
        finally:
            logger.info(f"Completed in {time.time() - start:.2f}s")

    def _execute(self, target: str, **kwargs) -> Dict[str, Any]:
        """Override this method with your specific logic."""
        return {"target": target, "status": "ok", "timestamp": time.time()}

    def export_results(self, output_file: str = "results.json") -> None:
        """Export results to JSON file."""
        with open(output_file, "w") as f:
            json.dump({"results": self.results, "errors": self.errors, "total": len(self.results)}, f, indent=2)
        logger.info(f"Results exported to {output_file}")

def main():
    parser = argparse.ArgumentParser(description="${title}")
    parser.add_argument("--target", required=True, help="Target to process")
    parser.add_argument("--output", default="results.json", help="Output file path")
    parser.add_argument("--config", help="JSON config file path")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    args = parser.parse_args()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    config = {}
    if args.config:
        with open(args.config) as f:
            config = json.load(f)
    engine = Engine(config)
    if not engine.validate_config():
        sys.exit(1)
    result = engine.run(args.target)
    print(json.dumps(result, indent=2))
    engine.export_results(args.output)

if __name__ == "__main__":
    main()
`,
    "requirements.txt": "requests>=2.28.0\\n",
    "config.example.json": JSON.stringify({"required_fields": [], "timeout": 30, "max_retries": 3, "output_format": "json"}, null, 2),
  }),
'''

# Now replace lines from corrupt_start to corrupt_end (exclusive of corrupt_end)
# The corrupt_end line is the start of the generic-py payload which we are replacing
new_lines = lines[:corrupt_start] + [replacement] + lines[corrupt_end:]

with open(path, "w") as f:
    f.writelines(new_lines)

print(f"Fixed corruption: replaced lines {corrupt_start+1} to {corrupt_end}")
print("Done")
