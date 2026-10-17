import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

async function AccountLinks() {
  const user = await getUser();
  if (user) {
    return (
      <>
        <Link href="/dashboard" className="font-medium text-brand hover:underline">
          My account
        </Link>
        <SignOutButton />
      </>
    );
  }
  return (
    <>
      <Link href="/login" className="font-medium text-brand hover:underline">
        Sign in
      </Link>
      <Link href="/signup" className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-dark">
        Sign up
      </Link>
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-3 whitespace-nowrap px-4 py-3 text-sm sm:gap-6 sm:px-6">
        <Link href="/" aria-label="UniCompass home" className="mr-auto flex items-center gap-2 text-base font-bold text-brand">
          <Image src="/mark.png" alt="" width={32} height={32} />
          <span className="hidden sm:inline">UniCompass</span>
        </Link>
        <Link href="/match" className="hover:text-brand">
          Find my area
        </Link>
        <Link href="/neighborhoods" className="hidden hover:text-brand sm:inline">
          All areas
        </Link>
        {/* inline-block so the width applies: reserves room for the auth links. */}
        <Suspense fallback={<span aria-hidden className="inline-block h-8 w-44" />}>
          <AccountLinks />
        </Suspense>
        <ThemeToggle />
      </nav>
    </header>
  );
}
