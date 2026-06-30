export type CropRect = { x: number; y: number; w: number; h: number };

/**
 * 回転 + トリミング済みの JPEG Blob を返す。
 * cropRect は displayCanvas のピクセル座標で指定する。
 * displayCanvas は回転適用済みの画像が描画されたキャンバス。
 */
export function renderEditedImage(
  img: HTMLImageElement,
  rotation: 0 | 90 | 180 | 270,
  cropRect: CropRect | null,
  displayCanvas: HTMLCanvasElement,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    const isRotated = rotation === 90 || rotation === 270;

    // 回転後の自然サイズ
    const rotatedW = isRotated ? nat.h : nat.w;
    const rotatedH = isRotated ? nat.w : nat.h;

    // ディスプレイキャンバスから自然画像サイズへのスケール
    const scaleX = rotatedW / displayCanvas.width;
    const scaleY = rotatedH / displayCanvas.height;

    // cropRect を自然画像座標に変換（null なら全体）
    const src = cropRect
      ? {
          x: cropRect.x * scaleX,
          y: cropRect.y * scaleY,
          w: cropRect.w * scaleX,
          h: cropRect.h * scaleY,
        }
      : { x: 0, y: 0, w: rotatedW, h: rotatedH };

    // Step 1: 回転済み自然サイズのキャンバスに元画像を描画
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = rotatedW;
    tempCanvas.height = rotatedH;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) { reject(new Error("canvas context unavailable")); return; }

    tempCtx.save();
    tempCtx.translate(rotatedW / 2, rotatedH / 2);
    tempCtx.rotate((rotation * Math.PI) / 180);
    tempCtx.drawImage(img, -nat.w / 2, -nat.h / 2, nat.w, nat.h);
    tempCtx.restore();

    // Step 2: cropRect 範囲を出力キャンバスに描画
    const outCanvas = document.createElement("canvas");
    outCanvas.width = Math.max(1, Math.round(src.w));
    outCanvas.height = Math.max(1, Math.round(src.h));
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) { reject(new Error("canvas context unavailable")); return; }

    outCtx.drawImage(tempCanvas, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);

    outCanvas.toBlob(
      (blob) => { blob ? resolve(blob) : reject(new Error("toBlob failed")); },
      "image/jpeg",
      0.9,
    );
  });
}
