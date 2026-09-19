// Single source of truth for the console's navigation - the sidebar and the
// command palette both read it.
export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/admin/command", label: "Command", icon: "command", hint: "Live snapshot of the business" }],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/agencies", label: "Agencies", icon: "building", hint: "Who's using Helixon, on what plan" },
      { href: "/admin/users", label: "Users", icon: "users", hint: "Accounts, bans and password resets" },
      { href: "/admin/leads", label: "Leads", icon: "inbox", hint: "Demo requests and where they came from" },
      { href: "/admin/billing", label: "Billing", icon: "card", hint: "Subscriptions and revenue" },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/admin/traffic", label: "Traffic", icon: "traffic", hint: "Requests, geography and IP blocking" },
      { href: "/admin/security", label: "Security", icon: "shield", hint: "Threats and failed sign-ins" },
      { href: "/admin/security/investigate", label: "Investigate", icon: "search", hint: "Dig into a single IP or path" },
      { href: "/admin/pentester", label: "Pentester", icon: "bug", hint: "Findings from security testing" },
    ],
  },
  {
    label: "Growth",
    items: [{ href: "/admin/seo", label: "SEO", icon: "trending", hint: "Acquisition channels" }],
  },
  {
    label: "Team",
    items: [
      { href: "/admin/employees", label: "Employees", icon: "briefcase", hint: "Internal staff accounts" },
      { href: "/admin/audit", label: "Audit log", icon: "scroll", hint: "Every admin action, with who and when" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));

export function titleFor(pathname) {
  const match = ALL_NAV_ITEMS.filter((i) => pathname === i.href || pathname?.startsWith(`${i.href}/`)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return match ? { title: match.label, group: match.group } : { title: "Admin", group: "" };
}
