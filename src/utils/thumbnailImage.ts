/** 콘텐츠 썸네일: 올린 이미지를 16:9(1280x720)로 가운데 잘라 webp로 줄인다. 발행 요청이 nginx 1MB 한도 안에 들어가야 한다 */

export const THUMB_W = 1280;
export const THUMB_H = 720;
/** 서버 한도(700KB)보다 조금 작게 */
const TARGET_BYTES = 600 * 1024;

/** 원본에서 잘라 낼 영역: 목표 비율을 유지하며 최대한 크게, 가운데 기준 */
export function coverCrop(w: number, h: number, tw = THUMB_W, th = THUMB_H) {
  const scale = Math.min(w / tw, h / th);
  const sw = tw * scale;
  const sh = th * scale;
  return { sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh };
}

export interface PreparedImage {
  /** 미리보기용 */
  dataUrl: string;
  type: string;
  /** data: 접두어를 뗀 base64 */
  data: string;
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** 이미지(파일이든 그려 낸 SVG든)를 썸네일 크기 webp로 */
export async function prepareThumbnail(source: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다');
  const { sx, sy, sw, sh } = coverCrop(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, THUMB_W, THUMB_H);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality));
    if (!blob) break;
    if (blob.size <= TARGET_BYTES) {
      const dataUrl = await toDataUrl(blob);
      return { dataUrl, type: blob.type, data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
    }
  }
  throw new Error('이미지를 충분히 줄이지 못했습니다. 더 단순한 이미지를 써 주세요');
}
