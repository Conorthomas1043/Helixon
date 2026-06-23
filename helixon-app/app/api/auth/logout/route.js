import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function POST() {
 try {
 const cookieStore = cookies();
 const supabase = createServerClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
 {
 cookies: {
 get(name) { return cookieStore.get(name)?.value; },
 set(name, value, options) {
 cookieStore.set({ name, value, ...options });
 },
 remove(name, options) {
 cookieStore.set({ name, value: "", ...options });
 },
 },
 }
 );
 await supabase.auth.signOut();
 return Response.json({ ok: true });
 } catch (err) {
 return Response.json({ ok: false, error: err.message }, { status: 500 });
 }
}
