// Teamleader API endpoints + business constants, ported from the Apps Script.

export const API_BASE = 'https://api.focus.teamleader.eu';
export const TOKEN_URL = 'https://focus.teamleader.eu/oauth2/access_token';

/** Lookback window for quotations + won deals. */
export const DAYS_LOOKBACK = 90;

/** Teamleader custom field IDs. */
export const CF_DATUM_UITVOERING = '9a9bf893-522a-0dcc-9b5a-40a50378b4d1';
export const CF_DOORLOOPTIJD = 'b19369b0-a73d-0e27-9954-e7d29878b4d3';
export const CF_LEADBRON = '0bb35cd7-9251-060b-8351-157c21789a0a';

/** Margin cost constants (€ per m²). */
export const LABOR_COST_PER_M2 = 17;
export const PRIMER_COST_PER_M2 = 0.75; // primer for glued PVC
export const GLUE_COST_PER_M2 = 1.36; // Uzin KS2000 glue
export const LEVELING_COST_PER_M2 = 2.99; // Egaline C Cotap leveling cement

/** Teamleader list pagination size. */
export const PAGE_SIZE = 20;

/** Concurrency cap for per-record detail fetches (rate-limit friendly). */
export const FETCH_CONCURRENCY = 4;
