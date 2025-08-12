import Stripe from 'stripe';

const allowOrigin = process.env.ALLOW_ORIGIN || '*';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ⬇️ اقرأ المفتاح من البيئة وتأكد منه
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^sk_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    console.error('Bad STRIPE_SECRET_KEY:', key);
    return res.status(500).json({ error: 'Server Stripe key misconfigured' });
  }
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

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(400).json({ error: err.message });
  }
}

