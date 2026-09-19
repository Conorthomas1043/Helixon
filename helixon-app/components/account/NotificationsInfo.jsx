import Link from "next/link";

// The "Notifications" tab. It used to say "Not built yet", but there is genuinely
// nothing to configure: the app has no optional notification or marketing
// emails (the only emails it sends are transactional - the demo/contact
// replies, emails a recruiter sends to a candidate from inside the app, and
// account/billing mail from Clerk and Stripe). This says so plainly rather than
// showing switches that would control nothing.
export default function NotificationsInfo() {
  return (
    <div className="px-6 py-8 sm:px-10 sm:py-10">
      <h3 className="text-[17px] font-semibold text-[#10221d]">There&apos;s nothing to switch off</h3>
      <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-[#638279]">
        Helixon doesn&apos;t send marketing emails or optional notifications. The only email you get from us is the essential
        kind - things like sign-in and verification messages, team invitations, and billing receipts - and those can&apos;t be
        turned off because the account needs them.
      </p>
      <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-[#638279]">
        If we add notification settings later, they&apos;ll appear here. Want something specific? Tell us via the{" "}
        <Link href="/contact" className="font-semibold text-[#087a5b] hover:underline">
          contact page
        </Link>
        .
      </p>
    </div>
  );
}
