import { Bot, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function TermsPage() {
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
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight">Terms & Conditions</h1>
          <p className="mt-4 text-white/40">Last updated: February 9, 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">1. Acceptance of Terms</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              By downloading, installing, accessing, or using Archibald Titan ("the Software"), you ("the User") agree to be bound by these Terms and Conditions ("Terms") in their entirety. If you do not agree to all of these Terms, you must immediately cease all use of the Software and delete all copies from your devices. Your continued use of the Software constitutes irrevocable acceptance of these Terms, including all disclaimers, limitations of liability, and indemnification obligations contained herein.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              These Terms constitute a legally binding agreement between you and Archibald Titan ("we," "us," "our," or "the Company"). We reserve the right to modify these Terms at any time without prior notice. It is your sole responsibility to review these Terms periodically. Continued use of the Software after any modifications constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">2. Description of Service</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              Archibald Titan is a locally-installed software tool designed to assist users in retrieving their own API keys and credentials from third-party service providers. The Software operates entirely on the User's local machine and does not transmit, store, or process any user data on external servers.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              The Software is provided as a convenience tool only. It automates browser-based interactions that the User could otherwise perform manually. The Software does not guarantee successful retrieval of credentials from any provider, as third-party websites may change their interfaces, security measures, or terms of service at any time without notice.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">3. User Responsibilities and Obligations</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              The User acknowledges and agrees that:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>They will only use the Software to access accounts and credentials that they own or have explicit, documented authorization to access.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>They are solely responsible for ensuring that their use of the Software complies with all applicable local, state, national, and international laws, regulations, and the terms of service of any third-party providers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>They will not use the Software for any unauthorized, illegal, or malicious purpose, including but not limited to unauthorized access to computer systems, identity theft, fraud, or any activity that violates the Computer Fraud and Abuse Act (CFAA) or equivalent legislation in their jurisdiction.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>They assume full responsibility for the security of their local machine, including the protection of any credentials stored in the Software's encrypted vault.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>They understand that the use of residential proxies, CAPTCHA-solving services, or browser automation may violate the terms of service of certain third-party providers, and they accept all risk and liability associated with such use.</span>
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">4. Complete Disclaimer of Warranties</h2>
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-4">
              <p className="text-sm text-amber-300/90 leading-relaxed font-medium">
                THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WE SPECIFICALLY DISCLAIM ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </p>
            </div>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              Without limiting the foregoing, we make no warranty or representation that:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The Software will meet your requirements or expectations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The Software will be uninterrupted, timely, secure, or error-free.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The results obtained from the use of the Software will be accurate, reliable, or complete.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The quality of any credentials, data, or information obtained through the Software will meet your expectations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any errors in the Software will be corrected.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The Software is free of viruses, malware, or other harmful components.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The encryption mechanisms will prevent all unauthorized access under all circumstances.</span>
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">5. Absolute Limitation of Liability</h2>
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 mb-4">
              <p className="text-sm text-red-300/90 leading-relaxed font-medium">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL ARCHIBALD TITAN, ITS CREATORS, DEVELOPERS, CONTRIBUTORS, AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, CREDENTIALS, API KEYS, OR OTHER INTANGIBLE LOSSES, REGARDLESS OF WHETHER SUCH DAMAGES WERE FORESEEABLE AND WHETHER OR NOT WE WERE ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
            </div>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              This limitation of liability applies to, without limitation:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any loss, theft, exposure, or unauthorized use of credentials, API keys, passwords, or other sensitive information retrieved, stored, or managed by the Software.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any account suspension, termination, or restriction imposed by third-party providers as a result of automated access or any other activity performed by the Software.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any financial loss, including but not limited to unauthorized charges, fraudulent transactions, or billing disputes arising from the use or misuse of retrieved credentials.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any damage to your computer system, loss of data, or corruption of files resulting from the download, installation, or use of the Software.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any legal action, claim, or proceeding brought against you by any third party as a result of your use of the Software.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any failure of the encryption, security mechanisms, kill switch, or any other protective feature of the Software.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any interruption, delay, or failure of the Software to perform as described or expected.</span>
              </li>
            </ul>
            <p className="text-sm text-white/60 leading-relaxed mt-4">
              IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE USE OF THE SOFTWARE EXCEED THE AMOUNT YOU PAID FOR THE SOFTWARE, WHICH IS ZERO DOLLARS ($0.00) FOR THE FREE VERSION. THIS LIMITATION APPLIES REGARDLESS OF THE LEGAL THEORY UPON WHICH THE CLAIM IS BASED, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR OTHERWISE.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">6. Comprehensive Indemnification</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              You agree to indemnify, defend, and hold harmless Archibald Titan, its creators, developers, contributors, affiliates, officers, directors, employees, agents, licensors, and service providers from and against any and all claims, demands, actions, suits, proceedings, losses, damages, liabilities, costs, and expenses (including reasonable attorneys' fees and court costs) arising out of or in connection with:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Your use or misuse of the Software.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Your violation of these Terms.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Your violation of any applicable law, regulation, or the terms of service of any third-party provider.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Your violation of any rights of any third party, including intellectual property rights, privacy rights, or contractual rights.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any claim that your use of the Software caused damage to a third party.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Any unauthorized access to accounts or systems facilitated through the Software.</span>
              </li>
            </ul>
            <p className="text-sm text-white/60 leading-relaxed mt-3">
              This indemnification obligation shall survive the termination of these Terms and your cessation of use of the Software.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">7. Assumption of Risk</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              You expressly acknowledge and agree that your use of the Software is at your sole and exclusive risk. You understand and accept that:
            </p>
            <ul className="text-sm text-white/60 leading-relaxed space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Automated interaction with third-party websites carries inherent risks, including but not limited to account suspension, IP blocking, legal action by providers, and data loss.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>The use of browser automation, stealth techniques, residential proxies, and CAPTCHA-solving services may violate the terms of service of certain providers and may have legal implications in certain jurisdictions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>No encryption system is infallible. While the Software uses AES-256-GCM encryption, no security measure can guarantee absolute protection against all threats.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>Third-party providers may change their websites, APIs, security measures, or terms of service at any time, which may render the Software partially or wholly non-functional.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1 shrink-0">•</span>
                <span>You assume all risk associated with the storage of sensitive credentials on your local machine, including risks from malware, unauthorized physical access, or hardware failure.</span>
              </li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">8. Third-Party Services and Providers</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              The Software interacts with third-party services and websites over which we have no control. We are not responsible for the availability, accuracy, content, policies, or practices of any third-party service. Your interactions with third-party services through the Software are governed solely by the terms and policies of those third parties.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              We do not endorse, warrant, or assume responsibility for any third-party service, product, or content. Any reliance you place on third-party services accessed through the Software is strictly at your own risk. We shall not be liable for any damage or loss caused by or in connection with the use of or reliance on any third-party service.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">9. Intellectual Property</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              The Software, including all code, documentation, design, logos, trademarks, and other intellectual property, is owned by Archibald Titan and is protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to use the Software for personal or internal business purposes only. You may not copy, modify, distribute, sell, lease, sublicense, reverse engineer, decompile, or disassemble the Software or any part thereof without prior written consent.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">10. Termination</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              We reserve the right to terminate or suspend your access to the Software at any time, for any reason, without prior notice or liability. Upon termination, all licenses granted to you under these Terms shall immediately cease. Sections 4, 5, 6, 7, 11, 12, and 13 shall survive any termination of these Terms.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">11. Governing Law and Dispute Resolution</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the Software shall be resolved exclusively through binding arbitration administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              YOU AGREE TO WAIVE YOUR RIGHT TO A JURY TRIAL AND YOUR RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION. All claims must be brought in the parties' individual capacity and not as a plaintiff or class member in any purported class or representative proceeding.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">12. Force Majeure</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              We shall not be liable for any failure or delay in performing our obligations under these Terms where such failure or delay results from any cause beyond our reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, pandemic, strikes, or shortages of transportation, facilities, fuel, energy, labor, or materials.
            </p>
          </section>

          {/* Section 13 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">13. Severability and Entire Agreement</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, such provision shall be modified to the minimum extent necessary to make it valid and enforceable, or if modification is not possible, shall be severed from these Terms. The remaining provisions shall continue in full force and effect.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Archibald Titan regarding the Software and supersede all prior or contemporaneous agreements, representations, warranties, and understandings, whether written or oral.
            </p>
          </section>

          {/* Section 14 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">14. No Waiver</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision. Any waiver of any provision of these Terms will be effective only if in writing and signed by us.
            </p>
          </section>

          {/* Section 15 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">15. Contact Information</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              For questions about these Terms, please contact us through the dashboard or at the contact information provided on our website. We will make reasonable efforts to respond to inquiries in a timely manner, but we are under no obligation to do so.
            </p>
          </section>

          {/* Acknowledgment */}
          <section className="mt-12 p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <h2 className="text-lg font-bold text-white mb-3">Acknowledgment</h2>
            <p className="text-sm text-white/60 leading-relaxed">
              BY DOWNLOADING, INSTALLING, OR USING ARCHIBALD TITAN, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS AND CONDITIONS. YOU FURTHER ACKNOWLEDGE THAT THESE TERMS CONSTITUTE A COMPLETE AND EXCLUSIVE STATEMENT OF THE AGREEMENT BETWEEN YOU AND ARCHIBALD TITAN, AND THAT THEY SUPERSEDE ANY PROPOSAL OR PRIOR AGREEMENT, ORAL OR WRITTEN, AND ANY OTHER COMMUNICATIONS BETWEEN YOU AND ARCHIBALD TITAN RELATING TO THE SUBJECT MATTER OF THESE TERMS.
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
            <Link href="/terms" className="text-xs text-blue-400/60 hover:text-blue-400 transition-colors">Terms & Conditions</Link>
            <Link href="/privacy" className="text-xs text-white/20 hover:text-white/40 transition-colors">Privacy Policy</Link>
            <Link href="/" className="text-xs text-white/20 hover:text-white/40 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
