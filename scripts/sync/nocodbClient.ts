import { env } from './env.js';

export type NocoRow = Record<string, unknown>;

interface PageResponse {
  list: NocoRow[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

const PAGE_SIZE = 100;
const DELAY_MS = 250; // protección contra rate limit NocoDB (con retry/backoff en fetchPage)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(tableId: string, offset: number): Promise<PageResponse> {
  const url = `${env.NOCODB_URL}/api/v2/tables/${tableId}/records?limit=${PAGE_SIZE}&offset=${offset}`;
  // Reintento con backoff ante 429 (rate limit) y 5xx transitorios.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'xc-token': env.NOCODB_TOKEN } });
    if (res.ok) return res.json() as Promise<PageResponse>;
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(1000 * attempt); // 1s, 2s, 3s, 4s
      continue;
    }
    throw new Error(`NocoDB ${tableId} offset=${offset}: ${res.status} ${res.statusText}`);
  }
  throw new Error(`NocoDB ${tableId} offset=${offset}: agotados los reintentos`);
}

export async function fetchAllRows(
  tableId: string,
  label: string,
): Promise<NocoRow[]> {
  const rows: NocoRow[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await fetchPage(tableId, offset);
    rows.push(...page.list);
    total = page.pageInfo.totalRows;
    if (page.pageInfo.isLastPage) break;
    offset += PAGE_SIZE;
    if (offset % 1000 === 0) {
      console.log(`  [${label}] ${offset}/${total} (${Math.round((offset / total) * 100)}%)`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`  [${label}] ${rows.length}/${total} rows descargadas`);
  return rows;
}
