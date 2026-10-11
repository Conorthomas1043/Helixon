import { headers } from "next/headers";
import { getAdminSession } from "@/lib/admin/auth";
import { css } from "./_shared/styles";
import AdminShell from "./_shared/AdminShell";

export const metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

// Decides on the SERVER whether to draw the console chrome.
//
// The shell (every nav label, the "Console connected" badge) only renders when
// there is a valid admin session (read here from the cookie, not extended), so
// someone who reaches the login form isn't shown the console's structure.
// Without one, whatever page is being shown (the login form) appears on its
// own, styled but with no navigation.
//
// /admin/mobile is the exception even when signed in: it's its own compact,
// tab-bar-driven surface built for a phone screen (app/admin/mobile), not
// the sidebar console, so it opts out of AdminShell entirely and draws its
// own chrome. proxy.ts stamps the resolved pathname onto the request as
// x-pathname (a layout has no other way to know which page is rendering).
export default async function AdminLayout({ children }) {
  const session = await getAdminSession({ refresh: false });
  const pathname = (await headers()).get("x-pathname") || "";
  const isMobileConsole = pathname.startsWith("/admin/mobile");

  return (
    <>
      <style>{css}</style>
      {session && !isMobileConsole ? (
        <AdminShell initialUsername={session.username}>{children}</AdminShell>
      ) : (
        children
      )}
    </>
  );
}
