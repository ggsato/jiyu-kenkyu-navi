"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, LoadingBlock, Pill, SectionTitle } from "@/components/ui";
import { INPUT_LIMITS, limitLabel } from "@/lib/input-limits";
import { getPrimaryPurposeFocusOption, normalizePurposeFocus } from "@/lib/purpose-focus";

type Candidate = {
  text: string;
  shape_label: string;
  purpose_hint: string;
  why_this_question: string;
};

type FieldCandidate = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  unit: string | null;
  options: string[];
  role: "core" | "compare" | "optional";
  why: string | null;
  how_to_use?: string | null;
  is_default: boolean;
  derived_from_key?: string | null;
  is_custom?: boolean;
};

type QuestionCandidatesResponse = {
  candidates?: Candidate[];
  questions?: string[];
  error?: string;
};

type RecordFieldSuggestionsResponse = {
  suggested_fields?: FieldCandidate[];
  selected_existing_keys?: string[];
  split_existing_keys?: string[];
  fallback_message?: string;
  error?: string;
};

type SplitFieldSuggestionsResponse = {
  split_candidates?: FieldCandidate[];
  error?: string;
};

type QuestionFormState = {
  wish_id: string;
  wish_text: string;
  reason: string;
  current_state: string;
  not_yet: string;
  desired_state: string;
  next_curiosity_text: string;
  question_text: string;
  purpose_focus: string;
};

const STORAGE_KEY_PREFIX = "jiyu-kenkyu-navi-question-form";
const CANDIDATES_STORAGE_KEY_PREFIX = "jiyu-kenkyu-navi-question-candidates";
const FIELD_CONFIG_STORAGE_KEY_PREFIX = "jiyu-kenkyu-navi-question-field-config";

function formStorageKey(mode: "continue" | "new") {
  return `${STORAGE_KEY_PREFIX}-${mode}`;
}

function candidateStorageKey(mode: "continue" | "new") {
  return `${CANDIDATES_STORAGE_KEY_PREFIX}-${mode}`;
}

function fieldConfigStorageKey(mode: "continue" | "new") {
  return `${FIELD_CONFIG_STORAGE_KEY_PREFIX}-${mode}`;
}

function isSameContinueWish(savedForm: QuestionFormState, continueTemplate: QuestionFormState) {
  return Boolean(savedForm.wish_id) && savedForm.wish_id === continueTemplate.wish_id;
}

function roleMeta(role: FieldCandidate["role"]) {
  if (role === "compare") {
    return {
      title: "違いを見る",
      description: "あとで比べたいときに足す項目",
    };
  }

  if (role === "optional") {
    return {
      title: "気になったら足す",
      description: "問いが育ってきたら使う項目",
    };
  }

  return {
    title: "まず残す",
    description: "最初の記録で持っておきたい項目",
  };
}

function fieldTypeLabel(type: FieldCandidate["type"]) {
  if (type === "select") {
    return "選ぶ";
  }

  if (type === "boolean") {
    return "はい/いいえ";
  }

  if (type === "number") {
    return "数で入れる";
  }

  return "短く書く";
}

function candidateShapeMeta(shapeLabel: string) {
  if (shapeLabel.includes("くらべ")) {
    return {
      className: "bg-sky-100 text-sky-900",
      label: shapeLabel,
    };
  }

  if (shapeLabel.includes("小さ")) {
    return {
      className: "bg-emerald-100 text-emerald-900",
      label: shapeLabel,
    };
  }

  return {
    className: "bg-amber-100 text-amber-900",
    label: shapeLabel,
  };
}

function getDefaultSelectedFieldKeys(fields: FieldCandidate[], preferredKeys: string[] = []) {
  const preferred = preferredKeys.filter((key) => fields.some((field) => field.key === key));

  if (preferred.length > 0) {
    return preferred;
  }

  const explicitDefaults = fields.filter((field) => field.is_default).map((field) => field.key);

  if (explicitDefaults.length > 0) {
    return explicitDefaults;
  }

  return fields
    .filter((field) => field.role === "core")
    .slice(0, 2)
    .map((field) => field.key);
}

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

