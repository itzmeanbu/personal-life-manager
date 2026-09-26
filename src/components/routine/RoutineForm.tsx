import { useState, type FormEvent } from 'react';
import type { BaseEntity, Routine } from '../../data/types';
import { Button } from '../ui/Button';
import { CADENCE_LABELS, DAY_LABELS } from '../../routine/engine';

export type RoutineFormValues = Omit<Routine, keyof BaseEntity | 'order'>;

interface RoutineFormProps {
  initial?: RoutineFormValues;
  categories: string[];
  onSubmit: (values: RoutineFormValues) => void | Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

function defaultValues(): RoutineFormValues {
  return {
    title: '',
    notes: '',
    category: '',
    kind: 'recurring',
    cadence: 'daily',
    activeDays: [],
    date: undefined,
    time: '',
    durationMinutes: undefined,
    enabled: true,
    archived: false,
    reminder: { enabled: false, offsetMinutes: 0 },
    moduleTag: '',
  };
}

export function RoutineForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  submitLabel = 'Save routine',
}: RoutineFormProps) {
  const [values, setValues] = useState<RoutineFormValues>(initial ?? defaultValues());
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof RoutineFormValues>(key: K, value: RoutineFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleDay(day: number) {
    setValues((v) => ({
      ...v,
      activeDays: v.activeDays.includes(day)
        ? v.activeDays.filter((d) => d !== day)
        : [...v.activeDays, day].sort(),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        category: values.category.trim() || 'General',
        durationMinutes: values.durationMinutes || undefined,
        time: values.time || undefined,
        date: values.kind === 'one-time' ? values.date : undefined,
        moduleTag: values.moduleTag || undefined,
        notes: values.notes || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const showDayPicker = values.kind === 'recurring' && (values.cadence === 'weekly' || values.cadence === 'custom');

  return (
    <form className="routine-form" onSubmit={handleSubmit}>
      <div className="field">
        <label className="field__label" htmlFor="rf-title">Title</label>
        <input
          id="rf-title"
          className="field__input"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Guitar practice"
          required
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="rf-category">Category</label>
        <input
          id="rf-category"
          className="field__input"
          list="rf-category-list"
          value={values.category}
          onChange={(e) => set('category', e.target.value)}
          placeholder="e.g. Fitness, Hygiene, Study…"
        />
        <datalist id="rf-category-list">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="rf-kind">Type</label>
          <select
            id="rf-kind"
            className="field__select"
            value={values.kind}
            onChange={(e) => set('kind', e.target.value as RoutineFormValues['kind'])}
          >
            <option value="recurring">Recurring</option>
            <option value="one-time">One-time</option>
          </select>
        </div>

        {values.kind === 'recurring' ? (
          <div className="field">
            <label className="field__label" htmlFor="rf-cadence">Repeats</label>
            <select
              id="rf-cadence"
              className="field__select"
              value={values.cadence}
              onChange={(e) => set('cadence', e.target.value as RoutineFormValues['cadence'])}
            >
              {Object.entries(CADENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label className="field__label" htmlFor="rf-date">Date</label>
            <input
              id="rf-date"
              type="date"
              className="field__input"
              value={values.date ?? ''}
              onChange={(e) => set('date', e.target.value)}
              required
            />
          </div>
        )}
      </div>

      {showDayPicker && (
        <div className="field">
          <span className="field__label">Days</span>
          <div className="day-picker">
            {DAY_LABELS.map((label, index) => (
              <button
                type="button"
                key={label}
                className={`day-picker__chip ${values.activeDays.includes(index) ? 'day-picker__chip--active' : ''}`}
                onClick={() => toggleDay(index)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="rf-time">Time (optional)</label>
          <input
            id="rf-time"
            type="time"
            className="field__input"
            value={values.time ?? ''}
            onChange={(e) => set('time', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="rf-duration">Duration (min)</label>
          <input
            id="rf-duration"
            type="number"
            min={0}
            className="field__input"
            value={values.durationMinutes ?? ''}
            onChange={(e) => set('durationMinutes', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="rf-notes">Notes (optional)</label>
        <textarea
          id="rf-notes"
          className="field__textarea"
          value={values.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
        />
      </div>

      <div className="field toggle-row">
        <label className="toggle">
          <input
            type="checkbox"
            checked={values.reminder.enabled}
            onChange={(e) => set('reminder', { ...values.reminder, enabled: e.target.checked })}
          />
          <span>Reminder</span>
        </label>
        {values.reminder.enabled && (
          <input
            type="number"
            min={0}
            className="field__input field__input--compact"
            value={values.reminder.offsetMinutes}
            onChange={(e) =>
              set('reminder', { ...values.reminder, offsetMinutes: Number(e.target.value) || 0 })
            }
            aria-label="Minutes before scheduled time"
          />
        )}
        {values.reminder.enabled && <span className="field__hint">min before</span>}
      </div>

      <div className="field toggle-row">
        <label className="toggle">
          <input
            type="checkbox"
            checked={values.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          <span>Active (uncheck to temporarily disable, without deleting)</span>
        </label>
      </div>

      <div className="routine-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
