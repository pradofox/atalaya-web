const DOWNLOAD_URL = 'https://www.mediafire.com/file/t1zavjh6pt0bf02/Refugee_Drumkit_Esencial.zip/file';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  return auth.slice(7) === env.ADMIN_PASSWORD;
}

async function handleLeads(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();

  if (!name || !email || !email.includes('@')) {
    return json({ error: 'nombre y correo requeridos' }, 400);
  }

  try {
    await env.DB.prepare(
      'INSERT INTO leads (name, email) VALUES (?, ?)'
    ).bind(name, email).run();
  } catch (e) {
    // unique constraint = email ya existe, igual mandamos el link
    if (!e.message?.includes('UNIQUE')) {
      return json({ error: 'error guardando' }, 500);
    }
  }

  return json({ url: DOWNLOAD_URL });
}

async function handleCampaignGet(env) {
  const raw = await env.CAMPAIGN.get('state');
  if (!raw) {
    return json({ active: false, date: '', link: '', text: '' });
  }
  return json(JSON.parse(raw));
}

async function handleCampaignSet(request, env) {
  if (!checkAuth(request, env)) return json({ error: 'no autorizado' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  await env.CAMPAIGN.put('state', JSON.stringify(body));
  return json({ ok: true });
}

async function handleAdminLeads(request, env, url) {
  if (!checkAuth(request, env)) return json({ error: 'no autorizado' }, 401);

  const { results } = await env.DB.prepare(
    'SELECT id, name, email, created_at FROM leads ORDER BY created_at DESC'
  ).all();

  if (url.searchParams.get('format') === 'csv') {
    const rows = ['id,nombre,correo,fecha', ...results.map(r =>
      `${r.id},"${r.name}","${r.email}","${r.created_at}"`
    )].join('\n');
    return new Response(rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="leads-atalaya.csv"'
      }
    });
  }

  return json(results);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    /* app.atalaya.com.mx → sirve el portal en la raíz */
    if (url.hostname === 'app.atalaya.com.mx') {
      if (pathname === '/' || pathname === '') {
        return Response.redirect('https://app.atalaya.com.mx/portal', 302);
      }
    }

    if (pathname === '/api/leads' && method === 'POST') return handleLeads(request, env);
    if (pathname === '/api/campaign' && method === 'GET') return handleCampaignGet(env);
    if (pathname === '/api/campaign' && method === 'POST') return handleCampaignSet(request, env);
    if (pathname === '/api/admin/leads' && method === 'GET') return handleAdminLeads(request, env, url);

    return env.ASSETS.fetch(request);
  }
};
