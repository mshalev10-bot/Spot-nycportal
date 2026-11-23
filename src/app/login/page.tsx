import { LOGO_URL, VENUE_ADDRESS } from "@/lib/constants";
import { isDemoMode, sessionSecret } from "@/lib/mode";
import { safeNext } from "@/lib/text";
import { activeUsers, usingBuiltInDemoUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  credentials: "That email and password don’t match.",
  rate: "Too many attempts. Wait a few minutes and try again.",
  config: "Owner login is not configured yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  let configMessage: string | null = null;
  let showDemoAccounts = false;
  try {
    if (!isDemoMode() && !sessionSecret()) {
      configMessage = "Set SESSION_SECRET to at least 16 characters. Live mode will not start a session without it.";
    } else if (activeUsers().length === 0) {
      configMessage = "No owner accounts yet. Add OWNER_USERS or data/users.json. See the README.";
    }
    showDemoAccounts = usingBuiltInDemoUsers();
  } catch (error) {
    configMessage = error instanceof Error ? error.message : "Owner accounts could not be read.";
  }
  const errorMessage = params.error ? ERRORS[params.error] ?? "Sign-in failed." : null;

  return (
    <div className="login">
      <section className="login-story">
        <div>
          <img src={LOGO_URL} alt="The Spot NYC" width={72} height={72} />
          <p className="kicker" style={{ color: "#fcea88" }}>I&M Hospitality</p>
          <h1>The Spot</h1>
          <p>Beers, bites, and the book of business. Formerly The Malthouse, West Village.</p>
        </div>
        <p>{VENUE_ADDRESS}</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>Owner login</h2>
          <p className="lede">Private view of Spot deals, leads, and activity. Read-only.</p>
          {configMessage ? <p className="alert">{configMessage}</p> : null}
          {errorMessage && !configMessage ? <p className="alert">{errorMessage}</p> : null}
          <form className="form" method="post" action="/api/auth/login">
            <input type="hidden" name="next" value={next} />
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="username" required disabled={Boolean(configMessage)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input name="password" type="password" autoComplete="current-password" required disabled={Boolean(configMessage)} />
            </label>
            <button className="primary" type="submit" disabled={Boolean(configMessage)}>Log in</button>
          </form>
          {showDemoAccounts ? (
            <div className="demo-accounts">
              <strong>Demo accounts</strong>
              <p><code>owner@thespot-nyc.com</code> · <code>demo-spot-2026</code></p>
              <p><code>kayleen@thespot-nyc.com</code> · <code>demo-kayleen-2026</code></p>
              <p>Both see the same venue book. They are disabled as soon as you configure real owner accounts.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
