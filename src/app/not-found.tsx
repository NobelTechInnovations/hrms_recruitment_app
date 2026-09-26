import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-2">The page may have moved, or you may not have access to it.</p>
      <ButtonLink href="/" className="mt-6">
        Go home
      </ButtonLink>
    </div>
  );
}
