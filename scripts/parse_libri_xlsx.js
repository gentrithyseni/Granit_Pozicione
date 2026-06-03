const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const folderName = process.env.LIBRI_FOLDER || 'libri_files';
const inputFolder = path.join(__dirname, '..', folderName);
const outputFolder = path.join(__dirname, '..', 'output');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toCellText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function isEmptyRow(row) {
  return row.every((cell) => toCellText(cell) === '');
}

function rowText(row) {
  return row.map(toCellText).filter(Boolean).join(' | ');
}

function isHeaderRow(row) {
  const text = normalizeText(rowText(row));
  return text.includes('pozicioni i punes') || text.includes('working positions');
}

function isStructuredHeaderRow(row) {
  const first = normalizeText(row[0]);
  const second = normalizeText(row[1]);
  const third = normalizeText(row[2]);
  const fourth = normalizeText(row[3]);
  const fifth = normalizeText(row[4]);
  const sixth = normalizeText(row[5]);

  return (
    first === 'pos' &&
    second.includes('pershkrimi i pozicionit') &&
    third.includes('njesia') &&
    fourth.includes('sasia') &&
    fifth.includes('cmimi') &&
    (sixth.includes('shuma') || sixth.includes('gjithsej'))
  );
}

function isSignatureRow(row) {
  const text = normalizeText(rowText(row));
  return text.includes('kryesi i pun') || text.includes('organi mbikqyr') || text.includes('signature');
}

function extractPositionNumber(text) {
  const match = String(text || '').match(/^\s*([0-9]+(?:\.[0-9]+)*)\b/);
  return match ? match[1] : '';
}

function extractUnitHint(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/l[lg]og\.?\s*n[ëe]\s+([a-z0-9/.\- ]+)$/i);
  if (match) {
    return match[1].trim();
  }
  const unitMatch = normalized.match(/\b(komplet|m2|m3|cop[eë]|cope|kg|ton|m|l|set)\b/i);
  return unitMatch ? unitMatch[1] : '';
}

function parseCalculation(text) {
  const normalized = normalizeText(text).replace(/,/g, '.');
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*x\s*([0-9]+(?:\.[0-9]+)?)\s*=\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) {
    return null;
  }

  const quantity = Number(match[1]);
  const unitPrice = Number(match[2]);
  const total = Number(match[3]);

  if ([quantity, unitPrice, total].some((value) => Number.isNaN(value))) {
    return null;
  }

  return {
    quantity,
    unitPrice,
    total,
    calculationText: `${match[1]} x ${match[2]} = ${match[3]}`,
  };
}

function parseDescriptionCell(text) {
  const raw = String(text || '').trim();
  const positionNumber = extractPositionNumber(raw);
  if (!positionNumber) {
    return {
      positionNumber: '',
      description: raw,
      unitHint: extractUnitHint(raw),
    };
  }

  const description = raw.replace(/^\s*[0-9]+(?:\.[0-9]+)*\s*/, '').trim();
  return {
    positionNumber,
    description,
    unitHint: extractUnitHint(raw),
  };
}

function parseStructuredTableRows(sheetRows, source) {
  const parsed = [];
  let active = false;

  for (let index = 0; index < sheetRows.length; index += 1) {
    const row = sheetRows[index];

    if (isStructuredHeaderRow(row)) {
      active = true;
      continue;
    }

    if (!active) {
      continue;
    }

    if (isSignatureRow(row)) {
      break;
    }

    if (isEmptyRow(row)) {
      continue;
    }

    const firstCell = toCellText(row[0]);
    const descriptionCell = toCellText(row[1]);
    const unitCell = toCellText(row[2]);
    const quantityCell = row[3];
    const priceCell = row[4];
    const totalCell = row[5];

    const positionNumber = extractPositionNumber(firstCell);
    const isItemRow = Boolean(positionNumber) && descriptionCell && !normalizeText(descriptionCell).startsWith('gjithsejt');
    if (!isItemRow) {
      continue;
    }

    const quantity = Number(String(quantityCell).replace(',', '.'));
    const unitPrice = Number(String(priceCell).replace(',', '.'));
    const explicitTotal = Number(String(totalCell).replace(',', '.'));
    const total = Number.isFinite(explicitTotal) && explicitTotal !== 0 ? explicitTotal : (Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : null);
    const issues = [];

    if (!Number.isFinite(quantity)) {
      issues.push('missing_quantity');
    }
    if (!Number.isFinite(unitPrice)) {
      issues.push('missing_unit_price');
    }
    if (!descriptionCell) {
      issues.push('missing_description');
    }

    if (Number.isFinite(quantity) && Number.isFinite(unitPrice) && Number.isFinite(total)) {
      const expected = Number((quantity * unitPrice).toFixed(2));
      const actual = Number(total.toFixed(2));
      if (expected !== actual) {
        issues.push('calculation_mismatch');
      }
    }

    parsed.push({
      sourceFile: source.file,
      sheetName: source.sheet,
      rowNumber: index + 1,
      positionNumber,
      description: descriptionCell,
      unit: unitCell,
      quantity: Number.isFinite(quantity) ? quantity : null,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
      total: Number.isFinite(total) ? total : null,
      calculationText: '',
      detailRows: [],
      confidence: 0.96,
      issues,
    });
  }

  return parsed;
}

