"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Card, LoadingBlock, Pill, SectionTitle } from "@/components/ui";
import { ObservationFieldEditor, type EditableObservationField } from "@/components/observation-field-editor";
import { RecordVisualizationCard } from "@/components/record-visualization";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";
import { getPrimaryPurposeFocusOption, normalizePurposeFocus } from "@/lib/purpose-focus";
import { buildRecordVisualization, sortVisualizationFields, summarizeRecord } from "@/lib/record-visualization";

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

function toLocalDateTimeInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function sortRecordsByRecordedAt(records: RecordItem[]) {
  return [...records].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
}

function sortFieldDefinitions(fields: FieldDefinition[]) {
  return sortVisualizationFields(fields);
}

export function RecordsClient({
  activeQuestionId,
  activeQuestionText,
  activePurposeFocus,
  records,
  fieldDefinitions,
  allFieldDefinitions,
}: {
  activeQuestionId: string;
  activeQuestionText: string;
  activePurposeFocus: string;
  records: RecordItem[];
  fieldDefinitions: FieldDefinition[];
  allFieldDefinitions: EditableObservationField[];
}) {
  const params = useSearchParams();
  const source = params.get("source") || "";
  const [items, setItems] = useState(records);
  const [currentFieldDefinitions, setCurrentFieldDefinitions] = useState(() => sortFieldDefinitions(fieldDefinitions));
  const [editableFieldDefinitions, setEditableFieldDefinitions] = useState(allFieldDefinitions);
  const [memo, setMemo] = useState("");
  const [recordedAt, setRecordedAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [kvFields, setKvFields] = useState<Record<string, string | number | boolean>>(() =>
    Object.fromEntries(
      sortFieldDefinitions(fieldDefinitions).map((field) => [
        field.key,
        field.type === "boolean" ? false : "",
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [isPending, startTransition] = useTransition();

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((item) => item.recordedAt.slice(0, 10) === today).length;
  }, [items]);
  const purpose = getPrimaryPurposeFocusOption(normalizePurposeFocus(activePurposeFocus));
  const visualization = useMemo(
    () => buildRecordVisualization(items, currentFieldDefinitions, normalizePurposeFocus(activePurposeFocus)),
    [items, currentFieldDefinitions, activePurposeFocus],
  );

  function buildRecordBody() {
    const parts = currentFieldDefinitions
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
    setSuccessMessage("");

    startTransition(async () => {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: activeQuestionId,
          recorded_at: new Date(recordedAt).toISOString(),
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

      setItems((current) => sortRecordsByRecordedAt([nextRecord, ...current]));
      setMemo("");
      setRecordedAt(toLocalDateTimeInputValue(new Date()));
      setSelectedFiles([]);
      setFileInputKey((current) => current + 1);
      setKvFields(
        Object.fromEntries(
          sortFieldDefinitions(currentFieldDefinitions).map((field) => [field.key, field.type === "boolean" ? false : ""]),
        ),
      );
      setSuccessMessage("記録を追加しました。");
    });
  }

  async function deleteRecord(recordId: string) {
    setError("");
    setSuccessMessage("");
    setDeletingId(recordId);

    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "記録を削除できませんでした");
        return;
      }

      setItems((current) => current.filter((item) => item.id !== recordId));
      setConfirmDeleteId("");
      setSuccessMessage("記録を削除しました。");
    } catch {
      setError("記録を削除できませんでした");
    } finally {
      setDeletingId("");
    }
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
              ? "今回のやり方と結果を残して、あとで試し方の違いを見ます。"
              : purpose.value === "relate"
                ? "まず何が起きているか分かるように、状況と結果を残します。"
                : "同じやり方や見方を続けて、変化を追えるように残します。"}
          </p>
        </div>
        <div>
          <label className="field-label">いつの記録か</label>
          <p className="mb-2 text-xs text-slate-500">時間情報は基本項目です。あとで順番や変化を見返せるよう、毎回ここから記録します。</p>
          <input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} />
        </div>
        <div>
          <label className="field-label">今回残す試し方と結果</label>
          <div className="space-y-3">
            {currentFieldDefinitions.map((field) => (
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
            {currentFieldDefinitions.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">この問いで使う項目はまだありません。</p> : null}
          </div>
        </div>
        <div>
          <label className="field-label">メモ</label>
          <p className="mb-2 text-xs text-slate-500">試したことや結果に入りきらない補足だけを短く残します。</p>
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
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {successMessage ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={submitRecord} disabled={isPending || !activeQuestionId}>
          {isPending ? "保存中..." : "記録する"}
        </button>
        {isPending ? (
          <LoadingBlock
            title="記録を保存しています"
            description="時間と、今回試したことや結果を、この問いの流れに積み上げています。"
          />
        ) : null}
      </Card>

      <Card>
        <ObservationFieldEditor
          fields={editableFieldDefinitions}
          onSaved={({ currentFields, allFields }) => {
            setEditableFieldDefinitions(allFields);
            const sortedCurrentFields = sortFieldDefinitions(
              currentFields.map((field) => ({
                id: field.id,
                key: field.key,
                label: field.label,
                type: field.type,
                unit: field.unit,
                options: field.options,
                role: field.role,
                why: field.why,
                howToUse: field.howToUse,
                isDefault: field.isDefault,
                parentLabel: field.derivedFromLabel,
              })),
            );
            setCurrentFieldDefinitions(
              sortedCurrentFields,
            );
            setKvFields(
              Object.fromEntries(
                sortedCurrentFields.map((field) => [field.key, field.type === "boolean" ? false : ""]),
              ),
            );
          }}
        />
      </Card>

      <Card className="md:col-span-2">
        <SectionTitle>流れを見る</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">この問いの記録から、変化の流れか試し方ごとの違いを自動で拾って表示します。</p>
        <div className="mt-4">
          <RecordVisualizationCard visualization={visualization} />
        </div>
      </Card>

      <Card className="md:col-span-2">
        <SectionTitle>記録一覧</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">新しい順に並びます。何を試してどうだったかを、あとで順番に追いかけ直せます。</p>
        <div className="mt-4 space-y-4">
          {items.length === 0 ? (
            <p className="text-slate-600">まだ記録はありません。</p>
          ) : (
            items.map((item) => {
              const summary = summarizeRecord(item, editableFieldDefinitions);

              return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  {(summary.trying.length > 0 || summary.outcome.length > 0) ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {summary.trying.slice(0, 2).map((entry) => (
                        <span key={`try-${item.id}-${entry.key}`} className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-900">
                          {entry.label}: {entry.value}
                        </span>
                      ))}
                      {summary.outcome.slice(0, 2).map((entry) => (
                        <span key={`outcome-${item.id}-${entry.key}`} className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-900">
                          {entry.label}: {entry.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-xs text-slate-500">{new Date(item.recordedAt).toLocaleString("ja-JP")}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                        onClick={() => setConfirmDeleteId((current) => (current === item.id ? "" : item.id))}
                        disabled={deletingId === item.id}
                      >
                        {confirmDeleteId === item.id ? "削除確認を閉じる" : "削除"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 font-medium text-slate-900">{item.body}</p>
                  {item.memo ? <p className="mt-2 text-sm text-slate-600">{item.memo}</p> : null}
                  {Object.keys(item.kvFields).length > 0 ? (
                    <dl className="mt-3 space-y-2 rounded-xl bg-white p-3 text-sm text-slate-700">
                      {sortVisualizationFields(editableFieldDefinitions)
                        .filter((field) => Object.prototype.hasOwnProperty.call(item.kvFields, field.key))
                        .map((field) => {
                          const value = item.kvFields[field.key];

                          if (value === "" || value === null || value === undefined || value === false) {
                            return null;
                          }

                          return (
                            <div key={field.key} className="grid grid-cols-1 gap-1 sm:grid-cols-[8rem_1fr] sm:gap-2">
                              <dt className="text-slate-500">{field.label}</dt>
                              <dd>
                                <p>{String(value)}</p>
                                {field.why ? <p className="mt-1 text-xs text-slate-500">{field.why}</p> : null}
                                {field.howToUse ? <p className="mt-1 text-xs text-slate-400">使い方: {field.howToUse}</p> : null}
                              </dd>
                            </div>
                          );
                        })}
                    </dl>
                  ) : null}
                  {summary.context.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summary.context.slice(0, 2).map((entry) => (
                        <span key={`context-${item.id}-${entry.key}`} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-900">
                          {entry.label}: {entry.value}
                        </span>
                      ))}
                    </div>
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
                  {confirmDeleteId === item.id ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-medium text-red-800">この記録を削除しますか？</p>
                      <p className="mt-1 text-xs text-red-700">削除すると、この一覧から消えます。誤操作を防ぐため、もう一度確認しています。</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500"
                          onClick={() => deleteRecord(item.id)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? "削除中..." : "削除する"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setConfirmDeleteId("")}
                          disabled={deletingId === item.id}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
