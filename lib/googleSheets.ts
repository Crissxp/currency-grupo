import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// path where a credentials file may be written (local dev only)
const credentialsPath = path.join(process.cwd(), 'currency-grupo-3084566a0217.json');

function loadCredentials(): any {
  // prefer explicit env var when deployed
  const envCreds = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (envCreds) {
    try {
      // allow base64 encoded or raw JSON
      const text = envCreds.trim().startsWith('{')
        ? envCreds
        : Buffer.from(envCreds, 'base64').toString('utf-8');
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY', e);
      throw e;
    }
  }

  // otherwise read from local file (development)
  if (fs.existsSync(credentialsPath)) {
    return JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  }

  throw new Error(
    'Google service account credentials not found. Set GOOGLE_SERVICE_ACCOUNT_KEY env var.'
  );
}

export async function getGoogleSheetsClient() {
  const credentials = loadCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

async function getFirstSheetName(spreadsheetId: string) {
  const sheets = await getGoogleSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const title =
    res.data.sheets && res.data.sheets.length > 0
      ? res.data.sheets[0].properties?.title
      : 'Sheet1';
  return title || 'Sheet1';
}

export async function appendToSheet(values: any[][]) {
  const sheets = await getGoogleSheetsClient();
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  const sheetName = await getFirstSheetName(spreadsheetId!);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:F`,
    // Use RAW so Google Sheets doesn't reformat numeric precision
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });
}

export async function clearSheet() {
  const sheets = await getGoogleSheetsClient();
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  const sheetName = await getFirstSheetName(spreadsheetId!);

  // Clear a wide area including the first row; we'll rewrite header/bank ourselves
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A1:F1000`,
  });
}

export async function getAllWithdrawals() {
  const sheets = await getGoogleSheetsClient();
  const spreadsheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;
  const sheetName = await getFirstSheetName(spreadsheetId!);

  // grab the entire data area so we can interpret the bank row if present
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:F1000`,
  });

  return result.data.values || [];
}
