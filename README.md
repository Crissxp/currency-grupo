This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deployar a Vercel (pasos rápidos)

1. Instala el CLI de Vercel si no lo tienes:

```bash
npm i -g vercel
```

2. Variables de entorno necesarias (añadir en Vercel > Project > Settings > Environment Variables):
- `NEXT_PUBLIC_GOOGLE_SHEET_ID` = ID de la hoja de Google Sheets
- `GOOGLE_SERVICE_ACCOUNT_KEY` = JSON del service account (puedes pegar el JSON completo o su base64)

3. Opcional: si usas el archivo `currency-grupo-3084566a0217.json` en local, en Vercel debes usar la variable `GOOGLE_SERVICE_ACCOUNT_KEY` en lugar de subir el archivo.

4. Desplegar desde la carpeta del proyecto:

```bash
vercel login
vercel --prod
```

5. Para añadir las variables de entorno desde la CLI:

```bash
vercel env add NEXT_PUBLIC_GOOGLE_SHEET_ID production
vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production
```

6. Si necesitas forzar refresh desde Sheets en producción, usa el botón "Refrescar desde Sheets" en la UI o vuelve a desplegar.

Si quieres, puedo generar un script con pasos automáticos para el CLI.
