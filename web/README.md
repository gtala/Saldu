# Saldu (Next.js)

Stack **opción B**: Tailwind CSS v4, shadcn/ui (Base UI), Recharts, `next/font`.

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

La ruta **`GET /api/data`** usa `../sheets.js` (misma lógica que el `server.js` legacy).

Variables (en **`../.env`** en la raíz del repo o en **`web/.env.local`**):

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` (ruta absoluta al JSON de la cuenta de servicio)

## Notas

- Tema oscuro por defecto (`className="dark"` en `app/layout.tsx`).
