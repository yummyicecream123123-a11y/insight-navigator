import type { NewsItem } from "@/lib/market.functions";

export function NewsList({ items }: { items: NewsItem[] | null | undefined }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      No recent headlines available for this asset.
    </div>
  );
  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border/60">
      {list.map((n, i) => (
        <a key={i} href={n.link} target="_blank" rel="noreferrer noopener"
          className="block px-4 py-3 hover:bg-accent/30 transition-colors">
          <div className="text-sm font-medium leading-snug">{n.title}</div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">
            {n.publisher ?? "source"}{n.published ? ` · ${new Date(n.published).toLocaleString()}` : ""}
          </div>
        </a>
      ))}
    </div>
  );
}
