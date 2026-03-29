import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { initAdTracking } from "@/lib/adTracking";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import FetcherLayout from "./components/FetcherLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ArchibaldProvider } from "./contexts/ArchibaldContext";
import { VoiceModeProvider } from "./components/VoiceMode";

// Public pages
import LandingPage from "./pages/LandingPage";
import BuilderPage from "./pages/BuilderPage";
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
import { RegisterPage } from "./pages/RegisterPage";
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
import ChatPage from "./pages/ChatPage";
import FetcherNew from "./pages/FetcherNew";
import FetcherJobs from "./pages/FetcherJobs";
import FetcherJobDetail from "./pages/FetcherJobDetail";
import FetcherCredentials from "./pages/FetcherCredentials";
import FetcherExport from "./pages/FetcherExport";
import FetcherSettings from "./pages/FetcherSettings";

// Developer Tools
import ReplicatePage from "./pages/ReplicatePage";
import SandboxPage from "./pages/SandboxPage";
import SmartFetchPage from "./pages/SmartFetchPage";
import MarketplacePage from "./pages/MarketplacePage";

// Security
import WatchdogPage from "./pages/WatchdogPage";
import ProviderHealthPage from "./pages/ProviderHealthPage";
import HealthTrendsPage from "./pages/HealthTrendsPage";
import LeakScannerPage from "./pages/LeakScannerPage";
import CredentialHealthPage from "./pages/CredentialHealthPage";
import TotpVaultPage from "./pages/TotpVaultPage";

// Business & Funding
import GrantsPage from "./pages/GrantsPage";
import GrantDetailPage from "./pages/GrantDetailPage";
import GrantApplicationsPage from "./pages/GrantApplicationsPage";
import CompaniesPage from "./pages/CompaniesPage";
import BusinessPlanPage from "./pages/BusinessPlanPage";
import CrowdfundingPage from "./pages/CrowdfundingPage";
import ReferralsPage from "./pages/ReferralsPage";
import AdvertisingDashboard from "./pages/AdvertisingDashboard";
import MasterGrowthDashboard from "./pages/MasterGrowthDashboard";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import SeoDashboard from "./pages/SeoDashboard";
import BlogAdmin from "./pages/BlogAdmin";
import MarketingPage from "./pages/MarketingPage";

// Account & Settings
import AccountSettingsPage from "./pages/AccountSettingsPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import CreditsPage from "./pages/CreditsPage";
import ApiAccessPage from "./pages/ApiAccessPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import TeamVaultPage from "./pages/TeamVaultPage";

// Automation
import ImportPage from "./pages/ImportPage";
import BulkSyncPage from "./pages/BulkSyncPage";
import AutoSyncPage from "./pages/AutoSyncPage";
import ProviderOnboardingPage from "./pages/ProviderOnboardingPage";
import CredentialHistoryPage from "./pages/CredentialHistoryPage";
import AuditLogsPage from "./pages/AuditLogsPage";

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
import AdminPanel from "./pages/AdminPanel";
import AdminActivityLogPage from "./pages/AdminActivityLogPage";
import TitanServerAdminPage from "./pages/TitanServerAdminPage";
import SelfImprovementDashboard from "./pages/SelfImprovementDashboard";

// Project Files
import ProjectFilesViewer from "./pages/ProjectFilesViewer";

// Site Monitor
import SiteMonitorPage from "./pages/SiteMonitorPage";

// LinkenSphere Integration
import LinkenSpherePage from "./pages/LinkenSpherePage";

// Evilginx Management
import EvilginxPage from "./pages/EvilginxPage";
// Specialised Tools
import BlackEyePage from "./pages/BlackEyePage";
import MetasploitPage from "./pages/MetasploitPage";
import ExploitPackPage from "./pages/ExploitPackPage";

// Content Creator
import ContentCreatorPage from "./pages/ContentCreatorPage";

// Security Tools
import CyberMCPPage from "./pages/CyberMCPPage";
import AstraPage from "./pages/AstraPage";
import ArgusPage from "./pages/ArgusPage";

// Titan Storage Add-on
import TitanStoragePage from "./pages/TitanStoragePage";

// Privacy & Anonymity Tools
import TorPage from "./pages/TorPage";
import VpnChainPage from "./pages/VpnChainPage";
import IsolatedBrowserPage from "./pages/IsolatedBrowserPage";
import ProxyMakerPage from "./pages/ProxyMakerPage";
import ProxyRotationPage from "./pages/ProxyRotationPage";
import IPRotationPage from "./pages/IPRotationPage";
import BinCheckerPage from "./pages/BinCheckerPage";
import WebAgentPage from "./pages/WebAgentPage";
import ProxyInterceptorPage from "./pages/ProxyInterceptorPage";
import RedTeamPlaybooksPage from "./pages/RedTeamPlaybooksPage";
import CommandCentrePage from "./pages/CommandCentrePage";
import EventBusPage from "./pages/EventBusPage";
import ComplianceReportsPage from "./pages/ComplianceReportsPage";
import SiemIntegrationPage from "./pages/SiemIntegrationPage";
import SecurityMarketplacePage from "./pages/SecurityMarketplacePage";


