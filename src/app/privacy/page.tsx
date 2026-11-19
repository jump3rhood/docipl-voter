import Link from 'next/link';

export const metadata = { title: 'Privacy | Doc IPL People\'s Choice' };

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-4 py-6">
      <h1 className="text-3xl font-extrabold">Privacy</h1>
      <p>Doc IPL collects no name, email, phone number or location.</p>
      <p>
        To prevent duplicate or automated votes, technical identifiers (a browser cookie ID, IP
        address and a device signal) are processed. They&apos;re stored only in scrambled (hashed)
        form, and are deleted within 30 days after voting closes.
      </p>
      <p>Cloudflare Turnstile is used for bot protection.</p>
      <Link href="/" className="min-h-11 py-2 font-bold text-brand-yellow underline">
        Back to voting
      </Link>
    </div>
  );
}
