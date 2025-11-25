const express = require("express");
const { nanoid } = require("nanoid");
const { getSheets } = require("../googleSheetsClient");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const sheetName = `${req.user.name}_Delegations`;
    const sheets = await getSheets(); 

    const fetch = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A2:H`,
    });

    const rows = fetch.data.values || [];
    const now = Date.now();

    const tasks = rows
      .filter((r) => {
        const status = r[5];
        if (status === "Pending" || status === "In Progress") return true;
        if (status === "Done") {
          const doneTime = new Date(r[4]).getTime();
          return now - doneTime <= 6 * 3600 * 1000;
        }
        return false;
      })
      .map((r) => ({
        TaskID: r[0],
        TaskName: r[1],
        CreatedDate: r[2],
        Deadline: r[3],
        DoneDate: r[4],
        Status: r[5],
        Priority: r[6],
        Notes: r[7],
      }));

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { TaskName, Deadline, Priority, Notes } = req.body;
    const TaskID = nanoid(6);
    const CreatedDate = new Date().toISOString();

    const sheetName = `${req.user.name}_Delegations`;
    const sheets = await getSheets();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A:H`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[TaskID, TaskName, CreatedDate, Deadline, "", "Pending", Priority, Notes]],
      },
    });

    res.json({ ok: true, TaskID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/start/:id", auth, async (req, res) => {
  try {
    const taskId = req.params.id;
    const sheetName = `${req.user.name}_Delegations`;
    const sheets = await getSheets();

    const fetch = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A2:H`,
    });

    const rows = fetch.data.values || [];
    const idx = rows.findIndex((r) => r[0] === taskId);

    if (idx === -1) return res.status(404).json({ error: "Task not found" });

    rows[idx][5] = "In Progress";

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A${idx + 2}:H${idx + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rows[idx]] },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/done/:id", auth, async (req, res) => {
  try {
    const taskId = req.params.id;
    const sheetName = `${req.user.name}_Delegations`;
    const sheets = await getSheets();

    const fetch = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A2:H`,
    });

    const rows = fetch.data.values || [];
    const idx = rows.findIndex((r) => r[0] === taskId);

    if (idx === -1) return res.status(404).json({ error: "Task not found" });

    rows[idx][4] = new Date().toISOString();
    rows[idx][5] = "Done";

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A${idx + 2}:H${idx + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rows[idx]] },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const taskId = req.params.id;
    const sheetName = `${req.user.name}_Delegations`;
    const sheets = await getSheets();

    const fetch = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A2:H`,
    });

    const rows = fetch.data.values || [];
    const idx = rows.findIndex((r) => r[0] === taskId);

    if (idx === -1) return res.status(404).json({ error: "Task not found" });

    // Clear the row (effectively delete)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A${idx + 2}:H${idx + 2}`,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
