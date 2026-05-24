import { useEffect, lazy, Suspense } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { isAdminRole } from "@shared/const";
import { useLocation } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { initAdTracking } from "@/lib/adTracking";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import MarketingLayout from "@/components/MarketingLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import FetcherLayout from "./components/FetcherLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ArchibaldProvider } from "./contexts/ArchibaldContext";
import { VoiceModeProvider } from "./components/VoiceMode";

// Public pages
import LandingPage from "./pages/LandingPage";
const BuilderPage = lazy(() => import("./pages/BuilderPage"));
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ContactPage from "./pages/ContactPage";
import PricingPage from "./pages/PricingPage";
import BlogPage from "./pages/BlogPage";
import SecurityPage from "./pages/SecurityPage";
import UseCasesPage from "./pages/UseCasesPage";
import ExamplesPage from "./pages/ExamplesPage";
import AboutPage from "./pages/AboutPage";
import ChangelogPage from "./pages/ChangelogPage";
import VsCopilotPage from "./pages/VsCopilotPage";
import VsNoCodePage from "./pages/VsNoCodePage";
import VsCloudAiPage from "./pages/VsCloudAiPage";
import DocsPage from "./pages/DocsPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import CustomersPage from "./pages/CustomersPage";
import DemoPage from "./pages/DemoPage";

// Auth pages
import { LoginPage } from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import DesktopLoginPage from "./pages/DesktopLoginPage";
import DesktopBillingCallbackPage from "./pages/DesktopBillingCallbackPage";
import DesktopSettingsPage from "./pages/DesktopSettingsPage";
import BuilderTemplatesPage from "./pages/BuilderTemplatesPage";
import AttackGraphPage from "./pages/AttackGraphPage";
import PaymentSetupPage from "./pages/PaymentSetupPage";

// Dashboard / Builder
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import ChatPage from "./pages/ChatPage";
import FetcherNew from "./pages/FetcherNew";
import FetcherJobs from "./pages/FetcherJobs";
import FetcherJobDetail from "./pages/FetcherJobDetail";
import FetcherCredentials from "./pages/FetcherCredentials";
import FetcherExport from "./pages/FetcherExport";
import FetcherSettings from "./pages/FetcherSettings";

// Developer Tools
const ReplicatePage = lazy(() => import("./pages/ReplicatePage"));
const SandboxPage = lazy(() => import("./pages/SandboxPage"));
import SmartFetchPage from "./pages/SmartFetchPage";
const MarketplacePage = lazy(() => import("./pages/MarketplacePage"));

// Security
const WatchdogPage = lazy(() => import("./pages/WatchdogPage"));
import ProviderHealthPage from "./pages/ProviderHealthPage";
import HealthTrendsPage from "./pages/HealthTrendsPage";
import LeakScannerPage from "./pages/LeakScannerPage";
import CredentialHealthPage from "./pages/CredentialHealthPage";
import TotpVaultPage from "./pages/TotpVaultPage";

// Business & Funding
const GrantsPage = lazy(() => import("./pages/GrantsPage"));
const GrantDetailPage = lazy(() => import("./pages/GrantDetailPage"));
const GrantApplicationsPage = lazy(() => import("./pages/GrantApplicationsPage"));
import CompaniesPage from "./pages/CompaniesPage";
const BusinessPlanPage = lazy(() => import("./pages/BusinessPlanPage"));
const CrowdfundingPage = lazy(() => import("./pages/CrowdfundingPage"));
import ReferralsPage from "./pages/ReferralsPage";
const AdvertisingDashboard = lazy(() => import("./pages/AdvertisingDashboard"));
const MasterGrowthDashboard = lazy(() => import("./pages/MasterGrowthDashboard"));
const GrowthSuitePage = lazy(() => import("./pages/GrowthSuitePage"));
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const SeoDashboard = lazy(() => import("./pages/SeoDashboard"));
const BlogAdmin = lazy(() => import("./pages/BlogAdmin"));
const MarketingPage = lazy(() => import("./pages/MarketingPage"));

// Account & Settings
import AccountSettingsPage from "./pages/AccountSettingsPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import CreditsPage from "./pages/CreditsPage";
import ApiAccessPage from "./pages/ApiAccessPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import TeamVaultPage from "./pages/TeamVaultPage";

// Automation
import ImportPage from "./pages/ImportPage";
const BulkSyncPage = lazy(() => import("./pages/BulkSyncPage"));
import AutoSyncPage from "./pages/AutoSyncPage";
import ProviderOnboardingPage from "./pages/ProviderOnboardingPage";
import CredentialHistoryPage from "./pages/CredentialHistoryPage";
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));

