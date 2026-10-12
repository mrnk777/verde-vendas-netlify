import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const UNIT_PRICE = 750;
const MAX_QUANTITY = 100000;
const STORE_NAME = 'verde-vendas-sales';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

export const config = {
  path: ['/api/health', '/api/sales']
};

export default async function handler(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'allow': 'GET, POST, OPTIONS' } });
  }

  if (pathname === '/api/health' && request.method === 'GET') {
    return json({ ok: true, unitPrice: UNIT_PRICE });
  }

  if (pathname !== '/api/sales') {
    return json({ error: 'Rota da API não encontrada.' }, 404);
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  try {
    if (request.method === 'GET') {
      const { blobs } = await store.list({ prefix: 'sale-' });
      const values = await Promise.all(
        blobs.map(async ({ key }) => store.get(key, { type: 'json', consistency: 'strong' }))
      );
      const sales = values
        .filter((sale) => sale && typeof sale === 'object')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return json({ sales, unitPrice: UNIT_PRICE });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Envie os dados em formato JSON válido.' }, 400);
      }

      const quantity = Number(body?.quantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
        return json({ error: `Informe uma quantidade inteira entre 1 e ${MAX_QUANTITY.toLocaleString('pt-BR')}.` }, 400);
      }

      const sale = {
        id: randomUUID(),
        quantity,
        unitPrice: UNIT_PRICE,
        total: quantity * UNIT_PRICE,
        createdAt: new Date().toISOString()
      };

      // One unique blob per sale prevents two people selling at the same time
      // from overwriting each other's records.
      await store.setJSON(`sale-${sale.id}`, sale, { onlyIfNew: true });
      return json({ sale }, 201);
    }

    return json({ error: 'Método não permitido.' }, 405);
  } catch (error) {
    console.error('[verde-vendas-api]', error);
    return json({ error: 'Não foi possível acessar o histórico. Tente novamente em instantes.' }, 500);
  }
}
