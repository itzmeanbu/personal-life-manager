import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageShell } from '../components/ui/PageShell';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/States';
import {
  vehiclesRepo,
  fuelRecordsRepo,
  distanceRecordsRepo,
  maintenanceRecordsRepo,
} from '../data/repository';
import type { Vehicle, MaintenanceKind } from '../data/types';
import { toIsoDate } from '../routine/engine';
import { computeRange, litresFromMoney } from '../vehicle/range';
import '../vehicle/vehicle.css';

type Tab = 'range' | 'fuel' | 'distance' | 'maintain' | 'vehicles';

const SUGGESTED_MILEAGE = 55; // suggestion only — never locked

export default function Bike() {
  const [tab, setTab] = useState<Tab>('range');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Fuel form
  const [entryMode, setEntryMode] = useState<'litres' | 'money'>('litres');
  const [litresIn, setLitresIn] = useState('');
  const [moneyIn, setMoneyIn] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');

  // Distance form
  const [kmIn, setKmIn] = useState('');
  const [distPurpose, setDistPurpose] = useState('');

  // Maintenance form
  const [mKind, setMKind] = useState<MaintenanceKind>('oil_change');
  const [mNotes, setMNotes] = useState('');
  const [mCost, setMCost] = useState('');

  // New vehicle form
  const [vName, setVName] = useState('');
  const [vType, setVType] = useState<Vehicle['type']>('bike');
  const [vMileage, setVMileage] = useState(String(SUGGESTED_MILEAGE));
  const [vPrice, setVPrice] = useState('100');
  const [vWarn, setVWarn] = useState('15');

  const todayIso = toIsoDate(new Date());

  const vehicles = useLiveQuery(
    () => vehiclesRepo.list().then((r) => r.sort((a, b) => a.name.localeCompare(b.name))),
    []
  );
  const fuel = useLiveQuery(() => fuelRecordsRepo.list(), []);
  const distance = useLiveQuery(() => distanceRecordsRepo.list(), []);
  const maintenance = useLiveQuery(() => maintenanceRecordsRepo.list(), []);

  const activeVehicles = useMemo(
    () => (vehicles ?? []).filter((v) => !v.deleted && v.enabled && !v.sold),
    [vehicles]
  );
  const allVehicles = useMemo(
    () => (vehicles ?? []).filter((v) => !v.deleted),
    [vehicles]
  );

  useEffect(() => {
    if (!vehicleId && activeVehicles[0]) setVehicleId(activeVehicles[0].id);
  }, [activeVehicles, vehicleId]);

  const vehicle = allVehicles.find((v) => v.id === vehicleId) ?? null;

  const range = useMemo(() => {
    if (!vehicle) return null;
    return computeRange(vehicle, fuel ?? [], distance ?? []);
  }, [vehicle, fuel, distance]);

  const vehicleFuel = useMemo(
    () =>
      (fuel ?? [])
        .filter((f) => f.vehicleId === vehicleId && !f.deleted)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [fuel, vehicleId]
  );
  const vehicleDist = useMemo(
    () =>
      (distance ?? [])
        .filter((d) => d.vehicleId === vehicleId && !d.deleted)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [distance, vehicleId]
  );
  const vehicleMaint = useMemo(
    () =>
      (maintenance ?? [])
        .filter((m) => m.vehicleId === vehicleId && !m.deleted)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [maintenance, vehicleId]
  );

  const addVehicle = async () => {
    if (!vName.trim()) return;
    setBusy(true);
    try {
      const row = await vehiclesRepo.create({
        name: vName.trim(),
        type: vType,
        expectedMileageKmPerL: Number(vMileage) || SUGGESTED_MILEAGE,
        fuelPricePerLitre: Number(vPrice) || 100,
        lowRangeWarnKm: Number(vWarn) || 15,
        enabled: true,
        sold: false,
        trackingStartedAt: todayIso,
      });
      setVehicleId(row.id);
      setVName('');
      setMsg('Vehicle added. Mileage is editable — not locked to 55.');
      setTab('range');
    } finally {
      setBusy(false);
    }
  };

  const addFuel = async () => {
    if (!vehicle || vehicle.sold) return;
    setBusy(true);
    setMsg(null);
    try {
      let litres = 0;
      let cost: number | undefined;
      let priceUsed: number | undefined;
      if (entryMode === 'litres') {
        litres = Number(litresIn);
        if (!(litres > 0)) return;
      } else {
        const money = Number(moneyIn);
        if (!(money > 0)) return;
        priceUsed = vehicle.fuelPricePerLitre;
        litres = litresFromMoney(money, priceUsed);
        cost = money;
      }
      await fuelRecordsRepo.create({
        vehicleId: vehicle.id,
        date: todayIso,
        litres,
        cost,
        entryMode,
        pricePerLitreUsed: priceUsed,
        notes: fuelNotes.trim() || undefined,
      });
      setLitresIn('');
      setMoneyIn('');
      setFuelNotes('');
      setMsg(
        `Added ${litres.toFixed(2)} L → ~${(litres * vehicle.expectedMileageKmPerL).toFixed(0)} km range at ${vehicle.expectedMileageKmPerL} km/L`
      );
    } finally {
      setBusy(false);
    }
  };

  const addDistance = async () => {
    if (!vehicle || vehicle.sold) return;
    const km = Number(kmIn);
    if (!(km > 0)) return;
    setBusy(true);
    try {
      await distanceRecordsRepo.create({
        vehicleId: vehicle.id,
        date: todayIso,
        km,
        purpose: distPurpose.trim() || undefined,
      });
      setKmIn('');
      setDistPurpose('');
    } finally {
      setBusy(false);
    }
  };

  const addMaintenance = async () => {
    if (!vehicle) return;
    setBusy(true);
    try {
      await maintenanceRecordsRepo.create({
        vehicleId: vehicle.id,
        date: todayIso,
        kind: mKind,
        cost: mCost ? Number(mCost) : undefined,
        notes: mNotes.trim() || undefined,
      });
      if (mKind === 'reset_tracking') {
        await vehiclesRepo.update(vehicle.id, { trackingStartedAt: todayIso });
        setMsg('New tracking period started. History kept; range recalculates from today.');
      }
      setMNotes('');
      setMCost('');
    } finally {
      setBusy(false);
    }
  };

  const resetTracking = async () => {
    if (!vehicle) return;
    if (!confirm('Start a new tracking period? Old fuel/distance history is kept but range uses data from today onward.'))
      return;
    await vehiclesRepo.update(vehicle.id, { trackingStartedAt: todayIso });
    await maintenanceRecordsRepo.create({
      vehicleId: vehicle.id,
      date: todayIso,
      kind: 'reset_tracking',
      notes: 'Tracking period reset',
    });
    setMsg('Tracking reset.');
  };

  const markSold = async (v: Vehicle) => {
    if (!confirm(`Mark “${v.name}” as sold? History is kept; active tracking stops.`)) return;
    await vehiclesRepo.update(v.id, { sold: true, soldDate: todayIso, enabled: false });
  };

  function tabsBar() {
    const items: { id: Tab; label: string }[] = [
      { id: 'range', label: 'Range' },
      { id: 'fuel', label: 'Fuel' },
      { id: 'distance', label: 'Distance' },
      { id: 'maintain', label: 'Maintain' },
      { id: 'vehicles', label: 'Vehicles' },
    ];
    return (
      <div className="vh-tabs">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`vh-tab ${tab === t.id ? 'vh-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <PageShell title="Vehicles">
      {tabsBar()}

      {allVehicles.length > 0 && (
        <div className="vh-chips">
          {allVehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`vh-chip ${vehicleId === v.id ? 'vh-chip--on' : ''}`}
              onClick={() => setVehicleId(v.id)}
            >
              {v.name}
              {v.sold ? ' (sold)' : !v.enabled ? ' (off)' : ''}
            </button>
          ))}
        </div>
      )}

      {!vehicle && tab !== 'vehicles' && (
        <EmptyState
          icon="🚲"
          title="No vehicle yet"
          description="Add a bike or car under Vehicles. Mileage is yours to set — not fixed at 55."
          action={
            <Button variant="secondary" onClick={() => setTab('vehicles')}>
              Add vehicle
            </Button>
          }
        />
      )}

      {vehicle && tab === 'range' && range && (
        <>
          {range.critical && (
            <div className="vh-banner vh-banner--crit">
              Estimated range is at or below zero — refuel soon.
            </div>
          )}
          {!range.critical && range.lowWarning && (
            <div className="vh-banner vh-banner--warn">
              Low range: ~{range.remainingKm.toFixed(0)} km left (warn at {vehicle.lowRangeWarnKm} km).
            </div>
          )}
          <div className="vh-stat-grid">
            <div className="vh-stat">
              <div
                className={`vh-stat__value ${
                  range.critical ? 'vh-stat__value--crit' : range.lowWarning ? 'vh-stat__value--warn' : ''
                }`}
              >
                {range.remainingKm.toFixed(0)} km
              </div>
              <div className="vh-stat__label">Remaining (est.)</div>
            </div>
            <div className="vh-stat">
              <div className="vh-stat__value">{range.estimatedRangeKm.toFixed(0)} km</div>
              <div className="vh-stat__label">From fuel this period</div>
            </div>
            <div className="vh-stat">
              <div className="vh-stat__value">{range.distanceTravelledKm.toFixed(0)} km</div>
              <div className="vh-stat__label">Travelled this period</div>
            </div>
            <div className="vh-stat">
              <div className="vh-stat__value">{vehicle.expectedMileageKmPerL} km/L</div>
              <div className="vh-stat__label">Configured mileage</div>
            </div>
          </div>
          <Card>
            <p className="vh-muted">
              Formula: litres × mileage − distance. Mileage is <strong>not</strong> permanently
              assumed as 55 — change it under Vehicles. Tracking since{' '}
              {vehicle.trackingStartedAt ?? 'all history'}.
            </p>
            {vehicle.sold && (
              <p className="vh-muted">Sold — history retained, tracking stopped.</p>
            )}
            {msg && <p className="vh-muted">{msg}</p>}
          </Card>
        </>
      )}

      {vehicle && tab === 'fuel' && (
        <>
          <Card>
            <strong>Add fuel</strong>
            <p className="vh-muted">History is never erased when you add more.</p>
            <div className="vh-chips">
              <button
                type="button"
                className={`vh-chip ${entryMode === 'litres' ? 'vh-chip--on' : ''}`}
                onClick={() => setEntryMode('litres')}
              >
                Enter litres
              </button>
              <button
                type="button"
                className={`vh-chip ${entryMode === 'money' ? 'vh-chip--on' : ''}`}
                onClick={() => setEntryMode('money')}
              >
                Enter money
              </button>
            </div>
            {entryMode === 'litres' ? (
              <div className="vh-field">
                <label>Litres</label>
                <input
                  className="vh-input"
                  type="number"
                  value={litresIn}
                  onChange={(e) => setLitresIn(e.target.value)}
                />
              </div>
            ) : (
              <div className="vh-field">
                <label>Money spent (₹) → ÷ {vehicle.fuelPricePerLitre}/L</label>
                <input
                  className="vh-input"
                  type="number"
                  value={moneyIn}
                  onChange={(e) => setMoneyIn(e.target.value)}
                />
                {moneyIn && (
                  <p className="vh-muted">
                    ≈ {litresFromMoney(Number(moneyIn), vehicle.fuelPricePerLitre).toFixed(2)} L · ≈{' '}
                    {(
                      litresFromMoney(Number(moneyIn), vehicle.fuelPricePerLitre) *
                      vehicle.expectedMileageKmPerL
                    ).toFixed(0)}{' '}
                    km
                  </p>
                )}
              </div>
            )}
            <div className="vh-field">
              <label>Notes</label>
              <input
                className="vh-input"
                value={fuelNotes}
                onChange={(e) => setFuelNotes(e.target.value)}
              />
            </div>
            <Button variant="primary" disabled={busy || vehicle.sold} onClick={addFuel}>
              Save fuel
            </Button>
            {msg && <p className="vh-muted">{msg}</p>}
          </Card>
          <SectionHeader title="Fuel history" />
          {vehicleFuel.length === 0 ? (
            <EmptyState icon="⛽" title="No fuel logs" description="Add litres or money above." />
          ) : (
            <Card style={{ padding: 0 }}>
              {vehicleFuel.map((f, i) => (
                <div
                  key={f.id}
                  className="vh-row"
                  style={{
                    borderBottom: i < vehicleFuel.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {f.date} · {f.litres.toFixed(2)} L
                      {f.cost != null ? ` · ₹${f.cost}` : ''}
                    </div>
                    <div className="vh-muted">
                      via {f.entryMode}
                      {f.notes ? ` · ${f.notes}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="vh-link"
                    onClick={() => fuelRecordsRepo.remove(f.id, true)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {vehicle && tab === 'distance' && (
        <>
          <Card>
            <strong>How many km today?</strong>
            <div className="vh-field">
              <label>Kilometres</label>
              <input
                className="vh-input"
                type="number"
                value={kmIn}
                onChange={(e) => setKmIn(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="vh-field">
              <label>Purpose (optional)</label>
              <input
                className="vh-input"
                value={distPurpose}
                onChange={(e) => setDistPurpose(e.target.value)}
              />
            </div>
            <Button variant="primary" disabled={busy || vehicle.sold} onClick={addDistance}>
              Log distance
            </Button>
          </Card>
          <SectionHeader title="Distance history" />
          {vehicleDist.length === 0 ? (
            <EmptyState icon="🛣️" title="No distance logs" description="Enter km travelled to reduce remaining range." />
          ) : (
            <Card style={{ padding: 0 }}>
              {vehicleDist.map((d, i) => (
                <div
                  key={d.id}
                  className="vh-row"
                  style={{
                    borderBottom: i < vehicleDist.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {d.date} · {d.km} km
                    </div>
                    <div className="vh-muted">{d.purpose ?? ''}</div>
                  </div>
                  <button
                    type="button"
                    className="vh-link"
                    onClick={() => distanceRecordsRepo.remove(d.id, true)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {vehicle && tab === 'maintain' && (
        <>
          <Card>
            <strong>Maintenance / reset</strong>
            <div className="vh-field">
              <label>Type</label>
              <select
                className="vh-input"
                value={mKind}
                onChange={(e) => setMKind(e.target.value as MaintenanceKind)}
              >
                <option value="oil_change">Oil change</option>
                <option value="service">Service</option>
                <option value="tyre">Tyre</option>
                <option value="other">Other</option>
                <option value="reset_tracking">Reset tracking period</option>
              </select>
            </div>
            <div className="vh-field">
              <label>Cost (optional)</label>
              <input
                className="vh-input"
                type="number"
                value={mCost}
                onChange={(e) => setMCost(e.target.value)}
              />
            </div>
            <div className="vh-field">
              <label>Notes</label>
              <input className="vh-input" value={mNotes} onChange={(e) => setMNotes(e.target.value)} />
            </div>
            <div className="vh-actions">
              <Button variant="primary" disabled={busy} onClick={addMaintenance}>
                Save
              </Button>
              <Button variant="secondary" onClick={resetTracking}>
                Start new tracking period
              </Button>
            </div>
            {msg && <p className="vh-muted">{msg}</p>}
          </Card>
          <SectionHeader title="Maintenance log" />
          {vehicleMaint.length === 0 ? (
            <EmptyState icon="🔧" title="No maintenance yet" description="" />
          ) : (
            <Card style={{ padding: 0 }}>
              {vehicleMaint.map((m, i) => (
                <div
                  key={m.id}
                  className="vh-row"
                  style={{
                    borderBottom: i < vehicleMaint.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {m.date} · {m.kind}
                      {m.cost != null ? ` · ₹${m.cost}` : ''}
                    </div>
                    <div className="vh-muted">{m.notes ?? ''}</div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {tab === 'vehicles' && (
        <>
          <Card>
            <strong>Add vehicle</strong>
            <p className="vh-muted">
              Suggested mileage {SUGGESTED_MILEAGE} km/L is only a starting value — change anytime.
              Real mileage is often unknown; estimates are yours.
            </p>
            <div className="vh-field">
              <label>Name</label>
              <input
                className="vh-input"
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                placeholder="Bike 1"
              />
            </div>
            <div className="vh-field">
              <label>Type</label>
              <select
                className="vh-input"
                value={vType}
                onChange={(e) => setVType(e.target.value as Vehicle['type'])}
              >
                <option value="bike">Bike</option>
                <option value="car">Car</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="vh-field">
              <label>Expected mileage (km/L)</label>
              <input
                className="vh-input"
                type="number"
                value={vMileage}
                onChange={(e) => setVMileage(e.target.value)}
              />
            </div>
            <div className="vh-field">
              <label>Fuel price (₹/L)</label>
              <input
                className="vh-input"
                type="number"
                value={vPrice}
                onChange={(e) => setVPrice(e.target.value)}
              />
            </div>
            <div className="vh-field">
              <label>Low-range warn at (km)</label>
              <input
                className="vh-input"
                type="number"
                value={vWarn}
                onChange={(e) => setVWarn(e.target.value)}
              />
            </div>
            <Button variant="primary" disabled={busy} onClick={addVehicle}>
              Add
            </Button>
          </Card>

          <SectionHeader title="All vehicles" />
          {allVehicles.length === 0 ? (
            <EmptyState icon="🚲" title="None yet" description="Add Bike 1, Bike 2, future car…" />
          ) : (
            <Card style={{ padding: 0 }}>
              {allVehicles.map((v, i) => (
                <div
                  key={v.id}
                  className="vh-row"
                  style={{
                    borderBottom: i < allVehicles.length - 1 ? '1px solid var(--color-border)' : 'none',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {v.name} · {v.type}
                    {v.sold ? ' · SOLD' : ''}
                  </div>
                  <div className="vh-field">
                    <label>Mileage km/L</label>
                    <input
                      className="vh-input"
                      type="number"
                      value={v.expectedMileageKmPerL}
                      onChange={(e) =>
                        vehiclesRepo.update(v.id, {
                          expectedMileageKmPerL: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="vh-field">
                    <label>Fuel price ₹/L</label>
                    <input
                      className="vh-input"
                      type="number"
                      value={v.fuelPricePerLitre}
                      onChange={(e) =>
                        vehiclesRepo.update(v.id, {
                          fuelPricePerLitre: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="vh-field">
                    <label>Low warn km</label>
                    <input
                      className="vh-input"
                      type="number"
                      value={v.lowRangeWarnKm}
                      onChange={(e) =>
                        vehiclesRepo.update(v.id, {
                          lowRangeWarnKm: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="vh-actions">
                    <Button
                      variant="ghost"
                      onClick={() => vehiclesRepo.update(v.id, { enabled: !v.enabled })}
                    >
                      {v.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    {!v.sold && (
                      <Button variant="secondary" onClick={() => markSold(v)}>
                        Mark sold
                      </Button>
                    )}
                    <button
                      type="button"
                      className="vh-link"
                      onClick={() => vehiclesRepo.remove(v.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}
