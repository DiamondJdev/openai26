import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          ClaimLens
        </p>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          An AI investigator for car-wash damage claims
        </h1>
        <p className="text-muted">
          Three fixed cameras already record the truth. ClaimLens reasons over
          the footage and answers, with cited evidence, whether the wash caused
          new damage — in under a minute.
        </p>
      </header>

      <nav aria-label="Primary" className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/employee"
          className="inline-flex min-h-touch items-center justify-center rounded-lg bg-accent px-5 py-3 font-semibold text-accent-fg"
        >
          Employee console
        </Link>
      </nav>
    </main>
  );
}
