"use client";
// The staff portal's toasts are the UI kit's (components/ui): short notices
// in place of window.alert()/confirm(), so a destructive action can offer
// Undo instead of asking "Are you sure?" first.
//
//   const { toasts, notify, dismiss } = useToasts();
//   notify("Task deleted", { action: { label: "Undo", onClick: restore } });
//   notify("Couldn't save", { tone: "error" });
//   <Toaster toasts={toasts} onDismiss={dismiss} />

export { useToasts, Toasts as Toaster } from "@/components/ui";
