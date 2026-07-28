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
const DELAY_MS = 350; // protección contra rate limit NocoDB (con retry/backoff en fetchPage)
const MAX_ATTEMPTS = 8;
const MAX_BACKOFF_MS = 30000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(tableId: string, offset: number, where?: string): Promise<PageResponse> {
  const whereParam = where ? `&where=${encodeURIComponent(where)}` : '';
  const url = `${env.NOCODB_URL}/api/v2/tables/${tableId}/records?limit=${PAGE_SIZE}&offset=${offset}${whereParam}`;
  // Reintento con backoff exponencial ante 429 (rate limit NocoDB Cloud) y 5xx
  // transitorios. Honra el header `Retry-After` si el server lo manda.
  let lastStatus = 0;
  let lastText = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // `x-noco-priority: low` → el proxy de ritmo prioriza el tráfico en vivo (leads)
    // sobre este batch. Si NOCODB_URL apunta directo a NocoDB Cloud, el header se ignora.
    const res = await fetch(url, {
      headers: { 'xc-token': env.NOCODB_TOKEN, 'x-noco-priority': 'low' },
    });
    if (res.ok) return res.json() as Promise<PageResponse>;
    lastStatus = res.status;
    lastText = res.statusText;
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(MAX_BACKOFF_MS, retryAfter * 1000)
        : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt - 1)); // 1,2,4,8,16,30,30s
      await sleep(backoff);
      continue;
    }
    throw new Error(`NocoDB ${tableId} offset=${offset}: ${res.status} ${res.statusText}`);
  }
  throw new Error(`NocoDB ${tableId} offset=${offset}: agotados ${MAX_ATTEMPTS} reintentos (${lastStatus} ${lastText})`);
}

export async function fetchAllRows(
  tableId: string,
  label: string,
  where?: string,
): Promise<NocoRow[]> {
  const rows: NocoRow[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await fetchPage(tableId, offset, where);
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
