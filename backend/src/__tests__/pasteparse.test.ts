import assert from 'assert/strict'
import { parsePastedContent } from '../pastecompare'

interface ExpectedTable {
  title: string
  fieldLogicalName?: string
  count: number
}

function summarize(input: string) {
  return parsePastedContent(input).map(table => ({
    title: table.title,
    fieldLogicalName: table.fieldLogicalName,
    count: table.rows.length,
  }))
}

function testParse(name: string, input: string, expected: ExpectedTable[]) {
  assert.deepEqual(summarize(input), expected, name)
}

testParse('basic single table', `Gender\nValue\tLabel\n1\tMale\n2\tFemale\n3\tOther`, [
  { title: 'Gender', fieldLogicalName: undefined, count: 3 },
])

testParse('two distinct tables', `Gender\nValue\tLabel\n1\tMale\n2\tFemale\n\nApplication Status\nValue\tLabel\n914310009\tDraft\n914310010\tSubmitted`, [
  { title: 'Gender', fieldLogicalName: undefined, count: 2 },
  { title: 'Application Status', fieldLogicalName: undefined, count: 2 },
])

testParse('blank rows inside table are not split', `Gender\nValue\tLabel\n1\tMale\n\n2\tFemale\n\n3\tOther`, [
  { title: 'Gender', fieldLogicalName: undefined, count: 3 },
])

testParse('two untitled blocks with a blank between become one table', `Value\tLabel\n1\tMale\n2\tFemale\n\nValue\tLabel\n914310009\tDraft`, [
  { title: '', fieldLogicalName: undefined, count: 3 },
])

testParse('reversed column order Label|Value', `Gender\nLabel\tValue\nMale\t1\nFemale\t2`, [
  { title: 'Gender', fieldLogicalName: undefined, count: 2 },
])

testParse('no title', `Value\tLabel\n914310001\tDraft\n914310002\tSubmitted`, [
  { title: '', fieldLogicalName: undefined, count: 2 },
])

testParse('extra columns ignored', `Gender\nValue\tLabel\tDescription\n1\tMale\tBio male\n2\tFemale\tBio female`, [
  { title: 'Gender', fieldLogicalName: undefined, count: 2 },
])

testParse('windows CRLF', `Gender\r\nValue\tLabel\r\n1\tMale\r\n2\tFemale`, [
  { title: 'Gender', fieldLogicalName: undefined, count: 2 },
])

testParse('empty input', ``, [])

testParse('no numeric values returns no tables', `Name\tDepartment\nAlice\tEngineering\nBob\tDesign`, [])

testParse('three separate named tables', [
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
  { title: 'Gender', fieldLogicalName: undefined, count: 2 },
  { title: 'Application Status', fieldLogicalName: undefined, count: 2 },
  { title: 'Payment Method', fieldLogicalName: undefined, count: 2 },
])

testParse('FieldLogicalName-only preamble extracts fieldLogicalName and leaves title empty', [
  'FieldLogicalName: leadsourcecode',
  'Value\tLabel',
  '1\tEmail',
  '2\tAdvertisement',
].join('\n'), [
  { title: '', fieldLogicalName: 'leadsourcecode', count: 2 },
])

testParse('blank between title and SourceType metadata keeps title', [
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
  {
    title: 'grmtr_applicationreviewstatus (Application Review Status)',
    fieldLogicalName: 'grmtr_applicationreviewstatus',
    count: 2,
  },
])

testParse('multiple metadata lines keep display name title', [
  'Lead Source',
  'SourceType: StandaloneOptionSet',
  'FieldLogicalName: leadsourcecode',
  'Value\tLabel',
  '1\tEmail',
  '2\tAdvertisement',
].join('\n'), [
  { title: 'Lead Source', fieldLogicalName: 'leadsourcecode', count: 2 },
])

testParse('logical_name display-name preamble prefers parenthesized line', [
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

testParse('non-tabbed line after data row starts a new table', [
  'Gender',
  'Value\tLabel',
  '1\tMale',
  '2\tFemale',
  'Lead Source',
  'Value\tLabel',
  '100\tAdvertisement',
].join('\n'), [
  { title: 'Gender', fieldLogicalName: undefined, count: 2 },
  { title: 'Lead Source', fieldLogicalName: undefined, count: 1 },
])

console.log('paste parser tests passed')
