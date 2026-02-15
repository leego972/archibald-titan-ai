import { Bot, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#060611] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#060611]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">Archibald Titan</span>
            </Link>
            <Link href="/" className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-28 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <span className="text-sm font-semibold text-blue-400 tracking-widest uppercase">Legal</span>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-4 text-white/40">Last updated: February 9, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">1. Overview</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              Archibald Titan ("the Software," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how the Software handles information when you use our locally-installed application and associated web services.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              The fundamental design principle of Archibald Titan is local-first operation. The Software is designed to run entirely on your machine, and your credentials never leave your local environment. This Privacy Policy describes what limited information may be collected through our website and web dashboard.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">2. Information We Do Not Collect</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              Archibald Titan is designed with privacy as a core principle. The following information is never collected, transmitted, or stored on our servers:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0">✓</span>
                <span>Your API keys, credentials, passwords, or any sensitive authentication data.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0">✓</span>
                <span>The contents of your encrypted vault.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0">✓</span>
                <span>Your browsing history or the websites the Software accesses on your behalf.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0">✓</span>
                <span>Screenshots, recordings, or logs of the automation process.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0">✓</span>
                <span>Your proxy credentials or residential proxy configuration.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-1 shrink-0">✓</span>
                <span>Your CAPTCHA-solving service API keys.</span>
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">3. Information We May Collect</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              When you use our web dashboard or website, we may collect limited information:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white/60 border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 pr-4 text-white/80 font-semibold">Data Type</th>
                    <th className="text-left py-3 pr-4 text-white/80 font-semibold">Purpose</th>
                    <th className="text-left py-3 text-white/80 font-semibold">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-3 pr-4">Account information (via OAuth)</td>
                    <td className="py-3 pr-4">Dashboard authentication</td>
                    <td className="py-3">Duration of account</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 pr-4">Usage analytics (page views)</td>
                    <td className="py-3 pr-4">Improve the website experience</td>
                    <td className="py-3">90 days</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 pr-4">Download counts</td>
                    <td className="py-3 pr-4">Track software adoption</td>
                    <td className="py-3">Indefinite (aggregated)</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-3 pr-4">Version check requests</td>
                    <td className="py-3 pr-4">Deliver update notifications</td>
                    <td className="py-3">Not stored</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">4. Local Data Storage</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              All sensitive data processed by the Software is stored exclusively on your local machine. This includes:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Encrypted credential vault (AES-256-GCM encryption at rest).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Provider login credentials you enter for automation.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Job history and automation logs.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Application settings and preferences.</span>
              </li>
            </ul>
            <p className="text-sm text-white/60 leading-relaxed mt-3">
              You are solely responsible for the security of your local machine and the data stored on it. We recommend using full-disk encryption, strong system passwords, and keeping your operating system updated.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">5. Third-Party Services</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              The Software may interact with the following categories of third-party services at your direction:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span><strong className="text-white/80">Provider websites</strong> (e.g., OpenAI, AWS, GoDaddy) — accessed only when you initiate a credential retrieval job. Your login credentials are sent directly from your machine to the provider; they never pass through our servers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span><strong className="text-white/80">CAPTCHA-solving services</strong> (e.g., 2Captcha, Anti-Captcha) — if configured by you. CAPTCHA images are sent to these services for solving. These services have their own privacy policies.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span><strong className="text-white/80">Residential proxy providers</strong> — if configured by you. Your web traffic is routed through these services. These services have their own privacy policies.</span>
              </li>
            </ul>
            <p className="text-sm text-white/60 leading-relaxed mt-3">
              We are not responsible for the privacy practices of any third-party services. We encourage you to review the privacy policies of any third-party services you use in conjunction with the Software.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">6. Cookies and Tracking</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              Our web dashboard uses session cookies solely for authentication purposes. We do not use tracking cookies, advertising cookies, or any form of cross-site tracking. We may use privacy-respecting analytics (without personal data collection) to understand aggregate usage patterns of our website.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">7. Data Security</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              We implement industry-standard security measures to protect any information processed through our web services. However, no method of electronic transmission or storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee its absolute security. The Software's local encryption uses AES-256-GCM, which is a military-grade encryption standard, but we make no guarantees about the security of your local environment.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">8. Children's Privacy</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              The Software is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us so we can take appropriate action.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">9. Your Rights</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              Depending on your jurisdiction, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The right to access the personal information we hold about you.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The right to request correction of inaccurate information.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The right to request deletion of your account and associated data.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The right to data portability.</span>
              </li>
            </ul>
            <p className="text-sm text-white/60 leading-relaxed mt-3">
              Since the vast majority of your data is stored locally on your machine, you have direct control over it at all times. You can delete all local data by uninstalling the Software and removing its data directory.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">10. Changes to This Policy</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">11. Contact Us</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us through the dashboard or at the contact information provided on our website.
            </p>
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">
            &copy; {new Date().getFullYear()} Archibald Titan. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-xs text-white/20 hover:text-white/40 transition-colors">Terms & Conditions</Link>
            <Link href="/privacy" className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors">Privacy Policy</Link>
            <Link href="/" className="text-xs text-white/20 hover:text-white/40 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
