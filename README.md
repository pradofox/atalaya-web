# atalaya-web

Sitio de **Atalaya** - academia / publishing / label de música urbana en Monterrey.

- Producción provisional: https://atalaya.sopadeletras.art
- Stack: HTML plano + Cloudflare Worker (assets binding).
- Cuenta CF: `pradofox@sopadeletras.art`.

## Deploy

```bash
npx wrangler deploy
```

El custom domain `atalaya.sopadeletras.art` está declarado en `wrangler.toml` (`routes` con `custom_domain = true`), así que la primera vez que se deploya, Cloudflare crea el record DNS automáticamente.

## Estructura

```
index.html         # landing single-page
style.css          # estilos
assets/
  logo/            # wordmarks pixel + favicon + gif
  textura/         # fondo textura vertical
wrangler.toml
_headers
_redirects
```

## Bitácora del proyecto

`Roberto Vault/sopadeletras®/Atalaya/02 - Bitácora - Atalaya.md`
