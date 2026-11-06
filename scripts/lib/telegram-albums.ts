/**
 * 텔레그램은 사진 여러 장(앨범)을 메시지 여러 개로 보내고 같은 groupedId로만 묶는다.
 * 글(캡션)은 보통 그중 한 메시지에만 붙는다. 묶음을 메시지 하나로 합쳐 사진만 있는 글이 따로 생기지 않게 한다.
 */
export interface AlbumPart {
  id: number;
  text: string;
  views: number;
  forwards: number;
  groupedId?: string;
  linkEntities?: unknown[];
  imageUrls?: string[];
}

export function mergeAlbums<T extends AlbumPart>(messages: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const m of messages) {
    if (!m.groupedId) continue;
    groups.set(m.groupedId, [...(groups.get(m.groupedId) ?? []), m]);
  }
  const merged = new Map<string, T>();
  for (const [gid, parts] of groups) {
    const sorted = [...parts].sort((a, b) => a.id - b.id);
    // 글이 붙은 메시지를 기준으로 삼아야 linkEntities 위치가 글과 맞는다
    const base = sorted.find((p) => p.text.trim()) ?? sorted[0];
    const imageUrls = sorted.flatMap((p) => p.imageUrls ?? []);
    const rest: T = { ...base };
    delete rest.groupedId;
    merged.set(gid, {
      ...rest,
      id: sorted[0].id,
      views: Math.max(...sorted.map((p) => p.views)),
      forwards: Math.max(...sorted.map((p) => p.forwards)),
      ...(imageUrls.length ? { imageUrls } : {}),
    });
  }
  const out: T[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    if (!m.groupedId) {
      out.push(m);
    } else if (!seen.has(m.groupedId)) {
      seen.add(m.groupedId);
      out.push(merged.get(m.groupedId)!);
    }
  }
  return out;
}
