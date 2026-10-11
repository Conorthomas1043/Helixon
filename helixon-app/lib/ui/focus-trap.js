// Keeps Tab and Shift+Tab inside an open modal, so keyboard users can't
// wander into the page behind it. Call from the dialog's keydown handler:
//
//   if (e.key === "Tab") trapTab(e, dialogRef.current);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapTab(e, container) {
  if (!container) return;
  // With one dialog opened over another, only the one holding focus traps it.
  const owner = document.activeElement?.closest?.('[aria-modal="true"]');
  if (owner && owner !== container) return;
  const items = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (items.length === 0) {
    e.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !container.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !container.contains(active))) {
    e.preventDefault();
    first.focus();
  }
}
