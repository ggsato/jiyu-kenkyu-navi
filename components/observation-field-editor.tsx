"use client";

import { useEffect, useState, useTransition } from "react";
import { SectionTitle } from "@/components/ui";

export type EditableObservationField = {
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
  derivedFromKey: string | null;
  derivedFromLabel: string | null;
  isSelected: boolean;
};

type ObservationFieldEditorProps = {
  fields: EditableObservationField[];
  onSaved: (payload: {
    currentFields: EditableObservationField[];
    allFields: EditableObservationField[];
  }) => void;
};

function makeFieldKey(label: string, existingKeys: string[]) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  const base = normalized || "custom_field";

  if (!existingKeys.includes(base)) {
    return base;
  }

  let index = 2;
  let candidate = `${base}_${index}`;

  while (existingKeys.includes(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }

  return candidate;
}

export function ObservationFieldEditor({ fields, onSaved }: ObservationFieldEditorProps) {
  const [draftFields, setDraftFields] = useState(fields);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");
  const [customError, setCustomError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [customField, setCustomField] = useState({
    label: "",
    type: "text" as EditableObservationField["type"],
    role: "optional" as EditableObservationField["role"],
    unit: "",
    optionsText: "",
    why: "",
    howToUse: "",
    derivedFromKey: "",
  });

  useEffect(() => {
    setDraftFields(fields);
  }, [fields]);

  function updateField(key: string, patch: Partial<EditableObservationField>) {
    setDraftFields((current) =>
      current.map((field) => (field.key === key ? { ...field, ...patch } : field)),
    );
  }

  function addCustomField() {
    setCustomError("");
    const label = customField.label.trim();

    if (!label) {
      setCustomError("項目名を入れてください");
      return;
    }

    if (draftFields.some((field) => field.label.trim() === label)) {
      setCustomError("同じ名前の項目があります");
      return;
    }

    const options = customField.type === "select"
      ? customField.optionsText.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    if (customField.type === "select" && options.length < 2) {
      setCustomError("選ぶ項目は選択肢を2つ以上入れてください");
      return;
    }

    const key = makeFieldKey(label, draftFields.map((field) => field.key));
    const parent = draftFields.find((field) => field.key === customField.derivedFromKey);
    setDraftFields((current) => [
      ...current,
      {
        id: `new-${key}`,
        key,
        label,
        type: customField.type,
        unit: customField.unit.trim() || null,
        options,
        role: customField.role,
        why: customField.why.trim() || null,
        howToUse: customField.howToUse.trim() || null,
        isDefault: false,
        derivedFromKey: parent?.key || null,
        derivedFromLabel: parent?.label || null,
        isSelected: true,
      },
    ]);
    setCustomField({
      label: "",
      type: "text",
      role: "optional",
      unit: "",
      optionsText: "",
      why: "",
      howToUse: "",
      derivedFromKey: "",
    });
    setIsAdding(false);
  }

  function saveFields() {
    setError("");

    const hasSelected = draftFields.some((field) => field.isSelected);

    if (!hasSelected) {
      setError("この問いで使う項目を1件以上選んでください");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/questions/active/field-definitions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_definitions: draftFields.map((field) => ({
            key: field.key,
            label: field.label.trim(),
            type: field.type,
            unit: field.unit,
            options: field.type === "select" ? field.options : [],
            role: field.role,
            why: field.why,
            how_to_use: field.howToUse,
            is_default: field.isDefault,
            is_selected: field.isSelected,
            derived_from_key: field.derivedFromKey,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "記録項目を更新できませんでした");
        return;
      }

      const payload = {
        currentFields: (data.current_fields || []) as EditableObservationField[],
        allFields: (data.all_fields || []) as EditableObservationField[],
      };
      setDraftFields(payload.allFields);
      onSaved(payload);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle>見方を育てる</SectionTitle>
        <button type="button" className="btn-secondary" onClick={() => setIsAdding((current) => !current)}>
          {isAdding ? "追加を閉じる" : "項目を足す"}
        </button>
      </div>
      <p className="text-sm text-slate-600">
        問いはそのままにして、今見る項目や名前を育てられます。保存済みの記録本文は書き換えず、項目の見方だけを更新します。
      </p>

      <div className="space-y-3">
        {draftFields.map((field) => (
          <div key={field.key} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={field.isSelected}
                  onChange={(event) => updateField(field.key, { isSelected: event.target.checked })}
                />
                この問いで使う
              </label>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{field.role}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{field.type}</span>
                {field.derivedFromLabel ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-900">細分化元: {field.derivedFromLabel}</span> : null}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="field-label">項目名</label>
                <input value={field.label} onChange={(event) => updateField(field.key, { label: event.target.value })} />
              </div>
              <div>
                <label className="field-label">役割</label>
                <select value={field.role} onChange={(event) => updateField(field.key, { role: event.target.value as EditableObservationField["role"] })}>
                  <option value="core">まず残す</option>
                  <option value="compare">違いを見る</option>
                  <option value="optional">気になったら足す</option>
                </select>
              </div>
              <div>
                <label className="field-label">単位</label>
                <input value={field.unit || ""} onChange={(event) => updateField(field.key, { unit: event.target.value || null })} />
              </div>
              <div>
                <label className="field-label">選択肢</label>
                <input
                  value={field.options.join(", ")}
                  disabled={field.type !== "select"}
                  onChange={(event) =>
                    updateField(field.key, {
                      options: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
              <div>
                <label className="field-label">何を見るためか</label>
                <input value={field.why || ""} onChange={(event) => updateField(field.key, { why: event.target.value || null })} />
              </div>
              <div>
                <label className="field-label">あとでどう使うか</label>
                <input value={field.howToUse || ""} onChange={(event) => updateField(field.key, { howToUse: event.target.value || null })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-slate-900">新しい項目を追加</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label className="field-label">項目名</label>
              <input value={customField.label} onChange={(event) => setCustomField((current) => ({ ...current, label: event.target.value }))} />
            </div>
            <div>
              <label className="field-label">入力型</label>
              <select value={customField.type} onChange={(event) => setCustomField((current) => ({ ...current, type: event.target.value as EditableObservationField["type"] }))}>
                <option value="text">短く書く</option>
                <option value="number">数で入れる</option>
                <option value="boolean">はい/いいえ</option>
                <option value="select">選ぶ</option>
              </select>
            </div>
            <div>
              <label className="field-label">役割</label>
              <select value={customField.role} onChange={(event) => setCustomField((current) => ({ ...current, role: event.target.value as EditableObservationField["role"] }))}>
                <option value="core">まず残す</option>
                <option value="compare">違いを見る</option>
                <option value="optional">気になったら足す</option>
              </select>
            </div>
            <div>
              <label className="field-label">細分化元</label>
              <select value={customField.derivedFromKey} onChange={(event) => setCustomField((current) => ({ ...current, derivedFromKey: event.target.value }))}>
                <option value="">なし</option>
                {draftFields.filter((field) => !field.derivedFromKey).map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">単位</label>
              <input value={customField.unit} onChange={(event) => setCustomField((current) => ({ ...current, unit: event.target.value }))} />
            </div>
            <div>
              <label className="field-label">選択肢</label>
              <input value={customField.optionsText} onChange={(event) => setCustomField((current) => ({ ...current, optionsText: event.target.value }))} placeholder="速い, ふつう, おそい" />
            </div>
            <div>
              <label className="field-label">何を見るためか</label>
              <input value={customField.why} onChange={(event) => setCustomField((current) => ({ ...current, why: event.target.value }))} />
            </div>
            <div>
              <label className="field-label">あとでどう使うか</label>
              <input value={customField.howToUse} onChange={(event) => setCustomField((current) => ({ ...current, howToUse: event.target.value }))} />
            </div>
          </div>
          {customError ? <p className="mt-3 text-sm text-red-600">{customError}</p> : null}
          <div className="mt-3 flex gap-3">
            <button type="button" className="btn-primary" onClick={addCustomField}>追加する</button>
            <button type="button" className="btn-secondary" onClick={() => setIsAdding(false)}>閉じる</button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="button" className="btn-primary w-full md:w-auto" onClick={saveFields} disabled={isPending}>
        {isPending ? "更新中..." : "見方を更新する"}
      </button>
    </div>
  );
}
