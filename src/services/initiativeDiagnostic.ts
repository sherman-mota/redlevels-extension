import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';

/**
 * Why tactical issues end up in "Sem Iniciativa Vinculada": compares the configured strategic-initiative
 * custom field with what Redmine actually returned in each tactical issue (field missing, empty, or
 * another field that looks like the initiative). Pure function over the loaded issues.
 */

export interface DiagnosticField {
  id: number;
  name: string;
  /** Tactical issues where Redmine returned this field / where it has a value. */
  returned: number;
  filled: number;
}

export interface InitiativeDiagnostic {
  /** The configured field (undefined = none configured). */
  fieldId: number | undefined;
  /** Tactical issues loaded. */
  total: number;
  /** With the configured field filled / returned without value / not returned at all. */
  withValue: number;
  empty: number;
  absent: number;
  /** Other fields whose name looks like an initiative and that are filled somewhere. */
  candidates: DiagnosticField[];
  /** Every field Redmine returned in the tactical issues, most filled first. */
  fields: DiagnosticField[];
}

const looksLikeInitiative = /inici|estrat/i;

/** Text of a custom field value (multi-value fields come as arrays). */
export function fieldText(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return value === null || value === undefined ? '' : String(value);
}

export function diagnoseInitiative(issues: RedmineIssue[], config: RedlevelsConfig): InitiativeDiagnostic {
  const fieldId = config.strategicCustomFieldId;
  const tactical = new Set(config.tacticalTrackerIds || []);
  const tacticalIssues = issues.filter((i) => tactical.has(i.tracker?.id));
  const seen = new Map<number, DiagnosticField>();
  let withValue = 0;
  let empty = 0;
  let absent = 0;

  tacticalIssues.forEach((issue) => {
    const fields = Array.isArray(issue.custom_fields) ? issue.custom_fields : [];
    fields.forEach((f) => {
      const entry = seen.get(f.id) ?? { id: f.id, name: f.name || '', returned: 0, filled: 0 };
      entry.returned++;
      if (fieldText(f.value).trim()) entry.filled++;
      seen.set(f.id, entry);
    });
    if (fieldId !== undefined && fieldId !== null) {
      const configured = fields.find((f) => f.id === fieldId);
      if (!configured) absent++;
      else if (fieldText(configured.value).trim()) withValue++;
      else empty++;
    }
  });

  const fields = [...seen.values()].sort((a, b) => b.filled - a.filled || b.returned - a.returned);
  const candidates = fields.filter((f) => f.id !== fieldId && f.filled > 0 && looksLikeInitiative.test(f.name));
  return { fieldId, total: tacticalIssues.length, withValue, empty, absent, candidates, fields };
}
