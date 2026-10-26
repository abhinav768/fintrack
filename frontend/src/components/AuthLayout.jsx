import { Wordmark } from "./Sidebar";
import { Reveal, ThemeToggle } from "./ui";

const TICKER = ["Loans", "EMIs", "Borrowers", "Reminders", "Interest", "Collections", "Overdue", "Exports"];

export default function AuthLayout({ eyebrow, title, accent, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line/[0.07] p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--line) / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / 0.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at 30% 60%, black 20%, transparent 70%)",
          }}
        />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full bg-lime/[0.07] blur-[120px]" />

        <Wordmark className="relative text-4xl" />

        <Reveal className="relative">
          <p className="eyebrow">Private lending ledger</p>
          <h2 className="display mt-6 text-[5.5rem] xl:text-[7rem]">
            Every rupee,
            <br />
            <em className="text-accent">accounted</em> for.
          </h2>
          <p className="mt-8 max-w-md text-base text-muted">
            Track who owes what, when it&apos;s due, and what has come back — with interest worked out
            to the paisa.
          </p>
        </Reveal>

        <div className="relative -mx-12 overflow-hidden border-t border-line/[0.07] pt-5">
          <div className="flex w-max animate-marquee">
            {[...TICKER, ...TICKER].map((word, i) => (
              <span key={i} className="flex items-center gap-6 pr-6 font-display text-2xl italic text-muted">
                {word}
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <ThemeToggle className="btn-icon absolute right-5 top-5" />
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="mb-16 block text-4xl lg:hidden" />
          <Reveal>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display mt-4 text-6xl">
              {title} <em className="text-muted">{accent}</em>
            </h1>
          </Reveal>
          <Reveal delay={100} className="mt-10">
            {children}
          </Reveal>
          {footer && (
            <Reveal delay={160} as="p" className="mt-8 text-sm text-muted">
              {footer}
            </Reveal>
          )}
        </div>
      </main>
    </div>
  );
}
