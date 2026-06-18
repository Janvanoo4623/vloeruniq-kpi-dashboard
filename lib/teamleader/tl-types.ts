// Minimal shapes of the Teamleader API responses we depend on.

export interface TLMoney {
  amount: number;
  currency?: string;
}

export interface TLTotal {
  tax_exclusive: TLMoney;
  tax_inclusive: TLMoney;
}

export interface TLQuotationSummary {
  id: string;
  name?: string;
  status: string; // 'accepted' | 'open' | 'refused' | ...
  created_at?: string;
  updated_at?: string;
  deal?: { id: string } | null;
  total: TLTotal;
}

export interface TLLineItem {
  description?: string;
  quantity?: number;
  total?: { tax_exclusive?: TLMoney };
}

export interface TLGroupedLine {
  section?: { title?: string } | null;
  line_items?: TLLineItem[];
}

export interface TLQuotationDetail {
  id?: string;
  grouped_lines?: TLGroupedLine[];
}

export interface TLDealSummary {
  id: string;
  lead?: { customer?: { type?: string; id?: string } | null } | null;
}

export interface TLAddress {
  line_1?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface TLContact {
  id: string;
  first_name?: string;
  last_name?: string;
  primary_address?: TLAddress | null;
}

export interface TLCompany {
  id: string;
  name?: string;
  primary_address?: TLAddress | null;
}

export interface TLCustomFieldValue {
  definition: { id: string };
  value: unknown;
}

export interface TLDealDetail {
  id: string;
  title?: string;
  closed_at?: string;
  custom_fields?: TLCustomFieldValue[];
}
