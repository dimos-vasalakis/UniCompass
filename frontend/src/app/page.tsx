import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold">UniCompass</h1>
      <p className="text-lg text-zinc-600">
        Passed the Panhellenic exams? Everything you need to move to your new
        university city — housing, costs, paperwork and local guides.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded bg-black px-4 py-2 text-white">
          Get started
        </Link>
        <Link href="/pricing" className="rounded border px-4 py-2">
          Pricing
        </Link>
      </div>
    </main>
  );
}
