"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Card, LoadingBlock, SectionTitle } from "@/components/ui";
import { ObservationFieldEditor, type EditableObservationField } from "@/components/observation-field-editor";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";
import { sortVisualizationFields } from "@/lib/record-visualization";

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
  isPrimaryMetric?: boolean;
  parentLabel: string | null;
};

type RecordAttachment = {
  id: string;
  storageKey: string;
  mimeType: string;
};

type RecordItem = {
  id: string;
  recordedAt: string;
  body: string;
  memo: string | null;
  kvFields: Record<string, unknown>;
  tags: string[];
  attachments: RecordAttachment[];
};

type RecordDraft = {
  recordedAt: string;
  memo: string;
  kvFields: Record<string, string | number | boolean | null>;
  selectedFiles: File[];
  existingAttachments: RecordAttachment[];
};

type EditorState =
  | { kind: "closed" }
  | { kind: "record"; mode: "create" | "edit"; recordId?: string }
  | { kind: "fields" };

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

function createEmptyKvFields(fields: FieldDefinition[]) {
  return Object.fromEntries(
    sortFieldDefinitions(fields).map((field) => [field.key, field.type === "boolean" ? false : ""]),
  ) as Record<string, string | number | boolean | null>;
}

function createEmptyDraft(fields: FieldDefinition[]): RecordDraft {
  return {
    recordedAt: toLocalDateTimeInputValue(new Date()),
    memo: "",
    kvFields: createEmptyKvFields(fields),
    selectedFiles: [],
    existingAttachments: [],
  };
}

