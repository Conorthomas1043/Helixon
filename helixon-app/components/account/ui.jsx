"use client";

// Account and billing pages' view of the UI kit (components/ui): the shared
// Button (primary by default here), the settings-row switch, a form-level
// alert and the page's content card.

import { forwardRef } from "react";
import { Button as KitButton, Card, Notice, Switch } from "@/components/ui";

export const Button = forwardRef(function Button({ variant = "primary", ...props }, ref) {
  return <KitButton ref={ref} variant={variant} {...props} />;
});

// Label and description first, switch on the right.
export function Toggle(props) {
  return <Switch align="end" {...props} />;
}

export function InlineAlert({ message }) {
  if (!message) return null;
  return (
    <Notice tone="error" className="mb-4 max-w-sm">
      {message}
    </Notice>
  );
}

// One per settings page: the single content boundary.
export function PageCard({ title, description, danger, children }) {
  return (
    <Card
      className="rounded-[18px] p-7 sm:p-9 shadow-[0_16px_32px_-20px_rgba(19,32,27,0.28)]"
      style={danger ? { borderColor: "var(--ui-danger)" } : undefined}
    >
      <h2
        className="text-base font-semibold mb-1.5"
        style={{ color: danger ? "var(--ui-danger)" : "var(--ui-text)", fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <p className="text-sm mb-6 text-[var(--ui-text-faint)]">{description}</p>
      {children}
    </Card>
  );
}