function parseSheetRows(sheetRows, source) {
  const structuredRows = parseStructuredTableRows(sheetRows, source);
  if (structuredRows.length > 0) {
    return structuredRows;
  }

  const parsed = [];
  let started = false;

  for (let index = 0; index < sheetRows.length; index += 1) {
    const row = sheetRows[index];
    if (!started) {
      if (isHeaderRow(row)) {
        started = true;
      }
      continue;
    }

    if (isSignatureRow(row)) {
      break;
    }

    if (isEmptyRow(row)) {
      continue;
    }

    const firstCell = toCellText(row[0]);
    if (!firstCell) {
      continue;
    }

    const rowString = rowText(row);
    const calcText = rowString.split('|').map((value) => value.trim()).find((value) => /\bx\b/i.test(value) && /=/.test(value));
    const calculation = calcText ? parseCalculation(calcText) : null;
    const descriptionInfo = parseDescriptionCell(firstCell);

    const detailRows = [];
    let lookAhead = index + 1;
    while (lookAhead < sheetRows.length) {
      const nextRow = sheetRows[lookAhead];
      if (isEmptyRow(nextRow)) {
        lookAhead += 1;
        continue;
      }

      const nextFirst = toCellText(nextRow[0]);
      const nextText = normalizeText(rowText(nextRow));
      if (isSignatureRow(nextRow) || isHeaderRow(nextRow)) {
        break;
      }
      if (nextFirst && nextFirst !== firstCell && extractPositionNumber(nextFirst)) {
        break;
      }
      if (nextFirst && /^[IVXLCM]+\.?\s+/i.test(nextFirst)) {
        break;
      }
      if (nextFirst && !nextText.startsWith('gjithsejt') && !/^\s*[0-9]+(?:\.[0-9]+)*\s+/.test(nextFirst)) {
        break;
      }

      detailRows.push({
        rowNumber: lookAhead + 1,
        text: rowText(nextRow),
      });

      if (parseCalculation(rowText(nextRow))) {
        break;
      }

      lookAhead += 1;
    }

    const computed = calculation || detailRows.map((detail) => parseCalculation(detail.text)).find(Boolean) || null;
    const parsedRow = {
      sourceFile: source.file,
      sheetName: source.sheet,
      rowNumber: index + 1,
      positionNumber: descriptionInfo.positionNumber,
      description: descriptionInfo.description,
      unit: descriptionInfo.unitHint || '',
      quantity: computed ? computed.quantity : null,
      unitPrice: computed ? computed.unitPrice : null,
      total: computed ? computed.total : null,
      calculationText: computed ? computed.calculationText : '',
      detailRows,
      confidence: computed ? 0.84 : 0.56,
      issues: [],
    };

    if (!parsedRow.positionNumber && parsedRow.description) {
      parsedRow.issues.push('missing_position_number');
    }
    if (!parsedRow.description) {
      parsedRow.issues.push('missing_description');
    }
    if (!computed) {
      parsedRow.issues.push('missing_calculation');
    }
    if (computed && Number.isFinite(computed.total) && Number.isFinite(computed.quantity) && Number.isFinite(computed.unitPrice)) {
      const expected = Number((computed.quantity * computed.unitPrice).toFixed(2));
      const actual = Number(computed.total.toFixed(2));
      if (expected !== actual) {
        parsedRow.issues.push('calculation_mismatch');
      }
    }

    parsed.push(parsedRow);
    index = Math.max(index, lookAhead - 1);
  }

  return parsed;
}

function parseWorkbook(filePath) {
  const workbook = xlsx.readFile(filePath);
  const result = {
    file: path.basename(filePath),
    sheets: [],
  };

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    const positions = parseSheetRows(rows, { file: path.basename(filePath), sheet: sheetName });

    result.sheets.push({
      name: sheetName,
      rowCount: rows.length,
      parsedCount: positions.length,
      positions,
    });
  });

  return result;
}

function toCsv(rows) {
  const headers = [
    'sourceFile',
    'sheetName',
    'rowNumber',
    'positionNumber',
    'description',
    'unit',
    'quantity',
    'unitPrice',
    'total',
    'calculationText',
    'confidence',
    'issues',
  ];

  const escapeCsv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
  });
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(inputFolder)) {
    console.error('Folder not found:', inputFolder);
    process.exit(1);
  }

  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const files = fs
    .readdirSync(inputFolder)
    .filter((file) => /\.(xls|xlsx)$/i.test(file))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

  if (files.length === 0) {
    console.log('No Excel files found in', inputFolder);
    return;
  }

  const summaries = [];
  const flatRows = [];

  files.forEach((file) => {
    const filePath = path.join(inputFolder, file);
    try {
      const parsed = parseWorkbook(filePath);
      summaries.push({ file, sheets: parsed.sheets.map((sheet) => ({ name: sheet.name, rowCount: sheet.rowCount, parsedCount: sheet.parsedCount })) });
      parsed.sheets.forEach((sheet) => {
        sheet.positions.forEach((position) => {
          flatRows.push(position);
        });
      });
    } catch (error) {
      summaries.push({ file, error: String(error) });
    }
  });

  const jsonPath = path.join(outputFolder, 'libri-positions.json');
  const csvPath = path.join(outputFolder, 'libri-positions.csv');
  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), inputFolder, summaries, positions: flatRows }, null, 2), 'utf8');
  fs.writeFileSync(csvPath, toCsv(flatRows), 'utf8');

  console.log(JSON.stringify({
    inputFolder,
    outputFolder,
    fileCount: files.length,
    parsedRows: flatRows.length,
    jsonPath,
    csvPath,
    summaries,
  }, null, 2));
}

main();