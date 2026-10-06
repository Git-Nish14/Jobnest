type ReadResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/** Page below the configured API cap; never mistake a capped first page for all history. */
export async function readAll<T>(read: (from: number, to: number) => PromiseLike<ReadResult<T>>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const result = await read(from, from + size - 1);
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("The database did not return a result");
    rows.push(...result.data);
    if (result.data.length < size) return rows;
  }
}
