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
    /* Escapa comillas y neutraliza inyección de fórmulas (=,+,-,@) al abrir en Excel */
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const rows = ['id,nombre,correo,fecha', ...results.map(r =>
      [r.id, cell(r.name), cell(r.email), cell(r.created_at)].join(',')
    )].join('\r\n');
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

    /* API routes — funcionan en todos los dominios */
    if (pathname === '/api/leads' && method === 'POST') return handleLeads(request, env);
    if (pathname === '/api/campaign' && method === 'GET') return handleCampaignGet(env);
    if (pathname === '/api/campaign' && method === 'POST') return handleCampaignSet(request, env);
    if (pathname === '/api/admin/leads' && method === 'GET') return handleAdminLeads(request, env, url);

    /* app.atalaya.com.mx → siempre sirve el portal.
     * Se pide "/portal" (URL canónica bajo html_handling=auto-trailing-slash);
     * pedir "/portal.html" devolvería un 307 al canónico y rompería el rewrite.
     * Excepción: archivos con extensión (svg, png, js, css…) pasan directo
     * para que el portal cargue sus assets. */
    if (url.hostname === 'app.atalaya.com.mx') {
      const hasExt = /\.[a-z0-9]{1,6}$/i.test(pathname) && !/\.html?$/i.test(pathname);
      if (!hasExt) {
        const portalReq = new Request(
          new URL('/portal', request.url).toString(),
          { method: request.method, headers: request.headers }
        );
        return env.ASSETS.fetch(portalReq);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
