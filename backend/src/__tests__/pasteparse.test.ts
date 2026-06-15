import { parsePastedContent } from '../pastecompare'

function test(
  name: string,
  input: string,
  expected: Array<{ title: string; fieldLogicalName?: string; count: number }>
) {
  const tables = parsePastedContent(input)
  const pass =
    tables.length === expected.length &&
    expected.every(
      (e, i) =>
        tables[i]?.title === e.title &&
        tables[i]?.rows.length === e.count &&
        (e.fieldLogicalName === undefined || tables[i]?.fieldLogicalName === e.fieldLogicalName)
    )
  console.log(`${pass ? '✓' : '✗'} ${name}`)
  if (!pass) {
    console.log('  got:', tables.map(t => ({ title: t.title, fieldLogicalName: t.fieldLogicalName, count: t.rows.length })))
    console.log('  exp:', expected)
  }
}

// ── Standard: title + header + rows ───────────────────────────────────────────
test('basic single table', `Gender\nValue\tLabel\n1\tMale\n2\tFemale\n3\tOther`, [
  { title: 'Gender', count: 3 },
])

// ── Multiple tables (blank line followed by a title = table separator) ─────────
test('two distinct tables', `Gender\nValue\tLabel\n1\tMale\n2\tFemale\n\nApplication Status\nValue\tLabel\n914310009\tDraft\n914310010\tSubmitted`, [
  { title: 'Gender', count: 2 },
  { title: 'Application Status', count: 2 },
])

// ── KEY FIX: blank rows INSIDE a table stay in the same table ──────────────────
test('blank rows inside table — not split', `Gender\nValue\tLabel\n1\tMale\n\n2\tFemale\n\n3\tOther`, [
  { title: 'Gender', count: 3 },
])

// ── Blank between two untitled blocks: next line has tabs so within-table ──
test('two untitled blocks, blank between → single table', `Value\tLabel\n1\tMale\n2\tFemale\n\nValue\tLabel\n914310009\tDraft`, [
  { title: '', count: 3 },
])

// ── Reversed columns (Label | Value) ──────────────────────────────────────────
test('reversed column order Label|Value', `Gender\nLabel\tValue\nMale\t1\nFemale\t2`, [
  { title: 'Gender', count: 2 },
])

// ── No title ───────────────────────────────────────────────────────────────────
test('no title', `Value\tLabel\n914310001\tDraft\n914310002\tSubmitted`, [
  { title: '', count: 2 },
])

// ── Extra columns (description etc.) ──────────────────────────────────────────
test('extra columns ignored', `Gender\nValue\tLabel\tDescription\n1\tMale\tBio male\n2\tFemale\tBio female`, [
  { title: 'Gender', count: 2 },
])

// ── Windows CRLF ───────────────────────────────────────────────────────────────
test('windows CRLF', `Gender\r\nValue\tLabel\r\n1\tMale\r\n2\tFemale`, [
  { title: 'Gender', count: 2 },
])

// ── Empty input ────────────────────────────────────────────────────────────────
test('empty input', ``, [])

// ── Non-option-set data (no numeric column) ────────────────────────────────────
test('no numeric values → no tables', `Name\tDepartment\nAlice\tEngineering\nBob\tDesign`, [])

// ── Real-world: 3 tables, blank lines between, each with own title ──────────────
test('3 separate named tables', [
  'Gender',
  'Value\tLabel',
  '914310001\tMale',
  '914310002\tFemale',
  '',
  'Application Status',
  'Value\tLabel',
  '914310009\tDraft',
  '914310010\tSubmitted',
  '',
  'Payment Method',
  'Value\tLabel',
  '914310020\tCredit Card',
  '914310021\tBank Transfer',
].join('\n'), [
  { title: 'Gender', count: 2 },
  { title: 'Application Status', count: 2 },
  { title: 'Payment Method', count: 2 },
])

// ── FieldLogicalName in metadata — extracted, NOT used as title ────────────────
// New parser: FieldLogicalName: prefix is stripped into fieldLogicalName field;
// title becomes '' since it's the only non-blank non-metadata line.
test('FieldLogicalName-only preamble: fieldLogicalName extracted, title empty', [
  'FieldLogicalName: leadsourcecode',
  'Value\tLabel',
  '1\tEmail',
  '2\tAdvertisement',
].join('\n'), [
  { title: '', fieldLogicalName: 'leadsourcecode', count: 2 },
])

// ── MAIN BUG FIX: blank line between title and metadata lines ──────────────────
// "grmtr_applicationreviewstatus (Application Review Status)" is the title;
// blank line + "SourceType: EntityInlineOptionSet" must NOT flush/reset it.
test('blank between title and SourceType metadata — title kept', [
  'grmtr_applicationreviewstatus (Application Review Status)',
  '',
  'SourceType: EntityInlineOptionSet',
  'Entity: Contact',
  'FieldLogicalName: grmtr_applicationreviewstatus',
  '',
  'OptionValue\tEnglishLabel',
  '914310009\tApplication in Progress (Draft)',
  '914310010\tSubmitted',
].join('\n'), [
  { title: 'grmtr_applicationreviewstatus (Application Review Status)', fieldLogicalName: 'grmtr_applicationreviewstatus', count: 2 },
])

// ── Multiple metadata lines — SourceType skipped, display name title kept ─────
test('multiple metadata lines — display name title wins', [
  'Lead Source',
  'SourceType: StandaloneOptionSet',
  'FieldLogicalName: leadsourcecode',
  'Value\tLabel',
  '1\tEmail',
  '2\tAdvertisement',
].join('\n'), [
  { title: 'Lead Source', fieldLogicalName: 'leadsourcecode', count: 2 },
])

// ── logicalName (Display Name) pattern — parentheses line wins over plain ─────
test('logical_name (Display Name) preamble — parenthesised line wins', [
  'Some other line',
  'grmtr_gender (Gender)',
  'SourceType: EntityInlineOptionSet',
  'FieldLogicalName: grmtr_gender',
  'Value\tLabel',
  '1\tMale',
  '2\tFemale',
].join('\n'), [
  { title: 'grmtr_gender (Gender)', fieldLogicalName: 'grmtr_gender', count: 2 },
])

// ── Two tables where second starts immediately after data, no blank ──────────────
test('non-tabbed line after data row triggers new table', [
  'Gender',
  'Value\tLabel',
  '1\tMale',
  '2\tFemale',
  'Lead Source',
  'Value\tLabel',
  '100\tAdvertisement',
].join('\n'), [
  { title: 'Gender', count: 2 },
  { title: 'Lead Source', count: 1 },
])

console.log('\nDone.')
