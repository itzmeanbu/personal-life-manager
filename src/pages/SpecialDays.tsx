import { useCallback, useState } from 'react';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import { dayProfilesRepo, dayAssignmentsRepo } from '../data/repository';
import type { DayProfile, DayProfileEffects, DayChecklistItem, DayExtraAgendaItem } from '../data/types';
import { useActiveDayProfile, useAllDayProfiles } from '../day/hooks';
import { emptyEffects } from '../day/effects';
import { generateId } from '../data/repository';
import { MODULES } from '../app/navConfig';
import '../day/day.css';

type Tab = 'today' | 'assign' | 'profiles';

export default function SpecialDays() {
  const [tab, setTab] = useState<Tab>('today');
  const profiles = useAllDayProfiles();
  const { profile: active, assignment, isoDate } = useActiveDayProfile();
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DayProfile> | null>(null);

  const assignToday = useCallback(
    async (profileId: string) => {
      setBusy(true);
      try {
        if (assignment) {
          await dayAssignmentsRepo.update(assignment.id, {
            profileId,
            checklistDone: [],
          });
        } else {
          await dayAssignmentsRepo.create({
            date: isoDate,
            profileId,
            checklistDone: [],
          });
        }
        setTab('today');
      } finally {
        setBusy(false);
      }
    },
    [assignment, isoDate]
  );

  const clearToday = useCallback(async () => {
    if (!assignment) return;
    setBusy(true);
    try {
      await dayAssignmentsRepo.remove(assignment.id);
    } finally {
      setBusy(false);
    }
  }, [assignment]);

  const toggleChecklist = useCallback(
    async (itemId: string) => {
      if (!assignment) {
        // create assignment for active profile if only auto-resolved
        if (!active) return;
        setBusy(true);
        try {
          await dayAssignmentsRepo.create({
            date: isoDate,
            profileId: active.id,
            checklistDone: [itemId],
          });
        } finally {
          setBusy(false);
        }
        return;
      }
      const done = new Set(assignment.checklistDone ?? []);
      if (done.has(itemId)) done.delete(itemId);
      else done.add(itemId);
      await dayAssignmentsRepo.update(assignment.id, {
        checklistDone: Array.from(done),
      });
    },
    [assignment, active, isoDate]
  );

  const startCreate = () => {
    setEditingId('new');
    setDraft({
      name: '',
      icon: '⭐',
      description: '',
      enabled: true,
      systemKey: null,
      effects: emptyEffects(),
    });
    setTab('profiles');
  };

  const startEdit = (p: DayProfile) => {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      icon: p.icon,
      description: p.description,
      enabled: p.enabled,
      systemKey: p.systemKey,
      effects: structuredClone(p.effects),
    });
  };

  const saveDraft = async () => {
    if (!draft?.name?.trim() || !draft.effects) return;
    setBusy(true);
    try {
      if (editingId === 'new') {
        const maxOrder = profiles.reduce((m, p) => Math.max(m, p.order), -1);
        await dayProfilesRepo.create({
          name: draft.name.trim(),
          icon: draft.icon,
          description: draft.description,
          enabled: draft.enabled ?? true,
          systemKey: draft.systemKey ?? null,
          effects: draft.effects,
          order: maxOrder + 1,
        });
      } else if (editingId) {
        await dayProfilesRepo.update(editingId, {
          name: draft.name.trim(),
          icon: draft.icon,
          description: draft.description,
          enabled: draft.enabled,
          effects: draft.effects,
        });
      }
      setEditingId(null);
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm('Delete this day type? Assignments using it will no longer resolve.')) return;
    await dayProfilesRepo.remove(id);
  };

  const toggleEnabled = async (p: DayProfile) => {
    await dayProfilesRepo.update(p.id, { enabled: !p.enabled });
  };

  // ---- effect editors helpers ----
  const patchEffects = (patch: Partial<DayProfileEffects>) => {
    if (!draft?.effects) return;
    setDraft({ ...draft, effects: { ...draft.effects, ...patch } });
  };

  const addChecklistItem = () => {
    if (!draft?.effects) return;
    const item: DayChecklistItem = { id: generateId(), title: 'New item' };
    patchEffects({ checklist: [...draft.effects.checklist, item] });
  };

  const addExtraItem = () => {
    if (!draft?.effects) return;
    const item: DayExtraAgendaItem = {
      id: generateId(),
      title: 'New agenda item',
      category: 'Special',
      time: '10:00',
    };
    patchEffects({ extraAgendaItems: [...draft.effects.extraAgendaItems, item] });
  };

  const moduleOptions = MODULES.map((m) => m.id);

  function renderToday() {
    if (!active) {
      return (
        <>
          <EmptyState
            icon="📅"
            title="Normal day"
            description="No special day profile is active. Assign one under Assign, or mark Bunk in College."
            action={
              <Button variant="secondary" onClick={() => setTab('assign')}>
                Assign a day type
              </Button>
            }
          />
        </>
      );
    }

    const done = new Set(assignment?.checklistDone ?? []);
    const fx = active.effects;

    return (
      <>
        <Card className="day-hero">
          <div className="day-hero__icon">{active.icon ?? '⭐'}</div>
          <div>
            <h2 className="day-hero__title">{active.name}</h2>
            {fx.bannerMessage && <p className="day-hero__banner">{fx.bannerMessage}</p>}
            {active.description && (
              <p className="day-hint">{active.description}</p>
            )}
          </div>
        </Card>

        {(fx.foodPlan || fx.travelPlan) && (
          <Card>
            {fx.foodPlan && (
              <p>
                <strong>Food:</strong> {fx.foodPlan}
              </p>
            )}
            {fx.travelPlan && (
              <p style={{ marginTop: fx.foodPlan ? 8 : 0 }}>
                <strong>Travel:</strong> {fx.travelPlan}
              </p>
            )}
          </Card>
        )}

        {fx.checklist.length > 0 && (
          <>
            <SectionHeader title="Checklist" />
            <Card style={{ padding: 0 }}>
              {fx.checklist.map((item, i) => (
                <label
                  key={item.id}
                  className="day-check-row"
                  style={{
                    borderBottom:
                      i < fx.checklist.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={done.has(item.id)}
                    onChange={() => toggleChecklist(item.id)}
                  />
                  <span className={done.has(item.id) ? 'day-check-done' : ''}>{item.title}</span>
                </label>
              ))}
            </Card>
          </>
        )}

        {fx.extraAgendaItems.length > 0 && (
          <>
            <SectionHeader title="Special agenda" />
            <Card style={{ padding: 0 }}>
              {fx.extraAgendaItems.map((item, i) => (
                <div
                  key={item.id}
                  className="day-extra-row"
                  style={{
                    borderBottom:
                      i < fx.extraAgendaItems.length - 1
                        ? '1px solid var(--color-border)'
                        : 'none',
                  }}
                >
                  <span className="day-extra-row__time">{item.time ?? '—'}</span>
                  <div>
                    <div className="day-extra-row__title">{item.title}</div>
                    <div className="day-hint">
                      {item.category}
                      {item.notes ? ` · ${item.notes}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {(fx.hideModules.length > 0 || fx.focusModules.length > 0) && (
          <Card>
            <p className="day-hint">
              Home shows a focused module set for this day type (not every page at once).
            </p>
            {fx.focusModules.length > 0 && (
              <p style={{ marginTop: 6 }}>
                <strong>Focus:</strong> {fx.focusModules.join(', ')}
              </p>
            )}
            {fx.hideModules.length > 0 && (
              <p style={{ marginTop: 4 }}>
                <strong>Hidden:</strong> {fx.hideModules.join(', ')}
              </p>
            )}
          </Card>
        )}

        {assignment && (
          <Button variant="ghost" disabled={busy} onClick={clearToday}>
            Clear assignment for today
          </Button>
        )}
      </>
    );
  }

  function renderAssign() {
    const enabled = profiles.filter((p) => p.enabled);
    return (
      <>
        <SectionHeader title={`Assign for ${isoDate}`} />
        <p className="day-hint">
          Pick a day type. This drives Today&apos;s agenda filters, checklists, and which modules
          appear on Home. Sunday and College bunk auto-apply when no manual assignment exists.
        </p>
        <div className="day-profile-grid">
          {enabled.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`day-profile-tile ${active?.id === p.id ? 'day-profile-tile--active' : ''}`}
              disabled={busy}
              onClick={() => assignToday(p.id)}
            >
              <span className="day-profile-tile__icon">{p.icon ?? '⭐'}</span>
              <span className="day-profile-tile__name">{p.name}</span>
            </button>
          ))}
        </div>
        {assignment && (
          <Button variant="secondary" disabled={busy} onClick={clearToday}>
            Clear today&apos;s assignment
          </Button>
        )}
      </>
    );
  }

  function renderProfiles() {
    if (editingId && draft) {
      const fx = draft.effects!;
      return (
        <>
          <SectionHeader title={editingId === 'new' ? 'New day type' : 'Edit day type'} />
          <Card>
            <div className="day-form-row">
              <input
                className="day-input day-input--icon"
                value={draft.icon ?? ''}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                placeholder="😀"
                maxLength={4}
              />
              <input
                className="day-input"
                value={draft.name ?? ''}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Name"
              />
            </div>
            <textarea
              className="day-input day-textarea"
              value={draft.description ?? ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Description"
              rows={2}
            />
            <label className="day-check-row" style={{ padding: '8px 0' }}>
              <input
                type="checkbox"
                checked={!!fx.replaceBaseRoutines}
                onChange={(e) => patchEffects({ replaceBaseRoutines: e.target.checked })}
              />
              Replace base routines (exam / hackathon style)
            </label>
            <label className="day-field-label">Banner message</label>
            <input
              className="day-input"
              value={fx.bannerMessage ?? ''}
              onChange={(e) => patchEffects({ bannerMessage: e.target.value })}
            />
            <label className="day-field-label">Food plan</label>
            <input
              className="day-input"
              value={fx.foodPlan ?? ''}
              onChange={(e) => patchEffects({ foodPlan: e.target.value })}
            />
            <label className="day-field-label">Travel plan</label>
            <input
              className="day-input"
              value={fx.travelPlan ?? ''}
              onChange={(e) => patchEffects({ travelPlan: e.target.value })}
            />
            <label className="day-field-label">
              Disable module tags (comma: workout, college, guitar)
            </label>
            <input
              className="day-input"
              value={fx.disableModuleTags.join(', ')}
              onChange={(e) =>
                patchEffects({
                  disableModuleTags: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <label className="day-field-label">Hide modules (ids)</label>
            <input
              className="day-input"
              value={fx.hideModules.join(', ')}
              onChange={(e) =>
                patchEffects({
                  hideModules: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <p className="day-hint">Available: {moduleOptions.join(', ')}</p>
            <label className="day-field-label">Focus modules only (empty = all not hidden)</label>
            <input
              className="day-input"
              value={fx.focusModules.join(', ')}
              onChange={(e) =>
                patchEffects({
                  focusModules: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />

            <SectionHeader
              title="Checklist"
              action={
                <Button variant="ghost" onClick={addChecklistItem}>
                  + Item
                </Button>
              }
            />
            {fx.checklist.map((item, idx) => (
              <div key={item.id} className="day-form-row" style={{ marginBottom: 6 }}>
                <input
                  className="day-input"
                  value={item.title}
                  onChange={(e) => {
                    const checklist = [...fx.checklist];
                    checklist[idx] = { ...item, title: e.target.value };
                    patchEffects({ checklist });
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={() =>
                    patchEffects({ checklist: fx.checklist.filter((c) => c.id !== item.id) })
                  }
                >
                  ×
                </Button>
              </div>
            ))}

            <SectionHeader
              title="Extra agenda items"
              action={
                <Button variant="ghost" onClick={addExtraItem}>
                  + Item
                </Button>
              }
            />
            {fx.extraAgendaItems.map((item, idx) => (
              <div key={item.id} className="day-extra-edit">
                <div className="day-form-row">
                  <input
                    className="day-input day-input--time"
                    value={item.time ?? ''}
                    placeholder="HH:mm"
                    onChange={(e) => {
                      const extraAgendaItems = [...fx.extraAgendaItems];
                      extraAgendaItems[idx] = { ...item, time: e.target.value };
                      patchEffects({ extraAgendaItems });
                    }}
                  />
                  <input
                    className="day-input"
                    value={item.title}
                    onChange={(e) => {
                      const extraAgendaItems = [...fx.extraAgendaItems];
                      extraAgendaItems[idx] = { ...item, title: e.target.value };
                      patchEffects({ extraAgendaItems });
                    }}
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      patchEffects({
                        extraAgendaItems: fx.extraAgendaItems.filter((x) => x.id !== item.id),
                      })
                    }
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}

            <div className="day-form-row" style={{ marginTop: 16 }}>
              <Button variant="primary" disabled={busy || !draft.name?.trim()} onClick={saveDraft}>
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setDraft(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </>
      );
    }

    return (
      <>
        <SectionHeader
          title="Day types"
          action={
            <Button variant="secondary" onClick={startCreate}>
              + New
            </Button>
          }
        />
        <p className="day-hint">
          Everything is editable here. New custom day types need no code changes.
        </p>
        {profiles.length === 0 ? (
          <EmptyState icon="📂" title="No profiles" description="Seed may still be running." />
        ) : (
          <Card style={{ padding: 0 }}>
            {profiles.map((p, i) => (
              <div
                key={p.id}
                className="day-cat-row"
                style={{
                  borderBottom: i < profiles.length - 1 ? '1px solid var(--color-border)' : 'none',
                  opacity: p.enabled ? 1 : 0.5,
                }}
              >
                <span className="day-cat-row__icon">{p.icon ?? '⭐'}</span>
                <div className="day-cat-row__body">
                  <div className="day-cat-row__name">
                    {p.name}
                    {p.systemKey && <span className="day-badge">{p.systemKey}</span>}
                  </div>
                  {p.description && <div className="day-hint">{p.description}</div>}
                </div>
                <div className="day-cat-row__actions">
                  <button type="button" className="day-link" onClick={() => startEdit(p)}>
                    Edit
                  </button>
                  <button type="button" className="day-link" onClick={() => toggleEnabled(p)}>
                    {p.enabled ? 'Disable' : 'Enable'}
                  </button>
                  {!p.systemKey && (
                    <button
                      type="button"
                      className="day-link day-link--danger"
                      onClick={() => deleteProfile(p.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </>
    );
  }

  return (
    <PageShell title="Special Days">
      <div className="day-tabs">
        {(
          [
            ['today', 'Active'],
            ['assign', 'Assign'],
            ['profiles', 'Day types'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`day-tab ${tab === id ? 'day-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'today' && renderToday()}
      {tab === 'assign' && renderAssign()}
      {tab === 'profiles' && renderProfiles()}
    </PageShell>
  );
}
