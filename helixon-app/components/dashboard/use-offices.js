"use client";

// The agency's offices / brands (app/api/settings/offices) - an empty list
// until loaded, or when there are none (then office pickers stay hidden).

import { useEffect, useState } from "react";
import { reportQuietly } from "@/lib/report-error";

export function useOffices() {
  const [offices, setOffices] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/offices", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setOffices(d.offices || []))
      .catch(reportQuietly);
    return () => {
      cancelled = true;
    };
  }, []);
  return offices;
}
