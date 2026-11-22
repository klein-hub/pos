import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface EditableRecordResult<T extends Record<string, unknown>> {
  form: T;
  updateField: (field: keyof T, value: T[keyof T]) => void;
  getChanges: () => Partial<T>;
  save: () => Promise<{ skipped: true } | { data: T; changes: Partial<T> }>;
  saving: boolean;
  isDirty: boolean;
}

export function useEditableRecord<T extends Record<string, unknown>>(
  table: string,
  initialRecord: T,
): EditableRecordResult<T> {
  const [original] = useState<T>(initialRecord);
  const [form, setForm] = useState<T>(initialRecord);
  const [saving, setSaving] = useState(false);

  const updateField = useCallback((field: keyof T, value: T[keyof T]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const getChanges = useCallback((): Partial<T> => {
    const changes: Partial<T> = {};
    for (const key in form) {
      if (form[key] !== original[key]) {
        changes[key as keyof T] = form[key];
      }
    }
    return changes;
  }, [form, original]);

  const save = useCallback(async () => {
    const changes = getChanges();
    if (Object.keys(changes).length === 0) return { skipped: true as const };

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from(table)
        .update(changes)
        .eq("id", (original as any).id)
        .select()
        .single();

      if (error) throw error;
      return { data: data as T, changes };
    } finally {
      setSaving(false);
    }
  }, [table, original, getChanges]);

  const isDirty = Object.keys(getChanges()).length > 0;

  return { form, updateField, getChanges, save, saving, isDirty };
}
