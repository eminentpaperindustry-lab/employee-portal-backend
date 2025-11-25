const { google } = require('googleapis');
const path = require('path');

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFilename: path.join(__dirname, "credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

module.exports = { getSheets };
