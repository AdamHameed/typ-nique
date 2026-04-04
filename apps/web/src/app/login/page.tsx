import { AuthForm } from "../../components/auth-form";
import { SiteShell } from "../../components/site-shell";

export default function LoginPage() {
  return (
    <SiteShell>
      <AuthForm mode="login" />
    </SiteShell>
  );
}
