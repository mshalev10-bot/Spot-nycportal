import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { LOGO_URL, SITE_URL, VENUE_ADDRESS } from "@/lib/constants";
import type { SessionPayload } from "@/lib/session";

export function Shell({
  user,
  mode,
  children,
}: {
  user: SessionPayload;
  mode: "demo" | "live";
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <img src={LOGO_URL} alt="" width={42} height={42} />
            <div>
              <strong>The Spot NYC</strong>
              <span>Owner portal · West Village</span>
            </div>
          </Link>
          <nav className="nav" aria-label="Portal">
            {mode === "live" ? <span className="live-pill">Live HubSpot</span> : <span className="demo-pill">Demo</span>}
            <NavLinks />
            <span className="who">{user.name}</span>
            <form method="post" action="/api/auth/logout">
              <button className="text-button" type="submit">Log out</button>
            </form>
          </nav>
        </div>
      </header>
      {mode === "demo" ? (
        <div className="demo-banner">
          <p>
            <strong>Demo mode.</strong> This is sample data, not the live HubSpot portal. Nothing on this screen is written to the CRM, and no AI is called.
          </p>
        </div>
      ) : null}
      <main id="main" className="page">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          The Spot NYC, formerly The Malthouse, West Village. {VENUE_ADDRESS}.{" "}
          <a href={SITE_URL}>thespot-nyc.com</a>
        </div>
      </footer>
    </>
  );
}
