import { notFound } from "next/navigation";
import Screen from "./Screen";
import { SCREENS } from "./screens";

// The signed-in screens, rendered without a session so they can be checked by
// eye and by e2e/screens.spec.js. Each page's server loader is skipped, so the
// page loads its data in the browser, where the test answers with fixtures
// (e2e/data/api.js). Not part of the product: a 404 unless UI_GALLERY=1
// is set where the app runs, like /ui-gallery itself.
export const metadata = { title: "Screens", robots: { index: false, follow: false } };

export default async function ScreenPage({ params }) {
  if (process.env.UI_GALLERY !== "1") notFound();
  const { screen } = await params;
  if (!SCREENS.includes(screen)) notFound();
  return <Screen screen={screen} />;
}
