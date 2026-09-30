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
