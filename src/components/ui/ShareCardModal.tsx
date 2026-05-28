import React, { forwardRef, useEffect, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Image as TauriImage } from "@tauri-apps/api/image";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { Check, Clipboard, Download, FileText, Palette, X } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { formatDateTime } from "../../lib/format";

/* ── Types ─────────────────────────────────────────────── */

type LayoutStyle = "a" | "b" | "c" | "receipt";
type ThemeId = "classic" | "ink-white" | "notebook" | "receipt";

type Theme = {
  id: ThemeId;
  name: string;
  layout: LayoutStyle;
  paper: {
    bg: string;
    bgExtra?: string;
    border?: string;
    shadow?: string;
    radius?: number;
  };
  text: {
    title: string;
    body: string;
    meta: string;
    accent?: string;
  };
  quote: {
    borderLeft: string;
    bg: string;
  };
  source?: {
    bg: string;
    border?: string;
  };
  brand: {
    color: string;
    opacity: number;
  };
  decor?: {
    bar?: string;
    barColor?: string;
    divider?: string;
  };
};

type ShareCardData = {
  kind: "bookmark" | "review";
  bookTitle: string;
  bookAuthor: string;
  content: string;
  chapter?: string;
  time?: number;
  abstractText?: string | null;
};

type ShareCardModalProps = {
  data: ShareCardData | null;
  onClose: () => void;
};

/* ── Theme definitions ─────────────────────────────────── */

const THEMES: Theme[] = [
  {
    id: "classic",
    name: "纸笺",
    layout: "a",
    paper: {
      bg: "linear-gradient(135deg, #fffef9 0%, #fffdf7 40%, #fffaf2 100%)",
      border: "1px solid rgba(132, 111, 82, 0.07)",
      shadow: "0 1px 3px rgba(55,43,27,0.04), 0 4px 16px rgba(55,43,27,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
    },
    text: { title: "#2b2824", body: "#2b2824", meta: "#9a8e82" },
    quote: {
      borderLeft: "3px solid rgba(47, 128, 237, 0.5)",
      bg: "linear-gradient(135deg, rgba(244,248,255,0.95) 0%, rgba(240,246,255,0.85) 100%)",
    },
    source: { bg: "rgba(132,111,82,0.04)", border: "1px solid rgba(132,111,82,0.07)" },
    brand: { color: "#7d7267", opacity: 0.62 },
    decor: { bar: "40px", barColor: "var(--brand, #2f80ed)", divider: "rgba(132,111,82,0.1)" },
  },
  {
    id: "ink-white",
    name: "墨白",
    layout: "b",
    paper: {
      bg: "#ffffff",
      border: "1px solid #e8e8e8",
      shadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.06)",
    },
    text: { title: "#1a1a1a", body: "#333333", meta: "#999999" },
    quote: {
      borderLeft: "3px solid #1a1a1a",
      bg: "#f8f8f8",
    },
    source: { bg: "#f5f5f5", border: "1px solid #eeeeee" },
    brand: { color: "#777777", opacity: 0.58 },
    decor: { divider: "#e8e8e8" },
  },
  {
    id: "notebook",
    name: "手札",
    layout: "a",
    paper: {
      bg: "linear-gradient(135deg, #faf8f5 0%, #f5f0e8 50%, #f0ebe2 100%)",
      border: "1px solid rgba(160,140,110,0.12)",
      shadow: "0 1px 3px rgba(120,100,60,0.05), 0 4px 16px rgba(120,100,60,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
      radius: 16,
    },
    text: { title: "#4a3f35", body: "#3d3429", meta: "#a0927e" },
    quote: {
      borderLeft: "3px solid rgba(180,140,80,0.5)",
      bg: "linear-gradient(135deg, rgba(245,240,232,0.9) 0%, rgba(240,235,226,0.8) 100%)",
    },
    source: { bg: "rgba(160,140,110,0.06)", border: "1px solid rgba(160,140,110,0.1)" },
    brand: { color: "#786b5b", opacity: 0.62 },
    decor: { divider: "rgba(160,140,110,0.12)" },
  },
  {
    id: "receipt",
    name: "小票",
    layout: "receipt",
    paper: {
      bg: "#fffdf0",
      border: "1px solid rgba(64, 55, 42, 0.08)",
      shadow: "0 2px 8px rgba(32,26,18,0.08), 0 14px 34px rgba(32,26,18,0.10)",
      radius: 0,
    },
    text: { title: "#2f2b24", body: "#343027", meta: "#8a8174" },
    quote: {
      borderLeft: "0",
      bg: "transparent",
    },
    brand: { color: "#6f675c", opacity: 0.72 },
    decor: { divider: "rgba(64, 55, 42, 0.2)" },
  },
];

