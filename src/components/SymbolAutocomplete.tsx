import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { searchSymbols, type SymbolSuggestion } from "@/lib/market.functions";

const VALID_RE = /^[A-Z0-9.\-=^]{1,20}$/;
export function isValidSymbolFormat(s: string) {
  return VALID_RE.test(s.trim().toUpperCase());
}

export function SymbolAutocomplete({
  value, onChange, onPick, placeholder, invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (s: SymbolSuggestion) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const search = useServerFn(searchSymbols);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SymbolSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tRef = useRef<any>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 1) { setItems([]); return; }
    setLoading(true);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(async () => {
      try {
        const r = await search({ data: { q } });
        setItems(r ?? []);
      } catch { setItems([]); }
      setLoading(false);
    }, 220);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [value, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-input px-3 py-2 text-sm font-mono uppercase ${invalid ? "border-bear/60 ring-1 ring-bear/40" : "border-border"}`}
        autoComplete="off"
        spellCheck={false}
      />
      {open && (items.length > 0 || loading) && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover shadow-2xl overflow-hidden backdrop-blur">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>}
          {items.map((it) => (
            <button
              key={it.symbol}
              type="button"
              onClick={() => { onChange(it.symbol); onPick?.(it); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-accent/40 transition-colors flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-mono text-sm">{it.symbol}</div>
                <div className="text-[11px] text-muted-foreground truncate">{it.name}</div>
              </div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground shrink-0">
                {it.type}{it.exchange ? ` · ${it.exchange}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
