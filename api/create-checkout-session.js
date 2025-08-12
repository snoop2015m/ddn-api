import Stripe from 'stripe';

function setCors(req, res) {
  const list = (process.env.ALLOW_ORIGIN || '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin || '';
  const allow =
    list.includes('*') || list.includes(origin)
      ? origin || (list[0] || '*')
      : (list[0] || '*');

  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Server Stripe key misconfigured' });
  const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

  try {
    const b = req.body || {};
    const plan = b.plan === 'advanced' ? 'advanced' : 'basic';
    const priceId = plan === 'advanced' ? process.env.PRICE_ADVANCED : process.env.PRICE_BASIC;

    const meta = {
      plan,
      full_name: b.full_name || '',
      phone: b.phone || '',
      preferred_language: b.preferred_language || 'ar',
      gender: b.gender || '',
      date_of_birth: b.date_of_birth || '',
      height_cm: String(b.height_cm || ''),
      weight_kg: String(b.weight_kg || ''),
      activity_level: b.activity_level || '',
      meals_per_day: String(b.meals_per_day || ''),
      goal: b.goal || '',
      conditions: b.conditions || '',
      allergies: b.allergies || '',
      meds_supplements: b.meds_supplements || ''
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.CANCEL_URL,
      customer_creation: 'always',
      customer_email: b.email || undefined,
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      subscription_data: { metadata: meta },
      metadata: meta
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(400).json({ error: err.message });
  }
}
