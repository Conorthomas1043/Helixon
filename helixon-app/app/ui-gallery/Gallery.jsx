"use client";

import { useState } from "react";
import {
  BUTTON_VARIANTS,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Kbd,
  LoadingCard,
  Notice,
  Pill,
  Segmented,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextInput,
} from "@/components/ui";
import { Card as DashboardCard } from "@/components/dashboard/ui";
import { InlineAlert, PageCard, Toggle } from "@/components/account/ui";
import { Chip, Kpi } from "@/app/employee/_shared/ui";

// The admin console's --ui-* values (app/admin/_shared/styles.js), applied
// to one panel so both themes show side by side.
const ADMIN_THEME = {
  "--ui-surface": "#0f141b",
  "--ui-surface-muted": "#151b24",
  "--ui-border": "rgba(255,255,255,.08)",
  "--ui-border-strong": "rgba(255,255,255,.24)",
  "--ui-text": "#e8edf2",
  "--ui-text-soft": "#8794a3",
  "--ui-text-faint": "#566373",
  "--ui-accent": "#3ddc97",
  "--ui-accent-hover": "#6ee7b7",
  "--ui-accent-soft": "rgba(61,220,151,.11)",
  "--ui-on-accent": "#04140c",
  "--ui-danger": "#f0707b",
  "--ui-danger-soft": "rgba(240,112,123,.11)",
  "--ui-warn": "#f0b35a",
  "--ui-warn-soft": "rgba(240,179,90,.11)",
  background: "#080b10",
};

function Kit() {
  const [on, setOn] = useState(true);
  const [view, setView] = useState("list");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {Object.keys(BUTTON_VARIANTS).map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon="plus">Small</Button>
        <Button icon="upload" variant="primary">Medium</Button>
        <Button size="lg" iconRight="arrowRight" variant="primary">Large</Button>
        <Button loading variant="primary">Saving</Button>
        <Button disabled>Disabled</Button>
        <Button href="#" variant="outline">Link</Button>
      </div>
      <Card>
        <CardHeader title="Card header" eyebrow="Eyebrow" description="A description under the title." count={4} action={<Button size="sm">Action</Button>} />
        <div className="p-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="As it appears on the CV">
            <TextInput placeholder="Ada Lovelace" />
          </Field>
          <Field label="Email" error="Enter a valid email address">
            <TextInput defaultValue="ada@" />
          </Field>
          <Field label="Stage">
            <Select options={[{ value: "a", label: "Screened" }, { value: "b", label: "Interview" }]} />
          </Field>
          <Field label="Note">
            <TextArea placeholder="Notes…" />
          </Field>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-4">
        <Switch checked={on} onChange={setOn} label="Blind screening" description="Hide names while scoring" />
        <Segmented value={view} onChange={setView} ariaLabel="View" options={[{ value: "list", label: "List", count: 12 }, { value: "board", label: "Board" }]} />
        <Pill>Neutral</Pill>
        <Pill tone="green">Strong</Pill>
        <Pill tone="amber">Review</Pill>
        <Pill tone="red">Weak</Pill>
        <Spinner />
        <Kbd>⌘K</Kbd>
        <Icon name="sparkle" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Notice>Info notice</Notice>
        <Notice tone="ok">Saved</Notice>
        <Notice tone="warn">Check this</Notice>
        <Notice tone="error" onDismiss={() => {}}>Couldn&apos;t save</Notice>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <EmptyState icon="inbox" title="No candidates yet" body="Screen a CV to get started." action={<Button variant="primary">Screen a CV</Button>} />
        <ErrorState body="The list didn't load." onRetry={() => {}} />
        <LoadingCard />
      </div>
    </div>
  );
}

export default function Gallery() {
  const [toggle, setToggle] = useState(false);
  return (
    <main className="p-6 sm:p-10 space-y-10" style={{ background: "var(--mist)" }}>
      <section>
        <h1 className="text-xl font-semibold mb-4">Customer theme</h1>
        <Kit />
      </section>
      <section>
        <h2 className="text-lg font-semibold mb-4">Area adapters</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <DashboardCard eyebrow="Dashboard" title="Titled card" action={<Button size="sm">Edit</Button>}>
            Dashboard card body.
          </DashboardCard>
          <PageCard title="Account page card" description="One per settings page.">
            <InlineAlert message="Your card was declined." />
            <Toggle id="g-toggle" checked={toggle} onChange={setToggle} label="Weekly summary" description="Settings-row switch" />
          </PageCard>
          <div className="flex gap-2 items-start">
            <Chip>neutral</Chip>
            <Chip tone="green">green</Chip>
            <Kpi label="Calls today" value={42} sub="Staff KPI tile" />
          </div>
        </div>
      </section>
      <section className="rounded-[16px] p-6 text-[var(--ui-text)]" style={ADMIN_THEME}>
        <h2 className="text-lg font-semibold mb-4">Admin console theme</h2>
        <Kit />
      </section>
    </main>
  );
}
