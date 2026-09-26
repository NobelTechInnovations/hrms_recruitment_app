import Link from "next/link";
import { getCurrentUser, homePathFor } from "@/server/auth";
import { Logo } from "@/components/shell";
import { ButtonLink } from "@/components/ui";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-5 text-sm text-ink-2 md:flex" aria-label="Main">
            <Link href="/jobs" className="hover:text-ink">
              Browse jobs
            </Link>
            <Link href="/#companies" className="hover:text-ink">
              For companies
            </Link>
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
          </nav>
          <div className="flex-1" />
          {user ? (
            <ButtonLink href={homePathFor(user)} size="sm">
              Go to dashboard
            </ButtonLink>
          ) : (
            <div className="flex items-center gap-2">
              <ButtonLink href="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register" size="sm">
                Get started
              </ButtonLink>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm text-ink-2 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs">Verified companies. Pre-screened candidates. Private, platform-routed communication.</p>
          </div>
          <div>
            <p className="font-medium text-ink">Job seekers</p>
            <ul className="mt-2 space-y-1.5">
              <li><Link href="/jobs" className="hover:text-ink">Browse verified jobs</Link></li>
              <li><Link href="/register" className="hover:text-ink">Create your profile</Link></li>
              <li><Link href="/register" className="hover:text-ink">Find Jobs For Me</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Companies</p>
            <ul className="mt-2 space-y-1.5">
              <li><Link href="/register?role=company" className="hover:text-ink">Register your company</Link></li>
              <li><Link href="/pricing" className="hover:text-ink">Plans & services</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Trust & privacy</p>
            <p className="mt-2">Candidates never pay. Contact details stay private until you choose to share them.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
