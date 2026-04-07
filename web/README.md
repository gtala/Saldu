# Saldu (Next.js)

Stack **opción B**: Tailwind CSS v4, shadcn/ui (Base UI), **D3 treemap** (paridad con `server.js`), `next/font`.

## Desarrollo

```bash
cd web
npm install
npm run dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000).

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
