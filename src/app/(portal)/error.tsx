"use client";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = error.message.replace(/pat-[a-z0-9-]+/gi, "[token]").replace(/Bearer\s+\S+/gi, "Bearer [token]");
  return (
    <div className="empty">
      <h1>Couldn’t load HubSpot</h1>
      <p>{message || "The portal could not finish the request."}</p>
      <button className="primary" type="button" onClick={reset} style={{ width: "auto" }}>Try again</button>
    </div>
  );
}
