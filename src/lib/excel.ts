import * as XLSX from 'xlsx';

export type ParsedRow = {
  position_number: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

// Heqim theksat dhe e kthejmë në lowercase për një krahasim më të lehtë
function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Marrim fletën e parë punuese
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // E kthejmë në format JSON (array of arrays)
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        const parsedRows: ParsedRow[] = [];
        let headerMap: Record<string, number> | null = null;

        for (const row of jsonData) {
          // Kontrollojmë nëse ky rresht i ngjan një header-i
          if (!headerMap) {
            const tempMap: Record<string, number> = {};
            let matchCount = 0;
            
            // Kërkojmë për kolonat kryesore bazuar në fjalë kyçe
            Object.keys(row).forEach((key) => {
              const val = normalizeString((row as any)[key]);
              if (val.includes('nr') || val.includes('numri') || val.includes('poz') || val === 'pos' || val.includes('pos')) {
                tempMap['position'] = Number(key); matchCount++;
              } else if (val.includes('pershkrim') || val.includes('emertimi') || val.includes('punet')) {
                tempMap['description'] = Number(key); matchCount++;
              } else if (val.includes('njesi') || val.includes('njesia')) {
                tempMap['unit'] = Number(key); matchCount++;
              } else if (val.includes('sasi') || val.includes('sasia')) {
                tempMap['quantity'] = Number(key); matchCount++;
              } else if (val.includes('cmim') && !val.includes('total')) {
                tempMap['price'] = Number(key); matchCount++;
              }
            });

            // Nëse i gjejmë të paktën 3 nga kolonat, e konsiderojmë header
            if (matchCount >= 3) {
              headerMap = tempMap;
            }
            continue; // Kalojmë në rreshtin tjetër pasi gjetëm headerin
          }

          // Nëse kemi gjetur header-in, fillojmë të lexojmë të dhënat
          if (headerMap) {
            const desc = row[headerMap['description'] as any];
            
            // Injorojmë rreshtat totalisht pa përshkrim ose empty
            if (!desc || typeof desc !== 'string' || desc.trim() === '') continue;

            // Pastrojmë dhe kthejmë vlerat në numra
            const qtyRaw = row[headerMap['quantity'] as any];
            const priceRaw = row[headerMap['price'] as any];
            
            const quantity = parseFloat(qtyRaw) || 0;
            const unit_price = parseFloat(priceRaw) || 0;

            // Injorojmë rreshtat (që shpesh janë tituj seksionesh) që s'janë pozicione me sasi (qty = 0)
            if (quantity === 0) continue;

            parsedRows.push({
              position_number: String(row[headerMap['position'] as any] || ''),
              description: desc.trim(),
              unit: String(row[headerMap['unit'] as any] || 'copë'),
              quantity: quantity,
              unit_price: unit_price,
              total_price: quantity * unit_price
            });
          }
        }
        // If we couldn't parse any rows with the array-based header detection above,
        // try a fallback using object-mode parsing (use first row as header keys)
        if (parsedRows.length === 0) {
          try {
            const objData = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });
            if (objData && objData.length > 0) {
              // Normalize header names
              const headerKeys = Object.keys(objData[0]);
              const keyMap: Record<string, string> = {};
              headerKeys.forEach((h) => {
                const nh = normalizeString(h);
                if (nh.includes('nr') || nh.includes('numri') || nh.includes('poz')) keyMap['position'] = h;
                else if (nh.includes('pershkrim') || nh.includes('emertimi') || nh.includes('punet') || nh.includes('desc')) keyMap['description'] = h;
                else if (nh.includes('njesi') || nh.includes('njesia') || nh.includes('unit')) keyMap['unit'] = h;
                else if (nh.includes('sasi') || nh.includes('sasia') || nh.includes('qty')) keyMap['quantity'] = h;
                else if (nh.includes('cmim') && !nh.includes('total') || nh.includes('price') || nh.includes('çmim')) keyMap['price'] = h;
              });

              for (const r of objData) {
                const desc = r[keyMap['description'] as any] || r[headerKeys[1]];
                const qtyRaw = r[keyMap['quantity'] as any] ?? r[headerKeys[3]];
                const priceRaw = r[keyMap['price'] as any] ?? r[headerKeys[4]];
                const quantity = parseFloat(String(qtyRaw)) || 0;
                const unit_price = parseFloat(String(priceRaw)) || 0;
                if (!desc || String(desc).trim() === '') continue;
                if (quantity === 0) continue;
                parsedRows.push({
                  position_number: String(r[keyMap['position'] as any] || ''),
                  description: String(desc).trim(),
                  unit: String(r[keyMap['unit'] as any] || ''),
                  quantity,
                  unit_price,
                  total_price: quantity * unit_price
                });
              }
            }
          } catch (err) {
            // fallback failed, continue with empty result
          }
        }

        resolve(parsedRows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
