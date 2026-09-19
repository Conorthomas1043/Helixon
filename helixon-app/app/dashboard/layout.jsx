import AccountSetupGate from "@/components/dashboard/AccountSetupGate";

export const metadata = {
  title: "Dashboard",
  robots: { index: false },
};

// Every /dashboard page sits behind the account-setup check: a signed-in
// account with no agency gets an explanation and next steps instead of a set
// of tabs that each fail with "Unable to load...".
export default function DashboardLayout({ children }) {
  return <AccountSetupGate>{children}</AccountSetupGate>;
}
