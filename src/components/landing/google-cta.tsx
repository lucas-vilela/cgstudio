import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { cn } from "@/lib/utils";

export function GoogleCta({ className }: { className?: string }) {
  return (
    <GoogleSignInButton
      className={cn(
        "h-12 gap-3 rounded-full border-0 bg-[var(--cg-signal)] px-7 text-base font-semibold text-[var(--cg-ink)] hover:bg-[var(--cg-signal)] hover:brightness-110",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M21.35 11.1H12v2.9h5.35c-.5 2.4-2.55 3.6-5.35 3.6a6 6 0 1 1 3.9-10.55l2.1-2.05A9 9 0 1 0 12 21c5.2 0 9.5-3.6 9.5-9 0-.3-.05-.6-.15-.9Z" />
      </svg>
      Entrar com Google
    </GoogleSignInButton>
  );
}
