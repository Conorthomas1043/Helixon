import ContactPage from "@/components/ContactPage";

export const metadata = {
  title: "Contact",
};

export default async function Page({ searchParams }) {
  const { role } = await searchParams;
  // Only a short plain title is used to start the message.
  const title = typeof role === "string" ? role.trim().slice(0, 80) : "";
  return <ContactPage role={title} />;
}
