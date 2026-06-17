import { MailCheck } from "lucide-react";

export default function VerifyRequestPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20 text-center">
      <div className="max-w-sm">
        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MailCheck size={22} className="text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Check your email
        </h1>
        <p className="text-slate-500 text-sm">
          We sent you a sign-in link. Click it to finish logging in.
        </p>
      </div>
    </main>
  );
}
