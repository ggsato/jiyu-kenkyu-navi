export type VisualizationFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  unit?: string | null;
  role?: "core" | "compare" | "optional";
  why?: string | null;
  isPrimaryMetric?: boolean;
};

export type VisualizationRecord = {
  recordedAt: string;
  kvFields: Record<string, unknown>;
};

export type RecordSummary = {
  trying: Array<{ key: string; label: string; value: string }>;
  context: Array<{ key: string; label: string; value: string }>;
  outcome: Array<{ key: string; label: string; value: string }>;
  extra: Array<{ key: string; label: string; value: string }>;
};

export type RecordVisualization =
  | {
      kind: "empty";
      title: string;
      description: string;
    }
  | {
      kind: "series";
      title: string;
      description: string;
      metricLabel: string;
      totalRecords: number;
      trendLabel: string;
      points: Array<{
        label: string;
        value: number;
        valueLabel: string;
      }>;
    }
  | {
      kind: "compare";
      title: string;
      description: string;
      metricLabel: string;
      groups: Array<{
        label: string;
        value: number;
        valueLabel: string;
        note: string;
        points: Array<{
          label: string;
          value: number;
          valueLabel: string;
        }>;
      }>;
    }
  | {
      kind: "summary";
      title: string;
      description: string;
      items: Array<{
        label: string;
        value: string;
      }>;
    };

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function fieldText(field: VisualizationFieldDefinition) {
  return normalizeText(`${field.key} ${field.label} ${field.why || ""}`);
}

function isTryingField(field: VisualizationFieldDefinition) {
  const text = fieldText(field);
  return (
    text.includes("try") ||
    text.includes("trying") ||
    text.includes("method") ||
    text.includes("approach") ||
    text.includes("やり方") ||
    text.includes("試") ||
    text.includes("方法") ||
    text.includes("作戦") ||
    text.includes("アプローチ")
  );
}

function isContextField(field: VisualizationFieldDefinition) {
  const text = fieldText(field);
  return (
    text.includes("scene") ||
    text.includes("context") ||
    text.includes("condition") ||
    text.includes("場面") ||
    text.includes("状況") ||
    text.includes("条件") ||
    text.includes("時間") ||
    text.includes("場所")
  );
}

function isOutcomeField(field: VisualizationFieldDefinition) {
  const text = fieldText(field);
  return (
    text.includes("result") ||
    text.includes("outcome") ||
    text.includes("what_happened") ||
    text.includes("結果") ||
    text.includes("どうだった") ||
    text.includes("起きた") ||
    text.includes("できた")
  );
}

export function fieldPriority(field: VisualizationFieldDefinition) {
  if (isTryingField(field)) {
    return 0;
  }

  if (isContextField(field)) {
    return 1;
  }

  if (isOutcomeField(field)) {
    return 2;
  }

  if (field.role === "core") {
    return 3;
  }

  if (field.role === "compare") {
    return 4;
  }

  return 5;
}

export function sortVisualizationFields<T extends VisualizationFieldDefinition>(fields: T[]) {
  return [...fields].sort((a, b) => {
    const priority = fieldPriority(a) - fieldPriority(b);

    if (priority !== 0) {
      return priority;
    }

    return a.label.localeCompare(b.label, "ja");
  });
}

function toDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "はい" : "";
  }

  return String(value);
}

function toNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

