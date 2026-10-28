#!/usr/bin/env node

import { strict as assert } from 'assert'

function validateInceptionDate(dateStr: string): { valid: boolean; error?: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: 'inception_date must be in YYYY-MM-DD format' }
  }

  const date = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' }
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  if (date > today) {
    return { valid: false, error: 'inception_date cannot be in the future' }
  }

  const sixYearsAgo = new Date(today)
  sixYearsAgo.setUTCFullYear(sixYearsAgo.getUTCFullYear() - 6)

  if (date < sixYearsAgo) {
    return { valid: false, error: 'inception_date cannot be earlier than 6 years ago' }
  }

  return { valid: true }
}

// Run tests
console.log('Running inception date validation tests...')

const today = new Date()
const todayStr = today.toISOString().split('T')[0]

// Valid dates
assert.ok(validateInceptionDate(todayStr).valid, 'Today should be valid')

const oneYearAgo = new Date(today)
oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1)
const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0]
assert.ok(validateInceptionDate(oneYearAgoStr).valid, '1-year-old date should be valid')

const fourYearsAgo = new Date(today)
fourYearsAgo.setUTCFullYear(fourYearsAgo.getUTCFullYear() - 4)
const fourYearsAgoStr = fourYearsAgo.toISOString().split('T')[0]
assert.ok(validateInceptionDate(fourYearsAgoStr).valid, '4-year-old date should be valid')

// Invalid formats
assert.ok(!validateInceptionDate('2024-01-15T00:00:00Z').valid, 'ISO format should be invalid')
assert.ok(!validateInceptionDate('01-15-2024').valid, 'MM-DD-YYYY should be invalid')
assert.ok(!validateInceptionDate('2024/01/15').valid, 'Slash format should be invalid')

// Future dates
const tomorrow = new Date(today)
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
const tomorrowStr = tomorrow.toISOString().split('T')[0]
assert.ok(!validateInceptionDate(tomorrowStr).valid, 'Future date should be invalid')

// Too old (7 years ago)
const sevenYearsAgo = new Date(today)
sevenYearsAgo.setUTCFullYear(sevenYearsAgo.getUTCFullYear() - 7)
const sevenYearsAgoStr = sevenYearsAgo.toISOString().split('T')[0]
assert.ok(!validateInceptionDate(sevenYearsAgoStr).valid, 'Date older than 6 years should be invalid')

// Exactly 6 years ago should be valid
const sixYearsAgoExact = new Date(today)
sixYearsAgoExact.setUTCFullYear(sixYearsAgoExact.getUTCFullYear() - 6)
const sixYearsAgoExactStr = sixYearsAgoExact.toISOString().split('T')[0]
assert.ok(validateInceptionDate(sixYearsAgoExactStr).valid, 'Exactly 6 years ago should be valid')

console.log('✓ All inception date validation tests passed')
