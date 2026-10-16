import Image from "next/image";
import Link from "next/link";

const STEPS = [
  { title: "Pick your department", text: "We know which campus you'll actually be going to." },
  { title: "Set your priorities", text: "Safety, a short commute, low rent, nightlife, getting home…" },
  { title: "Get your 3 best areas", text: "With the real advantages and disadvantages of each one." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-4 py-12 sm:px-6">
      <section className="grid items-center gap-10 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Got into a university in <span className="text-brand">Athens</span>? Find where to live.
          </h1>
          <p className="text-lg text-muted">
            You don&apos;t know the city yet, and that&apos;s fine. Tell us what matters to you and we&apos;ll
            show you the neighborhoods that fit you best. Free, no account needed.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/match" className="rounded-lg bg-brand px-5 py-3 font-medium text-white hover:bg-brand-dark">
              Find my area
            </Link>
            <Link
              href="/neighborhoods"
              className="rounded-lg border border-brand px-5 py-3 font-medium text-brand hover:bg-brand-light"
            >
              Browse all areas
            </Link>
          </div>
        </div>
        <Image src="/logo.png" alt="UniCompass" width={300} height={229} priority className="mx-auto hidden md:block" />
      </section>

      <section>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl bg-brand-light p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-bold">{i + 1}</div>
              <h2 className="mt-3 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
