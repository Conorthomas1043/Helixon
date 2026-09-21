import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import AdminMobileApp from "./AdminMobileApp";

export const metadata = {
  title: "Admin - Mobile",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "Helixon Admin",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// A separate, single-page surface for the handful of things an admin needs
// on a phone in a hurry - key stats, IP blocking, user lookup + lockdown -
// not the full desktop console (app/admin/_shared/AdminShell.jsx), which
// assumes sidebar-width screens. app/admin/layout.js skips that shell for
// this one route so it can render full-bleed and tab-bar-driven instead.
//
// Every /admin/* page already requires a valid session before it's served
// (proxy.ts), so this only redirects for the rare race where the token
// expired between that check and this render.
export default async function AdminMobilePage() {
  const session = await getAdminSession({ refresh: false });
  if (!session) redirect("/admin/login");
  return <AdminMobileApp username={session.username} />;
}
