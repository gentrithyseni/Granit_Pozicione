const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const folderName = process.env.LIBRI_FOLDER || 'libri_files';
const FOLDER = path.join(__dirname, '..', folderName);

function summarizeFile(filePath) {
  const wb = xlsx.readFile(filePath);
  const summary = { file: path.basename(filePath), sheets: [] };
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const json = xlsx.utils.sheet_to_json(ws, { header: 1 });
    // count rows and columns
    const rows = json.length;
    const cols = json[0] ? json[0].length : 0;
    // sample first 10 rows
    const sample = json.slice(0, 10);
    summary.sheets.push({ name, rows, cols, sample });
  });
  return summary;
}

function main() {
  if (!fs.existsSync(FOLDER)) {
    console.error('Folder not found:', FOLDER);
    process.exit(1);
  }
  const files = fs.readdirSync(FOLDER).filter(f => /\.(xls|xlsx)$/i.test(f));
  if (files.length === 0) {
    console.log('No Excel files found in', FOLDER);
    return;
  }
  const summaries = files.map(f => {
    const p = path.join(FOLDER, f);
    try {
      return summarizeFile(p);
    } catch (e) {
      return { file: f, error: String(e) };
    }
  });
  console.log(JSON.stringify(summaries, null, 2));
}

main();
