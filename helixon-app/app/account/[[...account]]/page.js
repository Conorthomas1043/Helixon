import AccountClient from "./AccountClient";

// The four account tabs are one catch-all route, so a single static title gave
// every tab the same <title>. This picks the title from the path instead. (The
// page body is a client component - see AccountClient.jsx - which can't export
// metadata itself.)
const TITLES = {
  "": "Profile settings",
  security: "Security settings",
  notifications: "Notification settings",
  danger: "Delete account",
};

export async function generateMetadata({ params }) {
  const { account } = await params;
  const key = Array.isArray(account) && account.length ? account[0] : "";
  return {
    title: TITLES[key] || TITLES[""],
    robots: { index: false },
  };
}

export default function AccountPage() {
  return <AccountClient />;
}
