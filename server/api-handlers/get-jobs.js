import { getPgPool } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const pool = getPgPool();
    const sqlRes = await pool.query(
      `SELECT * FROM jobs WHERE status IS NULL OR status != 'Deleted' ORDER BY createdat DESC, created_at DESC`
    );

    const jobs = (sqlRes.rows || []).map(j => {
      let refImg = j.referenceImage || j.referenceimage || j.image || '';
      const desc = (j.description || j.brief || j.details || '').toString();

      if (!refImg && desc) {
        const mTag = desc.match(/(?:Ref Image:\s*)?\[(?:START|IMAGE_DATA_START)\]([\s\S]*?)\[(?:END|IMAGE_DATA_END)\]/i);
        if (mTag && mTag[1]) {
          refImg = mTag[1].trim();
        } else {
          const mUrl = desc.match(/Ref Image:\s*(data:image\/[^\s|]+|https?:\/\/[^\s|]+)/i);
          if (mUrl && mUrl[1]) {
            refImg = mUrl[1].trim();
          }
        }
      }

      let cleanBrief = j.brief || desc;
      if (cleanBrief && typeof cleanBrief === 'string' && cleanBrief.includes('Ref Image:')) {
        cleanBrief = cleanBrief
          .replace(/(?:\|\s*)?Ref Image:\s*\[(?:START|IMAGE_DATA_START)\][\s\S]*?\[(?:END|IMAGE_DATA_END)\]/gi, '')
          .replace(/(?:\|\s*)?Ref Image:\s*(?:data:image\/[^\s|]+|https?:\/\/[^\s|]+)/gi, '')
          .replace(/(?:\|\s*)?Ratio:[^|]+/gi, '')
          .trim();
      }

      return {
        id: j.id,
        service: j.service || j.category || j.title || 'Graphic Design',
        category: j.category || j.service || 'Graphic Design',
        project: j.project || j.title || 'Design Request',
        title: j.title || j.project || 'Design Request',
        price: Number(j.price || j.budget) || 399,
        budget: Number(j.budget || j.price) || 399,
        brief: cleanBrief || 'Design Request',
        description: desc,
        phone: j.phone || j.whatsapp || '',
        whatsapp: j.whatsapp || j.phone || '',
        clientName: j.clientName || 'Client',
        ratio: j.ratio || 'Square (1:1)',
        referenceImage: refImg,
        referenceimage: refImg,
        image: refImg,
        refImage: refImg,
        status: j.status || 'Pending',
        acceptedBy: Array.isArray(j.acceptedBy) ? j.acceptedBy : (Array.isArray(j.acceptedby) ? j.acceptedby : (j.designer ? [j.designer] : [])),
        completed: !!j.completed,
        completedAt: j.completedat || j.completed_at || null,
        createdAt: j.createdat || j.created_at || new Date().toISOString(),
        time: j.time || j.deadline || 'Just now'
      };
    });

    return res.status(200).json({
      success: true,
      jobs,
      count: jobs.length
    });
  } catch (err) {
    console.error('[get-jobs PostgreSQL error]:', err);
    return res.status(200).json([]);
  }
}