export function QuestionsClient({
  continueTemplate,
  newTemplate,
  initialMode,
  hasActiveWish,
  forceTemplate,
  preferredFieldKeys,
  continueSummary,
}: {
  continueTemplate: QuestionFormState;
  newTemplate: QuestionFormState;
  initialMode: "continue" | "new";
  hasActiveWish: boolean;
  forceTemplate: boolean;
  preferredFieldKeys: string[];
  continueSummary: {
    wish_text: string;
    reason: string;
    before_current_state: string;
    before_not_yet: string;
    before_desired_state: string;
    after_current_state: string;
    after_not_yet: string;
    after_desired_state: string;
  } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"continue" | "new">(initialMode);
  const [form, setForm] = useState<QuestionFormState>(() => {
    if (typeof window === "undefined") {
      return initialMode === "continue" ? continueTemplate : newTemplate;
    }

    if (forceTemplate && initialMode === "continue") {
      window.sessionStorage.setItem(formStorageKey("continue"), JSON.stringify(continueTemplate));
      window.sessionStorage.removeItem(candidateStorageKey("continue"));
      window.sessionStorage.removeItem(fieldConfigStorageKey("continue"));
      return continueTemplate;
    }

    const saved = window.sessionStorage.getItem(formStorageKey(initialMode));

    if (!saved) {
      return initialMode === "continue" ? continueTemplate : newTemplate;
    }

    try {
      const parsed = JSON.parse(saved) as QuestionFormState;

      if (initialMode === "continue" && !isSameContinueWish(parsed, continueTemplate)) {
        window.sessionStorage.removeItem(formStorageKey("continue"));
        window.sessionStorage.removeItem(candidateStorageKey("continue"));
        window.sessionStorage.removeItem(fieldConfigStorageKey("continue"));
        return continueTemplate;
      }

      return parsed;
    } catch {
      window.sessionStorage.removeItem(formStorageKey(initialMode));
      return initialMode === "continue" ? continueTemplate : newTemplate;
    }
  });
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    if (forceTemplate && initialMode === "continue") {
      return [];
    }

    const saved = window.sessionStorage.getItem(candidateStorageKey(initialMode));

    if (!saved) {
      return [];
    }

    try {
      return JSON.parse(saved) as Candidate[];
    } catch {
      window.sessionStorage.removeItem(candidateStorageKey(initialMode));
      return [];
    }
  });
  const [fieldCandidates, setFieldCandidates] = useState<FieldCandidate[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved = window.sessionStorage.getItem(fieldConfigStorageKey(initialMode));

    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved) as { fieldCandidates?: FieldCandidate[] };
      return parsed.fieldCandidates || [];
    } catch {
      window.sessionStorage.removeItem(fieldConfigStorageKey(initialMode));
      return [];
    }
  });
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved = window.sessionStorage.getItem(fieldConfigStorageKey(initialMode));

    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved) as { selectedFieldKeys?: string[] };
      return parsed.selectedFieldKeys || [];
    } catch {
      window.sessionStorage.removeItem(fieldConfigStorageKey(initialMode));
      return [];
    }
  });
  const [splitSuggestedKeys, setSplitSuggestedKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const saved = window.sessionStorage.getItem(fieldConfigStorageKey(initialMode));

    if (!saved) {
      return [];
    }

    try {
      const parsed = JSON.parse(saved) as { splitSuggestedKeys?: string[] };
      return parsed.splitSuggestedKeys || [];
    } catch {
      window.sessionStorage.removeItem(fieldConfigStorageKey(initialMode));
      return [];
    }
  });
  const [splitCandidatesByParent, setSplitCandidatesByParent] = useState<Record<string, FieldCandidate[]>>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const saved = window.sessionStorage.getItem(fieldConfigStorageKey(initialMode));

    if (!saved) {
      return {};
    }

    try {
      const parsed = JSON.parse(saved) as { splitCandidatesByParent?: Record<string, FieldCandidate[]> };
      return parsed.splitCandidatesByParent || {};
    } catch {
      window.sessionStorage.removeItem(fieldConfigStorageKey(initialMode));
      return {};
    }
  });
  const [loadingSplitParentKey, setLoadingSplitParentKey] = useState("");
  const [isGenerating, startGenerating] = useTransition();
  const [isLoadingFields, startLoadingFields] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState("");
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [customFieldForm, setCustomFieldForm] = useState({
    label: "",
    type: "text" as FieldCandidate["type"],
    why: "",
    howToUse: "",
    optionsText: "",
    derivedFromKey: "",
  });
  const [customFieldError, setCustomFieldError] = useState("");
  const [highlightedSection, setHighlightedSection] = useState<"candidates" | "fields" | "">("");
  const candidatesSectionRef = useRef<HTMLElement | null>(null);
  const fieldsSectionRef = useRef<HTMLElement | null>(null);
  const previousCandidateCountRef = useRef(candidates.length);
  const previousFieldCountRef = useRef(fieldCandidates.length);

  useEffect(() => {
    window.sessionStorage.setItem(formStorageKey(mode), JSON.stringify(form));
  }, [form, mode]);

  useEffect(() => {
    window.sessionStorage.setItem(candidateStorageKey(mode), JSON.stringify(candidates));
  }, [candidates, mode]);

  useEffect(() => {
    window.sessionStorage.setItem(fieldConfigStorageKey(mode), JSON.stringify({ fieldCandidates, selectedFieldKeys, splitSuggestedKeys, splitCandidatesByParent }));
  }, [fieldCandidates, selectedFieldKeys, splitSuggestedKeys, splitCandidatesByParent, mode]);

  useEffect(() => {
    if (candidates.length > 0 && previousCandidateCountRef.current === 0) {
      window.setTimeout(() => {
        setHighlightedSection("candidates");
        candidatesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }

    previousCandidateCountRef.current = candidates.length;
  }, [candidates.length]);

  useEffect(() => {
    if (fieldCandidates.length > 0 && previousFieldCountRef.current === 0) {
      window.setTimeout(() => {
        setHighlightedSection("fields");
        fieldsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }

    previousFieldCountRef.current = fieldCandidates.length;
  }, [fieldCandidates.length]);

  useEffect(() => {
    if (!highlightedSection) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedSection("");
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [highlightedSection]);

  function templateForMode(nextMode: "continue" | "new") {
    return nextMode === "continue" ? continueTemplate : newTemplate;
  }

  function updateField(key: keyof QuestionFormState, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      window.sessionStorage.setItem(formStorageKey(mode), JSON.stringify(next));
      return next;
    });
  }

  function resetFieldSelection() {
    setFieldCandidates([]);
    setSelectedFieldKeys([]);
    setSplitSuggestedKeys([]);
    setSplitCandidatesByParent({});
    setLoadingSplitParentKey("");
    setIsAddingCustomField(false);
    setCustomFieldError("");
    setCustomFieldForm({
      label: "",
      type: "text",
      why: "",
      howToUse: "",
      optionsText: "",
      derivedFromKey: "",
    });
    window.sessionStorage.removeItem(fieldConfigStorageKey(mode));
  }

  function switchMode(nextMode: "continue" | "new") {
    setMode(nextMode);
    setError("");

    const savedForm = window.sessionStorage.getItem(formStorageKey(nextMode));
    const savedCandidates = window.sessionStorage.getItem(candidateStorageKey(nextMode));
    const savedFieldConfig = window.sessionStorage.getItem(fieldConfigStorageKey(nextMode));

    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm) as QuestionFormState;

        if (nextMode === "continue" && !isSameContinueWish(parsed, continueTemplate)) {
          window.sessionStorage.removeItem(formStorageKey("continue"));
          window.sessionStorage.removeItem(candidateStorageKey("continue"));
          window.sessionStorage.removeItem(fieldConfigStorageKey("continue"));
          setForm(continueTemplate);
        } else {
          setForm(parsed);
        }
      } catch {
        window.sessionStorage.removeItem(formStorageKey(nextMode));
        setForm(templateForMode(nextMode));
      }
    } else {
      setForm(templateForMode(nextMode));
    }

    if (savedCandidates) {
      try {
        setCandidates(JSON.parse(savedCandidates) as Candidate[]);
      } catch {
        window.sessionStorage.removeItem(candidateStorageKey(nextMode));
        setCandidates([]);
      }
    } else {
      setCandidates([]);
    }

    if (savedFieldConfig) {
      try {
        const parsed = JSON.parse(savedFieldConfig) as {
          fieldCandidates?: FieldCandidate[];
          selectedFieldKeys?: string[];
          splitSuggestedKeys?: string[];
          splitCandidatesByParent?: Record<string, FieldCandidate[]>;
        };
        setFieldCandidates(parsed.fieldCandidates || []);
        setSelectedFieldKeys(parsed.selectedFieldKeys || []);
        setSplitSuggestedKeys(parsed.splitSuggestedKeys || []);
        setSplitCandidatesByParent(parsed.splitCandidatesByParent || {});
      } catch {
        window.sessionStorage.removeItem(fieldConfigStorageKey(nextMode));
        setFieldCandidates([]);
        setSelectedFieldKeys([]);
        setSplitSuggestedKeys([]);
        setSplitCandidatesByParent({});
      }
    } else {
      setFieldCandidates([]);
      setSelectedFieldKeys([]);
      setSplitSuggestedKeys([]);
      setSplitCandidatesByParent({});
    }
  }

  function generateCandidates() {
    setError("");
    resetFieldSelection();

    startGenerating(async () => {
      const response = await fetch("/api/ai/question-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as QuestionCandidatesResponse;
      const nextCandidates = Array.isArray(data.candidates)
        ? data.candidates
        : Array.isArray(data.questions)
          ? data.questions.map((question) => ({
              text: question,
              shape_label: "小さくする",
              purpose_hint: "compare",
              why_this_question: "まずは問いに答える材料を集めるため",
            }))
          : [];

      setCandidates(nextCandidates);
      window.sessionStorage.setItem(candidateStorageKey(mode), JSON.stringify(nextCandidates));

      if (data.error) {
        setError(data.error);
      }
    });
  }

  function loadFieldCandidates(questionText: string, purposeFocus: string) {
    setError("");

    startLoadingFields(async () => {
      const response = await fetch("/api/ai/record-fields/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wish_id: form.wish_id || undefined,
          question_text: questionText,
          purpose_focus: purposeFocus,
          wish_text: form.wish_text,
          reason: form.reason,
          current_state: form.current_state,
          not_yet: form.not_yet,
          desired_state: form.desired_state,
          existing_kv_keys: [],
        }),
      });

      const data = (await response.json()) as RecordFieldSuggestionsResponse;
      const nextFieldCandidates = Array.isArray(data.suggested_fields) ? data.suggested_fields : [];
      const aiPreferredKeys = Array.isArray(data.selected_existing_keys) ? data.selected_existing_keys : [];
      const nextSplitSuggestedKeys = Array.isArray(data.split_existing_keys) ? data.split_existing_keys : [];
      const mergedPreferredKeys = mode === "continue"
        ? Array.from(new Set([...aiPreferredKeys, ...preferredFieldKeys]))
        : aiPreferredKeys;
      setFieldCandidates(nextFieldCandidates);
      setSplitSuggestedKeys(nextSplitSuggestedKeys);
      setSelectedFieldKeys(
        getDefaultSelectedFieldKeys(
          nextFieldCandidates,
          mergedPreferredKeys,
        ),
      );
    });
  }

  function selectCandidate(candidate: Candidate) {
    const normalizedPurpose = normalizePurposeFocus(candidate.purpose_hint);
    const nextForm = {
      ...form,
      question_text: candidate.text,
      purpose_focus: normalizedPurpose,
    };

    setForm(nextForm);
    window.sessionStorage.setItem(formStorageKey(mode), JSON.stringify(nextForm));
    loadFieldCandidates(candidate.text, normalizedPurpose);
  }

  function toggleFieldSelection(key: string) {
    setSelectedFieldKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function addCustomField() {
    setCustomFieldError("");

    const label = customFieldForm.label.trim();

    if (!label) {
      setCustomFieldError("項目名を入れてください");
      return;
    }

    const duplicateLabel = fieldCandidates.some((field) => field.label.trim() === label);

    if (duplicateLabel) {
      setCustomFieldError("同じ名前の項目があります");
      return;
    }

    const options = customFieldForm.type === "select"
      ? customFieldForm.optionsText
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (customFieldForm.type === "select" && options.length < 2) {
      setCustomFieldError("選ぶ項目は選択肢を2つ以上入れてください");
      return;
    }

    const key = makeFieldKey(label, fieldCandidates.map((field) => field.key));
    const nextField: FieldCandidate = {
      key,
      label,
      type: customFieldForm.type,
      unit: null,
      options,
      role: "optional",
      why: customFieldForm.why.trim() || null,
      how_to_use: customFieldForm.howToUse.trim() || null,
      is_default: false,
      derived_from_key: null,
      is_custom: true,
    };

    if (customFieldForm.derivedFromKey) {
      nextField.derived_from_key = customFieldForm.derivedFromKey;
    }

    setFieldCandidates((current) => [...current, nextField]);
    setSelectedFieldKeys((current) => [...current, key]);
    setCustomFieldForm({
      label: "",
      type: "text",
      why: "",
      howToUse: "",
      optionsText: "",
      derivedFromKey: "",
    });
    setIsAddingCustomField(false);
  }

  function startSplitField(field: FieldCandidate) {
    setCustomFieldError("");
    const existingSuggestion = splitCandidatesByParent[field.key];

    if (existingSuggestion && existingSuggestion.length > 0) {
      return;
    }

    setLoadingSplitParentKey(field.key);

    void fetch("/api/ai/record-fields/split-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wish_id: form.wish_id || undefined,
        question_text: form.question_text,
        purpose_focus: form.purpose_focus,
        wish_text: form.wish_text,
        parent_field_key: field.key,
        parent_field_label: field.label,
        parent_field_type: field.type,
        parent_field_why: field.why || "",
        existing_kv_keys: fieldCandidates.map((candidate) => candidate.key),
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as SplitFieldSuggestionsResponse;
        const nextCandidates = Array.isArray(data.split_candidates) ? data.split_candidates : [];
        setSplitCandidatesByParent((current) => ({
          ...current,
          [field.key]: nextCandidates,
        }));
      })
      .catch(() => {
        setSplitCandidatesByParent((current) => ({
          ...current,
          [field.key]: [],
        }));
      })
      .finally(() => {
        setLoadingSplitParentKey((current) => (current === field.key ? "" : current));
      });
  }

  function applySplitCandidate(parentField: FieldCandidate, candidate: FieldCandidate) {
    const key = makeFieldKey(candidate.label, fieldCandidates.map((field) => field.key));
    const nextField: FieldCandidate = {
      ...candidate,
      key,
      unit: candidate.unit || null,
      options: candidate.options || [],
      role: candidate.role || "optional",
      why: candidate.why || null,
      how_to_use: candidate.how_to_use || null,
      is_default: false,
      derived_from_key: parentField.key,
      is_custom: true,
    };

    setFieldCandidates((current) => [...current, nextField]);
    setSelectedFieldKeys((current) => Array.from(new Set([...current, key])));
    setSplitCandidatesByParent((current) => ({
      ...current,
      [parentField.key]: (current[parentField.key] || []).filter((item) => item.label !== candidate.label),
    }));
  }

  function saveQuestion() {
    setError("");

    startSaving(async () => {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          wish_id: mode === "continue" ? form.wish_id || undefined : undefined,
          field_definitions: fieldCandidates.map((field) => ({
            ...field,
            is_selected: selectedFieldKeys.includes(field.key),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "保存できませんでした");
        return;
      }

      window.sessionStorage.removeItem(formStorageKey(mode));
      window.sessionStorage.removeItem(candidateStorageKey(mode));
      window.sessionStorage.removeItem(fieldConfigStorageKey(mode));
      router.push("/");
      router.refresh();
    });
  }

  const groupedFieldCandidates = {
    core: fieldCandidates.filter((field) => field.role === "core"),
    compare: fieldCandidates.filter((field) => field.role === "compare"),
    optional: fieldCandidates.filter((field) => field.role === "optional"),
  };
  const selectedFields = fieldCandidates.filter((field) => selectedFieldKeys.includes(field.key));
  const inactiveFields = fieldCandidates.filter((field) => !selectedFieldKeys.includes(field.key));

  function renderFieldCard(field: FieldCandidate) {
    const selected = selectedFieldKeys.includes(field.key);
    const meta = roleMeta(field.role);
    const splitChildCandidates = fieldCandidates.filter((candidate) => candidate.derived_from_key === field.key);
    const splitSuggestions = splitCandidatesByParent[field.key] || [];
    const isLoadingSplitSuggestions = loadingSplitParentKey === field.key;

    return (
      <div
        key={field.key}
        className={`rounded-2xl border p-4 transition ${
          selected ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <button type="button" className="w-full text-left" onClick={() => toggleFieldSelection(field.key)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">
                {field.label}
                {field.unit ? ` (${field.unit})` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">{fieldTypeLabel(field.type)}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">{meta.title}</span>
              {field.is_default ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">初期選択</span> : null}
              {field.is_custom ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">自分で追加</span> : null}
              {splitSuggestedKeys.includes(field.key) ? <span className="rounded-full bg-white px-3 py-1 text-xs text-amber-800">細かく分ける候補</span> : null}
              {field.derived_from_key ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">細分化項目</span> : null}
              <span className={`rounded-full px-3 py-1 text-xs ${selected ? "bg-amber-200 text-amber-950" : "bg-slate-100 text-slate-700"}`}>{selected ? "今回使う" : "今回は休む"}</span>
            </div>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-700">{meta.description}</p>
          <p className="mt-2 text-sm text-slate-600">{field.why || "この項目があると、あとで見比べやすくなります。"}</p>
          {field.derived_from_key ? (
            <p className="mt-2 text-xs text-amber-800">
              細分化元: {fieldCandidates.find((candidate) => candidate.key === field.derived_from_key)?.label || field.derived_from_key}
            </p>
          ) : null}
          {field.how_to_use ? <p className="mt-2 text-xs text-slate-500">使い方: {field.how_to_use}</p> : null}
          {field.type === "select" && field.options.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">例: {field.options.join(" / ")}</p>
          ) : null}
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
            onClick={() => startSplitField(field)}
          >
            この項目を細かく分ける
          </button>
          {splitChildCandidates.length > 0 ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs text-amber-800">
              子項目候補: {splitChildCandidates.map((candidate) => candidate.label).join(" / ")}
            </span>
          ) : null}
        </div>
        {isLoadingSplitSuggestions ? (
          <p className="mt-3 text-xs text-slate-500">AI がこの項目の子項目候補を考えています...</p>
        ) : null}
        {splitSuggestions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {splitSuggestions.map((candidate) => (
              <div key={`${field.key}-${candidate.label}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-amber-900">{candidate.label}</p>
                    {candidate.why ? <p className="mt-1 text-xs text-amber-900/80">{candidate.why}</p> : null}
                    {candidate.how_to_use ? <p className="mt-1 text-xs text-slate-600">使い方: {candidate.how_to_use}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-900"
                    onClick={() => applySplitCandidate(field, candidate)}
                  >
                    追加する
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Card>
        <SectionTitle>問いを作る</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">
          同じ願いを育てるか、別の願いを始めるかを決めてから、問いの芽を整え、観測の仕方まで決めます。
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>1. どこから始めるか</SectionTitle>
          <Pill>{mode === "continue" ? "今の願いを続ける" : "別の願いを始める"}</Pill>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            className={`rounded-2xl border p-4 text-left ${mode === "continue" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
            onClick={() => switchMode("continue")}
            disabled={!hasActiveWish}
          >
            <p className="font-medium text-slate-900">今の願いを続ける</p>
            <p className="mt-1 text-sm text-slate-600">{hasActiveWish ? "同じ願いと見てきた項目を引き継ぐ" : "続ける願いはまだありません"}</p>
          </button>
          <button
            type="button"
            className={`rounded-2xl border p-4 text-left ${mode === "new" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}
            onClick={() => switchMode("new")}
          >
            <p className="font-medium text-slate-900">別の願いを始める</p>
            <p className="mt-1 text-sm text-slate-600">新しいテーマで最初から考える</p>
          </button>
        </div>
      </Card>

      {mode === "continue" && continueSummary ? (
        <Card className="space-y-4">
          <SectionTitle>続きに入るときの引き継ぎ</SectionTitle>
          <p className="text-sm text-slate-600">振り返りで書いた内容は、そのまま次の問い作りの下書きになります。</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "今できていること",
                before: continueSummary.before_current_state,
                after: continueSummary.after_current_state,
                note: "今日気づいたことを引き継ぐ",
              },
              {
                title: "まだできていないこと",
                before: continueSummary.before_not_yet,
                after: continueSummary.after_not_yet,
                note: "まだ気になることを引き継ぐ",
              },
              {
                title: "できるようになりたいこと",
                before: continueSummary.before_desired_state,
                after: continueSummary.after_desired_state,
                note: "次にやってみたいことを引き継ぐ",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs text-slate-500">前の入力</p>
                <p className="mt-1 text-sm text-slate-700">{item.before || "まだありません"}</p>
                <p className="mt-3 text-xs text-slate-500">今回の初期値</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{item.after || "まだありません"}</p>
                <p className="mt-2 text-xs text-amber-800">{item.note}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>2. 願いの今を整理する</SectionTitle>
          <Pill>{mode === "continue" ? "引き継ぎあり" : "新しく書く"}</Pill>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">何を願っているか</label>
            <textarea maxLength={INPUT_LIMITS.wish_text} rows={3} value={form.wish_text} onChange={(event) => updateField("wish_text", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.wish_text.length, INPUT_LIMITS.wish_text)}</p>
          </div>
          <div>
            <label className="field-label">なぜそう願うのか</label>
            <textarea maxLength={INPUT_LIMITS.reason} rows={3} value={form.reason} onChange={(event) => updateField("reason", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.reason.length, INPUT_LIMITS.reason)}</p>
          </div>
          <div>
            <label className="field-label">今できていること</label>
            <textarea maxLength={INPUT_LIMITS.current_state} rows={3} value={form.current_state} onChange={(event) => updateField("current_state", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.current_state.length, INPUT_LIMITS.current_state)}</p>
          </div>
          <div>
            <label className="field-label">まだできていないこと</label>
            <textarea maxLength={INPUT_LIMITS.not_yet} rows={3} value={form.not_yet} onChange={(event) => updateField("not_yet", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.not_yet.length, INPUT_LIMITS.not_yet)}</p>
          </div>
          <div className="md:col-span-2">
            <label className="field-label">できるようになりたいこと</label>
            <textarea maxLength={INPUT_LIMITS.desired_state} rows={3} value={form.desired_state} onChange={(event) => updateField("desired_state", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.desired_state.length, INPUT_LIMITS.desired_state)}</p>
          </div>
          <div className="md:col-span-2">
            <label className="field-label">今いちばん気になること</label>
            <textarea maxLength={INPUT_LIMITS.next_curiosity_text} rows={3} value={form.next_curiosity_text} onChange={(event) => updateField("next_curiosity_text", event.target.value)} />
            <p className="mt-2 text-xs text-slate-500">次に見たいことや、たしかめたいことがあれば書く</p>
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.next_curiosity_text.length, INPUT_LIMITS.next_curiosity_text)}</p>
          </div>
        </div>
        <button type="button" className="btn-primary w-full md:w-auto" onClick={generateCandidates} disabled={isGenerating}>
          {isGenerating ? "問いを考え中..." : "3. 問い候補を出す"}
        </button>
        {isGenerating ? (
          <LoadingBlock
            title="問い候補を整えています"
            description="願いの言葉から離れすぎない形で、試しやすい候補をまとめています。"
          />
        ) : null}
      </Card>

      <Card
        className={`space-y-4 transition ${highlightedSection === "candidates" ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-[var(--bg)]" : ""}`}
      >
        <section ref={candidatesSectionRef} className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>4. 問いを1つ選ぶ</SectionTitle>
          {form.question_text ? <Pill>{getPrimaryPurposeFocusOption(form.purpose_focus).label}</Pill> : null}
        </div>
        <p className="text-sm text-slate-600">本人の気になり方に近いものを選び、その問いでどこを見ていくかを決めます。</p>
        <div className="space-y-3">
          {candidates.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">上の内容から候補を作ります。</p>
          ) : (
            candidates.map((candidate) => {
              const normalizedPurpose = normalizePurposeFocus(candidate.purpose_hint);
              const purpose = getPrimaryPurposeFocusOption(normalizedPurpose);
              const selected = form.question_text === candidate.text && form.purpose_focus === normalizedPurpose;
              const shape = candidateShapeMeta(candidate.shape_label);

              return (
                <button
                  key={`${candidate.text}-${candidate.purpose_hint}`}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left ${
                    selected ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50"
                  }`}
                  onClick={() => selectCandidate(candidate)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{candidate.text}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${shape.className}`}>{shape.label}</span>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">{purpose.label}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${selected ? "bg-amber-200 text-amber-950" : "bg-slate-100 text-slate-700"}`}>{selected ? "選択中" : "選ぶ"}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{candidate.why_this_question}</p>
                  <p className="mt-2 text-xs text-slate-500">{purpose.description}</p>
                </button>
              );
            })
          )}
        </div>
        </section>
      </Card>

      <Card
        className={`space-y-4 transition ${highlightedSection === "fields" ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-[var(--bg)]" : ""}`}
      >
        <section ref={fieldsSectionRef} className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionTitle>5. 見る項目を整える</SectionTitle>
          {selectedFieldKeys.length > 0 ? <Pill>{selectedFieldKeys.length}項目を選択中</Pill> : null}
        </div>
        <p className="text-sm text-slate-600">この願いを見る項目のうち、今回の問いで使うものを決めます。AI の初期選択をそのまま使ってもかまいません。</p>
        {fieldCandidates.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {(["core", "compare", "optional"] as const).map((role) => {
              const meta = roleMeta(role);
              return (
                <div key={role} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">{meta.title}</p>
                  <p className="mt-1 text-xs text-slate-600">{meta.description}</p>
                  <p className="mt-3 text-xs font-medium text-slate-500">{groupedFieldCandidates[role].length}件</p>
                </div>
              );
            })}
          </div>
        ) : null}
        {splitSuggestedKeys.length > 0 ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            AI は、{splitSuggestedKeys.map((key) => fieldCandidates.find((field) => field.key === key)?.label || key).join(" / ")} を分けて見ると、ちがいが見つけやすいと提案しています。
          </p>
        ) : null}
        {isLoadingFields ? (
          <LoadingBlock
            title="見る項目を整えています"
            description="まず残す項目、違いを見る項目、あとで足す項目に分けて候補をまとめています。"
          />
        ) : fieldCandidates.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">問いを選ぶと、今まで見てきた項目と今回足す候補が出ます。</p>
        ) : (
          <div className="space-y-4">
            <section className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-900">今回よく見る項目</p>
                <p className="text-xs text-slate-500">今の問いで特によく見る項目です。</p>
              </div>
              <div className="space-y-3">
                {selectedFields.length > 0 ? selectedFields.map(renderFieldCard) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">使う項目を選んでください。</p>}
              </div>
            </section>
            <section className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-900">今回はお休みする項目</p>
                <p className="text-xs text-slate-500">この願いの見方には残しつつ、今回は外しておく項目です。</p>
              </div>
              <div className="space-y-3">
                {inactiveFields.length > 0 ? inactiveFields.map(renderFieldCard) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">すべての項目を今回使います。</p>}
              </div>
            </section>
          </div>
        )}
        {fieldCandidates.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
            {!isAddingCustomField ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">この項目も見たい</p>
                  <p className="text-xs text-slate-500">たとえば 対戦相手 / ステージ / 時間帯 のような、見たい項目を1件足せます。</p>
                </div>
                <button type="button" className="btn-secondary w-full md:w-auto" onClick={() => setIsAddingCustomField(true)}>
                  自分で項目を足す
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {customFieldForm.derivedFromKey ? "細かい項目を追加する" : "見たい項目を追加する"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customFieldForm.derivedFromKey ? "選んだ項目を細かく見るための子項目を足します。" : "この願いで見続けたいことを1件だけ足します。"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700"
                    onClick={() => {
                      setIsAddingCustomField(false);
                      setCustomFieldError("");
                    }}
                  >
                    閉じる
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="field-label">項目名</label>
                    <input
                      type="text"
                      value={customFieldForm.label}
                      onChange={(event) => setCustomFieldForm((current) => ({ ...current, label: event.target.value }))}
                      placeholder="対戦相手"
                    />
                  </div>
                  <div>
                    <label className="field-label">入力の種類</label>
                    <select
                      value={customFieldForm.type}
                      onChange={(event) =>
                        setCustomFieldForm((current) => ({
                          ...current,
                          type: event.target.value as FieldCandidate["type"],
                        }))
                      }
                    >
                      <option value="text">短く書く</option>
                      <option value="select">選ぶ</option>
                      <option value="number">数で入れる</option>
                      <option value="boolean">はい / いいえ</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label">この項目を見る理由</label>
                    <input
                      type="text"
                      value={customFieldForm.why}
                      onChange={(event) => setCustomFieldForm((current) => ({ ...current, why: event.target.value }))}
                      placeholder="相手による違いを見るため"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label">あとでどう使うか</label>
                    <input
                      type="text"
                      value={customFieldForm.howToUse}
                      onChange={(event) => setCustomFieldForm((current) => ({ ...current, howToUse: event.target.value }))}
                      placeholder="相手ごとに違いがあるか見比べる"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label">どの項目を細かく分けたものか</label>
                    <select
                      value={customFieldForm.derivedFromKey}
                      onChange={(event) =>
                        setCustomFieldForm((current) => ({
                          ...current,
                          derivedFromKey: event.target.value,
                        }))
                      }
                    >
                      <option value="">指定しない</option>
                      {fieldCandidates.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">既存項目をより細かく見たいときだけ選びます。</p>
                  </div>
                  {customFieldForm.type === "select" ? (
                    <div className="md:col-span-2">
                      <label className="field-label">選択肢</label>
                      <input
                        type="text"
                        value={customFieldForm.optionsText}
                        onChange={(event) => setCustomFieldForm((current) => ({ ...current, optionsText: event.target.value }))}
                        placeholder="友だち, CPU, 初めての相手"
                      />
                      <p className="mt-1 text-xs text-slate-500">カンマ区切りで2つ以上入れます。</p>
                    </div>
                  ) : null}
                </div>
                {customFieldError ? <p className="text-sm text-red-600">{customFieldError}</p> : null}
                <div className="flex flex-col gap-2 md:flex-row">
                  <button type="button" className="btn-primary w-full md:w-auto" onClick={addCustomField}>
                    この項目を追加する
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="button"
          className="btn-primary w-full"
          onClick={saveQuestion}
          disabled={isSaving || !form.question_text || selectedFieldKeys.length === 0}
        >
          {isSaving ? "保存中..." : "6. この問いで始める"}
        </button>
        {isSaving ? (
          <LoadingBlock
            title="この問いを保存しています"
            description="選んだ問いと今回の見方を、同じ願いの流れにつなげています。"
          />
        ) : null}
        </section>
      </Card>
    </>
  );
}
