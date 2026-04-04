import { RecordVisualization } from "@/lib/record-visualization";

export function RecordVisualizationCard({
  visualization,
}: {
  visualization: RecordVisualization;
}) {
  if (visualization.kind === "empty") {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-900">{visualization.title}</p>
        <p className="mt-2 text-sm text-slate-600">{visualization.description}</p>
      </div>
    );
  }

  if (visualization.kind === "summary") {
    return (
      <div className="rounded-3xl bg-[linear-gradient(135deg,#fff7d6,#ffffff)] p-4 ring-1 ring-amber-200">
        <p className="text-sm font-semibold text-slate-900">{visualization.title}</p>
        <p className="mt-2 text-sm text-slate-600">{visualization.description}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {visualization.items.map((item) => (
            <div key={item.label} className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visualization.kind === "series") {
    const maxValue = Math.max(...visualization.points.map((point) => point.value), 1);

    return (
      <div className="rounded-3xl bg-[linear-gradient(135deg,#fff7d6,#ffffff)] p-4 ring-1 ring-amber-200">
        <p className="text-sm font-semibold text-slate-900">{visualization.title}</p>
        <p className="mt-2 text-sm text-slate-600">{visualization.description}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-slate-500">見ている流れ</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{visualization.metricLabel}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-slate-500">記録数</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{visualization.totalRecords}件</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-slate-500">最初からの変化</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{visualization.trendLabel}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <div className="flex h-48 items-end gap-2">
              {visualization.points.map((point) => (
                <div key={`${point.label}-${point.valueLabel}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <p className="text-[11px] text-slate-500">{point.valueLabel}</p>
                  <div className="flex h-32 w-full items-end justify-center rounded-t-2xl bg-slate-50 px-1">
                    <div
                      className="w-full rounded-t-xl bg-[linear-gradient(180deg,#ffd166,#fb8500)]"
                      style={{ height: `${Math.max((point.value / maxValue) * 100, 10)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-600">{point.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...visualization.groups.map((group) => group.value), 1);

  return (
    <div className="rounded-3xl bg-[linear-gradient(135deg,#fff7d6,#ffffff)] p-4 ring-1 ring-amber-200">
      <p className="text-sm font-semibold text-slate-900">{visualization.title}</p>
      <p className="mt-2 text-sm text-slate-600">{visualization.description}</p>
      <div className="mt-4 rounded-2xl bg-white p-4">
        <div className="space-y-4">
          {visualization.groups.map((group) => (
            <div key={group.label}>
              <div className="grid gap-3 md:grid-cols-[180px_1fr] md:items-center">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{group.label}</p>
                    <p className="text-xs text-slate-500">{group.valueLabel}</p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-[linear-gradient(90deg,#219ebc,#8ecae6)]"
                      style={{ width: `${Math.max((group.value / maxValue) * 100, 10)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{group.note}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex h-20 items-end gap-2">
                    {group.points.length > 0 ? (
                      group.points.map((point) => (
                        <div key={`${group.label}-${point.label}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                          <div className="flex h-12 w-full items-end justify-center rounded-t-xl bg-white px-1">
                            <div
                              className="w-full rounded-t-lg bg-[linear-gradient(180deg,#8ecae6,#219ebc)]"
                              style={{ height: `${Math.max((point.value / maxValue) * 100, 12)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-600">{point.label}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">まだ日ごとの流れは出ていません。</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    );
  }
