const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const file = process.argv[2];
if (!file) {
  console.error('usage: node inspect_xlsx.js <xlsx-file>');
  process.exit(1);
}
const p = path.resolve(file);
if (!fs.existsSync(p)) { console.error('file not found', p); process.exit(2); }
const wb = XLSX.readFile(p);
const sheet = wb.SheetNames[0];
const ws = wb.Sheets[sheet];
const arr = XLSX.utils.sheet_to_json(ws, { header:1, defval: '' });
console.log('Sheet:', sheet);
console.log('First 60 rows (as arrays):');
for (let i=0;i<Math.min(arr.length,60);i++) console.log(i, arr[i]);
