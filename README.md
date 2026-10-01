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


## Phase 25 · Work Queue
- Added a unified work queue for open tasks, reminders and unread notifications.
- Added overdue counts, next-up work, one-tap completion and quick links into existing workspaces.
- Added responsive mobile/desktop prioritization with refresh and explicit error states.
\n\n## Phase 26 · School Activity Timeline\n- Added a per-school history workspace combining visits, orders, preparation status, deliveries, payments, reminders, and audit activity.\n- Added event-type summaries, search, filters, refresh, status context, and deep links back to related orders.\n- Added a direct School timeline action from each school record.\n

## Phase 27 — Multi-school visit routes

- Start one visit route in the morning without selecting a school.
- Add each school to the active route when you physically reach it.
- The previous school visit closes automatically when the next school is added.
- Each school keeps its own arrival time, GPS, purpose, person met, notes, order/payment/follow-up details.
- End the route once the day's school visits are complete.
- Existing single-school visit records remain supported through a nullable session link.


## Phase 28 — GST invoices

- Create one GST-ready invoice from each order.
- Automatic CGST + SGST for same-state billing and IGST for other-state billing.
- Invoice numbering, seller details, buyer snapshot, tax breakdown, and invoice register.
- Print / Save PDF from the invoice detail screen.
- Invoice and line-item tables use RLS and preserve the source order records.


## Phase 29 — WhatsApp Business & notifications
- Added a WhatsApp Center for reusable message templates, school WhatsApp contacts, drafts and a notification queue.
- Added reusable order confirmation, delivery update, payment received and follow-up templates.
- Added direct WhatsApp handoff with prefilled messages through WhatsApp deep links.
- Added message status tracking and RLS-protected WhatsApp message/template tables.
- The workspace is provider-ready for Meta/WhatsApp Business API credentials without exposing provider secrets in the browser.


## Phase 38 — Business expenses & cash flow

- Added a dedicated operating-expense ledger with categories, date/mode filters, search, edit/delete controls, and CSV export.
- Expenses are stored separately from school collections and supplier payments with row-level security and write-access checks.
- Reports include supplier payments, operating expenses, and net cash movement for the selected period. Net cash movement is explicitly a cash-flow measure, not accounting profit.


## Phase 39 — Inventory reorder planning

- Inventory low-stock indicators use each product's configured minimum stock.
- Inventory cards include reorder-gap units and estimated on-hand stock cost.
- Filtered inventory exports to CSV with stock, reorder and cost fields.


## Phase 40 — workspace UI redesign

- Refreshed the global design system with consistent surfaces, typography, responsive spacing, form focus states, tables, buttons and motion.
- Updated dashboard cards and action surfaces with polished hover/press feedback and restrained entrance animations.
- Organized the desktop sidebar into labeled navigation groups while preserving every existing destination.
- Improved small-screen surfaces and navigation styling, with reduced-motion accessibility support.
- Styling-only changes; no database migration or schema changes.
