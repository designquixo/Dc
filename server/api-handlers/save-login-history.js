import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzbwvleuuxyidohujibj.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Ynd2bGV1dXh5aWRvaHVqaWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg3ODEsImV4cCI6MjEwNTQ4NDc4MX0.qIvmq3FnjJPkKOcxnvFYS158NxF0GHKvd0PSwP7hECk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { id, phone, name, role, status, timestamp } = payload;

    const row = {
      id: id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      phone: (phone || '').toString().trim(),
      name: (name || 'User').toString().trim(),
      role: (role || 'user').toString().trim(),
      status: (status || '').toString().trim(),
      timestamp: timestamp || new Date().toISOString()
    };

    const { error } = await supabase.from('login_history').upsert(row, { onConflict: 'id' });

    if (error) {
      console.warn('[save-login-history warning]:', error.message);
    }

    // Also if this is a signed_agreement or user_dp, sync signature to designers table if possible
    if (role === 'signed_agreement' && status && row.phone) {
      const cleanPhone = row.phone.replace(/\D/g, '').slice(-10);
      const cleanEmail = row.phone.includes('@') ? row.phone.toLowerCase().trim() : '';

      const orFilters = [];
      if (cleanPhone) orFilters.push(`phone.eq.${cleanPhone}`, `id.eq.${cleanPhone}`);
      if (cleanEmail) orFilters.push(`email.ilike.${cleanEmail}`, `id.eq.${cleanEmail}`);

      if (orFilters.length > 0) {
        await supabase
          .from('designers')
          .update({
            signature: status,
            signatureDataUrl: status
          })
          .or(orFilters.join(','));
      }
    }

    return res.status(200).json({ success: true, message: 'Login history saved to cloud' });
  } catch (err) {
    console.error('Error in save-login-history handler:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Error saving login history' });
  }
}
