# School Supply Ops

Mobile-first operations app for a government-school supply business.

## Stack
Next.js + TypeScript + Tailwind CSS + Supabase PostgreSQL/Auth + Vercel.

## Phase 1
- Next.js App Router foundation
- TypeScript + Tailwind
- Supabase browser client
- Responsive mobile-first dashboard shell
- Core Supabase schema and migrations
- Seeded product categories and products

## Local setup
1. Copy .env.example to .env.local.
2. Add the Supabase project URL and publishable key.
3. npm install
4. npm run dev

Never commit .env.local or service-role credentials.

## Phase 12
- Follow-up Planner for overdue, today, upcoming, and unscheduled schools
- Visit form can schedule the next school follow-up date
- Follow-up dates persist on `schools.next_follow_up_at`
- One-tap follow-up reminders and visit shortcuts

- Latest Phase 12 implementation verified on the production deployment pipeline.


## Phase 19
- Global search across schools, products, and order numbers.
- Search is available from desktop and mobile navigation.
- `/` focuses search from anywhere outside form fields.
- Results deep-link directly into the relevant record.


## Phase 20
- Upgraded the activity timeline into a searchable, filterable audit trail.
- Added action and entity filters, refresh, event counts, actor/entity identifiers, and expandable before/after field changes.
- Timeline now handles loading and database error states explicitly.


## Phase 21
- Upgraded Deliveries into a fulfillment management workspace.
- Added delivery status dashboard, scheduling date/time, responsible-user assignment, notes, search and status filters.
- Added delivery completion timestamps and responsive mobile/desktop controls.


## Phase 22
- Upgraded Inventory into a stock-control workspace with stock KPIs, low/out-of-stock filters, product search, typed stock movements, notes, refresh/error states, and recent movement history.


## Phase 23
- Upgraded Payments into a collections workspace with received/outstanding KPIs and paid/partial order counts.
- Added order-level balance tracking, payment-mode filters, school/search filters, references and notes.
- Recording an order payment synchronizes the order paid amount and payment status.
- Added responsive loading, error, empty and refresh states.


## Phase 24 · Procurement

Purchasing now supports supplier/product purchase creation, purchase numbering, expected-arrival tracking, procurement KPIs, payable balances, status/search filters, and responsive purchase history.
