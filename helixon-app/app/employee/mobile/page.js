import { redirect } from "next/navigation";
import { getEmployeeSession } from "@/lib/employee-auth";
import EmployeeMobileApp from "./EmployeeMobileApp";

export const metadata = {
  title: "Staff - Mobile",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "Helixon Staff",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// The employee-side equivalent of /admin/mobile: a compact, phone-first
// surface for the two things staff actually need on the go - their to-dos
// and a read-only stats snapshot - not the full app/employee/dashboard
// layout, which is built for a desktop-width screen. Unlike /admin, the
// employee routes have no shared shell to opt out of, so this doesn't need
// the same layout-level pathname check /admin/mobile does.
export default async function EmployeeMobilePage() {
  const employee = await getEmployeeSession({ refresh: false });
  if (!employee) redirect("/employee/login");
  return <EmployeeMobileApp employee={employee} />;
}
