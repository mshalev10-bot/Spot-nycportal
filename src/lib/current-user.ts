import { cookies } from "next/headers";
import { COOKIE_NAME, verifySessionToken, type SessionPayload } from "./session";

export async function currentSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE_NAME)?.value);
}
