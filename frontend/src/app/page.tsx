import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";

export default async function Home() {
  const d = (await getDictionary()).home;
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-4 py-12 sm:px-6">
      <section className="grid items-center gap-10 md:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            {d.titleBefore}<span className="text-brand">{d.city}</span>{d.titleAfter}
          </h1>
          <p className="text-lg text-muted">
            {d.intro}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/match" className="rounded-lg bg-brand px-5 py-3 font-medium text-white hover:bg-brand-dark">
              {d.cta}
            </Link>
            <Link
              href="/neighborhoods"
              className="rounded-lg border border-brand px-5 py-3 font-medium text-brand hover:bg-brand-light"
            >
              {d.browse}
            </Link>
          </div>
        </div>
        <Image src="/logo.png" alt="UniCompass" width={300} height={229} priority className="mx-auto hidden md:block" />
      </section>

      <section>
        <ol className="grid gap-4 sm:grid-cols-3">
          {d.steps.map((s, i) => (
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