function DashboardRouter() {
  return (
    <FetcherLayout>
      <Switch>
        {/* Main Dashboard - Builder Chat */}
        <Route path="/dashboard" component={ChatPage} />

        {/* Developer Tools */}
        <Route path="/replicate" component={ReplicatePage} />
        <Route path="/sandbox" component={SandboxPage} />
        <Route path="/fetcher/smart-fetch" component={SmartFetchPage} />
        <Route path="/fetcher/new" component={FetcherNew} />
        <Route path="/fetcher/jobs" component={FetcherJobs} />
        <Route path="/fetcher/jobs/:id" component={FetcherJobDetail} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/marketplace/:rest*" component={MarketplacePage} />
        <Route path="/project-files" component={ProjectFilesViewer} />
        <Route path="/project-files/:projectId" component={ProjectFilesViewer} />

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
        <Route path="/advertising" component={AdvertisingDashboard} />
        <Route path="/master-growth" component={MasterGrowthDashboard} />
        <Route path="/affiliate" component={AffiliateDashboard} />
        <Route path="/seo" component={SeoDashboard} />
        <Route path="/blog-admin" component={BlogAdmin} />
        <Route path="/marketing" component={MarketingPage} />

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

        {/* LinkenSphere */}
        <Route path="/linken-sphere" component={LinkenSpherePage} />

        {/* Evilginx */}
        <Route path="/evilginx" component={EvilginxPage} />

        {/* Specialised Tools */}
        <Route path="/blackeye" component={BlackEyePage} />
        <Route path="/metasploit" component={MetasploitPage} />
        <Route path="/exploitpack" component={ExploitPackPage} />

        {/* Content Creator */}
        <Route path="/content-creator" component={ContentCreatorPage} />

        {/* Security Tools */}
        <Route path="/cybermcp" component={CyberMCPPage} />
        <Route path="/astra" component={AstraPage} />
        <Route path="/argus" component={ArgusPage} />

        {/* Titan Storage Add-on */}
        <Route path="/storage" component={TitanStoragePage} />

        {/* Privacy & Anonymity Tools */}
        <Route path="/tor" component={TorPage} />
        <Route path="/vpn-chain" component={VpnChainPage} />
        <Route path="/isolated-browser" component={IsolatedBrowserPage} />
        <Route path="/proxy-maker" component={ProxyMakerPage} />
        <Route path="/proxy-rotation" component={ProxyRotationPage} />
        <Route path="/ip-rotation" component={IPRotationPage} />
        <Route path="/bin-checker" component={BinCheckerPage} />
        <Route path="/web-agent" component={WebAgentPage} />

        {/* Admin */}
        <Route path="/fetcher/releases" component={ReleaseManagementPage} />
        <Route path="/fetcher/admin" component={AdminPanel} />
        <Route path="/admin/activity-log" component={AdminActivityLogPage} />
        <Route path="/admin/titan-server" component={TitanServerAdminPage} />
        <Route path="/fetcher/self-improvement" component={SelfImprovementDashboard} />

        {/* Desktop App Settings */}
        <Route path="/desktop-settings" component={DesktopSettingsPage} />

        {/* Builder Templates */}
        <Route path="/builder-templates" component={BuilderTemplatesPage} />

        {/* Attack Graph */}
        <Route path="/attack-graph" component={AttackGraphPage} />

        {/* Proxy Interceptor */}
        <Route path="/proxy-interceptor" component={ProxyInterceptorPage} />

        {/* Red Team Playbooks */}
        <Route path="/red-team-playbooks" component={RedTeamPlaybooksPage} />

        {/* Command Centre */}
        <Route path="/command-centre" component={CommandCentrePage} />

        {/* Event Bus */}
        <Route path="/event-bus" component={EventBusPage} />

        {/* Compliance Reports */}
        <Route path="/compliance-reports" component={ComplianceReportsPage} />

        {/* SIEM Integration */}
        <Route path="/siem-integration" component={SiemIntegrationPage} />

        {/* Security Marketplace */}
        <Route path="/security-marketplace" component={SecurityMarketplacePage} />

        <Route component={NotFound} />
      </Switch>
    </FetcherLayout>
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
      {/* Desktop settings hub */}
      <Route path="/desktop-settings" component={DashboardRouter} />

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
      <Route path="/isolated-browser" component={DashboardRouter} />
      <Route path="/proxy-maker" component={DashboardRouter} />
      <Route path="/proxy-rotation" component={DashboardRouter} />
      <Route path="/ip-rotation" component={DashboardRouter} />
      <Route path="/bin-checker" component={DashboardRouter} />
      <Route path="/web-agent" component={DashboardRouter} />
      <Route path="/admin/titan-server" component={DashboardRouter} />
      <Route path="/admin/activity-log" component={DashboardRouter} />
      <Route path="/fetcher/self-improvement" component={DashboardRouter} />

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
