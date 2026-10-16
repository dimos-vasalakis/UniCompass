import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-6">
      <h1>
        <Image src="/logo.png" alt="UniCompass" width={280} height={213} priority />
      </h1>
      <p className="text-lg text-muted">
        Passed the Panhellenic exams? Everything you need to move to your new
        university city — housing, costs, paperwork and local guides.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded bg-brand text-white hover:bg-brand-dark px-4 py-2 font-medium">
          Get started
        </Link>
        <Link href="/pricing" className="rounded border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-light">
          Pricing
        </Link>
      </div>
    </main>
  );
}
