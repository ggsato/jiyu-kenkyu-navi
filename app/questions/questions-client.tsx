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
  is_primary_metric?: boolean;
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
      title: "試し分けに使う",
      description: "やり方や結果の違いを見たいときに足す項目",
    };
  }

  if (role === "optional") {
    return {
      title: "気になったら足す",
      description: "問いが育ってきたら使う項目",
    };
  }

  return {
    title: "まず決める",
    description: "今回どうするかを残すための基本項目",
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

function fieldShortHint(field: FieldCandidate) {
  return field.why || "今回どうしてみたかや、どうだったかを残すための項目です。";
}

function isMetricField(field: FieldCandidate) {
  return field.type === "number" || field.type === "boolean";
}

function parseOptionsText(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function candidateShapeMeta(shapeLabel: string) {
  if (shapeLabel.includes("変え")) {
    return {
      className: "bg-sky-100 text-sky-900",
      label: shapeLabel,
    };
  }

  if (shapeLabel.includes("続け")) {
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

function helperTone(type: "example" | "meaning" | "tip") {
  if (type === "example") {
    return "bg-sky-50 text-sky-950";
  }

  if (type === "meaning") {
    return "bg-emerald-50 text-emerald-950";
  }

  return "bg-amber-50 text-amber-950";
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
  continueRecordInsightSummary,
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
    latest_reflection_learned: string;
    latest_reflection_unknown: string;
    latest_reflection_next_step: string;
  } | null;
  continueRecordInsightSummary: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"continue" | "new">(initialMode);
  const [form, setForm] = useState<QuestionFormState>(initialMode === "continue" ? continueTemplate : newTemplate);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [fieldCandidates, setFieldCandidates] = useState<FieldCandidate[]>([]);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>([]);
  const [splitSuggestedKeys, setSplitSuggestedKeys] = useState<string[]>([]);
  const [splitCandidatesByParent, setSplitCandidatesByParent] = useState<Record<string, FieldCandidate[]>>({});
  const [splitStatusByParent, setSplitStatusByParent] = useState<Record<string, { type: "idle" | "loading" | "error" | "empty"; message: string }>>({});
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
  const [storageReady, setStorageReady] = useState(false);
  const candidatesSectionRef = useRef<HTMLElement | null>(null);
  const fieldsSectionRef = useRef<HTMLElement | null>(null);
  const previousCandidateCountRef = useRef(candidates.length);
  const previousFieldCountRef = useRef(fieldCandidates.length);

  useEffect(() => {
    const defaultForm = initialMode === "continue" ? continueTemplate : newTemplate;
    let cancelled = false;

    const applyState = (next: {
      form: QuestionFormState;
      candidates: Candidate[];
      fieldCandidates: FieldCandidate[];
      selectedFieldKeys: string[];
      splitSuggestedKeys: string[];
      splitCandidatesByParent: Record<string, FieldCandidate[]>;
      splitStatusByParent: Record<string, { type: "idle" | "loading" | "error" | "empty"; message: string }>;
    }) => {
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        setForm(next.form);
        setCandidates(next.candidates);
        setFieldCandidates(next.fieldCandidates);
        setSelectedFieldKeys(next.selectedFieldKeys);
        setSplitSuggestedKeys(next.splitSuggestedKeys);
        setSplitCandidatesByParent(next.splitCandidatesByParent);
        setSplitStatusByParent(next.splitStatusByParent);
        setStorageReady(true);
      });
    };

    if (forceTemplate && initialMode === "continue") {
      window.sessionStorage.setItem(formStorageKey("continue"), JSON.stringify(continueTemplate));
      window.sessionStorage.removeItem(candidateStorageKey("continue"));
      window.sessionStorage.removeItem(fieldConfigStorageKey("continue"));
      applyState({
        form: continueTemplate,
        candidates: [],
        fieldCandidates: [],
        selectedFieldKeys: [],
        splitSuggestedKeys: [],
        splitCandidatesByParent: {},
        splitStatusByParent: {},
      });
      return () => {
        cancelled = true;
      };
    }

    const savedForm = window.sessionStorage.getItem(formStorageKey(initialMode));
    const savedCandidates = window.sessionStorage.getItem(candidateStorageKey(initialMode));
    const savedFieldConfig = window.sessionStorage.getItem(fieldConfigStorageKey(initialMode));
    let nextForm = defaultForm;
    let nextCandidates: Candidate[] = [];
    let nextFieldCandidates: FieldCandidate[] = [];
    let nextSelectedFieldKeys: string[] = [];
    let nextSplitSuggestedKeys: string[] = [];
    let nextSplitCandidatesByParent: Record<string, FieldCandidate[]> = {};
    let nextSplitStatusByParent: Record<string, { type: "idle" | "loading" | "error" | "empty"; message: string }> = {};

    if (savedForm) {
      try {
        const parsed = JSON.parse(savedForm) as QuestionFormState;

        if (initialMode === "continue" && !isSameContinueWish(parsed, continueTemplate)) {
          window.sessionStorage.removeItem(formStorageKey("continue"));
          window.sessionStorage.removeItem(candidateStorageKey("continue"));
          window.sessionStorage.removeItem(fieldConfigStorageKey("continue"));
          nextForm = continueTemplate;
        } else {
          nextForm = parsed;
        }
      } catch {
        window.sessionStorage.removeItem(formStorageKey(initialMode));
        nextForm = defaultForm;
      }
    }

    if (savedCandidates) {
      try {
        nextCandidates = JSON.parse(savedCandidates) as Candidate[];
      } catch {
        window.sessionStorage.removeItem(candidateStorageKey(initialMode));
      }
    }

    if (savedFieldConfig) {
      try {
        const parsed = JSON.parse(savedFieldConfig) as {
          fieldCandidates?: FieldCandidate[];
          selectedFieldKeys?: string[];
          splitSuggestedKeys?: string[];
          splitCandidatesByParent?: Record<string, FieldCandidate[]>;
          splitStatusByParent?: Record<string, { type: "idle" | "loading" | "error" | "empty"; message: string }>;
        };
        nextFieldCandidates = parsed.fieldCandidates || [];
        nextSelectedFieldKeys = parsed.selectedFieldKeys || [];
        nextSplitSuggestedKeys = parsed.splitSuggestedKeys || [];
        nextSplitCandidatesByParent = parsed.splitCandidatesByParent || {};
        nextSplitStatusByParent = parsed.splitStatusByParent || {};
      } catch {
        window.sessionStorage.removeItem(fieldConfigStorageKey(initialMode));
      }
    }

    applyState({
      form: nextForm,
      candidates: nextCandidates,
      fieldCandidates: nextFieldCandidates,
      selectedFieldKeys: nextSelectedFieldKeys,
      splitSuggestedKeys: nextSplitSuggestedKeys,
      splitCandidatesByParent: nextSplitCandidatesByParent,
      splitStatusByParent: nextSplitStatusByParent,
    });

    return () => {
      cancelled = true;
    };
  }, [continueTemplate, forceTemplate, initialMode, newTemplate]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    window.sessionStorage.setItem(formStorageKey(mode), JSON.stringify(form));
  }, [form, mode, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    window.sessionStorage.setItem(candidateStorageKey(mode), JSON.stringify(candidates));
  }, [candidates, mode, storageReady]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    window.sessionStorage.setItem(fieldConfigStorageKey(mode), JSON.stringify({ fieldCandidates, selectedFieldKeys, splitSuggestedKeys, splitCandidatesByParent, splitStatusByParent }));
  }, [fieldCandidates, selectedFieldKeys, splitSuggestedKeys, splitCandidatesByParent, splitStatusByParent, mode, storageReady]);

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
    setSplitStatusByParent({});
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
          splitStatusByParent?: Record<string, { type: "idle" | "loading" | "error" | "empty"; message: string }>;
        };
        setFieldCandidates(parsed.fieldCandidates || []);
        setSelectedFieldKeys(parsed.selectedFieldKeys || []);
        setSplitSuggestedKeys(parsed.splitSuggestedKeys || []);
        setSplitCandidatesByParent(parsed.splitCandidatesByParent || {});
        setSplitStatusByParent(parsed.splitStatusByParent || {});
      } catch {
        window.sessionStorage.removeItem(fieldConfigStorageKey(nextMode));
        setFieldCandidates([]);
        setSelectedFieldKeys([]);
        setSplitSuggestedKeys([]);
        setSplitCandidatesByParent({});
        setSplitStatusByParent({});
      }
    } else {
      setFieldCandidates([]);
      setSelectedFieldKeys([]);
      setSplitSuggestedKeys([]);
      setSplitCandidatesByParent({});
      setSplitStatusByParent({});
    }
  }

  function generateCandidates() {
    setError("");
    resetFieldSelection();

    startGenerating(async () => {
      const response = await fetch("/api/ai/question-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          record_insight_summary: mode === "continue" ? continueRecordInsightSummary : "",
        }),
      });

      const data = (await response.json()) as QuestionCandidatesResponse;
      const nextCandidates = Array.isArray(data.candidates)
        ? data.candidates
        : Array.isArray(data.questions)
          ? data.questions.map((question) => ({
              text: question,
              shape_label: "試し方を変えてみる",
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
          record_insight_summary: mode === "continue" ? continueRecordInsightSummary : "",
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
      const compareFieldKeys = purposeFocus === "compare"
        ? nextFieldCandidates.filter((field) => field.role === "compare").map((field) => field.key)
        : [];
      const primaryMetricKey = purposeFocus === "compare"
        ? nextFieldCandidates.find((field) => field.is_primary_metric)?.key || nextFieldCandidates.find((field) => isMetricField(field))?.key || ""
        : "";
      const normalizedFieldCandidates = nextFieldCandidates.map((field) => ({
        ...field,
        is_primary_metric: primaryMetricKey ? field.key === primaryMetricKey : Boolean(field.is_primary_metric),
      }));
      setFieldCandidates(normalizedFieldCandidates);
      setSplitSuggestedKeys(nextSplitSuggestedKeys);
      setSelectedFieldKeys(
        Array.from(
          new Set([
            ...getDefaultSelectedFieldKeys(
              normalizedFieldCandidates,
              mergedPreferredKeys,
            ),
            ...compareFieldKeys,
            ...(primaryMetricKey ? [primaryMetricKey] : []),
          ]),
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
      is_primary_metric: false,
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

    setSplitStatusByParent((current) => ({
      ...current,
      [field.key]: {
        type: "loading",
        message: "AI がこの項目の細分化候補を考えています...",
      },
    }));
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

        if (!response.ok || data.error) {
          setSplitCandidatesByParent((current) => ({
            ...current,
            [field.key]: [],
          }));
          setSplitStatusByParent((current) => ({
            ...current,
            [field.key]: {
              type: "error",
              message: data.error || "細分化候補を作れませんでした。もう一度試してください。",
            },
          }));
          return;
        }

        if (nextCandidates.length === 0) {
          setSplitCandidatesByParent((current) => ({
            ...current,
            [field.key]: [],
          }));
          setSplitStatusByParent((current) => ({
            ...current,
            [field.key]: {
              type: "empty",
              message: "今回は細分化候補が見つかりませんでした。必要ならもう一度試せます。",
            },
          }));
          return;
        }

        setSplitStatusByParent((current) => ({
          ...current,
          [field.key]: {
            type: "idle",
            message: "",
          },
        }));
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
        setSplitStatusByParent((current) => ({
          ...current,
          [field.key]: {
            type: "error",
            message: "細分化候補を作れませんでした。もう一度試してください。",
          },
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
            is_primary_metric: Boolean(field.is_primary_metric),
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
  const selectedCompareFields = selectedFields.filter((field) => field.role === "compare");
  const primaryCompareField = selectedCompareFields[0] || null;
  const selectedMetricFields = selectedFields.filter((field) => field.is_primary_metric);
  const primaryMetricField = selectedMetricFields[0] || null;
  const compareSetupError = form.purpose_focus !== "compare"
    ? ""
    : selectedCompareFields.length === 0
      ? "『試す』の問いでは、今回試すことを1つ決めてください。"
      : selectedCompareFields.length > 1
        ? "『試す』の問いでは、『試し分けに使う』項目を1つにしてください。"
        : primaryCompareField.type !== "select"
          ? "『今回試すこと』は、選択肢から選べる項目にしてください。"
          : primaryCompareField.options.length < 2
            ? "『今回試すこと』には、選択肢を2つ以上入れてください。"
            : selectedMetricFields.length !== 1
              ? "『試す』の問いでは、『今回見る項目』を1つ決めてください。"
              : !primaryMetricField || !isMetricField(primaryMetricField)
                ? "『今回見る項目』は、数で入れる項目か、はい/いいえの項目にしてください。"
                : "";
  const activeStep = isSaving || selectedFieldKeys.length > 0
    ? 5
    : isLoadingFields || form.question_text
      ? 4
      : isGenerating || candidates.length > 0
        ? 3
        : 2;
  const stepItems = [
    { number: 1, title: "始め方", href: "#question-step-1" },
    { number: 2, title: "願いの整理", href: "#question-step-2" },
    { number: 3, title: "問い候補", href: "#question-step-3" },
    { number: 4, title: "問い選択", href: "#question-step-4" },
    { number: 5, title: "項目調整", href: "#question-step-5" },
    { number: 6, title: "開始", href: "#question-step-6" },
  ] as const;

  function renderFieldCard(field: FieldCandidate) {
    const selected = selectedFieldKeys.includes(field.key);
    const meta = roleMeta(field.role);
    const splitChildCandidates = fieldCandidates.filter((candidate) => candidate.derived_from_key === field.key);
    const splitSuggestions = splitCandidatesByParent[field.key] || [];
    const isLoadingSplitSuggestions = loadingSplitParentKey === field.key;
    const splitStatus = splitStatusByParent[field.key];

    return (
      <div
        key={field.key}
        className={`rounded-2xl border p-4 transition ${
          selected ? "border-amber-400 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">
              {field.label}
              {field.unit ? ` (${field.unit})` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">{fieldShortHint(field)}</p>
            <p className="mt-2 text-xs font-medium text-slate-700">{meta.description}</p>
          </div>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              selected ? "bg-amber-200 text-amber-950" : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => toggleFieldSelection(field.key)}
          >
            {selected ? "今回使う" : "今回は休む"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">{meta.title}</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">{fieldTypeLabel(field.type)}</span>
          {field.is_primary_metric ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-900">今回見る項目</span> : null}
          {field.is_default ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">AI初期提案</span> : null}
          {field.is_custom ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">自分で追加</span> : null}
          {splitSuggestedKeys.includes(field.key) ? <span className="rounded-full bg-white px-3 py-1 text-xs text-amber-800">細かく分ける候補</span> : null}
          {field.derived_from_key ? <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">細分化項目</span> : null}
        </div>
        <details className="mt-3 rounded-2xl bg-white/80 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">少し直す / 詳細を見る</summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="field-label">項目名</label>
              <input
                type="text"
                value={field.label}
                onChange={(event) =>
                  setFieldCandidates((current) =>
                    current.map((candidate) =>
                      candidate.key === field.key ? { ...candidate, label: event.target.value } : candidate,
                    ),
                  )
                }
              />
              <p className="mt-1 text-xs text-slate-500">主操作は選ぶことです。名前だけ少し直したいときに使います。</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="field-label">役割</label>
                <select
                  value={field.role}
                  onChange={(event) =>
                    setFieldCandidates((current) =>
                      current.map((candidate) =>
                        candidate.key === field.key
                          ? { ...candidate, role: event.target.value as FieldCandidate["role"] }
                          : candidate,
                      ),
                    )
                  }
                >
                  <option value="core">まず決める</option>
                  <option value="compare">試し分けに使う</option>
                  <option value="optional">気になったら足す</option>
                </select>
              </div>
              <div>
                <label className="field-label">入力の種類</label>
                <select
                  value={field.type}
                  onChange={(event) =>
                    setFieldCandidates((current) =>
                      current.map((candidate) =>
                        candidate.key === field.key
                          ? {
                              ...candidate,
                              type: event.target.value as FieldCandidate["type"],
                              options: event.target.value === "select" ? candidate.options : [],
                            }
                          : candidate,
                      ),
                    )
                  }
                >
                  <option value="text">短く書く</option>
                  <option value="select">選ぶ</option>
                  <option value="number">数で入れる</option>
                  <option value="boolean">はい / いいえ</option>
                </select>
              </div>
            </div>
            {isMetricField(field) ? (
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={Boolean(field.is_primary_metric)}
                  onChange={(event) =>
                    setFieldCandidates((current) =>
                      current.map((candidate) => ({
                        ...candidate,
                        is_primary_metric: candidate.key === field.key ? event.target.checked : false,
                      })),
                    )
                  }
                />
                今回見る項目にする
              </label>
            ) : null}
            {field.type === "select" ? (
              <div>
                <label className="field-label">選択肢</label>
                <input
                  type="text"
                  value={field.options.join(", ")}
                  onChange={(event) =>
                    setFieldCandidates((current) =>
                      current.map((candidate) =>
                        candidate.key === field.key
                          ? { ...candidate, options: parseOptionsText(event.target.value) }
                          : candidate,
                      ),
                    )
                  }
                  placeholder="A, B"
                />
                <p className="mt-1 text-xs text-slate-500">カンマ区切りで入れます。</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {field.derived_from_key ? (
                <span>
                  細分化元: {fieldCandidates.find((candidate) => candidate.key === field.derived_from_key)?.label || field.derived_from_key}
                </span>
              ) : null}
              {field.how_to_use ? <span>使い方: {field.how_to_use}</span> : null}
              {field.type === "select" && field.options.length > 0 ? <span>選択肢: {field.options.join(" / ")}</span> : null}
            </div>
            <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
            onClick={() => startSplitField(field)}
            disabled={isLoadingSplitSuggestions}
          >
            {isLoadingSplitSuggestions ? "細分化候補を考え中..." : "この項目を細かく分ける"}
          </button>
              {splitChildCandidates.length > 0 ? (
                <span className="rounded-full bg-white px-3 py-1 text-xs text-amber-800">
                  子項目候補: {splitChildCandidates.map((candidate) => candidate.label).join(" / ")}
                </span>
              ) : null}
            </div>
          </div>
        </details>
        {splitStatus && splitStatus.type !== "idle" ? (
          <p
            className={`mt-3 rounded-2xl px-3 py-2 text-xs ${
              splitStatus.type === "error"
                ? "bg-red-50 text-red-700"
                : splitStatus.type === "empty"
                  ? "bg-slate-50 text-slate-600"
                  : "bg-slate-50 text-slate-500"
            }`}
          >
            {splitStatus.message}
          </p>
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
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>進み方</SectionTitle>
          <Pill>今は {stepItems.find((step) => step.number === activeStep)?.title}</Pill>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {stepItems.map((step) => {
            const state = step.number < activeStep ? "done" : step.number === activeStep ? "current" : "upcoming";

            return (
              <a
                key={step.number}
                href={step.href}
                className={`rounded-2xl border px-3 py-3 text-left ${
                  state === "current"
                    ? "border-amber-400 bg-amber-50"
                    : state === "done"
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-medium text-slate-500">STEP {step.number}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{step.title}</p>
              </a>
            );
          })}
        </div>
        <p className="text-xs text-slate-600">いま見たい場所へ戻れます。下まで進んでも、上の入力をあとで直してかまいません。</p>
      </Card>

      <Card id="question-step-1" className="space-y-3 scroll-mt-24">
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
          <SectionTitle>続きに入るときの材料</SectionTitle>
          <p className="text-sm text-slate-700">願いの土台はそのまま引き継ぎます。直近の振り返りは、次にどこを見直すか考えるためのメモとして参照します。</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: "今できていること",
                before: continueSummary.before_current_state,
                note: "願いの土台として維持する",
              },
              {
                title: "まだできていないこと",
                before: continueSummary.before_not_yet,
                note: "願いの土台として維持する",
              },
              {
                title: "できるようになりたいこと",
                before: continueSummary.before_desired_state,
                note: "願いの土台として維持する",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs text-slate-600">いまの土台</p>
                <p className="mt-1 text-sm text-slate-700">{item.before || "まだありません"}</p>
                <p className="mt-2 text-xs text-amber-800">{item.note}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">直近の振り返りメモ</p>
            <p className="mt-1 text-sm text-slate-700">次の問いを考えるときの参考です。必要なら「今いちばん気になること」や問い候補選びに反映します。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "今日気づいたこと",
                  value: continueSummary.latest_reflection_learned,
                },
                {
                  title: "まだ気になること",
                  value: continueSummary.latest_reflection_unknown,
                },
                {
                  title: "次にやってみたいこと",
                  value: continueSummary.latest_reflection_next_step,
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-700">{item.value || "まだありません"}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <Card id="question-step-2" className="space-y-4 scroll-mt-24">
        <div className="flex items-center justify-between">
          <SectionTitle>2. 願いの今を整理する</SectionTitle>
          <Pill>{mode === "continue" ? "引き継ぎあり" : "新しく書く"}</Pill>
        </div>
        <p className="text-sm text-slate-600">最初は少しだけ書けば進めます。くわしい背景は必要になったら開いて足せます。</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">何を願っているか</label>
            <p className={`mb-2 rounded-2xl px-3 py-2 text-xs ${helperTone("meaning")}`}>何をできるようにしたいか、何を知りたいかを一文で置きます。</p>
            <textarea maxLength={INPUT_LIMITS.wish_text} rows={3} value={form.wish_text} onChange={(event) => updateField("wish_text", event.target.value)} />
            <p className={`mt-2 rounded-2xl px-3 py-2 text-xs ${helperTone("example")}`}>例: サッカーで最後まで走り切れるようになりたい</p>
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.wish_text.length, INPUT_LIMITS.wish_text)}</p>
          </div>
          <div>
            <label className="field-label">今いちばん気になること</label>
            <textarea maxLength={INPUT_LIMITS.next_curiosity_text} rows={3} value={form.next_curiosity_text} onChange={(event) => updateField("next_curiosity_text", event.target.value)} />
            <p className={`mt-2 rounded-2xl px-3 py-2 text-xs ${helperTone("example")}`}>例: 後半に止まりたくなる前に、どんな場面が来ているんだろう</p>
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.next_curiosity_text.length, INPUT_LIMITS.next_curiosity_text)}</p>
          </div>
        </div>
        <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-900">もう少し話す / くわしく書く</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
            <label className="field-label">なぜそう願うのか</label>
            <p className={`mb-2 rounded-2xl px-3 py-2 text-xs ${helperTone("meaning")}`}>その願いが大事な理由を書くと、問いが自分の言葉から離れにくくなります。</p>
            <textarea maxLength={INPUT_LIMITS.reason} rows={3} value={form.reason} onChange={(event) => updateField("reason", event.target.value)} />
            <p className={`mt-2 rounded-2xl px-3 py-2 text-xs ${helperTone("example")}`}>例: 試合の後半になると急に動けなくなるから</p>
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.reason.length, INPUT_LIMITS.reason)}</p>
          </div>
          <div>
            <label className="field-label">今できていること</label>
            <p className={`mb-2 rounded-2xl px-3 py-2 text-xs ${helperTone("tip")}`}>少しでもできていることを書くと、問いを小さくしやすくなります。</p>
            <textarea maxLength={INPUT_LIMITS.current_state} rows={3} value={form.current_state} onChange={(event) => updateField("current_state", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.current_state.length, INPUT_LIMITS.current_state)}</p>
          </div>
          <div>
            <label className="field-label">まだできていないこと</label>
            <p className={`mb-2 rounded-2xl px-3 py-2 text-xs ${helperTone("tip")}`}>できていないことをそのまま書くと、次に何を見たり試したりするかが出やすくなります。</p>
            <textarea maxLength={INPUT_LIMITS.not_yet} rows={3} value={form.not_yet} onChange={(event) => updateField("not_yet", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.not_yet.length, INPUT_LIMITS.not_yet)}</p>
          </div>
          <div className="md:col-span-2">
            <label className="field-label">できるようになりたいこと</label>
            <p className={`mb-2 rounded-2xl px-3 py-2 text-xs ${helperTone("meaning")}`}>問いの向かう先です。今の課題より少し先の状態を書くと十分です。</p>
            <textarea maxLength={INPUT_LIMITS.desired_state} rows={3} value={form.desired_state} onChange={(event) => updateField("desired_state", event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{limitLabel(form.desired_state.length, INPUT_LIMITS.desired_state)}</p>
          </div>
          </div>
        </details>
        <div id="question-step-3" className="scroll-mt-24">
          <button type="button" className="btn-primary w-full md:w-auto" onClick={generateCandidates} disabled={isGenerating}>
          {isGenerating ? "問いを考え中..." : "3. 問い候補を出す"}
          </button>
        </div>
        {isGenerating ? (
          <LoadingBlock
            title="問い候補を整えています"
            description="願いの言葉から離れすぎない形で、試しやすい候補をまとめています。"
          />
        ) : null}
      </Card>

      <Card
        id="question-step-4"
        className={`space-y-4 transition ${highlightedSection === "candidates" ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-[var(--bg)]" : ""}`}
      >
        <section ref={candidatesSectionRef} className="space-y-4 scroll-mt-24">
        <div className="flex items-center justify-between">
          <SectionTitle>4. 問いを1つ選ぶ</SectionTitle>
          {form.question_text ? <Pill>{getPrimaryPurposeFocusOption(form.purpose_focus).label}</Pill> : null}
        </div>
        <p className="text-sm text-slate-600">本人の気になり方に近いものを選び、その問いで何を見るか、何を試すか、何を続けるかを決めます。</p>
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
        id="question-step-5"
        className={`space-y-4 transition ${highlightedSection === "fields" ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-[var(--bg)]" : ""}`}
      >
        <section ref={fieldsSectionRef} className="space-y-4 scroll-mt-24">
        <div className="flex items-center justify-between">
          <SectionTitle>5. 試し方と見方を整える</SectionTitle>
          {selectedFieldKeys.length > 0 ? <Pill>{selectedFieldKeys.length}項目を選択中</Pill> : null}
        </div>
        <p className="text-sm text-slate-600">この願いで使える試し方と見方の棚から、今回の問いで使うものを決めます。AI の初期提案をそのまま使ってもよく、必要なら少しだけ直せます。</p>
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
            AI は、{splitSuggestedKeys.map((key) => fieldCandidates.find((field) => field.key === key)?.label || key).join(" / ")} を分けて残すと、試し方や結果の違いが見えやすいと提案しています。
          </p>
        ) : null}
        {form.purpose_focus === "compare" && primaryCompareField ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-sm font-medium text-slate-900">今回試すこと</p>
              <p className="mt-1 text-sm text-slate-700">{primaryCompareField.label}</p>
              <p className="mt-2 text-xs text-slate-600">
                {primaryCompareField.options.length > 0
                  ? `選択肢: ${primaryCompareField.options.join(" / ")}`
                  : "選択肢を入れると、何を試し分けるかがはっきりします。"}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-slate-900">今回見る項目</p>
              <p className="mt-1 text-sm text-slate-700">{primaryMetricField?.label || "まだ決まっていません"}</p>
              <p className="mt-2 text-xs text-slate-600">
                {primaryMetricField ? "この項目で、試し方ごとの違いを見ます。" : "数で入れる項目か、はい/いいえの項目を1つ選びます。"}
              </p>
            </div>
          </div>
        ) : null}
        {form.purpose_focus === "compare" && compareSetupError ? (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{compareSetupError}</p>
        ) : null}
        {isLoadingFields ? (
          <LoadingBlock
            title="試し方と見方を整えています"
            description="まず決める項目、試し分けに使う項目、あとで足す項目に分けて候補をまとめています。"
          />
        ) : fieldCandidates.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">問いを選ぶと、この願いで使ってきた棚と、今回足す候補が出ます。</p>
        ) : (
          <div className="space-y-4">
            <section className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-900">今回使う試し方と見方</p>
                <p className="text-xs text-slate-500">今の問いで、何を試してどう見ていくかを決める項目です。</p>
              </div>
              <div className="space-y-3">
                {selectedFields.length > 0 ? selectedFields.map(renderFieldCard) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">使う項目を選んでください。</p>}
              </div>
            </section>
            <section className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-900">今回は休ませておく項目</p>
                <p className="text-xs text-slate-500">この願いの棚には残しつつ、今回は使わない項目です。</p>
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
                  <p className="text-sm font-medium text-slate-900">この試し方や見方も足したい</p>
                  <p className="text-xs text-slate-500">たとえば 相手 / 場面 / 時間帯 のような、今回残したい項目を1件足せます。</p>
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
                      {customFieldForm.derivedFromKey ? "細かい項目を追加する" : "残したい項目を追加する"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customFieldForm.derivedFromKey ? "選んだ項目をより細かく残すための子項目を足します。" : "この願いで試したことや結果を残す項目を1件だけ足します。"}
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
                      placeholder="どのやり方を試したか残すため"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label">あとでどう使うか</label>
                    <input
                      type="text"
                      value={customFieldForm.howToUse}
                      onChange={(event) => setCustomFieldForm((current) => ({ ...current, howToUse: event.target.value }))}
                      placeholder="試し方ごとに見返す"
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
          id="question-step-6"
          type="button"
          className="btn-primary w-full scroll-mt-24"
          onClick={saveQuestion}
          disabled={isSaving || !form.question_text || selectedFieldKeys.length === 0 || Boolean(compareSetupError)}
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
