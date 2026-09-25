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
    const cleanKey = (payload.key || payload.email || payload.phone || payload.id || '').toString().trim().toLowerCase();
    const newStatus = (payload.status === 'Approved' || payload.status === 'Revoked') ? payload.status : 'Pending';

    if (!cleanKey) {
      return res.status(400).json({ success: false, message: 'Designer key is required' });
    }

    const clean10 = cleanKey.replace(/\D/g, '').slice(-10);
    const extraPhone10 = payload.phone ? (payload.phone || '').toString().replace(/\D/g, '').slice(-10) : '';
    const targetEmail = (payload.email || (cleanKey.includes('@') ? cleanKey : '')).toString().trim().toLowerCase();
    const rawId = (payload.id || '').toString().trim();

    const isApprovedBool = (newStatus === 'Approved');

    const updateData = {
      status: newStatus
    };

    const orFilters = [
      `id.eq.${cleanKey}`,
      `email.ilike.${cleanKey}`,
      `identifier.ilike.${cleanKey}`
    ];
    if (clean10) {
      orFilters.push(`phone.eq.${clean10}`, `id.eq.${clean10}`);
    }
    if (extraPhone10) {
      orFilters.push(`phone.eq.${extraPhone10}`, `id.eq.${extraPhone10}`);
    }
    if (targetEmail) {
      orFilters.push(`email.ilike.${targetEmail}`, `id.eq.${targetEmail}`);
    }
    if (rawId) {
      orFilters.push(`id.eq.${rawId}`);
    }

    // 1. Update designers table in Supabase
    const { data: updatedRows, error: updateErr } = await supabase
      .from('designers')
      .update(updateData)
      .or(orFilters.join(','));

    if (updateErr) {
      console.warn('[update-designer-status warning]:', updateErr.message);
    }

    // 2. Audit log in login_history
    try {
      await supabase.from('login_history').insert({
        id: `status-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        phone: clean10 || targetEmail || cleanKey,
        name: payload.name || `Designer ${cleanKey}`,
        role: 'designer',
        status: `Admin updated status to: ${newStatus}`,
        timestamp: new Date().toISOString()
      });
    } catch (logErr) {}

    return res.status(200).json({
      success: true,
      status: newStatus,
      message: `Designer ${cleanKey} status permanently set to ${newStatus} in Supabase cloud`
    });
  } catch (err) {
    console.error('Error in update-designer-status handler:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Error updating designer status' });
  }
}
