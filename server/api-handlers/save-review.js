import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzbwvleuuxyidohujibj.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Ynd2bGV1dXh5aWRvaHVqaWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg3ODEsImV4cCI6MjEwNTQ4NDc4MX0.qIvmq3FnjJPkKOcxnvFYS158NxF0GHKvd0PSwP7hECk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const item = body.item;
    let items = body.items;

    const localRevPath = path.join(process.cwd(), 'reviews.json');
    let currentReviews = [];
    if (fs.existsSync(localRevPath)) {
      try {
        currentReviews = JSON.parse(fs.readFileSync(localRevPath, 'utf-8'));
      } catch (e) {}
    }

    if (Array.isArray(items) && items.length > 0) {
      currentReviews = items;
    } else if (item && item.id) {
      const idx = currentReviews.findIndex(r => r.id === item.id || String(r.id) === String(item.id));
      if (idx !== -1) {
        currentReviews[idx] = { ...currentReviews[idx], ...item };
      } else {
        currentReviews.unshift(item);
      }
    }

    // Save to local file
    try {
      fs.writeFileSync(localRevPath, JSON.stringify(currentReviews, null, 2), 'utf-8');
    } catch (fe) {}

    // Save to Supabase services table under sys_google_reviews
    try {
      await supabase.from('services').upsert({
        id: 'sys_google_reviews',
        name: 'System Reviews Data Store',
        price: 0,
        tag: JSON.stringify(currentReviews),
        description: 'Cloud storage for all verified client reviews'
      });
    } catch (se) {}

    return res.status(200).json({ success: true, reviews: currentReviews });
  } catch (err) {
    console.error('Error in save-review handler:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Error saving review' });
  }
}
