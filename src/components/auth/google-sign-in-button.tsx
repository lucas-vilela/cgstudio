import { signInWithGoogle } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export function GoogleSignInButton({
  children = "Entrar com Google",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "onClick">) {
  return (
    <form action={signInWithGoogle}>
      <Button type="submit" {...props}>
        <LogIn data-icon="inline-start" />
        {children}
      </Button>
    </form>
  );
}
