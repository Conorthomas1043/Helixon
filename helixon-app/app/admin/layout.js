import { getAdminSession } from "@/lib/admin-auth";
import { css } from "./_shared/styles";
import AdminShell from "./_shared/AdminShell";

export const metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

// Decides on the SERVER whether to draw the console chrome.
//
// This layout used to be a client component that drew the full sidebar - every
// nav label, the "Console connected" badge - around EVERY /admin page, the login
// page included, so anyone who reached the login form was shown the console's
// structure. Now the shell only renders when there is a valid admin session
// (read here from the cookie, not extended); without one, whatever page is being
// shown (the login form) appears on its own, styled but with no navigation.
export default async function AdminLayout({ children }) {
  const session = await getAdminSession({ refresh: false });

  return (
    <>
      <style>{css}</style>
      {session ? <AdminShell initialUsername={session.username}>{children}</AdminShell> : children}
    </>
  );
}
