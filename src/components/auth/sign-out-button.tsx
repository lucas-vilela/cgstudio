import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton({
  children = "Sair",
  variant = "outline",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "type" | "onClick">) {
  return (
    <form action={signOut}>
      <Button type="submit" variant={variant} {...props}>
        <LogOut data-icon="inline-start" />
        {children}
      </Button>
    </form>
  );
}
