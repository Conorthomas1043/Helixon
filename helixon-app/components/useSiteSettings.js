"use client";
// components/useSiteSettings.js
// The public site settings from /api/site (announcement banner, maintenance
// message, chat assistant switch - see lib/site-settings.js), fetched once
// per page load however many components ask. null until loaded, or if the
// request fails (callers treat that as "defaults": everything on, no banner).

import { useEffect, useState } from "react";

let pending = null;

function fetchSiteSettings() {
  if (!pending) {
    pending = fetch("/api/site")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return pending;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings().then((data) => {
      if (!cancelled) setSettings(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return settings;
}