function dateLabel(recordedAt: string) {
  return new Date(recordedAt).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

function dayKey(recordedAt: string) {
  return new Date(recordedAt).toISOString().slice(0, 10);
}

function hasUsableValue(record: VisualizationRecord, field: VisualizationFieldDefinition) {
  const value = record.kvFields[field.key];
  return value !== null && value !== undefined && value !== "";
}

function distinctValues(records: VisualizationRecord[], field: VisualizationFieldDefinition) {
  return Array.from(
    new Set(
      records
        .map((record) => toDisplayValue(record.kvFields[field.key]))
        .filter(Boolean),
    ),
  );
}

function formatMetricValue(field: VisualizationFieldDefinition, value: number) {
  if (field.type === "boolean") {
    return `${Math.round(value * 100)}%`;
  }

  if (field.unit) {
    return `${value}${field.unit}`;
  }

  return String(Number(value.toFixed(2)));
}

function formatTrendLabel(first: number, last: number, field: VisualizationFieldDefinition) {
  const delta = last - first;

  if (field.type === "boolean") {
    const signed = delta >= 0 ? "+" : "";
    return `${signed}${Math.round(delta * 100)}pt`;
  }

  const signed = delta >= 0 ? "+" : "";
  const rounded = Number(delta.toFixed(2));
  return field.unit ? `${signed}${rounded}${field.unit}` : `${signed}${rounded}`;
}

function isMetricCandidate(field: VisualizationFieldDefinition) {
  if (field.type !== "number" && field.type !== "boolean") {
    return false;
  }

  if (isTryingField(field) || isContextField(field)) {
    return false;
  }

  return true;
}

function fieldScore(field: VisualizationFieldDefinition) {
  let score = 0;

  if (isOutcomeField(field)) {
    score += 50;
  }

  if (!isTryingField(field) && !isContextField(field)) {
    score += 25;
  }

  if (field.role === "core") {
    score += 15;
  }

  if (field.role === "compare") {
    score += 10;
  }

  if (field.type === "number") {
    score += 5;
  }

  return score;
}

function findMetricField(records: VisualizationRecord[], fields: VisualizationFieldDefinition[]) {
  const explicit = fields.find(
    (field) => field.isPrimaryMetric && isMetricCandidate(field) && records.some((record) => toNumericValue(record.kvFields[field.key]) !== null),
  );

  if (explicit) {
    return explicit;
  }

  return [...fields]
    .filter((field) => isMetricCandidate(field) && records.some((record) => toNumericValue(record.kvFields[field.key]) !== null))
    .sort((a, b) => fieldScore(b) - fieldScore(a))[0] || null;
}

function findTryingField(records: VisualizationRecord[], fields: VisualizationFieldDefinition[]) {
  const candidates = [...fields]
    .filter((field) => (field.type === "select" || field.type === "text") && distinctValues(records, field).length >= 2)
    .filter((field) => distinctValues(records, field).length <= 6)
    .sort((a, b) => {
      const scoreA = (isTryingField(a) ? 40 : 0) + (a.role === "compare" ? 15 : 0) + (a.role === "core" ? 5 : 0);
      const scoreB = (isTryingField(b) ? 40 : 0) + (b.role === "compare" ? 15 : 0) + (b.role === "core" ? 5 : 0);
      return scoreB - scoreA;
    });

  return candidates[0] || null;
}

function buildDailyPoints(
  records: VisualizationRecord[],
  field: VisualizationFieldDefinition,
  limit = 8,
) {
  const daily = new Map<string, { label: string; values: number[] }>();

  for (const record of records) {
    const value = toNumericValue(record.kvFields[field.key]);

    if (value === null) {
      continue;
    }

    const key = dayKey(record.recordedAt);

    if (!daily.has(key)) {
      daily.set(key, {
        label: dateLabel(record.recordedAt),
        values: [],
      });
    }

    daily.get(key)!.values.push(value);
  }

  return Array.from(daily.values())
    .map((entry) => {
      const average = entry.values.reduce((sum, value) => sum + value, 0) / entry.values.length;

      return {
        label: entry.label,
        value: average,
        valueLabel: formatMetricValue(field, average),
      };
    })
    .slice(-limit);
}

function latestTryingValue(records: VisualizationRecord[], field: VisualizationFieldDefinition) {
  const sorted = [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  for (const record of sorted) {
    const value = toDisplayValue(record.kvFields[field.key]);

    if (value) {
      return value;
    }
  }

  return "";
}

export function summarizeRecord(
  record: VisualizationRecord,
  fields: VisualizationFieldDefinition[],
): RecordSummary {
  const summary: RecordSummary = {
    trying: [],
    context: [],
    outcome: [],
    extra: [],
  };

  for (const field of sortVisualizationFields(fields)) {
    const value = toDisplayValue(record.kvFields[field.key]);

    if (!value) {
      continue;
    }

    const item = {
      key: field.key,
      label: field.label,
      value,
    };

    if (isTryingField(field)) {
      summary.trying.push(item);
      continue;
    }

    if (isContextField(field)) {
      summary.context.push(item);
      continue;
    }

    if (isOutcomeField(field) || field.role === "compare") {
      summary.outcome.push(item);
      continue;
    }

    summary.extra.push(item);
  }

  return summary;
}

export function buildRecordInsightSummary(
  records: VisualizationRecord[],
  fields: VisualizationFieldDefinition[],
  purposeFocus: string,
) {
  const visualization = buildRecordVisualization(records, fields, purposeFocus);

  if (visualization.kind === "empty") {
    return "";
  }

  if (visualization.kind === "summary") {
    const items = visualization.items
      .slice(0, 3)
      .map((item) => `${item.label}: ${item.value}`)
      .join(" / ");

    return `${visualization.title}。${items}`.trim();
  }

  if (visualization.kind === "series") {
    const points = visualization.points
      .slice(-5)
      .map((point) => `${point.label} ${point.valueLabel}`)
      .join(" / ");

    return `${visualization.title}。${visualization.metricLabel}を日ごとに見る。${points}。記録${visualization.totalRecords}件、最初からの変化は${visualization.trendLabel}。`;
  }

  const groups = visualization.groups
    .slice(0, 3)
    .map((group) => {
      const points = group.points
        .slice(-4)
        .map((point) => `${point.label} ${point.valueLabel}`)
        .join(" / ");

      return `${group.label}: ${points} (${group.note})`;
    })
    .join(" | ");

  return `${visualization.title}。${visualization.metricLabel}をやり方ごとの日ごとに見る。${groups}`;
}

export function buildRecordVisualization(
  records: VisualizationRecord[],
  fields: VisualizationFieldDefinition[],
  purposeFocus: string,
): RecordVisualization {
  if (records.length === 0 || fields.length === 0) {
    return {
      kind: "empty",
      title: "まだ見える形がありません",
      description: "記録がたまると、ここに変化や試し分けの流れが出ます。",
    };
  }

  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const sortedFields = sortVisualizationFields(fields);
  const metricField = findMetricField(sortedRecords, sortedFields);
  const tryingField = findTryingField(sortedRecords, sortedFields);

  if (purposeFocus === "compare") {
    if (tryingField) {
      const grouped = new Map<string, number[]>();
      const groupRecords = new Map<string, VisualizationRecord[]>();

      for (const record of sortedRecords) {
        const groupLabel = toDisplayValue(record.kvFields[tryingField.key]);

        if (!groupLabel) {
          continue;
        }

        if (!grouped.has(groupLabel)) {
          grouped.set(groupLabel, []);
        }

        if (!groupRecords.has(groupLabel)) {
          groupRecords.set(groupLabel, []);
        }

        groupRecords.get(groupLabel)!.push(record);

        if (metricField) {
          const metric = toNumericValue(record.kvFields[metricField.key]);

          if (metric !== null) {
            grouped.get(groupLabel)!.push(metric);
          }
        } else {
          grouped.get(groupLabel)!.push(1);
        }
      }

      const groups = Array.from(grouped.entries())
        .map(([label, values]) => {
          const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
          const points = metricField ? buildDailyPoints(groupRecords.get(label) || [], metricField, 6) : [];
          const uniqueDays = new Set((groupRecords.get(label) || []).map((record) => dayKey(record.recordedAt)));

          return {
            label,
            value: average,
            valueLabel: metricField ? formatMetricValue(metricField, average) : `${values.length}件`,
            note: metricField ? `${uniqueDays.size}日 / ${values.length}件` : `${values.length}件の記録`,
            points,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      if (groups.length >= 2) {
        return {
          kind: "compare",
          title: `${tryingField.label}ごとの日ごとのちがい`,
          description: metricField
            ? `${metricField.label}を、やり方ごとに日単位で見比べます。`
            : "やり方ごとの記録数を見比べます。",
          metricLabel: metricField?.label || "記録数",
          groups,
        };
      }
    }
  }

  if (purposeFocus === "predict" && metricField && tryingField) {
    const currentTryingValue = latestTryingValue(sortedRecords, tryingField);

    if (currentTryingValue) {
      const filteredRecords = sortedRecords.filter(
        (record) => toDisplayValue(record.kvFields[tryingField.key]) === currentTryingValue,
      );
      const points = buildDailyPoints(filteredRecords, metricField);

      if (points.length >= 2) {
        return {
          kind: "series",
          title: `${currentTryingValue}を続けた流れ`,
          description: `${metricField.label}を日ごとに追って、続けたときの変化を見ます。`,
          metricLabel: metricField.label,
          totalRecords: filteredRecords.filter((record) => toNumericValue(record.kvFields[metricField.key]) !== null).length,
          trendLabel: formatTrendLabel(points[0]!.value, points[points.length - 1]!.value, metricField),
          points,
        };
      }
    }
  }

  if (metricField) {
    const points = buildDailyPoints(sortedRecords, metricField);

    if (points.length >= 2) {
      return {
        kind: "series",
        title: `${metricField.label}の日ごとの流れ`,
        description:
          purposeFocus === "predict"
            ? "今のやり方を続けながら、願いに近い変化を日ごとに追います。"
            : "願いに近い変化を、日ごとにまとめて追います。",
        metricLabel: metricField.label,
        totalRecords: sortedRecords.filter((record) => toNumericValue(record.kvFields[metricField.key]) !== null).length,
        trendLabel: formatTrendLabel(points[0]!.value, points[points.length - 1]!.value, metricField),
        points,
      };
    }
  }

  const topFields = sortedFields.filter((field) => sortedRecords.some((record) => hasUsableValue(record, field))).slice(0, 3);

  return {
    kind: "summary",
    title: "最近よく残していること",
    description: "まだ系列や比較にしづらいので、最近の記録で目立つ項目をまとめます。",
    items: topFields.map((field) => {
      const latestRecord = [...sortedRecords].reverse().find((record) => hasUsableValue(record, field));
      return {
        label: field.label,
        value: latestRecord ? toDisplayValue(latestRecord.kvFields[field.key]) : "まだありません",
      };
    }),
  };
}
