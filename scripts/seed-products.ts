import Stripe from "stripe";

  // ─── Stripe Client ───────────────────────────────────────────────────────────
  // Reads credentials from Replit Stripe integration (development env)
  async function getStripeClient(): Promise<Stripe> {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY
      ? "repl " + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
        ? "depl " + process.env.WEB_REPL_RENEWAL
        : null;

    if (hostname && xReplitToken) {
      const url = new URL(`https://${hostname}/api/v2/connection`);
      url.searchParams.set("include_secrets", "true");
      url.searchParams.set("connector_names", "stripe");
      url.searchParams.set("environment", "development");
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
      });
      const data = await res.json();
      const secret = data.items?.[0]?.settings?.secret;
      if (secret) return new Stripe(secret, { apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion });
    }

    // Fallback: use STRIPE_SECRET_KEY env var
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
    return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" as Stripe.LatestApiVersion });
  }

  // ─── Products (mirrors shared/pricing.ts) ───────────────────────────────────

  const SUBSCRIPTION_PLANS = [
    { id: "pro",        name: "Pro",        tagline: "For power users and professionals",                     monthlyPrice: 29,   yearlyPrice: 290   },
    { id: "enterprise", name: "Enterprise", tagline: "For organizations at scale",                            monthlyPrice: 99,   yearlyPrice: 990   },
    { id: "cyber",      name: "Cyber",      tagline: "Elite cybersecurity arsenal for professionals",         monthlyPrice: 199,  yearlyPrice: 1990  },
    { id: "cyber_plus", name: "Cyber+",     tagline: "Maximum firepower for security teams and agencies",     monthlyPrice: 499,  yearlyPrice: 4990  },
    { id: "titan",      name: "Titan",      tagline: "Unlimited power for large-scale enterprise operations", monthlyPrice: 4999, yearlyPrice: 49990 },
  ];

  const CREDIT_PACKS = [
    { id: "pack_500",   name: "Quick Top-Up",  credits: 10000,  price: 4.99  },
    { id: "pack_2500",  name: "Boost Pack",    credits: 25000,  price: 9.99,  popular: true },
    { id: "pack_5000",  name: "Power Top-Up",  credits: 50000,  price: 17.99 },
    { id: "pack_10000", name: "Mega Top-Up",   credits: 150000, price: 49.99 },
  ];

  const CLONE_PLANS = [
    { id: "clone_simple",     name: "Clone — Simple",     description: "Landing pages, portfolios, brochure sites (up to 5 pages)",          price: 500  },
    { id: "clone_standard",   name: "Clone — Standard",   description: "Business websites, blogs, multi-page sites (up to 15 pages)",        price: 1000 },
    { id: "clone_advanced",   name: "Clone — Advanced",   description: "E-commerce, SaaS, marketplace sites (up to 50 pages)",               price: 2000 },
    { id: "clone_enterprise", name: "Clone — Enterprise", description: "Complex web applications, multi-feature platforms (unlimited pages)", price: 3500 },
  ];

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  async function findOrCreateProduct(stripe: Stripe, name: string, description: string, metadata: Record<string, string>) {
    const existing = await stripe.products.list({ limit: 100 });
    const [key, val] = Object.entries(metadata)[0];
    const found = existing.data.find((p) => p.metadata[key] === val && p.active);
    if (found) { console.log(`  ✓ ${name} (${found.id})`); return found; }
    const product = await stripe.products.create({ name, description, metadata });
    console.log(`  + ${name} (${product.id})`);
    return product;
  }

  async function findOrCreatePrice(stripe: Stripe, productId: string, amount: number, currency: string, recurring: Stripe.PriceCreateParams.Recurring | null, metadata: Record<string, string>) {
    const existing = await stripe.prices.list({ product: productId, active: true, limit: 100 });
    const found = existing.data.find((p) => {
      const intervalMatch = recurring ? p.recurring?.interval === recurring.interval : !p.recurring;
      return p.unit_amount === amount && intervalMatch;
    });
    if (found) { console.log(`    ✓ $${(amount / 100).toFixed(2)} (${found.id})`); return found; }
    const price = await stripe.prices.create({ product: productId, unit_amount: amount, currency, ...(recurring ? { recurring } : {}), metadata });
    console.log(`    + $${(amount / 100).toFixed(2)} (${price.id})`);
    return price;
  }

  // ─── Main ─────────────────────────────────────────────────────────────────────

  async function seedProducts() {
    const stripe = await getStripeClient();
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║  Archibald Titan AI — Stripe Product Seeder  ║");
    console.log("╚══════════════════════════════════════════════╝\n");

    console.log("── Subscription Plans ──────────────────────────────────────────\n");
    for (const plan of SUBSCRIPTION_PLANS) {
      console.log(`▶ ${plan.name}`);
      const product = await findOrCreateProduct(stripe, `Archibald Titan ${plan.name}`, plan.tagline, { plan_id: plan.id });
      await findOrCreatePrice(stripe, product.id, plan.monthlyPrice * 100, "usd", { interval: "month" }, { plan_id: plan.id, interval: "month" });
      await findOrCreatePrice(stripe, product.id, plan.yearlyPrice  * 100, "usd", { interval: "year"  }, { plan_id: plan.id, interval: "year"  });
      console.log();
    }

    console.log("── Credit Top-Up Packs ─────────────────────────────────────────\n");
    for (const pack of CREDIT_PACKS) {
      console.log(`▶ ${pack.name} (${pack.credits.toLocaleString()} credits)`);
      const product = await findOrCreateProduct(stripe, `Archibald Titan Credits — ${pack.name}`, `${pack.credits.toLocaleString()} credits top-up${pack.popular ? " · Most Popular" : ""}`, { pack_id: pack.id, credits: String(pack.credits) });
      await findOrCreatePrice(stripe, product.id, Math.round(pack.price * 100), "usd", null, { pack_id: pack.id });
      console.log();
    }

    console.log("── Website Clone Plans (one-time) ──────────────────────────────\n");
    for (const clone of CLONE_PLANS) {
      console.log(`▶ ${clone.name}`);
      const product = await findOrCreateProduct(stripe, clone.name, clone.description, { clone_id: clone.id });
      await findOrCreatePrice(stripe, product.id, clone.price * 100, "usd", null, { clone_id: clone.id });
      console.log();
    }

    console.log("✅ Done. Confirm at https://dashboard.stripe.com/products\n");
  }

  seedProducts().catch((err) => { console.error("❌", err.message); process.exit(1); });
  