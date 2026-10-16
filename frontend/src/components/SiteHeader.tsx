import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

async function AccountLink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? (
    <Link href="/dashboard" className="font-medium text-brand hover:underline">
      My account
    </Link>
  ) : (
    <Link href="/login" className="font-medium text-brand hover:underline">
      Sign in
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 text-sm sm:gap-6 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 text-base font-bold text-brand">
          <Image src="/mark.png" alt="" width={32} height={32} />
          UniCompass
        </Link>
        <Link href="/match" className="hover:text-brand">
          Find my area
        </Link>
        <Link href="/neighborhoods" className="hidden hover:text-brand sm:inline">
          All areas
        </Link>
        <Suspense fallback={<span className="w-16" />}>
          <AccountLink />
        </Suspense>
      </nav>
    </header>
  );
}
