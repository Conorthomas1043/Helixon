import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function POST(request) {
 try {
 const { email, password } = await request.json();
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
 const { data, error } = await supabase.auth.signUp({
 email,
 password,
 });
 if (error) {
 return Response.json(
 { ok: false, error: error.message },
 { status: 400 }
 );
 }
 return Response.json({ ok: true, user: data.user });
 } catch (err) {
 return Response.json(
 { ok: false, error: err.message },
 { status: 500 }
 );
 }
}
