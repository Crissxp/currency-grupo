#!/usr/bin/env bash
# Small helper script with manual steps to deploy to Vercel using the CLI.
# Run from repo root.

set -euo pipefail

echo "1) Login to Vercel (if needed):"
echo "   vercel login"

echo "2) Add environment variables (interactive):"
echo "   vercel env add NEXT_PUBLIC_GOOGLE_SHEET_ID production"
echo "   vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production"

echo "3) Deploy to production:"
echo "   vercel --prod"

echo "Done. Open the Vercel dashboard to confirm variables and deployment status."