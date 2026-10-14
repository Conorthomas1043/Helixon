// The console's icons are the UI kit's (components/ui). Without a size they
// take it from CSS: 1.1em by default, or a component rule (.side-link svg,
// .btn svg ...) in app/admin/_shared/styles.js. Drawn at a heavier stroke
// than the customer app, to hold up on the dark theme.
import { Icon as KitIcon } from "@/components/ui";

export function Icon({ name, size = null, strokeWidth = 2, ...rest }) {
  return <KitIcon name={name} size={size} strokeWidth={strokeWidth} {...rest} />;
}