// Developer API
import DeveloperDocsPage from "./pages/DeveloperDocsPage";
import WebhooksPage from "./pages/WebhooksPage";
import NotificationChannelsPage from "./pages/NotificationChannelsPage";
import ApiAnalyticsPage from "./pages/ApiAnalyticsPage";
import CliToolPage from "./pages/CliToolPage";
import GitBashPage from "./pages/GitBashPage";
import DownloadAppPage from "./pages/DownloadAppPage";

// Admin
import ReleaseManagementPage from "./pages/ReleaseManagementPage";
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
import AdminActivityLogPage from "./pages/AdminActivityLogPage";
import TitanServerAdminPage from "./pages/TitanServerAdminPage";
const SelfImprovementDashboard = lazy(() => import("./pages/SelfImprovementDashboard"));

// Project Files
import ProjectFilesViewer from "./pages/ProjectFilesViewer";
import BridgeAIPage from "./pages/BridgeAI";

// Site Monitor
import SiteMonitorPage from "./pages/SiteMonitorPage";

// LinkenSphere Integration
const LinkenSpherePage = lazy(() => import("./pages/LinkenSpherePage"));

// Evilginx Management
const EvilginxPage = lazy(() => import("./pages/EvilginxPage"));
// Specialised Tools
const BlackEyePage = lazy(() => import("./pages/BlackEyePage"));
const MetasploitPage = lazy(() => import("./pages/MetasploitPage"));
const ExploitPackPage = lazy(() => import("./pages/ExploitPackPage"));

// Content Creator
const ContentCreatorPage = lazy(() => import("./pages/ContentCreatorPage"));

// Security Tools
const CyberMCPPage = lazy(() => import("./pages/CyberMCPPage"));
const AstraPage = lazy(() => import("./pages/AstraPage"));
const ArgusPage = lazy(() => import("./pages/ArgusPage"));

// Titan Storage Add-on
import TitanStoragePage from "./pages/TitanStoragePage";

// Privacy & Anonymity Tools
const TorPage = lazy(() => import("./pages/TorPage"));
const VpnChainPage = lazy(() => import("./pages/VpnChainPage"));
const VpnPage = lazy(() => import("./pages/VpnPage"));
const IsolatedBrowserPage = lazy(() => import("./pages/IsolatedBrowserPage"));
const ProxyMakerPage = lazy(() => import("./pages/ProxyMakerPage"));
const ProxyRotationPage = lazy(() => import("./pages/ProxyRotationPage"));
const IPRotationPage = lazy(() => import("./pages/IPRotationPage"));
const BinCheckerPage = lazy(() => import("./pages/BinCheckerPage"));
const WebAgentPage = lazy(() => import("./pages/WebAgentPage"));
import ProxyInterceptorPage from "./pages/ProxyInterceptorPage";
const RedTeamPlaybooksPage = lazy(() => import("./pages/RedTeamPlaybooksPage"));
import CommandCentrePage from "./pages/CommandCentrePage";
import EventBusPage from "./pages/EventBusPage";
import ComplianceReportsPage from "./pages/ComplianceReportsPage";
const SiemIntegrationPage = lazy(() => import("./pages/SiemIntegrationPage"));
const SecurityMarketplacePage = lazy(() => import("./pages/SecurityMarketplacePage"));

/** Renders the given page only when the logged-in user has an admin role.
 * Non-admins are immediately redirected to /dashboard. */
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  if (loading) return null;
  if (!user || !isAdminRole(user.role)) {
    setLocation("/dashboard");
    return null;
  }
  return <Component />;
}

