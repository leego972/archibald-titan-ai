# Production Deployment & Launch Checklist

This guide outlines the essential steps required to take Archibald Titan AI from a development environment to a live, production-ready state, specifically focusing on billing configuration and environment security.

## 1. Stripe Webhook Configuration (CRITICAL)

For the subscription and credits system to function correctly in production, Stripe must be able to communicate with your backend via webhooks. If this is not configured, users will be charged but their accounts will not be upgraded.

### Setup Steps:
1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/).
2. Ensure you are in **Live mode** (toggle in the top right), unless you are specifically testing in Test mode.
3. Navigate to **Developers > Webhooks**.
4. Click **Add an endpoint**.
5. Set the **Endpoint URL** to your production domain followed by the webhook route:
   \`https://your-production-domain.com/api/stripe/webhook\`
6. Select the following **Events to listen to**:
   - \`checkout.session.completed\`
   - \`invoice.payment_succeeded\`
   - \`customer.subscription.updated\`
   - \`customer.subscription.deleted\`
7. Click **Add endpoint**.
8. Reveal the **Signing secret** (it starts with \`whsec_\`).
9. Add this secret to your production environment variables as \`STRIPE_WEBHOOK_SECRET\`.

## 2. Environment Variables Checklist

Ensure all the following variables are set in your production PaaS (e.g., Railway, Render):

### Core & Database
- [ ] \`NODE_ENV=production\`
- [ ] \`DATABASE_URL\` (Must point to your production PostgreSQL instance)
- [ ] \`SESSION_SECRET\` (Generate a strong, random string for express-session)

### Authentication (OAuth)
- [ ] \`GITHUB_CLIENT_ID\` & \`GITHUB_CLIENT_SECRET\` (Ensure the callback URL in GitHub points to your production domain)
- [ ] \`GOOGLE_CLIENT_ID\` & \`GOOGLE_CLIENT_SECRET\` (Ensure the authorized redirect URI in Google Cloud Console points to your production domain)

### Billing (Stripe)
- [ ] \`STRIPE_SECRET_KEY\` (Live mode key starting with \`sk_live_\`)
- [ ] \`STRIPE_WEBHOOK_SECRET\` (From the webhook setup above)
- [ ] \`VITE_STRIPE_PUBLISHABLE_KEY\` (Live mode key starting with \`pk_live_\`)

### AI Integration
- [ ] \`OPENAI_API_KEY\` (Ensure billing is active on your OpenAI account)

## 3. Pre-Launch Security & Functionality Verification

Before opening the platform to the public, verify the following:

- [ ] **Database Migrations:** Ensure \`pnpm db:push\` has been run successfully against the production database.
- [ ] **OAuth Login:** Test logging in with both GitHub and Google using a non-admin account.
- [ ] **Feature Gating:** Verify that a free-tier user cannot access Cyber or Titan tier features (e.g., Red Team Playbooks, Compliance Reports).
- [ ] **Payment Flow:** Perform a live test transaction (you can refund it immediately) to ensure the Stripe checkout redirects correctly and the webhook upgrades the user's plan.
- [ ] **Legal Pages:** Confirm that \`/terms\` and \`/privacy\` are accessible and accurately reflect your company's legal standing.
- [ ] **Error Logging:** Ensure your production environment captures logs (via Railway logs or an external service like Datadog/Sentry) so you can monitor for crashes.

## 4. Launch Stages Recommendation

1. **Private Beta (Soft Launch):** Invite 20-50 trusted users. Monitor logs closely for unhandled exceptions or performance bottlenecks in the security engines.
2. **Public Beta:** Open signups but keep marketing limited. Ensure the free tier limits are strictly enforced to prevent abuse of the AI and security scanning tools.
3. **General Availability (GA):** Begin marketing and enterprise outreach. Ensure your support channels (email, Discord, etc.) are ready to handle inquiries.
