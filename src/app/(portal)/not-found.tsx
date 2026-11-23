import Link from "next/link";

export default function DealNotFound() {
  return (
    <div className="empty">
      <h1>This is not a Spot deal</h1>
      <p>The record is missing from The Spot and West Village venue filter, or the id is not valid.</p>
      <p><Link href="/">Back to the pipeline</Link></p>
    </div>
  );
}