function toDraftValue(field: FieldDefinition, value: unknown) {
  if (field.type === "boolean") {
    return Boolean(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  return value as string | number;
}

function createEditDraft(record: RecordItem, fields: FieldDefinition[]): RecordDraft {
  const kvFields = createEmptyKvFields(fields);

  for (const field of fields) {
    kvFields[field.key] = toDraftValue(field, record.kvFields[field.key]);
  }

  return {
    recordedAt: toLocalDateTimeInputValue(new Date(record.recordedAt)),
    memo: record.memo || "",
    kvFields,
    selectedFiles: [],
    existingAttachments: record.attachments,
  };
}

function summarizeBodyText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function hasMeaningfulValue(value: string | number | boolean | null | undefined) {
  return value !== "" && value !== null && value !== undefined && value !== false;
}

function displayFieldValue(field: FieldDefinition, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "ー";
  }

  if (field.type === "boolean") {
    return value ? "はい" : "ー";
  }

  return String(value);
}

function normalizeKvFieldsForSave(fields: FieldDefinition[], values: Record<string, string | number | boolean | null>) {
  return Object.fromEntries(
    fields.map((field) => {
      const value = values[field.key];

      if (field.type === "number") {
        if (value === "" || value === null || value === undefined) {
          return [field.key, null];
        }

        return [field.key, typeof value === "number" ? value : Number(value)];
      }

      if (field.type === "boolean") {
        return [field.key, Boolean(value)];
      }

      return [field.key, value ?? ""];
    }),
  );
}

function buildRecordBody(
  fields: FieldDefinition[],
  kvFields: Record<string, string | number | boolean | null>,
  memo: string,
) {
  const parts = fields
    .map((field) => {
      const value = kvFields[field.key];

      if (!hasMeaningfulValue(value)) {
        return null;
      }

      if (field.type === "boolean") {
        return `${field.label}: はい`;
      }

      return `${field.label}: ${String(value)}`;
    })
    .filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    const summaryParts: string[] = [];

    for (const part of parts) {
      const nextText = summaryParts.length === 0 ? part : `${summaryParts.join(" / ")} / ${part}`;

      if (nextText.length > INPUT_LIMITS.record_body) {
        break;
      }

      summaryParts.push(part);
    }

    if (summaryParts.length === 0) {
      return summarizeBodyText(parts[0]!, INPUT_LIMITS.record_body);
    }

    if (summaryParts.length < parts.length) {
      const suffix = ` / ほか${parts.length - summaryParts.length}項目`;
      const withSuffix = `${summaryParts.join(" / ")}${suffix}`;

      if (withSuffix.length <= INPUT_LIMITS.record_body) {
        return withSuffix;
      }

      return summarizeBodyText(summaryParts.join(" / "), INPUT_LIMITS.record_body);
    }

    return summaryParts.join(" / ");
  }

  if (memo.trim()) {
    return summarizeBodyText(memo.trim(), INPUT_LIMITS.record_body);
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

export function RecordsClient({
  activeQuestionId,
  activeQuestionText,
  records,
  fieldDefinitions,
  allFieldDefinitions,
}: {
  activeQuestionId: string;
  activeQuestionText: string;
  records: RecordItem[];
  fieldDefinitions: FieldDefinition[];
  allFieldDefinitions: EditableObservationField[];
}) {
  const params = useSearchParams();
  const source = params.get("source") || "";
  const [items, setItems] = useState(records);
  const [currentFieldDefinitions, setCurrentFieldDefinitions] = useState(() => sortFieldDefinitions(fieldDefinitions));
  const [editableFieldDefinitions, setEditableFieldDefinitions] = useState(allFieldDefinitions);
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [draft, setDraft] = useState<RecordDraft>(() => createEmptyDraft(fieldDefinitions));
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [isPending, startTransition] = useTransition();

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((item) => item.recordedAt.slice(0, 10) === today).length;
  }, [items]);

  function closeEditor() {
    setEditor({ kind: "closed" });
    setDraft(createEmptyDraft(currentFieldDefinitions));
    setFileInputKey((current) => current + 1);
    setError("");
  }

  function openCreateEditor() {
    setError("");
    setSuccessMessage("");
    setEditor({ kind: "record", mode: "create" });
    setDraft(createEmptyDraft(currentFieldDefinitions));
    setFileInputKey((current) => current + 1);
  }

  function openEditEditor(record: RecordItem) {
    setError("");
    setSuccessMessage("");
    setEditor({ kind: "record", mode: "edit", recordId: record.id });
    setDraft(createEditDraft(record, currentFieldDefinitions));
    setFileInputKey((current) => current + 1);
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

    return data.attachment as RecordAttachment;
  }

  function updateDraftField(key: string, value: string | number | boolean | null) {
    setDraft((current) => ({
      ...current,
      kvFields: {
        ...current.kvFields,
        [key]: value,
      },
    }));
  }

  async function saveRecord() {
    if (editor.kind !== "record") {
      return;
    }

    setError("");
    setSuccessMessage("");

    const payload = {
      recorded_at: new Date(draft.recordedAt).toISOString(),
      body: buildRecordBody(currentFieldDefinitions, draft.kvFields, draft.memo),
      memo: draft.memo,
      kv_fields: normalizeKvFieldsForSave(currentFieldDefinitions, draft.kvFields),
      tags: [],
    };

    startTransition(async () => {
      const response = await fetch(
        editor.mode === "create" ? "/api/records" : `/api/records/${editor.recordId}`,
        {
          method: editor.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editor.mode === "create"
              ? {
                  question_id: activeQuestionId,
                  source,
                  ...payload,
                }
              : payload,
          ),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || (editor.mode === "create" ? "記録できませんでした" : "記録を更新できませんでした"));
        return;
      }

      let nextRecord = data.record as RecordItem;

      try {
        if (draft.selectedFiles.length > 0) {
          const attachments = [...draft.existingAttachments];

          for (const file of draft.selectedFiles) {
            const attachment = await uploadAttachment(nextRecord.id, file);
            attachments.push(attachment);
          }

          nextRecord = {
            ...nextRecord,
            attachments,
          };
        }
      } catch (attachmentError) {
        setError(attachmentError instanceof Error ? attachmentError.message : "画像を保存できませんでした");
      }

      setItems((current) => {
        const others = current.filter((item) => item.id !== nextRecord.id);
        return sortRecordsByRecordedAt([nextRecord, ...others]);
      });
      setSuccessMessage(editor.mode === "create" ? "記録を追加しました。" : "記録を更新しました。");
      closeEditor();
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
    <div className="relative">
      <div className="grid gap-4">
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <SectionTitle>記録</SectionTitle>
              <p className="mt-2 text-sm text-slate-600">この問いで使っている項目を表で見ながら、生の記録を追加・修正します。</p>
              <p className="mt-3 text-base font-medium text-slate-900">{activeQuestionText || "まずは問いを作ろう"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-mint px-3 py-1 text-sm text-slate-700">今日 {todayCount} 件</span>
              <button type="button" className="btn-secondary" onClick={() => setEditor({ kind: "fields" })} disabled={!activeQuestionId}>
                項目を編集
              </button>
              <button type="button" className="btn-primary" onClick={openCreateEditor} disabled={!activeQuestionId}>
                記録を追加
              </button>
            </div>
          </div>
          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {successMessage ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</p> : null}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 font-medium">記録日時</th>
                  {currentFieldDefinitions.map((field) => (
                    <th key={field.id} className="border-b border-slate-200 px-4 py-3 font-medium">
                      <div>
                        <p>{field.label}{field.unit ? ` (${field.unit})` : ""}</p>
                        {field.why ? <p className="mt-1 text-xs font-normal text-slate-500">{field.why}</p> : null}
                      </div>
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-4 py-3 font-medium">メモ</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-medium">画像</th>
                  <th className="border-b border-slate-200 px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={currentFieldDefinitions.length + 4} className="px-4 py-8 text-center text-slate-600">
                      まだ記録はありません。右上の「記録を追加」から始めます。
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-600">
                        {new Date(item.recordedAt).toLocaleString("ja-JP")}
                      </td>
                      {currentFieldDefinitions.map((field) => (
                        <td key={`${item.id}-${field.id}`} className="border-b border-slate-100 px-4 py-3 text-slate-800">
                          {displayFieldValue(field, item.kvFields[field.key])}
                        </td>
                      ))}
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                        {item.memo ? <p className="max-w-[20rem] whitespace-pre-wrap">{item.memo}</p> : "ー"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        {item.attachments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {item.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={`/${attachment.storageKey.replace(/^public\//, "")}`}
                                target="_blank"
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                                rel="noreferrer"
                              >
                                画像
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">ー</span>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700" onClick={() => openEditEditor(item)}>
                            編集
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                            onClick={() => setConfirmDeleteId((current) => (current === item.id ? "" : item.id))}
                            disabled={deletingId === item.id}
                          >
                            {confirmDeleteId === item.id ? "削除確認を閉じる" : "削除"}
                          </button>
                        </div>
                        {confirmDeleteId === item.id ? (
                          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3">
                            <p className="text-xs font-medium text-red-800">この記録を削除しますか？</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                                onClick={() => deleteRecord(item.id)}
                                disabled={deletingId === item.id}
                              >
                                {deletingId === item.id ? "削除中..." : "削除する"}
                              </button>
                              <button type="button" className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700" onClick={() => setConfirmDeleteId("")}>
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {editor.kind !== "closed" ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 px-4 md:absolute md:right-0 md:top-4 md:inset-x-auto md:bottom-auto md:w-[30rem]">
          <Card className="pointer-events-auto max-h-[85vh] overflow-y-auto border-amber-200 shadow-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <SectionTitle>
                  {editor.kind === "fields"
                    ? "項目を編集"
                    : editor.mode === "create"
                      ? "新しい記録"
                      : "記録を編集"}
                </SectionTitle>
                <p className="mt-2 text-sm text-slate-600">
                  {editor.kind === "fields"
                    ? "表に出す項目と意味づけをここで直します。保存すると列にも反映されます。"
                    : "表を見たまま、記録の中身を追加または修正します。"}
                </p>
              </div>
              <button type="button" className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700" onClick={closeEditor}>
                閉じる
              </button>
            </div>

            {editor.kind === "fields" ? (
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
                  setCurrentFieldDefinitions(sortedCurrentFields);
                  setDraft(createEmptyDraft(sortedCurrentFields));
                  setSuccessMessage("項目を更新しました。");
                  setEditor({ kind: "closed" });
                }}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="field-label">いつの記録か</label>
                  <p className="mb-2 text-xs text-slate-500">時間情報は基本項目です。あとで並び替えや流れを見るときの基準になります。</p>
                  <input type="datetime-local" value={draft.recordedAt} onChange={(event) => setDraft((current) => ({ ...current, recordedAt: event.target.value }))} />
                </div>
                <div>
                  <label className="field-label">今回使う項目</label>
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
                            value={String(draft.kvFields[field.key] ?? "")}
                            onChange={(event) => updateDraftField(field.key, event.target.value)}
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
                              checked={Boolean(draft.kvFields[field.key])}
                              onChange={(event) => updateDraftField(field.key, event.target.checked)}
                            />
                            はい
                          </label>
                        ) : (
                          <input
                            type={field.type === "number" ? "number" : "text"}
                            value={String(draft.kvFields[field.key] ?? "")}
                            onChange={(event) =>
                              updateDraftField(
                                field.key,
                                field.type === "number"
                                  ? (event.target.value === "" ? "" : Number(event.target.value))
                                  : event.target.value,
                              )
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
                  <p className="mb-2 text-xs text-slate-500">表の項目に入りきらない補足だけを短く残します。</p>
                  <textarea
                    maxLength={INPUT_LIMITS.record_memo}
                    rows={3}
                    value={draft.memo}
                    onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))}
                  />
                  <p className="mt-1 text-xs text-slate-500">{limitLabel(draft.memo.length, INPUT_LIMITS.record_memo)}</p>
                </div>
                <div>
                  <label className="field-label">画像を追加</label>
                  <p className="mb-2 text-xs text-slate-500">jpg / png / webp を3枚まで追加できます。1枚10MBまでです。</p>
                  {draft.existingAttachments.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {draft.existingAttachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={`/${attachment.storageKey.replace(/^public\//, "")}`}
                          target="_blank"
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                          rel="noreferrer"
                        >
                          既存画像
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) => {
                      const files = Array.from(event.target.files || []).slice(0, 3);
                      setDraft((current) => ({ ...current, selectedFiles: files }));
                    }}
                  />
                  {draft.selectedFiles.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm text-slate-600">
                      {draft.selectedFiles.map((file) => (
                        <li key={`${file.name}-${file.size}`}>{file.name}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button type="button" className="btn-primary w-full" onClick={saveRecord} disabled={isPending || !activeQuestionId}>
                  {isPending ? "保存中..." : editor.mode === "create" ? "記録を保存" : "変更を保存"}
                </button>
                {isPending ? (
                  <LoadingBlock
                    title={editor.mode === "create" ? "記録を保存しています" : "記録を更新しています"}
                    description="表を見比べながら使えるように、生の記録データを反映しています。"
                  />
                ) : null}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
