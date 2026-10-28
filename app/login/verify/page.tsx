import { MailCheck } from "lucide-react";

export default function VerifyRequestPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20 text-center bg-paper">
      <div className="max-w-sm">
        <div className="w-12 h-12 border border-forest/40 flex items-center justify-center mx-auto mb-4">
          <MailCheck size={22} className="text-forest" />
        </div>
        <h1 className="font-display text-2xl text-ink mb-2">Check your email</h1>
        <p className="text-stone-text text-sm">
          We sent you a sign-in link. Click it to finish logging in.
        </p>
      </div>
    </main>
  );
}
