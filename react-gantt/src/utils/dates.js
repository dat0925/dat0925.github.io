export function td() { return ds(new Date()) }
export function ds(d) { return d.toISOString().split('T')[0] }
export function pd(s) { return s ? new Date(s + 'T00:00:00') : null }
export function fmt(s) {
  if (!s) return ''
  const d = pd(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const WD = ['日', '月', '火', '水', '木', '金', '土']
export function fmtLong(s) {
  if (!s) return ''
  const d = pd(s)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（${WD[d.getDay()]}）`
}
export function addD(s, n) {
  const d = pd(s)
  d.setDate(d.getDate() + n)
  return ds(d)
}
export function diffD(a, b) { return Math.round((pd(b) - pd(a)) / 86400000) }

export function parseInputDate(s) {
  if (!s) return td()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (m) {
    const yr = new Date().getFullYear()
    return `${yr}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
  }
  return td()
}