/** Renders the given page only for Cyber/Enterprise/Titan subscribers + admins.
   * Free and Pro users are redirected to /pricing to upgrade. */
  function CyberRoute({ component: Component }: { component: React.ComponentType }) {
    const { user, loading } = useAuth();
    const sub = useSubscription();
    const [, setLocation] = useLocation();
    if (loading || sub.loading) return null;
    if (!user) {
      setLocation("/login");
      return null;
    }
    const isAdmin = isAdminRole(user.role);
    const hasCyberAccess = isAdmin || ["enterprise", "cyber", "cyber_plus", "titan"].includes(sub.planId);
    if (!hasCyberAccess) {
      setLocation("/pricing");
      return null;
    }
    return <Component />;
  }

  function DashboardRouter() {
  return (
    <Suspense fallback={<DashboardLayoutSkeleton />}>
    <RouteErrorBoundary>
    <FetcherLayout>
      <Switch>
        {/* Main Dashboard - Builder Chat */}
        <Route path="/dashboard" component={ChatPage} />

        {/* Developer Tools */}
        <Route path="/replicate" component={() => <AdminRoute component={ReplicatePage} />} />
        <Route path="/sandbox" component={SandboxPage} />
        <Route path="/fetcher/smart-fetch" component={SmartFetchPage} />
        <Route path="/fetcher/new" component={FetcherNew} />
        <Route path="/fetcher/jobs" component={FetcherJobs} />
        <Route path="/fetcher/jobs/:id" component={FetcherJobDetail} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/marketplace/:rest*" component={MarketplacePage} />
        <Route path="/project-files" component={ProjectFilesViewer} />
        <Route path="/project-files/:projectId" component={ProjectFilesViewer} />
        <Route path="/bridge" component={BridgeAIPage} />

        {/* Security */}
        <Route path="/fetcher/totp-vault" component={TotpVaultPage} />
        <Route path="/fetcher/watchdog" component={WatchdogPage} />
        <Route path="/fetcher/provider-health" component={ProviderHealthPage} />
        <Route path="/fetcher/health-trends" component={HealthTrendsPage} />
        <Route path="/fetcher/leak-scanner" component={LeakScannerPage} />
        <Route path="/fetcher/credential-health" component={CredentialHealthPage} />

        {/* Business & Funding */}
        <Route path="/grants" component={GrantsPage} />
        <Route path="/grants/:id" component={GrantDetailPage} />
        <Route path="/grant-applications" component={GrantApplicationsPage} />
        <Route path="/companies" component={CompaniesPage} />
        <Route path="/business-plans" component={BusinessPlanPage} />
        <Route path="/crowdfunding" component={CrowdfundingPage} />
        <Route path="/crowdfunding/:rest*" component={CrowdfundingPage} />
        <Route path="/referrals" component={ReferralsPage} />
        <Route path="/advertising" component={() => <AdminRoute component={AdvertisingDashboard} />} />
        <Route path="/master-growth" component={() => <AdminRoute component={MasterGrowthDashboard} />} />
        <Route path="/growth-suite" component={() => <AdminRoute component={GrowthSuitePage} />} />
        <Route path="/affiliate" component={AffiliateDashboard} />
        <Route path="/seo" component={() => <AdminRoute component={SeoDashboard} />} />
        <Route path="/blog-admin" component={() => <AdminRoute component={BlogAdmin} />} />
        <Route path="/marketing" component={() => <AdminRoute component={MarketingPage} />} />

        {/* Account & Settings */}
        <Route path="/dashboard/subscription" component={SubscriptionPage} />
        <Route path="/dashboard/credits" component={CreditsPage} />
        <Route path="/fetcher/credentials" component={FetcherCredentials} />
        <Route path="/fetcher/api-access" component={ApiAccessPage} />
        <Route path="/fetcher/team" component={TeamManagementPage} />
        <Route path="/fetcher/team-vault" component={TeamVaultPage} />
        <Route path="/fetcher/settings" component={FetcherSettings} />
        <Route path="/fetcher/account" component={AccountSettingsPage} />

        {/* Automation */}
        <Route path="/fetcher/export" component={FetcherExport} />
        <Route path="/fetcher/import" component={ImportPage} />
        <Route path="/fetcher/bulk-sync" component={BulkSyncPage} />
        <Route path="/fetcher/auto-sync" component={AutoSyncPage} />
        <Route path="/fetcher/onboarding" component={ProviderOnboardingPage} />
        <Route path="/fetcher/history" component={CredentialHistoryPage} />
        <Route path="/fetcher/audit-logs" component={AuditLogsPage} />

        {/* Developer API */}
        <Route path="/fetcher/developer-docs" component={DeveloperDocsPage} />
        <Route path="/fetcher/webhooks" component={WebhooksPage} />
        <Route path="/fetcher/notifications" component={NotificationChannelsPage} />
        <Route path="/fetcher/api-analytics" component={ApiAnalyticsPage} />
        <Route path="/fetcher/cli" component={CliToolPage} />
        <Route path="/fetcher/git-bash" component={GitBashPage} />
        <Route path="/fetcher/download-app" component={DownloadAppPage} />

        {/* Site Monitor */}
        <Route path="/site-monitor" component={SiteMonitorPage} />

        {/* LinkenSphere — admin only */}
        <Route path="/linken-sphere" component={() => <AdminRoute component={LinkenSpherePage} />} />

        {/* Evilginx — admin only */}
        <Route path="/evilginx" component={() => <CyberRoute component={EvilginxPage} />} />

        {/* Specialised Tools — admin only */}
        <Route path="/blackeye" component={() => <CyberRoute component={BlackEyePage} />} />
        <Route path="/metasploit" component={() => <CyberRoute component={MetasploitPage} />} />
        <Route path="/exploitpack" component={() => <CyberRoute component={ExploitPackPage} />} />

        {/* Content Creator */}
        <Route path="/content-creator" component={ContentCreatorPage} />

        {/* Security Tools */}
        <Route path="/cybermcp" component={() => <CyberRoute component={CyberMCPPage} />} />
        <Route path="/astra" component={() => <CyberRoute component={AstraPage} />} />
        <Route path="/argus" component={() => <CyberRoute component={ArgusPage} />} />

        {/* Titan Storage Add-on */}
        <Route path="/storage" component={TitanStoragePage} />

        {/* Privacy & Anonymity Tools — admin only */}
        <Route path="/tor" component={() => <CyberRoute component={TorPage} />} />
        <Route path="/vpn-chain" component={() => <CyberRoute component={VpnChainPage} />} />
        <Route path="/vpn" component={() => <CyberRoute component={VpnPage} />} />
        <Route path="/isolated-browser" component={() => <CyberRoute component={IsolatedBrowserPage} />} />
        <Route path="/proxy-maker" component={() => <CyberRoute component={ProxyMakerPage} />} />
        <Route path="/proxy-rotation" component={() => <CyberRoute component={ProxyRotationPage} />} />
        <Route path="/ip-rotation" component={() => <CyberRoute component={IPRotationPage} />} />
        <Route path="/bin-checker" component={() => <CyberRoute component={BinCheckerPage} />} />
        <Route path="/web-agent" component={() => <CyberRoute component={WebAgentPage} />} />

        {/* Admin — requires admin role; non-admins are redirected to /dashboard */}
        <Route path="/fetcher/releases" component={() => <AdminRoute component={ReleaseManagementPage} />} />
        <Route path="/fetcher/admin" component={() => <AdminRoute component={AdminPanel} />} />
        <Route path="/admin/activity-log" component={() => <AdminRoute component={AdminActivityLogPage} />} />
        <Route path="/admin/titan-server" component={() => <AdminRoute component={TitanServerAdminPage} />} />
        <Route path="/fetcher/self-improvement" component={() => <AdminRoute component={SelfImprovementDashboard} />} />

        {/* Desktop App Settings */}
        <Route path="/desktop-settings" component={DesktopSettingsPage} />

        {/* Builder Templates */}
        <Route path="/builder-templates" component={BuilderTemplatesPage} />

        {/* Attack Graph */}
        <Route path="/attack-graph" component={() => <CyberRoute component={AttackGraphPage} />} />

        {/* Proxy Interceptor — admin only */}
        <Route path="/proxy-interceptor" component={() => <CyberRoute component={ProxyInterceptorPage} />} />

        {/* Red Team Playbooks — admin only */}
        <Route path="/red-team-playbooks" component={() => <CyberRoute component={RedTeamPlaybooksPage} />} />

        {/* Command Centre */}
        <Route path="/command-centre" component={CommandCentrePage} />

        {/* Event Bus */}
        <Route path="/event-bus" component={() => <AdminRoute component={EventBusPage} />} />

        {/* Compliance Reports */}
        <Route path="/compliance-reports" component={ComplianceReportsPage} />

        {/* SIEM Integration — admin only */}
        <Route path="/siem-integration" component={() => <AdminRoute component={SiemIntegrationPage} />} />

        {/* Security Marketplace — admin only */}
        <Route path="/security-marketplace" component={() => <AdminRoute component={SecurityMarketplacePage} />} />

        <Route component={NotFound} />
      </Switch>
    </FetcherLayout>
    </RouteErrorBoundary>
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public landing page */}
      <Route path="/" component={LandingPage} />

      {/* Auth pages */}
      <Route path="/payment-setup" component={PaymentSetupPage} />
      <Route path="/login" component={() => <LoginPage />} />
      <Route path="/register" component={() => <SignUpPage />} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/desktop-login" component={DesktopLoginPage} />
      {/* Desktop billing callback — handles titandesktop:// deep links from Stripe */}
      <Route path="/desktop-billing-callback" component={DesktopBillingCallbackPage} />
      {/* Desktop settings hub — renders without requiring dashboard auth wrapper */}
      <Route path="/desktop-settings" component={DesktopSettingsPage} />

      {/* Public pages */}
      <Route path="/builder" component={BuilderPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:rest*" component={BlogPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/use-cases" component={UseCasesPage} />
      <Route path="/examples" component={ExamplesPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/changelog" component={ChangelogPage} />
      <Route path="/vs-copilot" component={VsCopilotPage} />
      <Route path="/vs-no-code" component={VsNoCodePage} />
      <Route path="/vs-cloud-ai" component={VsCloudAiPage} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/how-it-works" component={HowItWorksPage} />
      <Route path="/customers" component={CustomersPage} />
      <Route path="/demo" component={DemoPage} />
        <Route path="/developer-docs" component={() => (
            <MarketingLayout>
              <div className="pt-16 container max-w-4xl py-12">
                <DeveloperDocsPage />
              </div>
            </MarketingLayout>
          )} />
        <Route path="/cli" component={CliToolPage} />
        <Route path="/download" component={DownloadAppPage} />

      {/* Dashboard routes — wrapped in FetcherLayout with sidebar + auth */}
      <Route path="/dashboard/:rest*" component={DashboardRouter} />
      <Route path="/dashboard" component={DashboardRouter} />
      <Route path="/fetcher/:rest*" component={DashboardRouter} />
      <Route path="/replicate" component={DashboardRouter} />
      <Route path="/sandbox" component={DashboardRouter} />
      <Route path="/marketplace/:rest*" component={DashboardRouter} />
      <Route path="/marketplace" component={DashboardRouter} />
      <Route path="/project-files/:rest*" component={DashboardRouter} />
      <Route path="/project-files" component={DashboardRouter} />
      <Route path="/grants/:rest*" component={DashboardRouter} />
      <Route path="/grants" component={DashboardRouter} />
      <Route path="/grant-applications" component={DashboardRouter} />
      <Route path="/companies" component={DashboardRouter} />
      <Route path="/business-plans" component={DashboardRouter} />
      <Route path="/crowdfunding/:rest*" component={DashboardRouter} />
      <Route path="/crowdfunding" component={DashboardRouter} />
      <Route path="/referrals" component={DashboardRouter} />
      <Route path="/advertising" component={DashboardRouter} />
      <Route path="/master-growth" component={DashboardRouter} />
      <Route path="/growth-suite" component={DashboardRouter} />
      <Route path="/affiliate" component={DashboardRouter} />
      <Route path="/seo" component={DashboardRouter} />
      <Route path="/blog-admin" component={DashboardRouter} />
      <Route path="/marketing" component={DashboardRouter} />
      <Route path="/site-monitor" component={DashboardRouter} />
      <Route path="/linken-sphere" component={DashboardRouter} />
      <Route path="/evilginx" component={DashboardRouter} />
      <Route path="/blackeye" component={DashboardRouter} />
      <Route path="/metasploit" component={DashboardRouter} />
      <Route path="/content-creator" component={DashboardRouter} />
      <Route path="/cybermcp" component={DashboardRouter} />
      <Route path="/astra" component={DashboardRouter} />
      <Route path="/argus" component={DashboardRouter} />
      <Route path="/storage" component={DashboardRouter} />
      <Route path="/tor" component={DashboardRouter} />
      <Route path="/vpn-chain" component={DashboardRouter} />
        <Route path="/vpn" component={DashboardRouter} />
      <Route path="/isolated-browser" component={DashboardRouter} />
      <Route path="/proxy-maker" component={DashboardRouter} />
      <Route path="/proxy-rotation" component={DashboardRouter} />
      <Route path="/ip-rotation" component={DashboardRouter} />
      <Route path="/bin-checker" component={DashboardRouter} />
      <Route path="/web-agent" component={DashboardRouter} />
      <Route path="/admin/titan-server" component={DashboardRouter} />
      <Route path="/admin/activity-log" component={DashboardRouter} />
      <Route path="/fetcher/self-improvement" component={DashboardRouter} />
      {/* Additional dashboard routes — were missing from outer Switch causing 404 */}
      <Route path="/proxy-interceptor" component={DashboardRouter} />
      <Route path="/attack-graph" component={DashboardRouter} />
      <Route path="/red-team-playbooks" component={DashboardRouter} />
      <Route path="/command-centre" component={DashboardRouter} />
      <Route path="/event-bus" component={DashboardRouter} />
      <Route path="/compliance-reports" component={DashboardRouter} />
      <Route path="/siem-integration" component={DashboardRouter} />
      <Route path="/security-marketplace" component={DashboardRouter} />
      <Route path="/exploitpack" component={DashboardRouter} />
      <Route path="/builder-templates" component={DashboardRouter} />
      <Route path="/bridge" component={DashboardRouter} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    initAdTracking();
  }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <ArchibaldProvider>
          <VoiceModeProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </VoiceModeProvider>
        </ArchibaldProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;