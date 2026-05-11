# Saldu (Next.js)

Stack **opción B**: Tailwind CSS v4, shadcn/ui (Base UI), **D3 treemap** (paridad con `server.js`), `next/font`.

## Desarrollo

```bash
cd web
npm install
npm run dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000).

**Login Google (NextAuth):** `AUTH_URL` tiene que ser exactamente la base donde corre Next (host + puerto). Si el 3000 está ocupado, Next puede usar 3009: entonces `AUTH_URL=http://localhost:3009` y en Google Cloud Console agregá `http://localhost:3009/api/auth/callback/google` en «URI de redireccionamiento autorizados». Si Google vuelve al 3000 y ahí no está Saldu, verás `ruta no encontrada` en el callback.

## Componentes shadcn

```bash
npx shadcn@latest add dialog
```

## Datos (Google Sheets)

- **`GET /api/data`** — mismo `fetchMonthlyTotals` que el `server.js` legacy (`../sheets.js`).
- **`GET /api/cotizacion-cripto`** — dólar cripto (venta) para el toggle USD en la UI.

Variables (en **`../.env`** en la raíz del repo o en **`web/.env.local`**):

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` (ruta absoluta al JSON de la cuenta de servicio)

## Notas

- Tema oscuro por defecto (`className="dark"` en `app/layout.tsx`).
