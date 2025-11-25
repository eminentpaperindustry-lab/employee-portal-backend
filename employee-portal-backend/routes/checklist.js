const express = require("express");
const { nanoid } = require("nanoid");
const { getSheets } = require("../googleSheetsClient");
const auth = require("../middleware/auth");

const router = express.Router();

// ======================================================
// DEADLINE GENERATOR
// ======================================================
function getNextDeadline(format) {
  const now = new Date();

  if (format === "Daily") {
    now.setDate(now.getDate() + 1);
  } else if (format === "Weekly") {
    now.setDate(now.getDate() + 7);
  } else if (format === "Monthly") {
    now.setMonth(now.getMonth() + 1);
  }

  return now.toISOString().split("T")[0];
}

// ======================================================
// GET ALL CHECKLISTS
// ======================================================
router.get("/", auth, async (req, res) => {
  try {
    const sheetName = `${req.user.name}_Checklist`;
    const sheets = await getSheets();

    const fetchRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A2:G`,
    });

    const rows = fetchRes.data.values || [];

    const checklists = rows.map((r) => ({
      ChecklistID: r[0],
      ChecklistName: r[1],
      CreatedDate: r[2],
      Deadline: r[3],
      DoneDate: r[4],
      Status: r[5],
      Format: r[6],
    }));

    res.json(checklists);
  } catch (err) {
    console.error("Checklist GET Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// CREATE CHECKLIST MANUALLY
// ======================================================
router.post("/", auth, async (req, res) => {
  try {
    const { ChecklistName, Format, Deadline } = req.body;

    if (!ChecklistName || !Format) {
      return res.status(400).json({ error: "ChecklistName and Format are required" });
    }

    const today = new Date().toISOString().split("T")[0];
    const finalDeadline = Deadline || getNextDeadline(Format);

    const sheetName = `${req.user.name}_Checklist`;
    const sheets = await getSheets();

    const id = nanoid(6);

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [id, ChecklistName, today, finalDeadline, "", "Pending", Format],
        ],
      },
    });

    res.json({ ok: true, ChecklistID: id, Deadline: finalDeadline });
  } catch (err) {
    console.error("Checklist CREATE Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// MARK CHECKLIST AS DONE
// ======================================================
router.patch("/done/:id", auth, async (req, res) => {
  try {
    const checklistId = req.params.id;
    const sheetName = `${req.user.name}_Checklist`;
    const sheets = await getSheets();

    const fetchRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A2:G`,
    });

    const rows = fetchRes.data.values || [];
    const idx = rows.findIndex((r) => r[0] === checklistId);

    if (idx === -1) {
      return res.status(404).json({ error: "Checklist not found" });
    }

    const row = rows[idx];
    row[4] = new Date().toISOString(); // DoneDate
    row[5] = "Done"; // Status

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A${idx + 2}:G${idx + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    res.json({ ok: true, DoneDate: row[4] });
  } catch (err) {
    console.error("Checklist DONE Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ======================================================
// DELETE CHECKLIST
// ======================================================
router.delete("/:id", auth, async (req, res) => {
  try {
    const checklistId = req.params.id;
    const sheetName = `${req.user.name}_Checklist`;
    const sheets = await getSheets();

    const fetchRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A2:G`,
    });

    const rows = fetchRes.data.values || [];
    const idx = rows.findIndex((r) => r[0] === checklistId);

    if (idx === -1) return res.status(404).json({ error: "Checklist not found" });

    await sheets.spreadsheets.values.clear({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A${idx + 2}:G${idx + 2}`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Checklist DELETE Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
