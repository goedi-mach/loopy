export function csvCell(v: unknown) {
  let s = String(v ?? '')
  // Stop spreadsheets from running a cell that starts like a formula
  if (/^[=@\t\r]|^[+-](?![\d\s().-])/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') // BOM keeps accents correct in Excel
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}