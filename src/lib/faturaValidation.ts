import type { FaturaKontrateFields, FaturaPozicioneFields, FaturaPositionRow } from '../types/fatura';

export type FaturaFieldErrors = Record<string, string>;

export type FaturaValidationResult = {
  valid: boolean;
  errors: FaturaFieldErrors;
  firstError: string | null;
};

/** Lejon vetëm shifra dhe një presje/pikë dhjetore gjatë shkrimit. */
export function sanitizeDecimalInput(raw: string): string {
  let result = '';
  let separatorSeen = false;
  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      result += char;
      continue;
    }
    if ((char === ',' || char === '.') && !separatorSeen) {
      result += char;
      separatorSeen = true;
    }
  }
  return result;
}

/** Lejon vetëm shifra (p.sh. NUI, llogari bankare). */
export function sanitizeDigitsInput(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidDecimal(value: string, options?: { required?: boolean; min?: number }): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !options?.required;
  if (!/^[\d]+([.,]\d+)?$/.test(trimmed.replace(/\s/g, ''))) return false;
  const parsed = parseDecimal(trimmed);
  if (parsed === null) return false;
  if (options?.min !== undefined && parsed < options.min) return false;
  return true;
}

function result(errors: FaturaFieldErrors): FaturaValidationResult {
  const messages = Object.values(errors);
  return {
    valid: messages.length === 0,
    errors,
    firstError: messages[0] ?? null,
  };
}

function requireText(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

function positionIsActive(row: FaturaPositionRow): boolean {
  return Boolean(
    row.description.trim() ||
      row.unit.trim() ||
      row.quantity.trim() ||
      row.unitPrice.trim()
  );
}

export function validateKontrate(data: FaturaKontrateFields): FaturaValidationResult {
  const errors: FaturaFieldErrors = {};

  const invoiceNumberError = requireText(data.invoiceNumber, 'Shkruaj numrin e faturës (FATURA Nr =).');
  if (invoiceNumberError) errors.invoiceNumber = invoiceNumberError;

  if (!data.invoiceDate.trim()) errors.invoiceDate = 'Zgjidh datën e faturës.';

  const clientNameError = requireText(data.clientName, 'Shkruaj emrin e klientit (PËR).');
  if (clientNameError) errors.clientName = clientNameError;

  const clientAddressError = requireText(data.clientAddress, 'Shkruaj adresën e klientit.');
  if (clientAddressError) errors.clientAddress = clientAddressError;

  if (!data.issuer.companyName.trim()) errors['issuer.companyName'] = 'Emri i kompanisë nuk mund të jetë bosh.';
  if (!data.issuer.nui.trim()) errors['issuer.nui'] = 'Numri unik identifikues është i detyrueshëm.';
  else if (!/^\d+$/.test(data.issuer.nui.trim())) errors['issuer.nui'] = 'NUI lejon vetëm shifra.';
  if (!data.issuer.bankAccount.trim()) errors['issuer.bankAccount'] = 'Llogaria bankare është e detyrueshme.';
  else if (!/^\d+$/.test(data.issuer.bankAccount.trim())) errors['issuer.bankAccount'] = 'Llogaria bankare lejon vetëm shifra.';

  if (!data.contractBlockNumber.trim()) errors.contractBlockNumber = 'Shkruaj numrin e kontratës.';
  if (!data.contractBlockDate.trim()) errors.contractBlockDate = 'Zgjidh datën e kontratës.';
  if (!data.contractBlockTitle.trim()) errors.contractBlockTitle = 'Shkruaj titullin e kontratës.';

  if (!data.tableTitle.trim()) errors.tableTitle = 'Shkruaj titullin në tabelë (kolona A).';
  if (!data.tableContractNumber.trim()) errors.tableContractNumber = 'Shkruaj numrin e kontratës në tabelë (kolona D).';
  if (!data.tableInvoiceReference.trim()) errors.tableInvoiceReference = 'Shkruaj përshkrimin e faturës (kolona F).';

  if (!isValidDecimal(data.totalWithVat, { required: true, min: 0.01 })) {
    errors.totalWithVat = 'Shuma me TVSH duhet të jetë numër valid (p.sh. 6409.76).';
  }

  return result(errors);
}

export function validatePozicione(data: FaturaPozicioneFields): FaturaValidationResult {
  const errors: FaturaFieldErrors = {};

  const invoiceNumberError = requireText(data.invoiceNumber, 'Shkruaj numrin e faturës (FATURA Nr =).');
  if (invoiceNumberError) errors.invoiceNumber = invoiceNumberError;

  if (!data.invoiceDate.trim()) errors.invoiceDate = 'Zgjidh datën e faturës.';
  if (!data.place.trim()) errors.place = 'Shkruaj vendin (para datës).';

  const clientNameError = requireText(data.clientName, 'Shkruaj emrin e klientit (PËR).');
  if (clientNameError) errors.clientName = clientNameError;

  const clientAddressError = requireText(data.clientAddress, 'Shkruaj adresën e klientit.');
  if (clientAddressError) errors.clientAddress = clientAddressError;

  if (!data.issuer.companyName.trim()) errors['issuer.companyName'] = 'Emri i kompanisë nuk mund të jetë bosh.';
  if (!data.issuer.nui.trim()) errors['issuer.nui'] = 'Numri unik identifikues është i detyrueshëm.';
  else if (!/^\d+$/.test(data.issuer.nui.trim())) errors['issuer.nui'] = 'NUI lejon vetëm shifra.';
  if (!data.issuer.bankAccount.trim()) errors['issuer.bankAccount'] = 'Llogaria bankare është e detyrueshme.';
  else if (!/^\d+$/.test(data.issuer.bankAccount.trim())) errors['issuer.bankAccount'] = 'Llogaria bankare lejon vetëm shifra.';

  if (!data.contractTitle.trim()) errors.contractTitle = 'Shkruaj titullin / përshkrimin e kontratës.';
  if (!data.contractNumber.trim()) errors.contractNumber = 'Shkruaj numrin e kontratës.';

  const activePositions = data.positions.filter(positionIsActive);
  if (activePositions.length === 0) {
    errors.positions = 'Shto të paktën një pozicion me përshkrim, sasi dhe çmim.';
  }

  data.positions.forEach((position, index) => {
    if (!positionIsActive(position)) return;
    const prefix = `positions.${position.id}`;

    if (!position.description.trim()) {
      errors[`${prefix}.description`] = `Pozicioni ${index + 1}: shkruaj përshkrimin.`;
    }
    if (!position.unit.trim()) {
      errors[`${prefix}.unit`] = `Pozicioni ${index + 1}: shkruaj njësinë (m2, copë...).`;
    }
    if (!isValidDecimal(position.quantity, { required: true, min: 0.0001 })) {
      errors[`${prefix}.quantity`] = `Pozicioni ${index + 1}: sasia duhet të jetë numër valid.`;
    }
    if (!isValidDecimal(position.unitPrice, { required: true, min: 0 })) {
      errors[`${prefix}.unitPrice`] = `Pozicioni ${index + 1}: çmimi duhet të jetë numër valid.`;
    }
  });

  return result(errors);
}
