"use client";

// /dashboard/settings - one place for every workspace setting. Most are
// for the owner and admins; each page says so when you can't change it.

import { ResearchOptIn } from "@/components/dashboard/research";
import Link from "next/link";
import { Page, PageHeader, INK, INK_MUTED, INK_FAINT, CARD } from "@/components/dashboard/ui";

const SECTIONS = [
  {
    title: "Hiring",
    items: [
      { href: "/dashboard/settings/careers", label: "Your jobs page", body: "The public page where people apply, your privacy notice, and job board feeds." },
      { href: "/dashboard/settings/pipeline", label: "Pipeline & fields", body: "Your own steps inside each stage, and extra fields on candidates, jobs and clients." },
      { href: "/dashboard/email", label: "Email templates & sequences", body: "Reusable emails with merge fields, and timed follow-up sequences." },
    ],
  },
  {
    title: "Revenue & team",
    items: [
      { href: "/dashboard/settings/invoicing", label: "Invoices", body: "Your company details, bank details, VAT and payment terms on invoices." },
      { href: "/dashboard/settings/targets", label: "Targets & commission", body: "Monthly targets per recruiter and the commission plan behind the Performance page." },
      { href: "/dashboard/team", label: "Team", body: "Invite teammates, roles, and who's working on what." },
      { href: "/dashboard/settings/offices", label: "Offices & brands", body: "Split the workspace by office, team or brand, and filter jobs and analytics by it." },
    ],
  },
  {
    title: "Data & connections",
    items: [
      { href: "/dashboard/privacy", label: "Data & privacy", body: "Retention, the talent pool, blind screening and what teammates can see." },
      { href: "/dashboard/settings/permissions", label: "Permissions", body: "Keep fees and invoices to admins, and limit members to their own candidates." },
      { href: "/dashboard/settings/audit", label: "Audit log", body: "Who deleted, exported or changed what, and when." },
      { href: "/dashboard/settings/connections", label: "Calendar & email", body: "Subscribe to your interviews in Google, Outlook or Apple, and log emails by BCC." },
      { href: "/dashboard/settings/integrations", label: "Integrations", body: "Your Gmail or Outlook, Xero or QuickBooks, texting, the job feed, API keys, webhooks and the LinkedIn extension." },
      { href: "/dashboard/import", label: "Import", body: "Bring candidates, clients and jobs over from a spreadsheet or your old system." },
    ],
  },
  {
    title: "You",
    items: [
      { href: "/account", label: "Account", body: "Your name, email, password and notification emails." },
      { href: "/billing", label: "Billing", body: "Your plan, invoices and payment details." },
    ],
  },
];

export default function SettingsPage() {
  return (
    <Page width={1000}>
      <PageHeader eyebrow="Workspace" title="Settings" subtitle="How Helixon works for your agency." />
      {SECTIONS.map((s) => (
        <section key={s.title}>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: INK_FAINT }}>
            {s.title}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {s.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="block rounded-[14px] p-4 transition-shadow hover:shadow-[var(--shadow-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={CARD}
              >
                <p className="text-sm font-semibold" style={{ color: INK }}>
                  {i.label} →
                </p>
                <p className="text-[12px] mt-1" style={{ color: INK_MUTED }}>
                  {i.body}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <ResearchOptIn />
    </Page>
  );
}
