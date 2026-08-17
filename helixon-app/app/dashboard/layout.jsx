import { DashboardDataProvider } from "@/lib/DashboardDataContext";

export default function DashboardLayout({ children }) {
  return <DashboardDataProvider>{children}</DashboardDataProvider>;
}
