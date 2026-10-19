import React, { useState, useEffect, useRef } from 'react';
import { Bold, Italic, Underline, Highlighter, ImagePlus, X } from 'lucide-react';

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Amarelo', color: 'rgba(250, 204, 21, 0.35)', dot: 'bg-yellow-400' },
  { id: 'emerald', label: 'Verde', color: 'rgba(52, 211, 153, 0.35)', dot: 'bg-emerald-400' },
  { id: 'cyan', label: 'Azul', color: 'rgba(56, 189, 248, 0.35)', dot: 'bg-sky-400' },
  { id: 'rose', label: 'Rosa', color: 'rgba(244, 63, 94, 0.35)', dot: 'bg-rose-400' },
];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '',
  label,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);

  useEffect(() => {
    if (
      editorRef.current &&
      value !== editorRef.current.innerHTML &&
      document.activeElement !== editorRef.current
    ) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  const applyFormat = (command: string, arg: string | null = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg ?? undefined);
    onChange(editorRef.current.innerHTML);
  };

  const processImageFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1080;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, width, height);

        try {
          let compressedBase64 = canvas.toDataURL('image/webp', 0.82);
          if (!compressedBase64.startsWith('data:image/webp')) {
            compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          }

          if (editorRef.current) {
            editorRef.current.focus();
          }
          document.execCommand('insertImage', false, compressedBase64);
          if (editorRef.current) {
            const imgs = editorRef.current.querySelectorAll('img');
            imgs.forEach((i) => {
              if (i.src === compressedBase64) i.dataset.compressed = 'true';
            });
            onChange(editorRef.current.innerHTML);
          }
        } catch (e) {
          console.error(e);
        }
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const compressEditorImages = () => {
    if (!editorRef.current) return;
    const imgs = editorRef.current.querySelectorAll<HTMLImageElement>(
      'img:not([data-compressed="true"])'
    );
    if (imgs.length === 0) return;

    imgs.forEach((img) => {
      img.dataset.compressed = 'true';

      if (img.src.includes('image/gif') || img.src.toLowerCase().endsWith('.gif')) return;

      const tempImg = new Image();
      if (!img.src.startsWith('data:image')) {
        tempImg.crossOrigin = 'Anonymous';
      }
      tempImg.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1080;
        let width = tempImg.width;
        let height = tempImg.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempImg, 0, 0, width, height);

        try {
          let compressedBase64 = canvas.toDataURL('image/webp', 0.82);
          if (!compressedBase64.startsWith('data:image/webp')) {
            compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          }
          img.src = compressedBase64;
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        } catch (e) {
          console.warn('CORS impediu a compressão. Mantendo original.');
        }
      };
      tempImg.src = img.src;
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    let handled = false;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            handled = true;
            e.preventDefault();
            return;
          }
        }
      }
    }
    if (!handled) {
      setTimeout(() => {
        compressEditorImages();
        if (editorRef.current) onChange(editorRef.current.innerHTML);
      }, 100);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const items = e.dataTransfer?.items;
    let handled = false;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            handled = true;
            e.preventDefault();
            return;
          }
        }
      }
    }
    if (!handled) {
      setTimeout(() => {
        compressEditorImages();
        if (editorRef.current) onChange(editorRef.current.innerHTML);
      }, 100);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-400 mb-1.5">{label}</label>}
      <div className="border border-slate-800 rounded-xl bg-slate-950 focus-within:ring-2 focus-within:ring-indigo-500 transition-all overflow-hidden">
        <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex-wrap">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormat('bold');
              }}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              title="Negrito (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormat('italic');
              }}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              title="Itálico (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyFormat('underline');
              }}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              title="Sublinhado (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-slate-800 mx-1"></div>

            <div className="relative flex items-center">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowHighlightPalette((prev) => !prev);
                }}
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                  showHighlightPalette
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
                title="Marca-texto colorido"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>
              {showHighlightPalette && (
                <div className="flex items-center gap-1 ml-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 animate-in fade-in duration-150">
                  {HIGHLIGHT_COLORS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyFormat('hiliteColor', h.color);
                        setShowHighlightPalette(false);
                      }}
                      className={`w-4 h-4 rounded-full ${h.dot} hover:scale-125 transition-transform border border-white/20`}
                      title={`Destacar em ${h.label}`}
                    />
                  ))}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyFormat('hiliteColor', 'transparent');
                      applyFormat('removeFormat');
                      setShowHighlightPalette(false);
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-400 px-1 font-bold"
                    title="Limpar marcação"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <input
              type="file"
              accept="image/*"
              ref={galleryInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file) processImageFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
              title="Anexar imagem da galeria ou computador"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span className="text-[11px]">Imagem</span>
            </button>
          </div>
        </div>

        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full text-slate-100 p-3 focus:outline-none overflow-y-auto min-h-[5rem] max-h-[15rem] cursor-text relative empty:before:content-[attr(data-placeholder)] empty:before:text-slate-700 custom-scrollbar anki-content transition-colors"
          data-placeholder={placeholder}
        />
      </div>
    </div>
  );
};