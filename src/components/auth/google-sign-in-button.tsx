import { signInWithGoogle } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  children = "Entrar com Google",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "onClick">) {
  return (
    <form action={signInWithGoogle}>
      <Button type="submit" {...props}>
        {children}
      </Button>
    </form>
  );
}
