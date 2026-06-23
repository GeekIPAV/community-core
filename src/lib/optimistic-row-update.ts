import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Atualiza uma linha na cache do React Query sem aguardar o refetch.
 * Devolve um snapshot anterior para rollback em caso de erro.
 *
 * Pensado para tabelas mantidas em cache como `Row[]` numa única queryKey.
 */
export async function applyOptimisticRowPatch<T extends { id: string }>(
  qc: QueryClient,
  queryKey: QueryKey,
  id: string,
  patch: Partial<T>,
): Promise<T[] | undefined> {
  await qc.cancelQueries({ queryKey });
  const prev = qc.getQueryData<T[]>(queryKey);
  if (prev) {
    qc.setQueryData<T[]>(
      queryKey,
      prev.map((row) => (row.id === id ? ({ ...row, ...patch } as T) : row)),
    );
  }
  return prev;
}

export function rollbackOptimisticRows<T>(
  qc: QueryClient,
  queryKey: QueryKey,
  prev: T[] | undefined,
) {
  if (prev) qc.setQueryData(queryKey, prev);
}