import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export async function POST(request) {
 try {
 const { plan, userId, userEmail } = await request.json();
 // Your Stripe price IDs — get these from Stripe dashboard
 const prices = {
 solo: "price_your_solo_price_id",
 team: "price_your_team_price_id",
 };
 const session = await stripe.checkout.sessions.create({
 mode: "subscription",
 payment_method_types: ["card"],
 customer_email: userEmail,
 line_items: [{ price: prices[plan], quantity: 1 }],
 success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success`,
 cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
 metadata: {
 user_id: userId,
 plan: plan,
 },
 });
 return Response.json({ ok: true, url: session.url });
 } catch (err) {
 return Response.json({ ok: false, error: err.message }, { status: 500 });
 }
}