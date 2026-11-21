import { useEffect, useRef, useState } from 'react';
import { Upload, X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (imageDataUrl: string) => Promise<void>;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CROP_VIEW_SIZE = 280;
const EXPORT_SIZE = 512;

export function AvatarCropModal({ isOpen, onClose, onUploadComplete }: AvatarCropModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setImageSrc(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
      setUploading(false);
      loadedImgRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      loadedImgRef.current = img;
      drawPreview();
    };
    img.onerror = () => {
      setError('Could not load selected image file.');
    };
    img.src = imageSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  useEffect(() => {
    if (loadedImgRef.current) {
      drawPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, offset]);

  function drawPreview(): void {
    const canvas = canvasRef.current;
    const img = loadedImgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CROP_VIEW_SIZE, CROP_VIEW_SIZE);
    ctx.fillStyle = '#0B0F17';
    ctx.fillRect(0, 0, CROP_VIEW_SIZE, CROP_VIEW_SIZE);

    const baseScale = Math.max(CROP_VIEW_SIZE / img.width, CROP_VIEW_SIZE / img.height);
    const scale = baseScale * zoom;
    const drawW = img.width * scale;
    const drawH = img.height * scale;

    const maxPanX = Math.max(0, (drawW - CROP_VIEW_SIZE) / 2);
    const maxPanY = Math.max(0, (drawH - CROP_VIEW_SIZE) / 2);
    const clampedX = Math.max(-maxPanX, Math.min(maxPanX, offset.x));
    const clampedY = Math.max(-maxPanY, Math.min(maxPanY, offset.y));

    const drawX = (CROP_VIEW_SIZE - drawW) / 2 + clampedX;
    const drawY = (CROP_VIEW_SIZE - drawH) / 2 + clampedY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Subtle circular crop guide
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2, CROP_VIEW_SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
      setError('Invalid format. Please choose a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Image is larger than 5 MB. Please choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setImageSrc(reader.result);
      }
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!imageSrc) return;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (!dragging || !loadedImgRef.current) return;
    const img = loadedImgRef.current;
    const baseScale = Math.max(CROP_VIEW_SIZE / img.width, CROP_VIEW_SIZE / img.height);
    const scale = baseScale * zoom;
    const maxPanX = Math.max(0, (img.width * scale - CROP_VIEW_SIZE) / 2);
    const maxPanY = Math.max(0, (img.height * scale - CROP_VIEW_SIZE) / 2);

    const nextX = dragStartRef.current.ox + (e.clientX - dragStartRef.current.x);
    const nextY = dragStartRef.current.oy + (e.clientY - dragStartRef.current.y);
    setOffset({
      x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
    });
  }

  function handlePointerUp(): void {
    setDragging(false);
  }

  async function handleSaveCrop(): Promise<void> {
    const img = loadedImgRef.current;
    if (!img) return;
    setError(null);
    setUploading(true);
    try {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = EXPORT_SIZE;
      outCanvas.height = EXPORT_SIZE;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) throw new Error('Canvas export unsupported.');

      const baseScale = Math.max(CROP_VIEW_SIZE / img.width, CROP_VIEW_SIZE / img.height);
      const ratio = EXPORT_SIZE / CROP_VIEW_SIZE;
      const scale = baseScale * zoom * ratio;
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      const maxPanX = Math.max(0, (img.width * baseScale * zoom - CROP_VIEW_SIZE) / 2);
      const maxPanY = Math.max(0, (img.height * baseScale * zoom - CROP_VIEW_SIZE) / 2);
      const clampedX = Math.max(-maxPanX, Math.min(maxPanX, offset.x)) * ratio;
      const clampedY = Math.max(-maxPanY, Math.min(maxPanY, offset.y)) * ratio;

      const drawX = (EXPORT_SIZE - drawW) / 2 + clampedX;
      const drawY = (EXPORT_SIZE - drawH) / 2 + clampedY;

      outCtx.fillStyle = '#0B0F17';
      outCtx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
      outCtx.drawImage(img, drawX, drawY, drawW, drawH);

      let dataUrl = outCanvas.toDataURL('image/webp', 0.9);
      if (!dataUrl.startsWith('data:image/webp')) {
        dataUrl = outCanvas.toDataURL('image/png');
      }
      await onUploadComplete(dataUrl);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div className="clay-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="crop-modal-title" className="font-display text-2xl font-bold text-white">
              Upload Profile Picture
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              JPG, JPEG, PNG, or WEBP up to 5 MB
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="clay-btn-secondary p-2 cursor-pointer"
            aria-label="Close upload dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {!imageSrc ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="clay-inset w-full h-64 border-2 border-dashed border-slate-600 hover:border-orange-500/70 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-400">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-center px-4">
              <p className="text-sm font-semibold text-slate-200">
                Choose from device or mobile gallery
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Crop and reposition before saving
              </p>
            </div>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <canvas
                ref={canvasRef}
                width={CROP_VIEW_SIZE}
                height={CROP_VIEW_SIZE}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="rounded-2xl border border-white/10 cursor-grab active:cursor-grabbing touch-none"
              />
              <p className="text-xs text-slate-400 mt-2">Drag image to reposition inside frame</p>
            </div>

            <div className="flex items-center gap-3">
              <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom image"
                className="w-full accent-orange-500"
              />
              <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                className="clay-btn-secondary p-2 cursor-pointer"
                title="Reset position"
                aria-label="Reset position"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="clay-btn-secondary px-4 py-2.5 text-sm font-semibold cursor-pointer"
              >
                Choose Another
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => void handleSaveCrop()}
                className="clay-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-60 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Save Picture'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-rose-300 bg-rose-500/15 border border-rose-500/25 rounded-2xl px-3.5 py-2.5">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
