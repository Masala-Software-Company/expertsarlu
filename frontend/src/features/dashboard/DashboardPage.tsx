import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { isAppRole, ROLE_MISSIONS, type AppRole } from '@/lib/role-access';
import { ROLE_LABELS, STATUT_LABELS, formatMoney, firstName } from '@/lib/utils';

type Dossier = {
  id: string;
  numero: string;
  statut: string;
  destination?: string;
  priorite: string;
  patient?: { id: string; nom: string; prenom: string; photoProfil?: string | null };
  lignesCotation?: { montant: string | number }[];
};

type Pipeline = {
  facture: number;
  encaisse: number;
  enAttente: number;
  parAgent: { nom: string; facture: number; encaisse: number }[];
  parDestination: { destination: string; facture: number; encaisse: number }[];
};

type CaisseItem = {
  id: string;
  numero: string;
  type: string;
  statut: string;
  montantTotal: string | number;
  dossierId: string;
};

type Prospect = { id: string; nom: string; prenom?: string; statut: string };
type Rdv = { id: string; type: string; dateHeure: string; lieu?: string; dossier?: { numero: string } };

const C = {
  brand: '#144EB9',
  brandSoft: '#3B82F6',
  success: '#059669',
  warn: '#D97706',
  danger: '#DC2626',
  slate: '#64748B',
  ink: '#0F172A',
  muted: '#94A3B8',
};

const PRIORITE_COLORS: Record<string, string> = {
  Normale: C.brand,
  Urgente: C.warn,
  Critique: C.danger,
};

function ChartPanel({
  title,
  subtitle,
  children,
  className = '',
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-surface p-5 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/[0.06] to-transparent" />
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  );
}

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-xs shadow-soft">
      {label ? <div className="mb-1.5 font-semibold">{label}</div> : null}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color ?? C.brand }} />
          <span>{p.name}</span>
          <span className="ml-auto font-semibold text-ink">{formatMoney(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { name?: string } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const name = payload[0]?.payload?.name ?? label ?? payload[0]?.name;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold">{name}</div>
      <div className="text-muted">{payload[0]?.value ?? 0}</div>
    </div>
  );
}

