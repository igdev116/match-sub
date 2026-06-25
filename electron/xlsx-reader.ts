import fs from 'node:fs'
import * as XLSX from 'xlsx'
import type { Scene } from './types'

interface SceneRow {
  STT?: string | number
  'Nội dung'?: string | number
}

export function readScenes(path: string): Scene[] {
  const workbook = XLSX.read(fs.readFileSync(path), { type: 'buffer' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('File Excel không có worksheet.')

  const rows = XLSX.utils.sheet_to_json<SceneRow>(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: false,
  })

  if (rows.length === 0) throw new Error('File Excel không có dữ liệu.')
  if (!Object.prototype.hasOwnProperty.call(rows[0], 'STT')) {
    throw new Error('File Excel thiếu cột "STT".')
  }
  if (!Object.prototype.hasOwnProperty.call(rows[0], 'Nội dung')) {
    throw new Error('File Excel thiếu cột "Nội dung".')
  }

  return rows.map((row, index) => {
    const number = Number(row.STT)
    const content = String(row['Nội dung'] ?? '').trim()
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`STT không hợp lệ tại dòng ${index + 2}.`)
    }
    if (!content) throw new Error(`Nội dung trống tại dòng ${index + 2}.`)
    return { number, content }
  })
}
