import assert from 'node:assert/strict'
import { applyRules } from '../optimizer'
import { mergeAIOptimizations } from '../ai'

function ids(yaml: string): string[] {
  return applyRules(yaml).optimizations.map(o => o.id)
}

{
  const yaml = `steps:
  - checkout: self
    fetchDepth: 1
`
  const result = applyRules(yaml)
  assert.ok(result.optimizations.some(o => o.id === 'checkout-fetch-tags'))
  assert.match(result.optimizedYaml, /fetchTags: false/)
}

{
  const yaml = `steps:
  - checkout: self
    fetchDepth: 1
  - script: git describe --tags
`
  assert.ok(!ids(yaml).includes('checkout-fetch-tags'))
}

{
  const yaml = `trigger:
  branches:
    include:
      - main
steps:
  - script: dotnet restore src/App/App.csproj
  - script: dotnet build src/App/App.csproj
  - script: dotnet test tests/App.Tests/App.Tests.csproj
`
  const result = applyRules(yaml)
  assert.ok(ids(yaml).includes('ci-trigger-batching'))
  assert.ok(ids(yaml).includes('ci-path-filters'))
  assert.ok(ids(yaml).includes('dotnet-build-no-restore'))
  assert.ok(ids(yaml).includes('dotnet-test-no-build'))
  assert.equal(result.optimizedYaml.includes('--no-restore'), false)
  assert.equal(result.optimizedYaml.includes('--no-build'), false)
}

{
  const yaml = `steps:
  - task: DownloadPipelineArtifact@2
    inputs:
      artifact: drop
  - task: VSTest@3
    inputs:
      testSelector: testAssemblies
`
  const found = ids(yaml)
  assert.ok(found.includes('artifact-selective-download'))
  assert.ok(found.includes('vstest-parallel'))
  assert.ok(found.includes('parallel-test-sharding'))
}

{
  const base = [
    {
      id: 'shallow-clone',
      title: 'Shallow clone',
      description: '',
      estimatedSavingMinutes: 20,
      confidence: 'high' as const,
      category: 'speed' as const,
    },
    {
      id: 'parallel-stages',
      title: 'Parallel stages',
      description: '',
      estimatedSavingMinutes: 120,
      confidence: 'low' as const,
      category: 'parallelism' as const,
    },
  ]
  const ai = [{
    id: 'ai-parallel-1',
    title: 'Parallelize Test',
    description: 'Test and Staging are independent.',
    estimatedSavingMinutes: 30,
    confidence: 'high' as const,
    category: 'parallelism' as const,
  }]
  const merged = mergeAIOptimizations(base, ai)
  assert.equal(merged.estimatedSavingMinutes, 140)
  assert.equal(merged.optimizations.length, 3)
  assert.equal(merged.optimizations[2].estimatedSavingMinutes, 0)
  assert.match(merged.optimizations[2].title, /^AI confirmed:/)
}

{
  const merged = mergeAIOptimizations([], [{
    id: 'ai-parallel-1',
    title: 'Parallelize Test',
    description: 'Independent stage.',
    estimatedSavingMinutes: 30,
    confidence: 'high',
    category: 'parallelism',
  }])
  assert.equal(merged.estimatedSavingMinutes, 30)
}

// ── Regression: injectCheckoutProp must not duplicate properties ─────────────

{
  // Standalone checkout: self — all checkout rules fire together.
  // Before the fix, lfs/submodules/persistCredentials/fetchTags each appeared twice.
  const yaml = `steps:
  - checkout: self
`
  const result = applyRules(yaml)
  const props = ['fetchDepth', 'lfs', 'submodules', 'persistCredentials', 'fetchTags']
  for (const prop of props) {
    const count = (result.optimizedYaml.match(new RegExp(prop + ':', 'g')) ?? []).length
    assert.equal(count, 1, `${prop}: appeared ${count} times (expected 1) — duplicate bug regressed`)
  }
  console.log('✓  standalone checkout: no duplicate checkout properties')
}

{
  // Multi-line checkout block already present — same regression check.
  const yaml = `steps:
  - checkout: self
    persistCredentials: true
    clean: true
`
  const result = applyRules(yaml)
  const props = ['fetchDepth', 'lfs', 'submodules', 'fetchTags']
  for (const prop of props) {
    const count = (result.optimizedYaml.match(new RegExp(prop + ':', 'g')) ?? []).length
    assert.equal(count, 1, `${prop}: appeared ${count} times in multi-line case`)
  }
  // persistCredentials was already set — should not be added again
  const pcCount = (result.optimizedYaml.match(/persistCredentials:/g) ?? []).length
  assert.equal(pcCount, 1, 'persistCredentials: duplicated when already present')
  // clean: true should be removed
  assert.ok(!result.optimizedYaml.includes('clean: true'), 'clean: true was not removed')
  console.log('✓  multi-line checkout: no duplicate properties, existing props preserved')
}

{
  // Artifact task renames must not corrupt the task name (simple string replacement safety)
  const yaml = `steps:
  - task: PublishBuildArtifacts@1
    inputs:
      PathtoPublish: drop
  - task: DownloadBuildArtifacts@0
    inputs:
      buildType: current
`
  const result = applyRules(yaml)
  assert.ok(result.optimizedYaml.includes('PublishPipelineArtifact@1'), 'PublishPipelineArtifact@1 not found after upgrade')
  assert.ok(result.optimizedYaml.includes('DownloadPipelineArtifact@2'), 'DownloadPipelineArtifact@2 not found after upgrade')
  assert.ok(!result.optimizedYaml.includes('PublishBuildArtifacts@1'), 'Old task still present after upgrade')
  assert.ok(!result.optimizedYaml.includes('DownloadBuildArtifacts@0'), 'Old task still present after upgrade')
  console.log('✓  artifact task upgrades: task names replaced correctly')
}

{
  // PP import async flags must be added exactly once even when multiple rules touch the same task
  const yaml = `steps:
  - task: PowerPlatformImportSolution@2
    inputs:
      authenticationType: PowerPlatformSPN
      SolutionInputFile: drop/solution.zip
`
  const result = applyRules(yaml)
  const asyncCount = (result.optimizedYaml.match(/asyncOperation:/g) ?? []).length
  const skipCount = (result.optimizedYaml.match(/skipLowerVersion:/g) ?? []).length
  assert.equal(asyncCount, 1, `asyncOperation: appeared ${asyncCount} times`)
  assert.equal(skipCount, 1, `skipLowerVersion: appeared ${skipCount} times`)
  console.log('✓  PP import: asyncOperation and skipLowerVersion added exactly once')
}

console.log('optimizer tests passed')
