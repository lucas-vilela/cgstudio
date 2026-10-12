import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { cn } from "@/lib/utils";

export function GoogleCta({ className }: { className?: string }) {
  return (
    <GoogleSignInButton
      className={cn(
        "h-11 rounded-full px-6 text-[15px] font-semibold hover:bg-primary/90",
        className,
      )}
    >
      Entrar com Google
    </GoogleSignInButton>
  );
}
