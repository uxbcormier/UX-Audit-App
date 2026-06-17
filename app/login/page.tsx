import { Mail } from "lucide-react";
import { sendMagicLink } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-bold text-xl text-neutral-100">
            UX<span className="text-teal-400">Audit</span>
          </span>
          <h1 className="text-2xl font-bold text-neutral-100 mt-6 mb-2">
            Sign in
          </h1>
          <p className="text-neutral-500 text-sm">
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>

        <form action={sendMagicLink} className="flex flex-col gap-3">
          <div className="relative">
            <Mail
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="email"
              name="email"
              required
              placeholder="you@yourstore.com"
              className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-neutral-950 font-semibold rounded-xl transition"
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
