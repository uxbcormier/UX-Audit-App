import { Mail } from "lucide-react";
import { sendMagicLink } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-bold text-xl text-slate-900">
            UX<span className="text-indigo-600">Audit</span>
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-2">
            Sign in
          </h1>
          <p className="text-slate-500 text-sm">
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>

        <form action={sendMagicLink} className="flex flex-col gap-3">
          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="email"
              name="email"
              required
              placeholder="you@yourstore.com"
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-base"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition"
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
