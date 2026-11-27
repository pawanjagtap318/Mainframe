import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(Number(value || 0));
const shortDate = (value) => new Date(`${value.slice(0, 10)}T00:00:00`)
  .toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export default function ActivityChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
      <defs>
        <linearGradient id="creditFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#52bfa5" stopOpacity={0.19} />
          <stop offset="95%" stopColor="#52bfa5" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="debitFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7b94dd" stopOpacity={0.18} />
          <stop offset="95%" stopColor="#7b94dd" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="#edf0f4" vertical={false} />
      <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false}
        axisLine={false} tick={{ fill: '#8a94a5', fontSize: 11 }} dy={10} />
      <YAxis tickLine={false} axisLine={false}
        tick={{ fill: '#8a94a5', fontSize: 10 }}
        tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} />
      <Tooltip formatter={(value) => money(value)}
        labelFormatter={(label) => new Date(`${label}T00:00:00`)
          .toLocaleDateString('en-IN', { dateStyle: 'medium' })}
        contentStyle={{ border: '1px solid #e8ebf0', borderRadius: 10, fontSize: 12 }} />
      <Area type="monotone" dataKey="credit" name="Credit" stroke="#52bfa5"
        strokeWidth={2} fill="url(#creditFill)" />
      <Area type="monotone" dataKey="debit" name="Debit" stroke="#7b94dd"
        strokeWidth={2} fill="url(#debitFill)" />
    </AreaChart>
  </ResponsiveContainer>;
}
