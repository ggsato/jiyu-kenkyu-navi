"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";
import { getPrimaryPurposeFocusOption, normalizePurposeFocus } from "@/lib/purpose-focus";

type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  unit: string | null;
  options: string[];
  role: "core" | "compare" | "optional";
  why: string | null;
  howToUse: string | null;
  isDefault: boolean;
  parentLabel: string | null;
};

type RecordItem = {
  id: string;
  recordedAt: string;
  body: string;
  memo: string | null;
  kvFields: Record<string, unknown>;
  tags: string[];
  attachments: Array<{ id: string; storageKey: string; mimeType: string }>;
};

export function RecordsClient({
  activeQuestionId,
  activeQuestionText,
  activePurposeFocus,
  records,
  fieldDefinitions,
}: {
  activeQuestionId: string;
  activeQuestionText: string;
  activePurposeFocus: string;
  records: RecordItem[];
  fieldDefinitions: FieldDefinition[];
}) {
  const params = useSearchParams();
  const source = params.get("source") || "";
  const [items, setItems] = useState(records);
  const [memo, setMemo] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [kvFields, setKvFields] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(
      fieldDefinitions.map((field) => [
        field.key,
        field.type === "boolean" ? false : "",
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((item) => item.recordedAt.slice(0, 10) === today).length;
  }, [items]);
  const purpose = getPrimaryPurposeFocusOption(normalizePurposeFocus(activePurposeFocus));

  function buildRecordBody() {
    const parts = fieldDefinitions
      .map((field) => {
        const value = kvFields[field.key];

        if (value === "" || value === false || value === null || value === undefined) {
          return null;
        }

        if (field.type === "boolean") {
          return `${field.label}: はい`;
        }

        return `${field.label}: ${String(value)}`;
      })
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" / ");
    }

    if (memo.trim()) {
      return memo.trim();
    }

    return "記録を追加";
  }

  function fieldHint(field: FieldDefinition) {
    if (field.why) {
      return field.why;
    }

    if (field.type === "select") {
      return "その回でいちばん近いものを1つ選ぶ";
    }

    if (field.type === "boolean") {
      return "あてはまるときだけ入れる";
    }

    if (field.type === "number") {
      return `${field.label}を数で入れる`;
    }

    return `${field.label}を短く書く`;
  }

  async function uploadAttachment(recordId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/records/${recordId}/attachments`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "画像を保存できませんでした");
    }

    return data.attachment as { id: string; storageKey: string; mimeType: string };
  }

  async function submitRecord() {
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: activeQuestionId,
          body: buildRecordBody(),
          memo,
          kv_fields: kvFields,
          tags: [],
          source,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "記録できませんでした");
        return;
      }

      const nextRecord = data.record as RecordItem;

      try {
        if (selectedFiles.length > 0) {
          const attachments = [];

          for (const file of selectedFiles) {
            const attachment = await uploadAttachment(nextRecord.id, file);
            attachments.push(attachment);
          }

          nextRecord.attachments = attachments;
        }
      } catch (attachmentError) {
        setError(attachmentError instanceof Error ? attachmentError.message : "画像を保存できませんでした");
      }

      setItems((current) => [nextRecord, ...current]);
      setMemo("");
      setSelectedFiles([]);
      setFileInputKey((current) => current + 1);
      setKvFields(
        Object.fromEntries(
          fieldDefinitions.map((field) => [field.key, field.type === "boolean" ? false : ""]),
        ),
      );
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>記録を追加</SectionTitle>
          <span className="rounded-full bg-mint px-3 py-1 text-sm text-slate-700">今日 {todayCount} 件</span>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium text-slate-900">{activeQuestionText || "この問いの記録"}</p>
            <Pill>{purpose.label}</Pill>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {purpose.value === "compare"
              ? "同じ見方で残して、あとで違いを見ます。"
              : purpose.value === "relate"
                ? "何と何がいっしょに起きたかを見つけるために残します。"
                : "予想と実際を見比べられるように残します。"}
          </p>
        </div>
        <div>
          <label className="field-label">今回注目する観測項目</label>
          <div className="space-y-3">
            {fieldDefinitions.map((field) => (
              <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <label className="field-label">
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ""}
                </label>
                <p className="mb-2 text-xs text-slate-500">{fieldHint(field)}</p>
                {field.parentLabel ? <p className="mb-2 text-xs text-amber-800">細分化元: {field.parentLabel}</p> : null}
                {field.howToUse ? <p className="mb-2 text-xs text-slate-400">使い方: {field.howToUse}</p> : null}
                {field.type === "select" ? (
                  <select
                    value={String(kvFields[field.key] ?? "")}
                    onChange={(event) =>
                      setKvFields((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  >
                    <option value="">選ぶ</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "boolean" ? (
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900">
                    <input
                      type="checkbox"
                      checked={Boolean(kvFields[field.key])}
                      onChange={(event) =>
                        setKvFields((current) => ({
                          ...current,
                          [field.key]: event.target.checked,
                        }))
                      }
                    />
                    はい
                  </label>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    value={String(kvFields[field.key] ?? "")}
                    onChange={(event) =>
                      setKvFields((current) => ({
                        ...current,
                        [field.key]: field.type === "number" ? Number(event.target.value) || 0 : event.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
            {fieldDefinitions.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">この問いで使う観測項目はまだありません。</p> : null}
          </div>
        </div>
        <div>
          <label className="field-label">メモ</label>
          <p className="mb-2 text-xs text-slate-500">項目に入りにくい補足だけを短く残します。</p>
          <textarea maxLength={INPUT_LIMITS.record_memo} rows={3} value={memo} onChange={(event) => setMemo(event.target.value)} />
          <p className="mt-1 text-xs text-slate-500">{limitLabel(memo.length, INPUT_LIMITS.record_memo)}</p>
        </div>
        <div>
          <label className="field-label">画像を追加</label>
          <p className="mb-2 text-xs text-slate-500">jpg / png / webp を3枚まで追加できます。1枚10MBまでです。</p>
          <input
            key={fileInputKey}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files || []).slice(0, 3);
              setSelectedFiles(files);
            }}
          />
          {selectedFiles.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={submitRecord} disabled={isPending || !activeQuestionId}>
          {isPending ? "保存中..." : "記録する"}
        </button>
      </Card>

      <Card>
        <SectionTitle>記録一覧</SectionTitle>
        <div className="mt-4 space-y-4">
          {items.length === 0 ? (
            <p className="text-slate-600">まだ記録はありません。</p>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{new Date(item.recordedAt).toLocaleString("ja-JP")}</p>
                <p className="mt-2 font-medium text-slate-900">{item.body}</p>
                {item.memo ? <p className="mt-2 text-sm text-slate-600">{item.memo}</p> : null}
                {Object.keys(item.kvFields).length > 0 ? (
                  <dl className="mt-3 space-y-2 rounded-xl bg-white p-3 text-sm text-slate-700">
                    {Object.entries(item.kvFields).map(([key, value]) => {
                      const field = fieldDefinitions.find((definition) => definition.key === key);
                      return (
                        <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
                          <dt className="text-slate-500">{field?.label || key}</dt>
                          <dd>
                            <p>{String(value)}</p>
                            {field?.why ? <p className="mt-1 text-xs text-slate-500">{field.why}</p> : null}
                            {field?.howToUse ? <p className="mt-1 text-xs text-slate-400">使い方: {field.howToUse}</p> : null}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                ) : null}
                {item.tags.length > 0 ? <p className="mt-2 text-xs text-slate-500">タグ: {item.tags.join(", ")}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                {item.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={`/${attachment.storageKey.replace(/^public\//, "")}`}
                    target="_blank"
                    className="rounded-full bg-white px-3 py-1 text-xs text-slate-700"
                    rel="noreferrer"
                  >
                      画像を開く
                  </a>
                ))}
              </div>
              </article>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
