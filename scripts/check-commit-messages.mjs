#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const range = process.argv[2] || 'HEAD'
const pattern =
  /^co-authored-by:.*(claude|anthropic|deepseek|openai|chatgpt|copilot|gemini)/i

let raw
try {
  raw = execFileSync('git', ['log', '--format=%H%x00%B%x00', range], { encoding: 'utf8' })
} catch (error) {
  console.error(`Không đọc được commit trong khoảng "${range}".`)
  console.error(error.stderr?.toString() || error.message)
  process.exit(2)
}

const parts = raw.split('\0').filter((part) => part.trim() !== '')
const offenders = []
for (let index = 0; index < parts.length; index += 2) {
  const sha = (parts[index] || '').trim()
  const message = parts[index + 1] || ''
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => pattern.test(line))
  if (lines.length) offenders.push({ sha: sha.slice(0, 7), lines })
}

if (offenders.length) {
  console.error('Phát hiện co-author do AI sinh ra trong thông điệp commit:')
  for (const offender of offenders) {
    console.error(`  ${offender.sha}  ${offender.lines.join(' | ')}`)
  }
  console.error('Xóa các dòng "Co-Authored-By" đó rồi sửa lại commit.')
  process.exit(1)
}

console.log(`Đã kiểm tra ${parts.length / 2} commit: không có co-author AI.`)