const THEME_KEY = "share-card-theme";

function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (THEMES.some((t) => t.id === v)) return v as ThemeId;
  } catch {}
  return "classic";
}

function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/* ── Helpers ─────────────────────────────────────────────── */

function metaStr(data: ShareCardData): string {
  return [data.chapter, data.time ? formatDateTime(data.time) : null]
    .filter(Boolean)
    .join(" · ");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

function clipRounded(dataUrl: string, radius: number): Promise<string> {
  return loadImage(dataUrl).then((img) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, radius * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err instanceof Event) return `${err.type} (${err.target?.constructor?.name ?? "unknown"})`;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

/* ── Theme thumbnail icons ──────────────────────────────── */

function ThemeThumbClassic() {
  return (
    <svg viewBox="0 0 28 36" fill="none">
      <rect x="0" y="0" width="28" height="36" rx="3" fill="#fffdf7" stroke="#d6cfc4" strokeWidth="0.5" />
      <rect x="4" y="5" width="14" height="2" rx="1" fill="#4a3f35" opacity="0.7" />
      <rect x="4" y="9" width="8" height="1.2" rx="0.6" fill="#a0927e" opacity="0.5" />
      <line x1="4" y1="13" x2="24" y2="13" stroke="#d6cfc4" strokeWidth="0.4" />
      <rect x="4" y="15" width="20" height="12" rx="2" fill="rgba(47,128,237,0.06)" />
      <rect x="4" y="15" width="1" height="12" rx="0.5" fill="rgba(47,128,237,0.4)" />
      <rect x="4" y="30" width="10" height="1" rx="0.5" fill="#a0927e" opacity="0.3" />
    </svg>
  );
}

function ThemeThumbInkWhite() {
  return (
    <svg viewBox="0 0 28 36" fill="none">
      <rect x="0" y="0" width="28" height="36" rx="3" fill="#ffffff" stroke="#e0e0e0" strokeWidth="0.5" />
      <rect x="4" y="4" width="20" height="14" rx="1.5" fill="#f5f5f5" />
      <rect x="4" y="4" width="1" height="14" rx="0.5" fill="#1a1a1a" opacity="0.4" />
      <rect x="4" y="21" width="20" height="8" rx="2" fill="#f5f5f5" stroke="#eee" strokeWidth="0.4" />
      <rect x="6" y="23.5" width="14" height="1.2" rx="0.6" fill="#1a1a1a" opacity="0.45" />
      <rect x="6" y="26" width="10" height="1" rx="0.5" fill="#999" opacity="0.3" />
      <rect x="14" y="31" width="10" height="1" rx="0.5" fill="#999" opacity="0.2" />
    </svg>
  );
}

function ThemeThumbNotebook() {
  return (
    <svg viewBox="0 0 28 36" fill="none">
      <rect x="0" y="0" width="28" height="36" rx="3" fill="#f5f0e8" stroke="rgba(160,140,110,0.15)" strokeWidth="0.5" />
      <rect x="4" y="5" width="14" height="2" rx="1" fill="#4a3f35" opacity="0.6" />
      <rect x="4" y="9" width="8" height="1.2" rx="0.6" fill="#a0927e" opacity="0.5" />
      <line x1="4" y1="13" x2="24" y2="13" stroke="rgba(160,140,110,0.12)" strokeWidth="0.4" />
      <rect x="4" y="15" width="20" height="12" rx="2" fill="rgba(180,140,80,0.06)" />
      <rect x="4" y="30" width="10" height="1" rx="0.5" fill="#a0927e" opacity="0.3" />
    </svg>
  );
}

function ThemeThumbReceipt() {
  return (
    <svg viewBox="0 0 28 36" fill="none">
      <path d="M2 1.5h24v33l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2V1.5Z" fill="#fffdf0" stroke="#d8d0bd" strokeWidth="0.6" />
      <rect x="8" y="5" width="12" height="1.5" rx="0.7" fill="#3e382f" opacity="0.65" />
      <rect x="6" y="8" width="16" height="1" rx="0.5" fill="#3e382f" opacity="0.45" />
      <line x1="5" y1="12" x2="23" y2="12" stroke="#bdb4a2" strokeWidth="0.5" strokeDasharray="2 2" />
      <rect x="5" y="15" width="18" height="9" rx="1" fill="#f6f0dd" opacity="0.45" />
      <line x1="5" y1="27" x2="23" y2="27" stroke="#bdb4a2" strokeWidth="0.5" strokeDasharray="2 2" />
      <rect x="5" y="30" width="10" height="1" rx="0.5" fill="#8a8174" opacity="0.55" />
    </svg>
  );
}

const THEME_THUMBS: Record<ThemeId, React.FC> = {
  classic: ThemeThumbClassic,
  "ink-white": ThemeThumbInkWhite,
  notebook: ThemeThumbNotebook,
  receipt: ThemeThumbReceipt,
};

/* ── Theme picker ───────────────────────────────────────── */

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
}) {
  return (
    <div className="share-theme-picker">
      {THEMES.map((t) => {
        const Thumb = THEME_THUMBS[t.id];
        return (
          <button
            key={t.id}
            type="button"
            className={`share-theme-thumb ${value === t.id ? "active" : ""}`}
            onClick={() => onChange(t.id)}
            aria-label={t.name}
          >
            <Thumb />
            <span className="share-theme-thumb-label">{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Share card preview ─────────────────────────────────── */

const ShareCardPreview = forwardRef<
  HTMLDivElement,
  { data: ShareCardData; theme: Theme }
>(function ShareCardPreview({ data, theme }, ref) {
  const meta = metaStr(data);
  const t = theme;

  const paperStyle: React.CSSProperties = {
    background: t.paper.bg,
    border: t.paper.border,
    boxShadow: t.paper.shadow,
    borderRadius: t.paper.radius ?? 14,
  };

  function renderBody() {
    return data.kind === "bookmark" ? (
      <blockquote
        style={{
          borderLeft: t.quote.borderLeft,
          background: t.quote.bg,
          color: t.text.body,
        }}
      >
        {data.content}
      </blockquote>
    ) : (
      <>
        {data.abstractText ? (
          <blockquote
            className="share-review-abstract"
            style={{
              borderLeft: t.quote.borderLeft,
              background: t.quote.bg,
              color: t.text.meta,
            }}
          >
            {data.abstractText}
          </blockquote>
        ) : null}
        <p style={{ color: t.text.body }}>{data.content}</p>
      </>
    );
  }

  const dividerColor = t.decor?.divider ?? "rgba(132,111,82,0.1)";
  const brand = (placement: "footer" | "source" | "topline" | "center" | "receipt") => (
    <span
      className={`share-card-brand share-card-brand-${placement}`}
      style={{ color: t.brand.color, opacity: t.brand.opacity }}
    >
      「书迹」桌面端
    </span>
  );

  if (t.layout === "receipt") {
    return (
      <div className="share-card-paper share-card-paper-receipt" ref={ref} style={paperStyle}>
        <div className="share-card-receipt-inner">
          <header className="share-card-receipt-header">
            <span>书迹</span>
            <strong>Note Receipt</strong>
          </header>
          <div className="share-card-receipt-divider" />
          <div className="share-card-receipt-body">{renderBody()}</div>
          <div className="share-card-receipt-divider" />
          <footer className="share-card-receipt-footer">
            <span>《{data.bookTitle}》</span>
            {data.bookAuthor ? <span>{data.bookAuthor}</span> : null}
            {data.chapter ? <span>{data.chapter}</span> : null}
            {data.time ? <time>{formatDateTime(data.time)}</time> : null}
            {brand("receipt")}
          </footer>
        </div>
      </div>
    );
  }

  /* ── Layout A: 标题置顶 ── */
  if (t.layout === "a") {
    return (
      <div className="share-card-paper" ref={ref} style={paperStyle}>
        <div className="share-card-inner">
          <div className="share-card-header" style={{ borderBottomColor: dividerColor }}>
            <span className="share-card-book" style={{ color: t.text.title }}>
              《{data.bookTitle}》
            </span>
            <span className="share-card-author" style={{ color: t.text.meta }}>
              {data.bookAuthor}
            </span>
          </div>
          <div className="share-card-body">{renderBody()}</div>
          <div className="share-card-footer" style={{ borderTopColor: dividerColor }}>
            <span className="share-card-meta" style={{ color: t.text.meta }}>
              {meta}
            </span>
            {brand("footer")}
          </div>
        </div>
      </div>
    );
  }

  /* ── Layout B: 底部卡片 ── */
  if (t.layout === "b") {
    return (
      <div className="share-card-paper" ref={ref} style={paperStyle}>
        <div className="share-card-inner">
          <div className="share-card-body">{renderBody()}</div>
          {t.source && (
            <div
              className="share-card-source"
              style={{ background: t.source.bg, border: t.source.border }}
            >
              <div className="share-card-source-book" style={{ color: t.text.title }}>
                《{data.bookTitle}》{data.bookAuthor}
              </div>
              {meta ? (
                <div className="share-card-source-meta" style={{ color: t.text.meta }}>
                  {meta}
                </div>
              ) : null}
            </div>
          )}
          {brand("center")}
        </div>
      </div>
    );
  }

  /* ── Layout C: 紧凑一行 ── */
  return (
    <div className="share-card-paper" ref={ref} style={paperStyle}>
      <div className="share-card-inner">
        <div className="share-card-topline" style={{ borderBottomColor: dividerColor }}>
          <span className="share-card-topline-main">
            <span className="share-card-topline-title" style={{ color: t.text.title }}>
              《{data.bookTitle}》{data.bookAuthor}
            </span>
            {brand("topline")}
          </span>
          {meta ? (
            <span className="share-card-topline-meta" style={{ color: t.text.meta }}>
              {meta}
            </span>
          ) : null}
        </div>
        <div className="share-card-body">{renderBody()}</div>
      </div>
    </div>
  );
});

/* ── Modal ───────────────────────────────────────────────── */

function ShareCardModal({ data, onClose }: ShareCardModalProps) {
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(getStoredTheme);
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageDataUrlRef = useRef<string | null>(null);

  const theme = getTheme(themeId);
  const contentLabel = data?.kind === "bookmark" ? "划线" : "想法";

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, themeId); } catch {}
  }, [themeId]);

  useEffect(() => {
    if (!data) return;
    setSaveError(null);
    setSaved(false);
    setCopied(false);
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data, onClose]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function generateImage(): Promise<string> {
    const node = cardRef.current;
    if (!node) throw new Error("卡片未就绪");
    const fullHeight = node.scrollHeight;
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: "#fffdf8",
      height: fullHeight,
      style: {
        height: `${fullHeight}px`,
        maxHeight: "none",
      },
    });
    return clipRounded(dataUrl, theme.paper.radius ?? 16);
  }

  async function getPreparedImage(): Promise<string> {
    if (imageDataUrlRef.current) return imageDataUrlRef.current;
    const dataUrl = await generateImage();
    imageDataUrlRef.current = dataUrl;
    return dataUrl;
  }

  async function handleSave() {
    if (!cardRef.current || !data) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const roundedDataUrl = await getPreparedImage();

      // 生成文件名：书名-章节-摘要.png
      const sanitize = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "");
      const bookPart = sanitize(data.bookTitle).slice(0, 30);
      const chapterPart = data.chapter ? sanitize(data.chapter).slice(0, 10) : "";
      const contentPart = sanitize(data.content).slice(0, 5).replace(/[，。！？、；：""''（）《》…—\-.,!?;:'"()\[\]{}]+$/, "");

      const parts = [bookPart, chapterPart, contentPart].filter(Boolean);
      const fileName = `${parts.join("-")}.png`;

      // 使用前端 save API 选择文件路径（异步，不阻塞 UI）
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: "图片", extensions: ["png"] }],
      });

      if (!filePath) {
        // 用户取消了对话框
        return;
      }

      // 将 data URL 转换为 Blob
      const response = await fetch(roundedDataUrl);
      const blob = await response.blob();

      // 使用浏览器下载 API 保存文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSaved(true);
    } catch (err) {
      if (String(err) !== "用户取消") setSaveError(formatError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!cardRef.current || !data) return;
    setCopying(true);
    setSaveError(null);
    setCopied(false);
    try {
      const roundedDataUrl = await getPreparedImage();
      const base64 = roundedDataUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const image = await TauriImage.fromBytes(bytes);
      await writeImage(image);
      setCopied(true);
    } catch (err) {
      setSaveError(formatError(err));
    } finally {
      setCopying(false);
    }
  }

  const previewRef = useRef<HTMLDivElement>(null);

  // 数据或主题变化时清除图片缓存，下次点击时重新生成
  useEffect(() => {
    imageDataUrlRef.current = null;
  }, [data, themeId]);

  if (!data) return null;

  return (
    <div className="share-card-backdrop" onClick={onClose}>
      <div
        className="share-card-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-card-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          className="share-card-close"
          icon={<X size={18} />}
          aria-label="关闭"
          onClick={onClose}
        />

        <header className="share-card-workbench-header">
          <div>
            <span className="share-card-kicker">分享卡片</span>
            <h2 id="share-card-title">生成{contentLabel}图片</h2>
          </div>
        </header>

        <div className="share-card-layout">
          <aside className="share-card-sidebar" aria-label="卡片设置">
            <section className="share-card-source-panel">
              <div className="share-card-panel-title">
                <FileText size={15} />
                <span>来源</span>
              </div>
              <div className="share-card-origin-book">
                <strong>{data.bookTitle}</strong>
                {data.bookAuthor ? <span>{data.bookAuthor}</span> : null}
              </div>
              <dl className="share-card-origin-meta">
                <div>
                  <dt>类型</dt>
                  <dd>{contentLabel}</dd>
                </div>
                {data.chapter ? (
                  <div>
                    <dt>章节</dt>
                    <dd>{data.chapter}</dd>
                  </div>
                ) : null}
                {data.time ? (
                  <div>
                    <dt>时间</dt>
                    <dd>{formatDateTime(data.time)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="share-card-style-panel">
              <div className="share-card-panel-title">
                <Palette size={15} />
                <span>样式</span>
              </div>
              <ThemePicker value={themeId} onChange={setThemeId} />
            </section>
          </aside>

          <div className="share-card-main">
            <div className="share-card-preview-center" ref={previewRef}>
              <div className="share-card-scale-wrapper">
                <ShareCardPreview ref={cardRef} data={data} theme={theme} />
              </div>
            </div>

            <div className="share-card-toolbar-bottom">
              {saveError ? (
                <p className="share-card-error">{saveError}</p>
              ) : null}
              <div className="share-card-actions">
                <Button
                  className={`share-card-action-btn ${copied ? "share-card-action-btn-success" : ""}`}
                  variant="secondary"
                  icon={copied ? <Check size={16} /> : <Clipboard size={16} />}
                  disabled={copying || saving}
                  onClick={() => void handleCopy()}
                >
                  {copying ? "复制中..." : copied ? "已复制" : "复制"}
                </Button>
                <Button
                  className="share-card-action-btn share-card-action-btn-primary"
                  variant={saved ? "secondary" : "primary"}
                  icon={saved ? <Check size={16} /> : <Download size={16} />}
                  disabled={saving || copying}
                  onClick={() => void handleSave()}
                >
                  {saving ? "保存中..." : saved ? "已保存" : "保存图片"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ShareCardModal };
export type { ShareCardData };
