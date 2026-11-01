import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatMoney, TONES } from '../lib/format';

type TooltipRow = { value?: number | string };
type TooltipProps = {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string;
};

function TooltipBox({ label, rows }: { label?: string; rows: { name: string; value: string }[] }) {
  return (
    <div className="chart-tooltip">
      {label && <div className="label">{label}</div>}
      {rows.map((row) => (
        <div key={row.name} className="value">{row.name} · {row.value}</div>
      ))}
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return <TooltipBox label={label} rows={[{ name: 'Encaissé', value: formatMoney(Number(payload[0].value ?? 0)) }]} />;
}

function CountTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return <TooltipBox label={label} rows={[{ name: 'Élèves', value: String(payload[0].value ?? 0) }]} />;
}

function MethodTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0] as TooltipRow & { name?: string };
  return <TooltipBox rows={[{ name: String(row.name ?? ''), value: formatMoney(Number(row.value ?? 0)) }]} />;
}

export function RevenueChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#7f918d' }} dy={8} />
          <YAxis
            tickLine={false} axisLine={false} width={62}
            tick={{ fontSize: 11, fill: '#7f918d' }}
            tickFormatter={(value: number) => (value >= 1_000_000 ? `${(value / 1_000_000).toFixed(0)} M` : `${Math.round(value / 1000)} k`)}
          />
          <Tooltip cursor={{ stroke: '#cfe0dc', strokeWidth: 1 }} content={<MoneyTooltip />} />
          <Area
            type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2.4}
            fill="url(#revenueFill)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const METHOD_COLORS = [TONES.primary, TONES.info, TONES.amber, TONES.violet, TONES.success, TONES.danger];

export function MethodDonut({ data }: { data: { method: string; total: number; count: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.total, 0);
  return (
    <div className="row gap-20 wrap">
      <div style={{ position: 'relative', width: 168, height: 168, flex: 'none' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="method" innerRadius={56} outerRadius={80} paddingAngle={2} stroke="none">
              {data.map((entry, index) => (
                <Cell key={entry.method} fill={METHOD_COLORS[index % METHOD_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<MethodTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <div className="tiny muted">Total</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            {formatMoney(total, true).replace(' FCFA', '')}
          </div>
          <div className="tiny muted">FCFA</div>
        </div>
      </div>
      <div className="legend grow">
        {data.map((row, index) => (
          <div className="legend-item" key={row.method}>
            <span className="legend-dot" style={{ background: METHOD_COLORS[index % METHOD_COLORS.length] }} />
            <span className="grow">{row.method}</span>
            <span className="strong">{formatMoney(row.total, true).replace(' FCFA', '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LevelBars({ data }: { data: { level: string; total: number }[] }) {
  return (
    <div className="chart-wrap" style={{ height: 210 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 4, left: -22, bottom: 0 }} barCategoryGap="32%">
          <CartesianGrid stroke="#eef2f0" vertical={false} />
          <XAxis dataKey="level" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#7f918d' }} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#7f918d' }} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgba(15,118,110,0.06)' }} content={<CountTooltip />} />
          <Bar dataKey="total" fill="#0f766e" radius={[6, 6, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
