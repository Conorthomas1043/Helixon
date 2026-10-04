import FaqPage from "@/components/FaqPage";
import { FAQ_GROUPS } from "@/lib/faq-content";

export const metadata = {
  title: "FAQ",
  description: "Answers on how Helixon scores CVs, where candidate data is stored, pricing, cancelling and getting started.",
};

// FAQPage structured data, so search results can show the answers directly.
const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_GROUPS.flatMap((g) =>
    g.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }))
  ),
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD).replace(/</g, "\\u003c") }} />
      <FaqPage />
    </>
  );
}