/** KPI with sparkline + progress rail — no rings */
function SparkKpi({
  label,
  value,
  hint,
  color,
  spark,
  max,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
  spark: number[];
  max?: number;
}) {
  const chartData = spark.map((v, i) => ({ i, v }));
  const last = spark[spark.length - 1] ?? 0;
  const peak = Math.max(...spark, 1);
  const pct = max != null && max > 0 ? Math.min(100, Math.round((last / max) * 100)) : undefined;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-surface p-4">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12]"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-extrabold tracking-tight tabular-nums" style={{ color }}>
            {value}
          </p>
          {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
        </div>
        <div className="h-12 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                fill={`url(#spark-${label})`}
                strokeWidth={2}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {pct != null ? (
        <div className="relative mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-medium text-muted">
            <span>vs max</span>
            <span>{pct}%</span>
          </div>
        </div>
      ) : (
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.round((last / peak) * 100))}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

/** Horizontal stacked distribution — replaces donuts */
function DistBars({
  items,
  formatValue = (n) => String(n),
}: {
  items: { name: string; value: number; color: string }[];
  formatValue?: (n: number) => string;
}) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const safe = total > 0 ? items : items.map((i, idx) => (idx === 0 ? { ...i, value: 1 } : { ...i, value: 0 }));
  const sum = safe.reduce((s, i) => s + i.value, 0);

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--border)]">
        {safe.map((it) => (
          <div
            key={it.name}
            className="h-full transition-all"
            style={{
              width: `${(it.value / sum) * 100}%`,
              background: total === 0 ? 'var(--border)' : it.color,
            }}
            title={`${it.name}: ${formatValue(it.value)}`}
          />
        ))}
      </div>
      <ul className="space-y-3">
        {items.map((it) => {
          const share = total > 0 ? Math.round((it.value / total) * 100) : 0;
          return (
            <li key={it.name}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 rounded-sm" style={{ background: it.color }} />
                  {it.name}
                </span>
                <span className="tabular-nums text-muted">
                  <span className="font-semibold text-ink">{formatValue(it.value)}</span>
                  <span className="ml-2">{share}%</span>
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share}%`, background: it.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function sparkFrom(value: number, steps = 8): number[] {
  const base = Math.max(value, 0);
  if (base === 0) return Array.from({ length: steps }, (_, i) => (i % 3 === 0 ? 0.15 : 0.05));
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    const wobble = 0.72 + Math.sin(i * 1.7) * 0.12 + (i / steps) * 0.2;
    return Math.max(0, base * wobble * t);
  });
}

function SuperAdminDash({
  dossiers,
  pipeline,
  loading,
}: {
  dossiers: Dossier[];
  pipeline?: Pipeline;
  loading: boolean;
}) {
  const facture = pipeline?.facture ?? 0;
  const encaisse = pipeline?.encaisse ?? 0;
  const enAttente = pipeline?.enAttente ?? 0;
  const financeMax = Math.max(facture, encaisse, enAttente, 1);

  const statutData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dossiers) {
      const key = STATUT_LABELS[d.statut] ?? d.statut;
      map[key] = (map[key] ?? 0) + 1;
    }
    const colors = [C.brand, C.brandSoft, C.success, C.warn, C.slate, C.ink];
    return Object.entries(map).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
  }, [dossiers]);

  const prioriteData = useMemo(() => {
    const map = { Normale: 0, Urgente: 0, Critique: 0 };
    for (const d of dossiers) {
      if (d.priorite === 'URGENTE') map.Urgente += 1;
      else if (d.priorite === 'CRITIQUE') map.Critique += 1;
      else map.Normale += 1;
    }
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      color: PRIORITE_COLORS[name] ?? C.slate,
    }));
  }, [dossiers]);

  const destData = pipeline?.parDestination?.length
    ? pipeline.parDestination
    : [{ destination: '—', facture: 0, encaisse: 0 }];

  const agentData = (pipeline?.parAgent ?? [])
    .slice()
    .sort((a, b) => b.facture - a.facture)
    .slice(0, 6);

  const cashMix = [
    { name: 'Facturé', value: Math.max(facture, 0), color: C.brand },
    { name: 'Encaissé', value: Math.max(encaisse, 0), color: C.success },
    { name: 'En attente', value: Math.max(enAttente, 0), color: C.warn },
  ];

  const statutBars = statutData.length
    ? statutData
    : [{ name: 'Aucun', value: 0, color: C.slate }];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SparkKpi
          label="Dossiers actifs"
          value={loading ? '—' : String(dossiers.length)}
          hint="Volume ouvert"
          color={C.brand}
          spark={sparkFrom(Math.max(dossiers.length, 1))}
          max={Math.max(dossiers.length, 10)}
        />
        <SparkKpi
          label="Facturé"
          value={formatMoney(facture)}
          hint="Pipeline cotation"
          color={C.brand}
          spark={sparkFrom(facture || 1)}
          max={financeMax}
        />
        <SparkKpi
          label="Encaissé"
          value={formatMoney(encaisse)}
          hint="Cash reçu"
          color={C.success}
          spark={sparkFrom(encaisse || 0.01)}
          max={financeMax}
        />
        <SparkKpi
          label="En attente"
          value={formatMoney(enAttente)}
          hint="À collecter"
          color={C.warn}
          spark={sparkFrom(enAttente || 1)}
          max={financeMax}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <ChartPanel
          title="Pipeline par destination"
          subtitle="Facturé vs encaissé"
          className="min-h-[340px] xl:col-span-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={destData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="areaFacture" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.brand} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="destination"
                tick={{ fill: C.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<MoneyTooltip />} />
              <Area
                type="monotone"
                dataKey="facture"
                name="Facturé"
                stroke={C.brand}
                fill="url(#areaFacture)"
                strokeWidth={2.5}
              />
              <Line
                type="monotone"
                dataKey="encaisse"
                name="Encaissé"
                stroke={C.success}
                strokeWidth={2.5}
                dot={{ r: 3, fill: C.success, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Répartition financière"
          subtitle="Mix cash"
          className="min-h-[340px] xl:col-span-2"
        >
          <DistBars items={cashMix} formatValue={(n) => formatMoney(n)} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartPanel title="Statuts dossiers" subtitle="Volume par étape" className="min-h-[280px]">
          <DistBars items={statutBars} />
        </ChartPanel>

        <ChartPanel title="Priorités" subtitle="Charge opérationnelle" className="min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={prioriteData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="value" name="Dossiers" radius={[6, 6, 0, 0]} barSize={36}>
                {prioriteData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Performance agents" subtitle="Top facturation" className="min-h-[280px]">
          {agentData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Pas encore de données agents
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="nom"
                  width={80}
                  tick={{ fill: C.muted, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MoneyTooltip />} />
                <Bar dataKey="facture" name="Facturé" fill={C.brand} radius={[0, 5, 5, 0]} barSize={10} />
                <Bar dataKey="encaisse" name="Encaissé" fill={C.success} radius={[0, 5, 5, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

function AssistantDash({
  dossiers,
  planning,
}: {
  dossiers: Dossier[];
  planning: Rdv[];
  loading: boolean;
}) {
  const aValider = dossiers.filter((d) => d.statut === 'EN_COURS').length;
  const urgents = dossiers.filter((d) => d.priorite !== 'NORMALE').length;
  const valides = dossiers.filter((d) => d.statut === 'VALIDE' || d.statut === 'VERROUILLE').length;
  const mix = [
    { name: 'À valider', value: aValider, color: C.brand },
    { name: 'Priorité haute', value: urgents, color: C.warn },
    { name: 'Validés', value: valides, color: C.success },
    {
      name: 'Autres',
      value: Math.max(0, dossiers.length - aValider - valides),
      color: C.slate,
    },
  ];

  const typeBars = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of planning) {
      const key = r.type.replace(/_/g, ' ');
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [planning]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SparkKpi
          label="À valider"
          value={String(aValider)}
          color={C.brand}
          spark={sparkFrom(Math.max(aValider, 1))}
        />
        <SparkKpi
          label="Priorité haute"
          value={String(urgents)}
          color={C.warn}
          spark={sparkFrom(Math.max(urgents, 0.2))}
        />
        <SparkKpi
          label="RDV du jour"
          value={String(planning.length)}
          color={C.success}
          spark={sparkFrom(Math.max(planning.length, 1))}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Charge dossiers" subtitle="Répartition opérationnelle" className="min-h-[280px]">
          <DistBars items={mix} />
        </ChartPanel>
        <ChartPanel
          title="Protocole du jour"
          subtitle="Missions planifiées"
          className="min-h-[280px]"
          action={
            <Link to="/logistique" className="text-xs font-semibold text-brand hover:underline">
              Ouvrir →
            </Link>
          }
        >
          {typeBars.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Aucun RDV aujourd’hui
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeBars} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="value" fill={C.brand} radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

function SupportDash({
  dossiers,
  prospects,
}: {
  dossiers: Dossier[];
  prospects: Prospect[];
  loading: boolean;
}) {
  const onboarding = dossiers.filter((d) => ['BROUILLON', 'EN_COURS'].includes(d.statut)).length;
  const byStatut = useMemo(() => {
    const colors = [C.brand, C.brandSoft, C.success, C.warn, C.slate];
    const map: Record<string, number> = {};
    for (const p of prospects) map[p.statut] = (map[p.statut] ?? 0) + 1;
    return Object.entries(map).map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
  }, [prospects]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SparkKpi
          label="Prospects"
          value={String(prospects.length)}
          color={C.brand}
          spark={sparkFrom(Math.max(prospects.length, 1))}
        />
        <SparkKpi
          label="En onboarding"
          value={String(onboarding)}
          color={C.warn}
          spark={sparkFrom(Math.max(onboarding, 1))}
        />
        <SparkKpi
          label="Dossiers suivis"
          value={String(dossiers.length)}
          color={C.success}
          spark={sparkFrom(Math.max(dossiers.length, 1))}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Pipeline prospects" subtitle="Par statut" className="min-h-[280px]">
          {byStatut.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">Aucun prospect</div>
          ) : (
            <DistBars items={byStatut} />
          )}
        </ChartPanel>
        <ChartPanel title="Volume prospects" subtitle="Comparatif par statut" className="min-h-[280px]">
          {byStatut.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatut} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="value" radius={[0, 5, 5, 0]} barSize={12}>
                  {byStatut.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

function CaisseDash({
  dossiers,
  caisse,
}: {
  dossiers: Dossier[];
  caisse: CaisseItem[];
  loading: boolean;
}) {
  const aEncaisser = caisse.filter((f) => f.statut !== 'PAYE' && f.statut !== 'ANNULE');
  const payes = caisse.filter((f) => f.statut === 'PAYE');
  const totalOpen = aEncaisser.reduce((s, f) => s + Number(f.montantTotal), 0);
  const totalPaye = payes.reduce((s, f) => s + Number(f.montantTotal), 0);
  const cotation = dossiers.reduce(
    (s, d) => s + (d.lignesCotation?.reduce((a, l) => a + Number(l.montant), 0) ?? 0),
    0,
  );
  const mix = [
    { name: 'À encaisser', value: Math.max(totalOpen, 0), color: C.warn },
    { name: 'Encaissé', value: Math.max(totalPaye, 0), color: C.success },
  ];
  const pieceBars = [
    { name: 'Ouvertes', value: aEncaisser.length },
    { name: 'Payées', value: payes.length },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SparkKpi
          label="À encaisser"
          value={formatMoney(totalOpen)}
          color={C.warn}
          spark={sparkFrom(totalOpen || 1)}
        />
        <SparkKpi
          label="Encaissé"
          value={formatMoney(totalPaye)}
          color={C.success}
          spark={sparkFrom(totalPaye || 0.01)}
        />
        <SparkKpi
          label="Cotation dossiers"
          value={formatMoney(cotation)}
          color={C.brand}
          spark={sparkFrom(cotation || 1)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Flux de caisse" subtitle="Volumes monétaires" className="min-h-[280px]">
          <DistBars items={mix} formatValue={(n) => formatMoney(n)} />
        </ChartPanel>
        <ChartPanel title="Pièces" subtitle="Ouvertes vs encaissées" className="min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pieceBars} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                <Cell fill={C.warn} />
                <Cell fill={C.success} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  );
}

function ProtocoleDash({
  planning,
  dossiers,
}: {
  planning: Rdv[];
  dossiers: Dossier[];
  loading: boolean;
}) {
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of planning) {
      const key = r.type.replace(/_/g, ' ');
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [planning]);

  const logis = dossiers.filter((d) => d.statut === 'EN_COURS' || d.statut === 'VALIDE').length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SparkKpi
          label="RDV aujourd’hui"
          value={String(planning.length)}
          color={C.brand}
          spark={sparkFrom(Math.max(planning.length, 1))}
        />
        <SparkKpi
          label="Dossiers logistiques"
          value={String(logis)}
          color={C.success}
          spark={sparkFrom(Math.max(logis, 1))}
        />
      </div>
      <ChartPanel title="Missions du jour" subtitle="Répartition par type" className="min-h-[300px]">
        {byType.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">Aucune mission</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byType} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="value" fill={C.brand} radius={[6, 6, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartPanel>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const appRole: AppRole | null = isAppRole(role) ? role : null;

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['dossiers'],
    queryFn: async () => (await api.get<Dossier[]>('/dossiers')).data,
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => (await api.get<Pipeline>('/facturation/pipeline')).data,
    enabled: role === 'SUPER_ADMIN',
  });

  const { data: planning = [] } = useQuery({
    queryKey: ['planning-dash'],
    queryFn: async () => (await api.get<Rdv[]>('/logistique/planning')).data,
    enabled: role === 'PROTOCOLE' || role === 'ASSISTANT_MANAGER' || role === 'SUPER_ADMIN',
  });

  const { data: prospects = [] } = useQuery({
    queryKey: ['prospects-dash'],
    queryFn: async () => (await api.get<Prospect[]>('/prospects')).data,
    enabled: role === 'SUPPORT_CLIENT' || role === 'SUPER_ADMIN',
  });

  const { data: caisse = [] } = useQuery({
    queryKey: ['caisse-dash'],
    queryFn: async () => (await api.get<CaisseItem[]>('/facturation/caisse')).data,
    enabled: role === 'CAISSE_ADMIN' || role === 'SUPER_ADMIN' || role === 'ASSISTANT_MANAGER',
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Vue analytique</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Bonjour{user?.nom ? `, ${firstName(user.nom)}` : ''}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {user ? ROLE_LABELS[user.role] ?? user.role : ''}
          {appRole ? ` · ${ROLE_MISSIONS[appRole].split('.')[0]}.` : ''}
        </p>
      </header>

      {role === 'SUPER_ADMIN' && (
        <SuperAdminDash dossiers={dossiers} pipeline={pipeline} loading={isLoading} />
      )}
      {role === 'ASSISTANT_MANAGER' && (
        <AssistantDash dossiers={dossiers} planning={planning} loading={isLoading} />
      )}
      {role === 'SUPPORT_CLIENT' && (
        <SupportDash dossiers={dossiers} prospects={prospects} loading={isLoading} />
      )}
      {role === 'CAISSE_ADMIN' && (
        <CaisseDash dossiers={dossiers} caisse={caisse} loading={isLoading} />
      )}
      {role === 'PROTOCOLE' && (
        <ProtocoleDash planning={planning} dossiers={dossiers} loading={isLoading} />
      )}
      {!appRole && (
        <ChartPanel title="Activité" subtitle="Aucun rôle reconnu">
          <div className="py-16 text-center text-sm text-muted">Aucune donnée à visualiser</div>
        </ChartPanel>
      )}
    </div>
  );
}
