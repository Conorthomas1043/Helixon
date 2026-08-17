"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getMockData } from "./mock-data";

const DashboardDataContext = createContext(null);

async function fetchDashboardData() {
  return new Promise((resolve) => setTimeout(() => resolve(getMockData()), 200));
}

export function DashboardDataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Failed to load dashboard data."); });
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardDataContext.Provider value={{ data, error }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return ctx;
}
