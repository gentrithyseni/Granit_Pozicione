export type FaturaKind = 'kontrate' | 'pozicione';

export type FaturaIssuerDefaults = {
  companyName: string;
  nui: string;
  bankAccount: string;
};

export type FaturaSharedFields = {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  clientNameLine2: string;
  clientAddress: string;
  issuer: FaturaIssuerDefaults;
};

export type FaturaKontrateFields = FaturaSharedFields & {
  contractBlockNumber: string;
  contractBlockDate: string;
  contractBlockTitle: string;
  contractProtocolReference: string;
  contractWorkSiteAddress: string;
  tableTitle: string;
  tableContractNumber: string;
  tableInvoiceReference: string;
  totalWithVat: string;
};

export type FaturaPositionRow = {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export type FaturaPozicioneFields = FaturaSharedFields & {
  place: string;
  contractTitle: string;
  contractNumber: string;
  positions: FaturaPositionRow[];
};

export const DEFAULT_ISSUER: FaturaIssuerDefaults = {
  companyName: '" MEGRANT ING " SH.P.K',
  nui: '811282136',
  bankAccount: '1701017400063720',
};

export function todaySqDate(): string {
  return new Date().toLocaleDateString('sq-AL');
}

export function createEmptyPosition(index: number): FaturaPositionRow {
  return {
    id: `pos-${index}-${Date.now()}`,
    description: '',
    unit: '',
    quantity: '',
    unitPrice: '',
  };
}

export function createKontrateDefaults(): FaturaKontrateFields {
  const date = todaySqDate();
  return {
    invoiceNumber: '',
    invoiceDate: date,
    clientName: '',
    clientNameLine2: '',
    clientAddress: '',
    issuer: { ...DEFAULT_ISSUER },
    contractBlockNumber: '',
    contractBlockDate: date,
    contractBlockTitle: '',
    contractProtocolReference: '',
    contractWorkSiteAddress: '',
    tableTitle: '',
    tableContractNumber: '',
    tableInvoiceReference: '',
    totalWithVat: '',
  };
}

export function createPozicioneDefaults(): FaturaPozicioneFields {
  return {
    invoiceNumber: '',
    invoiceDate: todaySqDate(),
    clientName: '',
    clientNameLine2: '',
    clientAddress: '',
    issuer: { ...DEFAULT_ISSUER },
    place: 'Prishtinë',
    contractTitle: '',
    contractNumber: '',
    positions: [1, 2, 3, 4].map((n) => createEmptyPosition(n)),
  };
}
