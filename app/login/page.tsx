import { Mail } from "lucide-react";
import { sendMagicLink } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20 bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-display text-xl tracking-tight">GRAFTER</span>
          <h1 className="font-display text-2xl text-ink mt-6 mb-2">Sign in</h1>
          <p className="text-stone-text text-sm">
            We&apos;ll email you a magic link — no password needed.
          </p>
        </div>

        <form action={sendMagicLink} className="flex flex-col gap-3">
          <div className="relative">
            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-text" />
            <input
              type="email"
              name="email"
              required
              placeholder="you@yourstore.com"
              className="w-full pl-10 pr-4 py-3 bg-white border border-stone text-ink placeholder:text-stone-text focus:outline-none focus:border-ink text-base"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-ink hover:bg-forest text-paper font-semibold transition-colors"
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
