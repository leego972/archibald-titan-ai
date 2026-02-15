import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import FetcherLayout from "./components/FetcherLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import LandingPage from "./pages/LandingPage";
import FetcherNew from "./pages/FetcherNew";
import FetcherJobs from "./pages/FetcherJobs";
import FetcherJobDetail from "./pages/FetcherJobDetail";
import FetcherCredentials from "./pages/FetcherCredentials";
import FetcherExport from "./pages/FetcherExport";
import FetcherSettings from "./pages/FetcherSettings";
import FetcherKillSwitch from "./pages/FetcherKillSwitch";
import ApiAccessPage from "./pages/ApiAccessPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ContactPage from "./pages/ContactPage";
import PricingPage from "./pages/PricingPage";
import ReleaseManagementPage from "./pages/ReleaseManagementPage";
import WatchdogPage from "./pages/WatchdogPage";
import BulkSyncPage from "./pages/BulkSyncPage";
import CredentialHistoryPage from "./pages/CredentialHistoryPage";
import ChatPage from "./pages/ChatPage";
import ProviderHealthPage from "./pages/ProviderHealthPage";
import AutoSyncPage from "./pages/AutoSyncPage";
import SmartFetchPage from "./pages/SmartFetchPage";
import HealthTrendsPage from "./pages/HealthTrendsPage";
import LeakScannerPage from "./pages/LeakScannerPage";
import ProviderOnboardingPage from "./pages/ProviderOnboardingPage";
import TeamVaultPage from "./pages/TeamVaultPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DeveloperDocsPage from "./pages/DeveloperDocsPage";
import WebhooksPage from "./pages/WebhooksPage";
import ApiAnalyticsPage from "./pages/ApiAnalyticsPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AdminPanel from "./pages/AdminPanel";
import SelfImprovementDashboard from "./pages/SelfImprovementDashboard";
import CreditsPage from "./pages/CreditsPage";
import DesktopLoginPage from "./pages/DesktopLoginPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import ImportPage from "./pages/ImportPage";
import CredentialHealthPage from "./pages/CredentialHealthPage";
import NotificationChannelsPage from "./pages/NotificationChannelsPage";
import CliToolPage from "./pages/CliToolPage";
import TotpVaultPage from "./pages/TotpVaultPage";
import GrantsPage from "./pages/GrantsPage";
import GrantDetailPage from "./pages/GrantDetailPage";
import CompaniesPage from "./pages/CompaniesPage";
import BusinessPlanPage from "./pages/BusinessPlanPage";
import GrantApplicationsPage from "./pages/GrantApplicationsPage";
import CrowdfundingPage from "./pages/CrowdfundingPage";

function DashboardRouter() {
  return (
    <FetcherLayout>
      <Switch>
        <Route path="/dashboard" component={ChatPage} />
        <Route path="/fetcher/new" component={FetcherNew} />
        <Route path="/fetcher/jobs" component={FetcherJobs} />
        <Route path="/fetcher/jobs/:id" component={FetcherJobDetail} />
        <Route path="/fetcher/credentials" component={FetcherCredentials} />
        <Route path="/fetcher/export" component={FetcherExport} />
        <Route path="/fetcher/settings" component={FetcherSettings} />
        <Route path="/fetcher/killswitch" component={FetcherKillSwitch} />
        <Route path="/fetcher/api-access" component={ApiAccessPage} />
        <Route path="/fetcher/team" component={TeamManagementPage} />
        <Route path="/fetcher/audit-logs" component={AuditLogsPage} />
        <Route path="/fetcher/releases" component={ReleaseManagementPage} />
        <Route path="/fetcher/watchdog" component={WatchdogPage} />
        <Route path="/fetcher/bulk-sync" component={BulkSyncPage} />
        <Route path="/fetcher/history" component={CredentialHistoryPage} />
        <Route path="/fetcher/provider-health" component={ProviderHealthPage} />
        <Route path="/fetcher/auto-sync" component={AutoSyncPage} />
        <Route path="/fetcher/smart-fetch" component={SmartFetchPage} />
        <Route path="/fetcher/health-trends" component={HealthTrendsPage} />
        <Route path="/fetcher/leak-scanner" component={LeakScannerPage} />
        <Route path="/fetcher/onboarding" component={ProviderOnboardingPage} />
        <Route path="/fetcher/team-vault" component={TeamVaultPage} />
        <Route path="/fetcher/developer-docs" component={DeveloperDocsPage} />
        <Route path="/fetcher/webhooks" component={WebhooksPage} />
        <Route path="/fetcher/api-analytics" component={ApiAnalyticsPage} />
        <Route path="/fetcher/import" component={ImportPage} />
        <Route path="/fetcher/credential-health" component={CredentialHealthPage} />
        <Route path="/fetcher/notifications" component={NotificationChannelsPage} />
        <Route path="/fetcher/cli" component={CliToolPage} />
        <Route path="/fetcher/totp-vault" component={TotpVaultPage} />
        <Route path="/grants" component={GrantsPage} />
        <Route path="/grants/:id" component={GrantDetailPage} />
        <Route path="/companies" component={CompaniesPage} />
        <Route path="/business-plans" component={BusinessPlanPage} />
        <Route path="/grant-applications" component={GrantApplicationsPage} />
        <Route path="/crowdfunding" component={CrowdfundingPage} />
        <Route path="/fetcher/account" component={AccountSettingsPage} />
        <Route path="/fetcher/admin" component={AdminPanel} />
        <Route path="/fetcher/self-improvement" component={SelfImprovementDashboard} />
        <Route path="/dashboard/credits" component={CreditsPage} />
        <Route path="/dashboard/subscription" component={SubscriptionPage} />
        <Route component={NotFound} />
      </Switch>
    </FetcherLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public landing page — no sidebar, no auth required */}
      <Route path="/" component={LandingPage} />

      {/* Auth pages — no sidebar, no auth required */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />

      {/* Desktop app login — no sidebar, no auth required */}
      <Route path="/desktop-login" component={DesktopLoginPage} />

      {/* Public pages — no auth required */}
      <Route path="/pricing" component={PricingPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/contact" component={ContactPage} />

      {/* Dashboard routes — wrapped in FetcherLayout with sidebar + auth */}
      <Route path="/dashboard/:rest*" component={DashboardRouter} />
      <Route path="/dashboard" component={DashboardRouter} />
      <Route path="/fetcher/:rest*" component={DashboardRouter} />
      <Route path="/api-access" component={DashboardRouter} />
      <Route path="/team" component={DashboardRouter} />
      <Route path="/audit-logs" component={DashboardRouter} />
      <Route path="/grants/:rest*" component={DashboardRouter} />
      <Route path="/grants" component={DashboardRouter} />
      <Route path="/companies" component={DashboardRouter} />
      <Route path="/business-plans" component={DashboardRouter} />
      <Route path="/grant-applications" component={DashboardRouter} />
      <Route path="/crowdfunding" component={DashboardRouter} />

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
