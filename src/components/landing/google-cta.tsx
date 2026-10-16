import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { cn } from "@/lib/utils";

/** `local` identifica qual dos botões foi clicado no GA4. */
export function GoogleCta({ className, local }: { className?: string; local: "header" | "hero" | "footer" }) {
  return (
    <GoogleSignInButton
      data-track="login_click"
      data-track-local={local}
      className={cn(
        "h-11 rounded-full px-6 text-[15px] font-semibold hover:bg-primary/90",
        className,
      )}
    >
      Entrar com Google
    </GoogleSignInButton>
  );
}
