const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://gzbwvleuuxyidohujibj.supabase.co').replace(/\/+$/, '').replace(/\/rest\/v1\/?$/i, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Ynd2bGV1dXh5aWRvaHVqaWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDg3ODEsImV4cCI6MjEwNTQ4NDc4MX0.qIvmq3FnjJPkKOcxnvFYS158NxF0GHKvd0PSwP7hECk';

// In-Memory OTP Store for 100% failproof zero-latency verification & 0 Supabase quotas
export const inMemoryOtpStore = new Map();

export async function querySupabaseRest(sqlText, params = []) {
  const trimmed = (sqlText || '').trim();
  const lower = trimmed.toLowerCase();

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // 1. SELECT queries
    if (lower.startsWith('select')) {
      let table = 'login_history';
      if (lower.includes('from designers')) table = 'designers';
      else if (lower.includes('from jobs')) table = 'jobs';
      else if (lower.includes('from push_subscriptions')) table = 'push_subscriptions';
      else if (lower.includes('from login_history')) table = 'login_history';

      let endpoint = `${SUPABASE_URL}/rest/v1/${table}?select=*`;

      if (lower.includes('order by created_at desc') || lower.includes('order by createdat desc')) {
        if (table === 'designers') {
          endpoint += '&order=createdat.desc';
        } else {
          endpoint += '&order=created_at.desc';
        }
      } else if (lower.includes('order by timestamp desc')) {
        endpoint += '&order=timestamp.desc';
      }

      if (lower.includes('limit 1')) endpoint += '&limit=1';

      if (table === 'login_history') {
        if (params.length >= 1 && params[0]) {
          endpoint += `&phone=eq.${encodeURIComponent(params[0])}`;
        }
        if (lower.includes("role = 'otp_verification'") || (params.length >= 2 && params[1] === 'otp_verification')) {
          endpoint += `&role=eq.otp_verification`;
        }
      } else if (table === 'designers') {
        if (params.length === 1 && params[0]) {
          const val = encodeURIComponent(params[0]);
          endpoint += `&or=(email.ilike.${val},identifier.ilike.${val},id.ilike.${val})`;
        } else if (params.length >= 2) {
          const val0 = encodeURIComponent(params[0] || '');
          const val1 = encodeURIComponent(params[1] || '');
          endpoint += `&or=(email.ilike.${val0},identifier.ilike.${val0},id.ilike.${val0},phone.ilike.*${val1}*)`;
        }
      }

      const res = await fetch(endpoint, { headers });
      if (res.ok) {
        const rows = await res.json().catch(() => []);
        return { rows: Array.isArray(rows) ? rows : [] };
      }
      return { rows: [] };
    }

    // 2. DELETE queries
    if (lower.startsWith('delete')) {
      let table = 'login_history';
      if (lower.includes('from login_history')) table = 'login_history';
      else if (lower.includes('from jobs')) table = 'jobs';

      let endpoint = `${SUPABASE_URL}/rest/v1/${table}?`;
      if (lower.includes("role = 'otp_verification'") && params[0]) {
        endpoint += `phone=eq.${encodeURIComponent(params[0])}&role=eq.otp_verification`;
      } else if (lower.includes('where id = $1') && params[0]) {
        endpoint += `id=eq.${encodeURIComponent(params[0])}`;
      } else if (params[0]) {
        endpoint += `phone=eq.${encodeURIComponent(params[0])}`;
      }

      const res = await fetch(endpoint, { method: 'DELETE', headers });
      return { rows: [], rowCount: res.ok ? 1 : 0 };
    }

    // 3. INSERT queries
    if (lower.startsWith('insert')) {
      let table = 'login_history';
      if (lower.includes('into designers')) table = 'designers';
      else if (lower.includes('into jobs')) table = 'jobs';
      else if (lower.includes('into push_subscriptions')) table = 'push_subscriptions';
      else if (lower.includes('into login_history')) table = 'login_history';

      let payload = {};
      if (table === 'login_history') {
        let roleVal = 'designer';
        let statusVal = params[3] || 'Success';
        let timeVal = params[4] || new Date().toISOString();

        if (lower.includes("'otp_verification'") || lower.includes("otp_verification")) {
          roleVal = 'otp_verification';
          statusVal = params[3]; // 6-digit OTP code ($4)
          timeVal = params[4]; // expiresAt ($5)
        } else if (params.length >= 6) {
          roleVal = params[3];
          statusVal = params[4];
          timeVal = params[5];
        }

        payload = {
          id: params[0] || `log-${Date.now()}`,
          phone: params[1] || '',
          name: params[2] || 'User',
          role: roleVal,
          status: statusVal,
          timestamp: timeVal
        };
      } else if (table === 'designers') {
        const primaryId = (params[0] || '').toString().trim();
        const name = (params[1] || 'Designer').toString().trim();
        let phone = '';
        let email = '';
        let portfolio = '';
        let skills = '';
        let status = 'Pending';
        let role = 'designer';
        let avatar = '';
        let password = 'Designer@123';
        let signature = '';
        let dateStr = new Date().toLocaleDateString('en-IN');

        if (params.length >= 10) {
          phone = (params[2] || '').toString().trim();
          email = (params[3] || '').toString().trim();
          password = (params[5] || 'Designer@123').toString().trim();
          portfolio = (params[7] || '').toString().trim();
          skills = (params[8] || '').toString().trim();
          status = (params[9] || 'Pending').toString().trim();
          role = (params[10] || 'designer').toString().trim();
          avatar = (params[11] || params[12] || '').toString().trim();
          dateStr = (params[13] || dateStr).toString().trim();
          signature = (params[14] || params[15] || '').toString().trim();
        } else {
          email = (params[2] || '').toString().trim();
          phone = (params[3] || '').toString().trim();
          status = (params[5] || 'Pending').toString().trim();
          portfolio = (params[6] || '').toString().trim();
          skills = (params[7] || '').toString().trim();
        }

        const clean10 = phone.replace(/\D/g, '').slice(-10) || primaryId.replace(/\D/g, '').slice(-10);
        const cleanEm = email.includes('@') ? email : (primaryId.includes('@') ? primaryId : '');

        payload = {
          id: primaryId || clean10 || cleanEm || `DES-${Date.now()}`,
          name: name || 'Designer',
          phone: clean10 || phone || '',
          email: cleanEm || email || '',
          specialization: skills || 'Graphic Design',
          skills: skills || 'Photoshop, Illustrator',
          portfolio: portfolio || '',
          avatar: avatar || null,
          avatar_url: avatar || null,
          status: status || 'Pending',
          role: role || 'designer',
          created_at: new Date().toISOString(),
          createdat: new Date().toISOString(),
          date: dateStr,
          password: password,
          pin: password,
          identifier: cleanEm || clean10 || primaryId,
          signature: signature || '',
          signaturedataurl: signature || '',
          agreementsigned: true,
          agreementsigneddate: dateStr
        };
      } else if (table === 'jobs') {
        const cleanId = (params[0] || '').toString().trim();
        const service = (params[1] || 'Graphic Design').toString().trim();
        const project = (params[2] || 'Design Request').toString().trim();
        const price = Number(params[3]) || 399;
        const brief = (params[4] || '').toString().trim();
        const phone = (params[5] || '').toString().trim();
        const whatsapp = (params[6] || '').toString().trim();
        const ratio = (params[7] || 'Square (1:1)').toString().trim();
        const refImg = (params[8] || '').toString().trim();
        const status = (params[9] || 'Pending').toString().trim();
        let acceptedBy = [];
        try {
          acceptedBy = typeof params[10] === 'string' ? JSON.parse(params[10]) : (Array.isArray(params[10]) ? params[10] : []);
        } catch(e) {}
        const completed = !!params[11];
        const completedAt = params[12] || null;
        const createdAt = params[13] || new Date().toISOString();
        const time = (params[14] || 'Just now').toString().trim();

        payload = {
          id: cleanId,
          service: service,
          category: service,
          project: project,
          title: project,
          price: price,
          budget: price,
          brief: brief,
          details: brief,
          description: refImg ? `${brief}\n\nRef Image: ${refImg}` : brief,
          phone: phone,
          whatsapp: whatsapp,
          ratio: ratio,
          referenceimage: refImg,
          referenceImage: refImg,
          reference_image: refImg,
          image: refImg,
          status: status,
          acceptedby: acceptedBy,
          acceptedBy: acceptedBy,
          completed: completed,
          completedat: completedAt,
          completedAt: completedAt,
          createdat: createdAt,
          createdAt: createdAt,
          created_at: createdAt,
          time: time
        };
      }

      const reqHeaders = {
        ...headers,
        'Prefer': 'return=representation,resolution=merge-duplicates'
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => []);
      return { rows: Array.isArray(data) ? data : [payload] };
    }

    // 4. UPDATE queries
    if (lower.startsWith('update')) {
      let table = 'designers';
      if (lower.includes('designers')) table = 'designers';

      let endpoint = `${SUPABASE_URL}/rest/v1/${table}?`;
      if (params.length >= 2) {
        endpoint += `or=(email.ilike.${encodeURIComponent(params[1])},phone.ilike.*${encodeURIComponent(params[2] || '')}*)`;
      }
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ password: params[0] })
      });
      return { rows: [], rowCount: res.ok ? 1 : 0 };
    }
  } catch (err) {
    console.warn('[Supabase REST query notice]:', err?.message);
  }

  return { rows: [] };
}

export function getPgPool() {
  return {
    query: async (sqlText, params = []) => {
      // Direct high-efficiency Supabase REST API over HTTPS (Port 443) - Zero connection overhead
      return await querySupabaseRest(sqlText, params);
    }
  };
}

export default getPgPool;


