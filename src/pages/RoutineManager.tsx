import { useMemo, useState } from 'react';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { RoutineForm, type RoutineFormValues } from '../components/routine/RoutineForm';
import { useRoutineManager } from '../routine/hooks';
import { CADENCE_LABELS, DAY_LABELS, distinctCategories } from '../routine/engine';
import type { Routine } from '../data/types';

function routineSummary(routine: Routine): string {
  if (routine.kind === 'one-time') {
    return `One-time · ${routine.date ?? 'no date set'}`;
  }
  const cadence = CADENCE_LABELS[routine.cadence];
  if ((routine.cadence === 'weekly' || routine.cadence === 'custom') && routine.activeDays.length) {
    return `${routine.activeDays.map((d) => DAY_LABELS[d]).join(', ')}`;
  }
  return cadence;
}

function toFormValues(routine: Routine): RoutineFormValues {
  const { id, createdAt, updatedAt, deleted, syncedAt, order, ...rest } = routine;
  void id; void createdAt; void updatedAt; void deleted; void syncedAt; void order;
  return rest;
}

export default function RoutineManager() {
  const { routines, addRoutine, updateRoutine, deleteRoutine, setEnabled, move } = useRoutineManager();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const categories = useMemo(() => distinctCategories(routines), [routines]);
  const visible = categoryFilter ? routines.filter((r) => r.category === categoryFilter) : routines;
  const editingRoutine = editingId && editingId !== 'new' ? routines.find((r) => r.id === editingId) : undefined;

  async function handleSubmit(values: RoutineFormValues) {
    if (editingId && editingId !== 'new') {
      await updateRoutine(editingId, values);
    } else {
      await addRoutine(values);
    }
    setEditingId(null);
  }

  return (
    <PageShell
      title="Routines"
      right={
        editingId === null ? (
          <Button onClick={() => setEditingId('new')}>+ Add</Button>
        ) : undefined
      }
    >
      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
        Everything here — timing, cadence, category, order, reminders — is fully yours to
        change. Nothing about your day is fixed in code.
      </p>

      {editingId !== null && (
        <Card>
          <strong style={{ display: 'block', marginBottom: 12 }}>
            {editingId === 'new' ? 'New routine' : `Edit "${editingRoutine?.title}"`}
          </strong>
          <RoutineForm
            initial={editingRoutine ? toFormValues(editingRoutine) : undefined}
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={() => setEditingId(null)}
            submitLabel={editingId === 'new' ? 'Add routine' : 'Save changes'}
          />
        </Card>
      )}

      {categories.length > 0 && (
        <div className="category-filter">
          <button
            className={`category-filter__chip ${categoryFilter === null ? 'category-filter__chip--active' : ''}`}
            onClick={() => setCategoryFilter(null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`category-filter__chip ${categoryFilter === c ? 'category-filter__chip--active' : ''}`}
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon="🗓"
          title="No routines yet"
          description="Add your first one — wake-up time, a class, a workout, anything recurring or one-off."
          action={<Button variant="secondary" onClick={() => setEditingId('new')}>+ Add a routine</Button>}
        />
      ) : (
        <Card style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          {visible.map((routine, i) => (
            <div
              key={routine.id}
              className={`manager-item ${!routine.enabled ? 'manager-item--disabled' : ''}`}
              style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--color-border)' : 'none' }}
            >
              <div className="manager-item__reorder">
                <button aria-label="Move up" onClick={() => move(routine.id, 'up')}>▲</button>
                <button aria-label="Move down" onClick={() => move(routine.id, 'down')}>▼</button>
              </div>
              <div className="manager-item__body">
                <div className="manager-item__title">
                  {routine.time ? `${routine.time} · ` : ''}
                  {routine.title}
                </div>
                <div className="manager-item__meta">
                  {routine.category} · {routineSummary(routine)}
                  {routine.durationMinutes ? ` · ${routine.durationMinutes} min` : ''}
                  {routine.reminder.enabled ? ' · 🔔' : ''}
                  {!routine.enabled ? ' · disabled' : ''}
                </div>
              </div>
              <div className="manager-item__actions">
                <Button variant="ghost" onClick={() => setEnabled(routine.id, !routine.enabled)}>
                  {routine.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="ghost" onClick={() => setEditingId(routine.id)}>Edit</Button>
                {confirmDeleteId === routine.id ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      void deleteRoutine(routine.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    Confirm?
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmDeleteId(routine.id)}>Delete</Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
