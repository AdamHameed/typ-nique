import { AuthForm } from "../../components/auth-form";
import { SiteShell } from "../../components/site-shell";

export default function SignupPage() {
  return (
    <SiteShell>
      <AuthForm mode="signup" />
    </SiteShell>
  );
}
