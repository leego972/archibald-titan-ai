# Marketplace Stripe Integration — Logical Flow

## Pricing Model
- 1 credit ≈ $0.01 USD (based on seller fee: 1200 credits = $12)
- Credit packs have volume discounts (bulk = cheaper per credit)
- Marketplace items: sellers set `priceCredits`, we auto-calculate `priceUsd` = priceCredits * $0.01
- Stripe charges in cents: `priceUsd` field stores cents (e.g., 5000 credits → $50.00 → 5000 cents)

## Dual Payment Options (Buyer's Choice)
1. **Pay with Credits** — instant, deducts from balance (existing flow)
2. **Pay with Card (Stripe)** — redirects to Stripe Checkout, fulfills on webhook

## Flow: Pay with Credits (existing — no changes needed)
1. Buyer clicks "Pay with Credits"
2. Server checks balance ≥ priceCredits
3. Deducts from buyer, credits seller (92%), creates purchase record
4. Returns downloadToken

## Flow: Pay with Card (NEW)
1. Buyer clicks "Pay with Card"
2. Client calls `trpc.stripe.marketplaceCheckout.mutate({ listingId })`
3. Server creates Stripe Checkout Session:
   - mode: "payment" (one-time)
   - line_items: listing title + priceUsd
   - metadata: { type: "marketplace_purchase", user_id, listing_id }
   - success_url: /marketplace?purchase_success=true&listing_id={id}
   - cancel_url: /marketplace?purchase_canceled=true
4. Client redirects to session.url
5. Stripe processes payment
6. Webhook receives `checkout.session.completed` with type=marketplace_purchase
7. Webhook handler:
   - Looks up listing by listing_id from metadata
   - Creates purchase record (same as credit flow)
   - Credits seller (92% in credits)
   - Platform keeps 8% (real USD in Stripe, credits to seller)
   - Logs transaction

## Flow: Become Seller
- Already has Stripe path in stripe-router.ts
- marketplace-router.ts becomeSeller should redirect to Stripe when payWithCredits=false
- Add `payWithStripe` boolean input option

## Pricing Guidelines for Sellers
- Minimum: 500 credits ($5) — signals quality, not a toy
- Suggested ranges by category:
  - Templates/Datasets: 500–2,500 credits ($5–$25)
  - Modules/Blueprints: 1,000–5,000 credits ($10–$50)
  - AI Agents: 2,500–15,000 credits ($25–$150)
  - Exploits/Advanced: 5,000–50,000 credits ($50–$500)
- Platform minimum enforced at 500 credits
