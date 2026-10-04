import { notFound } from "next/navigation";
import Gallery from "./Gallery";

// Every UI kit component on one page, in the customer theme and in the admin
// console's dark theme, for checking the kit by eye. Not part of the product:
// it is a 404 unless UI_GALLERY=1 is set where the app runs.
export const metadata = { title: "UI kit", robots: { index: false, follow: false } };

export default function UiGalleryPage() {
  if (process.env.UI_GALLERY !== "1") notFound();
  return <Gallery />;
}
