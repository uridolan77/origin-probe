#requires -Version 5.1

<#
.SYNOPSIS
Validates or performs the versioned Window 002 staged-deployment promotion.

.DESCRIPTION
ContractTest validates synthetic evidence without acquiring credentials, calling
the provider, creating a mutex, or writing a journal. Preflight and Promote
reuse the exact provider/runtime functions from the sealed v1 helper after
verifying its digest. Promote remains a single guarded, no-rebuild, no-redirect,
no-retry mutation and leaves a durable pending marker on every ambiguous result.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('ContractTest', 'Preflight', 'Promote')]
    [string] $Mode,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$')]
    [string] $ExpectedCutoverUtc,

    [Parameter(Mandatory = $true)]
    [string] $EvidenceDirectoryPath,

    [Parameter(Mandatory = $true)]
    [string] $SupplementalRuntimeSealPath,

    [string] $ContractStageReceiptPath,

    [string] $ContractNodePath,

    [ValidateSet('Multiline', 'OversizedStdout', 'OversizedStderr', 'Timeout')]
    [string] $ContractPinnedNodeProbeMode,

    [string] $ContractJournalManifestPath,

    [string] $ContractProviderReconciliationPath,

    [string] $ContractCredentialProbePath,

    [string] $ContractLiveGateProbePath,

    [string] $ContractPathProbePath,

    [string] $ContractPathProbeRoot,

    [ValidatePattern('^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$')]
    [string] $ContractNowUtc
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$runId = 'ORIGIN-G2-PUBLIC-PROBE-AUTH-002'
$projectId = 'prj_BGVULzAdg0iZSZPUwdUdVO0RO0cY'
$orgId = 'team_OD1jaVJioNw3IjsSJdp5fMwB'
$scope = 'uridolan77s-projects'
$projectName = 'origin-probe-measure'
$expectedProjectNodeVersion = '24.x'
$acceptedDeploymentId = 'dpl_FzYtRPK5oxnoG4TJnjNxEYrcZbs7'
$acceptedDeploymentHost = 'origin-probe-measure-ovq9ctzbp-uridolan77s-projects.vercel.app'
$publicProductionAliasHost = 'origin-probe-measure.vercel.app'
$automaticProtectedAliasHost = 'origin-probe-measure-uridolan77s-projects.vercel.app'

$nodePath = 'C:\Progra~1\nodejs\node.exe'
$vercelRoot = 'C:\Users\urido\OriginProbeOperator\window002-vercel-cli\vercel'
$vercelScript = 'C:\Users\urido\OriginProbeOperator\window002-vercel-cli\vercel\dist\index.js'
$vercelPackageJson = 'C:\Users\urido\OriginProbeOperator\window002-vercel-cli\vercel\package.json'
$promotionGuard = 'C:\Users\urido\OriginProbeOperator\window002-promotion-runtime\origin-g2-window002-vercel-promote-once.mjs'
$promotionGuardUrl = 'file:///C:/Users/urido/OriginProbeOperator/window002-promotion-runtime/origin-g2-window002-vercel-promote-once.mjs'
$promotionExecutionConfig = 'C:\Users\urido\OriginProbeOperator\window002-promotion-runtime'
$promotionExecutionConfigJson = 'C:\Users\urido\OriginProbeOperator\window002-promotion-runtime\config.json'
$vercelScratch = 'C:\Users\urido\OriginProbeOperator\window002-vercel-scratch'
$vercelGlobalConfig = 'C:\Users\urido\AppData\Roaming\com.vercel.cli\Data'
$vercelAuthJson = 'C:\Users\urido\AppData\Roaming\com.vercel.cli\Data\auth.json'
$vercelConfigJson = 'C:\Users\urido\AppData\Roaming\com.vercel.cli\Data\config.json'

$expectedNodeVersion = 'v22.14.0'
$expectedNodeSha256 = '33b1bc1a8aca11fd5a4f2699e51019c63c0af30cf437701d07af69be7706771b'
$expectedVercelVersion = '57.0.0'
$expectedVercelPackageSha256 = 'd9411007d47bd58845ff8742a309e16211b26832dd775fa6b730a2f7640182bf'
$expectedVercelScriptSha256 = '5d3d5e2d243a9b0a362dab6de2746b23ed3450696593ff2c53b2927f07a23c99'
$expectedVercelTreeManifestSha256 = '21545361d00941da2994447db68cbd5c5ddc2899a326974996fe05210e80b994'
$expectedVercelTreeFileCount = 6827
$expectedPromotionGuardSha256 = 'f975e7b191eeab86a4f486d246e95485d9af10d94e1245397c688574f6dc0a70'
$expectedExecutionConfigSha256 = '889e23d72f6500793b541d7dace3cb13a8e8cddb0d0cba4babc60841f14fdf96'
$expectedVercelConfigSha256 = '610d361e025dde51b866344c55ea5546f98ed353c87f09a97b336f393e87e8a8'
$expectedStageHelperSha256 = '0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd'
$expectedRepairedCommit = '2e4f33c334f5eb07204d6a69481b5c85fe15e45a'
$expectedRepairedMeasurementTree = '76218da5886b022ec7d7310dfc6c79f00228a17e'

$storePath = 'C:\Users\urido\OriginProbeOperator'
$protectedRuntimeRoot = 'C:\Users\urido\OriginProbeOperator\window002-runtime'
$stageHelperPath = [IO.Path]::Combine($protectedRuntimeRoot, 'origin-g2-window002-stage.ps1')
$stagePassPath = [IO.Path]::Combine($storePath, 'window002-stage-pass.json')
$promotionPendingPath = [IO.Path]::Combine($storePath, 'window002-promotion-v2-pending.json')
$promotionPassPath = [IO.Path]::Combine($storePath, 'window002-promotion-v2-pass.json')
$promotionJournalRecordFilenames = @(
    'window002-promotion-v2-journal-001-launched.json',
    'window002-promotion-v2-journal-002-cli-returned.json',
    'window002-promotion-v2-journal-003-provider-reconciled.json',
    'window002-promotion-v2-journal-004-public-alias-gate-passed.json',
    'window002-promotion-v2-journal-005-final-provider-verified.json'
)
$promotionJournalRecordStates = @(
    'LAUNCHED_SINGLE_ATTEMPT',
    'CLI_RETURNED_RECONCILIATION_REQUIRED',
    'PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PENDING',
    'PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PASSED_FINAL_RECONCILIATION_PENDING',
    'PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PASSED_FINAL_RECONCILIATION_VERIFIED_PASS_PENDING'
)
$promotionJournalRecordPaths = @($promotionJournalRecordFilenames | ForEach-Object {
    [IO.Path]::Combine($storePath, $_)
})
$legacyPromotionPendingPath = [IO.Path]::Combine($storePath, 'window002-promotion-pending.json')
$legacyPromotionPassPath = [IO.Path]::Combine($storePath, 'window002-promotion-pass.json')
$mutexName = 'Global\OriginG2Window002Promotion'
$safeErrorPrefix = 'origin_window002_promotion_v2_safe:'

$legacyPromotionHelperPath = [IO.Path]::Combine(
    $protectedRuntimeRoot, 'origin-g2-window002-promote.ps1'
)
$expectedLegacyPromotionHelperSha256 = '76b3c3d6ce64f02ecaa6ee36f0f6800d2fd8bf9e17c12c973197700de9affede'
$expectedBaseRuntimeSealSha256 = 'edddde2dcf37fe21f5d983b5f066ed5c7110a720bacd11228df2b0b3675ae158'
$expectedBaseRuntimeSealPath = 'origin-g2-public-probe/ORIGIN_G2_WINDOW_002_RUNTIME_SEAL_RECEIPT.json'
$expectedEvidenceDirectoryName = 'window002-baseline-supersession'
$captureReceiptFilename = 'window002-baseline-capture-v2.json'
$zeroBaselineFilename = 'window002-zero-baseline-v2.json'
$supplementalSealFilename = 'window002-supplemental-runtime-seal-v2.json'
$stagedReceiptFilename = 'staged-deployment-receipt.json'
$providerLookupFilename = 'vercel-deployment-lookup.json'
$captureBodyFilenames = @(
    'read-1-export-all.json',
    'read-1-bounded-reduction.json',
    'read-2-export-all.json',
    'read-2-bounded-reduction.json'
)
$captureSequence = @(
    'read1_export_all',
    'read1_bounded_reduction',
    'read2_export_all',
    'read2_bounded_reduction'
)
$originalRunId = 'ORIGIN-G2R-ACCEPTANCE'
$reacceptanceRunId = 'ORIGIN-G2R-UI-REACCEPTANCE-001'
$historicalEventCount = 37
$windowDuration = [TimeSpan]::FromDays(14)
$maxStdinCharacters = 8194
$maxLiveResponseBytes = 5242880
$maxImmediateGateSeconds = 30
$maxLastReadToMutationSeconds = 10
$maxPinnedAnalysisOutputBytes = 32768
$pinnedAnalysisTimeoutMilliseconds = 30000
$maxFinalReconciliationToPassSeconds = 10
$liveGateDirectoryName = 'window002-promotion-live-gate-v2'
$liveGateDirectoryPath = [IO.Path]::Combine($storePath, $liveGateDirectoryName)
$liveGatePreBodyFilenames = @(
    'pre-read-1-export-all.json',
    'pre-read-1-bounded-reduction.json',
    'pre-read-2-export-all.json',
    'pre-read-2-bounded-reduction.json'
)
$liveGatePostBodyFilenames = @(
    'post-public-alias-read-1-export-all.json',
    'post-public-alias-read-1-authoritative-reduction.json',
    'post-public-alias-read-2-export-all.json',
    'post-public-alias-read-2-authoritative-reduction.json'
)
$expectedWindowReducerSha256 = 'c2a14b8f14dd272f563f46b0ea16baa40715ed2799d845c733e00671e57f63b0'

$captureToolRelativePath = 'measurement/scripts/window002-baseline-capture-v2.mjs'
$captureTestRelativePath = 'measurement/test/window002-baseline-capture-v2.test.js'
$protectedCaptureToolRelativePath = 'measurement/scripts/window002-baseline-capture-protected-v2.ps1'
$protectedCaptureTestRelativePath = 'measurement/test/window002-baseline-capture-protected-v2.test.js'
$zeroToolRelativePath = 'measurement/scripts/window002-zero-baseline-v2.mjs'
$zeroTestRelativePath = 'measurement/test/window002-zero-baseline-v2.test.js'
$promotionToolRelativePath = 'measurement/scripts/window002-promote-v2.ps1'
$promotionTestRelativePath = 'measurement/test/window002-promote-v2.test.js'
$historicalToolRelativePath = 'measurement/scripts/window002-historical-projection.mjs'
$historicalTestRelativePath = 'measurement/test/window002-historical-projection.test.js'

function Stop-Promotion {
    param([Parameter(Mandatory = $true)][string] $Message)
    throw [InvalidOperationException]::new("$safeErrorPrefix$Message")
}

function Get-BootstrapSha256 {
    param([Parameter(Mandatory = $true)][string] $LiteralPath)
    return (Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-BootstrapBytesSha256 {
    param([Parameter(Mandatory = $true)][byte[]] $Bytes)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($hasher.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally { $hasher.Dispose() }
}

function Assert-V2ExactKeys {
    param(
        [Parameter(Mandatory = $true)][AllowNull()][object] $Value,
        [Parameter(Mandatory = $true)][string[]] $Expected,
        [Parameter(Mandatory = $true)][string] $Label
    )
    if ($null -eq $Value -or $Value -is [Array] -or $Value -isnot [psobject]) {
        Stop-Promotion "$Label is not an object."
    }
    [string[]] $actual = @($Value.PSObject.Properties.Name)
    [string[]] $wanted = @($Expected)
    [Array]::Sort($actual, [StringComparer]::Ordinal)
    [Array]::Sort($wanted, [StringComparer]::Ordinal)
    if ($actual.Count -ne $wanted.Count) { Stop-Promotion "$Label field set changed." }
    for ($index = 0; $index -lt $wanted.Count; $index++) {
        if ($actual[$index] -cne $wanted[$index]) {
            Stop-Promotion "$Label field set changed."
        }
    }
}

function Assert-Sha256 {
    param([AllowNull()][object] $Value, [string] $Label)
    if ([string] $Value -cnotmatch '^[0-9a-f]{64}$') {
        Stop-Promotion "$Label is not a lowercase SHA-256 digest."
    }
}

function Assert-ZeroNumber {
    param([AllowNull()][object] $Value, [string] $Label)
    if ((Get-V2JsonInteger -Value $Value -Label $Label) -ne 0) {
        Stop-Promotion "$Label is not integer zero."
    }
}

function Assert-V2JsonBoolean {
    param(
        [AllowNull()][object] $Value,
        [Parameter(Mandatory = $true)][bool] $Expected,
        [Parameter(Mandatory = $true)][string] $Label
    )
    if ($Value -isnot [bool] -or $Value -cne $Expected) {
        Stop-Promotion "$Label is not the exact JSON Boolean $($Expected.ToString().ToLowerInvariant())."
    }
}

function Get-V2JsonInteger {
    param(
        [AllowNull()][object] $Value,
        [Parameter(Mandatory = $true)][string] $Label
    )
    if ($null -eq $Value) { Stop-Promotion "$Label is not a JSON integer." }
    $typeName = $Value.GetType().FullName
    if ($typeName -cnotmatch '^System\.(?:SByte|Byte|Int16|UInt16|Int32|UInt32|Int64|UInt64)$') {
        Stop-Promotion "$Label is not a JSON integer."
    }
    try { return [Convert]::ToInt64($Value, [Globalization.CultureInfo]::InvariantCulture) }
    catch { Stop-Promotion "$Label is outside the signed 64-bit JSON integer range." }
}

function ConvertFrom-V2Utc {
    param([string] $Value, [string] $Label, [switch] $RequireWholeHour)
    $parsed = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParseExact(
        $Value,
        "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal -bor
            [Globalization.DateTimeStyles]::AdjustToUniversal,
        [ref] $parsed
    )) {
        Stop-Promotion "$Label is not canonical millisecond UTC."
    }
    if ($parsed.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'") -cne $Value) {
        Stop-Promotion "$Label is not canonical millisecond UTC."
    }
    if ($RequireWholeHour -and (
        $parsed.Minute -ne 0 -or $parsed.Second -ne 0 -or $parsed.Millisecond -ne 0
    )) {
        Stop-Promotion "$Label is not a whole UTC hour."
    }
    return $parsed
}

function ConvertTo-CanonicalJsonText {
    param([AllowNull()][object] $Value)
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [bool]) { if ($Value) { return 'true' } else { return 'false' } }
    if ($Value -is [string] -or $Value -is [char]) {
        return ([string] $Value | ConvertTo-Json -Compress)
    }
    if ($Value -is [ValueType]) {
        return [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture).ToLowerInvariant()
    }
    if ($Value -is [Collections.IDictionary]) {
        [string[]] $dictionaryNames = @($Value.Keys | ForEach-Object { [string] $_ })
        [Array]::Sort($dictionaryNames, [StringComparer]::Ordinal)
        $dictionaryMembers = foreach ($name in $dictionaryNames) {
            '{0}:{1}' -f ($name | ConvertTo-Json -Compress),
                (ConvertTo-CanonicalJsonText $Value[$name])
        }
        return '{' + ($dictionaryMembers -join ',') + '}'
    }
    if ($Value -is [Collections.IEnumerable] -and $Value -isnot [psobject]) {
        return '[' + ((@($Value) | ForEach-Object { ConvertTo-CanonicalJsonText $_ }) -join ',') + ']'
    }
    if ($Value -is [Array] -or $Value -is [Collections.IList]) {
        return '[' + ((@($Value) | ForEach-Object { ConvertTo-CanonicalJsonText $_ }) -join ',') + ']'
    }
    [string[]] $names = @($Value.PSObject.Properties.Name)
    [Array]::Sort($names, [StringComparer]::Ordinal)
    $members = foreach ($name in $names) {
        '{0}:{1}' -f ($name | ConvertTo-Json -Compress), (ConvertTo-CanonicalJsonText $Value.$name)
    }
    return '{' + ($members -join ',') + '}'
}

function Get-CanonicalJsonSha256 {
    param([AllowNull()][object] $Value)
    $text = ConvertTo-CanonicalJsonText $Value
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($text)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($hasher.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        [Array]::Clear($bytes, 0, $bytes.Length)
        $hasher.Dispose()
    }
}

function Read-JsonEvidence {
    param([string] $LiteralPath, [string] $Label)
    if (-not (Test-Path -LiteralPath $LiteralPath -PathType Leaf)) {
        Stop-Promotion "$Label is absent."
    }
    $item = Get-Item -LiteralPath $LiteralPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-Promotion "$Label is a reparse point."
    }
    $bytes = [IO.File]::ReadAllBytes($item.FullName)
    try {
        $text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
        $convertCommand = Get-Command ConvertFrom-Json
        $parsedValue = if ($convertCommand.Parameters.ContainsKey('DateKind')) {
            $text | ConvertFrom-Json -DateKind String
        } else {
            $text | ConvertFrom-Json
        }
        return [pscustomobject]@{
            Path = $item.FullName
            Bytes = $bytes
            Sha256 = Get-BootstrapBytesSha256 -Bytes $bytes
            Value = $parsedValue
        }
    }
    catch {
        if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
        Stop-Promotion "$Label is not strict UTF-8 JSON."
    }
}

function Assert-PathUnderRoot {
    param(
        [Parameter(Mandatory = $true)][string] $LiteralPath,
        [Parameter(Mandatory = $true)][string] $RootPath,
        [Parameter(Mandatory = $true)][string] $Label,
        [switch] $AllowDirectory
    )
    $root = [IO.Path]::GetFullPath($RootPath).TrimEnd('\')
    $full = [IO.Path]::GetFullPath($LiteralPath)
    if (
        $full -cne $root -and
        -not $full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)
    ) { Stop-Promotion "$Label is outside its pinned root." }
    $cursor = $full
    while ($cursor.Length -ge $root.Length) {
        if (-not (Test-Path -LiteralPath $cursor)) { Stop-Promotion "$Label is absent." }
        $item = Get-Item -LiteralPath $cursor -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            Stop-Promotion "$Label traverses a reparse point."
        }
        if ($cursor -ceq $root) { break }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ([string]::IsNullOrEmpty($parent) -or $parent.Length -ge $cursor.Length) {
            Stop-Promotion "$Label root traversal is invalid."
        }
        $cursor = $parent.TrimEnd('\')
    }
    $leaf = Get-Item -LiteralPath $full -Force
    if ($AllowDirectory) {
        if (-not $leaf.PSIsContainer) { Stop-Promotion "$Label is not a directory." }
    } elseif ($leaf.PSIsContainer) { Stop-Promotion "$Label is not a file." }
    return $leaf.FullName
}

function Assert-BootstrapRestrictedAcl {
    param(
        [Parameter(Mandatory = $true)][string] $LiteralPath,
        [Parameter(Mandatory = $true)][string] $Label,
        [Parameter(Mandatory = $true)][bool] $IsDirectory
    )
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        Stop-Promotion "$Label protection can be verified only on Windows."
    }
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = [Security.Principal.SecurityIdentifier]::new(
        [Security.Principal.WellKnownSidType]::LocalSystemSid, $null
    )
    if ($null -eq $currentSid) { Stop-Promotion "$Label owner identity is unavailable." }
    $acl = Get-Acl -LiteralPath $LiteralPath
    $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier])
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if (
        -not $acl.AreAccessRulesProtected -or $null -eq $owner -or
        $owner.Value -cne $currentSid.Value -or $rules.Count -ne 2
    ) { Stop-Promotion "$Label ACL or owner changed." }
    $expectedInheritance = [Security.AccessControl.InheritanceFlags]::None
    if ($IsDirectory) {
        $expectedInheritance =
            [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
            [Security.AccessControl.InheritanceFlags]::ObjectInherit
    }
    $seenCurrent = $false
    $seenSystem = $false
    foreach ($rule in $rules) {
        $sid = [Security.Principal.SecurityIdentifier] $rule.IdentityReference
        if (
            $rule.IsInherited -or
            $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
            $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or
            $rule.InheritanceFlags -ne $expectedInheritance -or
            $rule.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None
        ) { Stop-Promotion "$Label contains an unreviewed access rule." }
        if ($sid.Value -ceq $currentSid.Value -and -not $seenCurrent) { $seenCurrent = $true }
        elseif ($sid.Value -ceq $systemSid.Value -and -not $seenSystem) { $seenSystem = $true }
        else { Stop-Promotion "$Label grants an unreviewed or duplicate identity." }
    }
    if (-not $seenCurrent -or -not $seenSystem) {
        Stop-Promotion "$Label lacks a required principal."
    }
}

function Assert-ProtectedRuntimeCopiesBootstrap {
    $root = Assert-PathUnderRoot -LiteralPath $protectedRuntimeRoot -RootPath $storePath `
        -Label 'The protected promotion runtime directory' -AllowDirectory
    Assert-BootstrapRestrictedAcl -LiteralPath $root `
        -Label 'The protected promotion runtime directory' -IsDirectory $true
    foreach ($entry in @(
        @($stageHelperPath, $expectedStageHelperSha256, 'The protected stage helper copy'),
        @($legacyPromotionHelperPath, $expectedLegacyPromotionHelperSha256, 'The protected promotion helper copy')
    )) {
        $path = Assert-PathUnderRoot -LiteralPath $entry[0] -RootPath $protectedRuntimeRoot `
            -Label $entry[2]
        Assert-BootstrapRestrictedAcl -LiteralPath $path -Label $entry[2] -IsDirectory $false
        if ((Get-BootstrapSha256 -LiteralPath $path) -cne $entry[1]) {
            Stop-Promotion "$($entry[2]) digest changed."
        }
    }
}

function Assert-ArtifactPin {
    param([object] $Pin, [string] $ExpectedPath, [string] $ExpectedSha256, [string] $Label)
    Assert-V2ExactKeys -Value $Pin -Expected @('path', 'sha256') -Label $Label
    Assert-Sha256 -Value $Pin.sha256 -Label "$Label digest"
    if ([string] $Pin.path -cne $ExpectedPath -or [string] $Pin.sha256 -cne $ExpectedSha256) {
        Stop-Promotion "$Label does not match the exact artifact."
    }
}

function Get-StageContract {
    param([string] $LiteralPath)
    $evidence = Read-JsonEvidence -LiteralPath $LiteralPath -Label 'The stage receipt'
    $receipt = $evidence.Value
    if (
        [string] $receipt.schemaVersion -cne 'origin.window002.staged-deployment-receipt.v1' -or
        [string] $receipt.result -cne 'PASS' -or
        [string] $receipt.providerWriteState -cne 'STAGED_READY_NOT_PROMOTED' -or
        [string] $receipt.runId -cne $runId -or
        [string] $receipt.projectId -cne $projectId -or
        [string] $receipt.orgId -cne $orgId -or
        [string] $receipt.scope -cne $scope -or
        [string] $receipt.repairedCommit -cne $expectedRepairedCommit -or
        [string] $receipt.repairedMeasurementTree -cne $expectedRepairedMeasurementTree -or
        [string] $receipt.vercelCliVersion -cne $expectedVercelVersion -or
        [string] $receipt.vercelTreeManifestSha256 -cne $expectedVercelTreeManifestSha256 -or
        [string] $receipt.noRetryPreloadSha256 -cne 'd8ac99ea2805cd00e11e28270083192b8a5389e4142695b7c49a0fd6c04de2fe' -or
        [string] $receipt.wrapperSha256Before -cne $expectedStageHelperSha256 -or
        [string] $receipt.wrapperSha256After -cne $expectedStageHelperSha256
    ) {
        Stop-Promotion 'The stage receipt does not pin the accepted staged deployment.'
    }
    Assert-V2JsonBoolean -Value $receipt.productionAliasesRemainOnAcceptedDeployment `
        -Expected $true -Label 'stage productionAliasesRemainOnAcceptedDeployment'
    $candidate = $receipt.stagedDeployment
    $uri = $null
    if (
        $null -eq $candidate -or
        [string] $candidate.id -cnotmatch '^dpl_[A-Za-z0-9]+$' -or
        [string] $candidate.target -cne 'production' -or
        [string] $candidate.readyState -cne 'READY' -or
        [string] $candidate.readySubstate -cne 'STAGED' -or
        -not [Uri]::TryCreate([string] $candidate.uniqueUrl, [UriKind]::Absolute, [ref] $uri) -or
        $uri.Scheme -cne 'https' -or
        -not $uri.IsDefaultPort -or
        -not [string]::IsNullOrEmpty($uri.UserInfo) -or
        $uri.AbsolutePath -cne '/' -or
        -not [string]::IsNullOrEmpty($uri.Query) -or
        -not [string]::IsNullOrEmpty($uri.Fragment) -or
        $uri.Host -cnotmatch '^origin-probe-measure-[a-z0-9]+-uridolan77s-projects\.vercel\.app$'
    ) {
        Stop-Promotion 'The stage candidate identity is invalid.'
    }
    $assigned = Get-V2JsonInteger `
        -Value $receipt.providerReconciliation.candidateAliasAssignedAtEpochMs `
        -Label 'stage candidateAliasAssignedAtEpochMs'
    $created = Get-V2JsonInteger `
        -Value $receipt.providerReconciliation.candidateCreatedAtEpochMs `
        -Label 'stage candidateCreatedAtEpochMs'
    if (
        $assigned -le 0 -or $created -le 0 -or $created -gt $assigned -or
        [string] $receipt.providerReconciliation.candidateAliasAssignedSemantics -cne
            'staged_readiness_signal_not_window_start'
    ) {
        Stop-Promotion 'The stage readiness timestamp is invalid.'
    }
    return [pscustomobject]@{
        Receipt = $receipt
        Sha256 = $evidence.Sha256
        CandidateId = [string] $candidate.id
        CandidateUrl = [string] $candidate.uniqueUrl
        CandidateHost = $uri.Host
        StagedAliasAssignedAtEpochMs = $assigned
        CandidateCreatedAtEpochMs = $created
        CompletedAtUtc = ConvertFrom-V2Utc -Value ([string] $receipt.completedAtUtc) -Label 'stage completedAtUtc'
    }
}

function Assert-CaptureReceipt {
    param(
        [object] $Capture,
        [object] $Stage,
        [DateTimeOffset] $CutoverUtc,
        [DateTimeOffset] $ExpectedEndUtc,
        [object[]] $RawBodies,
        [object] $ProviderLookup
    )
    Assert-V2ExactKeys -Value $Capture -Expected @(
        'schemaVersion', 'result', 'targetRunId', 'serviceActiveRunId',
        'uniqueUrl', 'deploymentSource', 'deploymentProtection',
        'operatorProvenance', 'windowIntent', 'captureTool', 'contract',
        'authentication', 'sequence', 'requests', 'captureBindingSha256'
    ) -Label 'capture receipt'
    if (
        [string] $Capture.schemaVersion -cne 'origin.window002.baseline-capture.v2' -or
        [string] $Capture.result -cne 'PASS' -or
        [string] $Capture.targetRunId -cne $runId -or
        [string] $Capture.serviceActiveRunId -cne $runId -or
        [string] $Capture.uniqueUrl -cne $Stage.CandidateUrl
    ) {
        Stop-Promotion 'The capture is not bound to active Window 002 on the staged deployment.'
    }
    Assert-V2ExactKeys -Value $Capture.deploymentSource -Expected @(
        'kind', 'stageReceipt', 'deploymentId', 'uniqueUrl',
        'projectId', 'orgId', 'scope'
    ) -Label 'capture deployment source'
    if (
        [string] $Capture.deploymentSource.kind -cne 'staged_deployment_receipt' -or
        [string] $Capture.deploymentSource.deploymentId -cne $Stage.CandidateId -or
        [string] $Capture.deploymentSource.uniqueUrl -cne $Stage.CandidateUrl -or
        [string] $Capture.deploymentSource.projectId -cne $projectId -or
        [string] $Capture.deploymentSource.orgId -cne $orgId -or
        [string] $Capture.deploymentSource.scope -cne $scope
    ) { Stop-Promotion 'The capture deployment source is not the exact staged deployment.' }
    Assert-ArtifactPin -Pin $Capture.deploymentSource.stageReceipt `
        -ExpectedPath $stagedReceiptFilename -ExpectedSha256 $Stage.Sha256 `
        -Label 'capture staged-deployment receipt pin'
    Assert-V2ExactKeys -Value $Capture.deploymentProtection -Expected @(
        'fingerprintSha256', 'header', 'presented', 'secretLogged',
        'secretPersisted', 'source'
    ) -Label 'capture deployment protection'
    if (
        [string] $Capture.deploymentProtection.header -cne 'x-vercel-protection-bypass' -or
        [string] $Capture.deploymentProtection.source -cne 'stdin_only_via_protected_wrapper'
    ) { Stop-Promotion 'The staged deployment-protection contract changed.' }
    Assert-V2JsonBoolean -Value $Capture.deploymentProtection.presented -Expected $true `
        -Label 'capture deploymentProtection.presented'
    Assert-V2JsonBoolean -Value $Capture.deploymentProtection.secretLogged -Expected $false `
        -Label 'capture deploymentProtection.secretLogged'
    Assert-V2JsonBoolean -Value $Capture.deploymentProtection.secretPersisted -Expected $false `
        -Label 'capture deploymentProtection.secretPersisted'
    Assert-Sha256 -Value $Capture.deploymentProtection.fingerprintSha256 `
        -Label 'deployment-protection fingerprint'
    $provenance = $Capture.operatorProvenance
    Assert-V2ExactKeys -Value $provenance -Expected @(
        'deploymentProtectionFingerprintSha256', 'fixedPaths', 'phase',
        'providerLookup', 'schemaVersion', 'trustModel', 'windowsProtection',
        'wrapper'
    ) -Label 'operator provenance'
    if (
        [string] $provenance.schemaVersion -cne 'origin.window002.baseline-capture-provenance.v1' -or
        [string] $provenance.trustModel -cne
            'trusted_operator_tls_capture_plus_read_only_provider_lookup_not_a_signature' -or
        [string] $provenance.phase -cne 'staged' -or
        [string] $provenance.deploymentProtectionFingerprintSha256 -cne
            [string] $Capture.deploymentProtection.fingerprintSha256
    ) { Stop-Promotion 'The protected operator provenance binding changed.' }
    $root = Get-ProductRoot
    $protectedWrapperPath = [IO.Path]::Combine(
        $root, 'measurement', 'scripts', 'window002-baseline-capture-protected-v2.ps1'
    )
    Assert-ArtifactPin -Pin $provenance.wrapper `
        -ExpectedPath $protectedCaptureToolRelativePath `
        -ExpectedSha256 (Get-BootstrapSha256 -LiteralPath $protectedWrapperPath) `
        -Label 'protected capture wrapper pin'
    Assert-V2ExactKeys -Value $provenance.fixedPaths -Expected @(
        'outputDirectoryName', 'protectedStore', 'stagePass'
    ) -Label 'protected capture fixed paths'
    if (
        [string] $provenance.fixedPaths.protectedStore -cne 'OriginProbeOperator' -or
        [string] $provenance.fixedPaths.stagePass -cne 'window002-stage-pass.json' -or
        [string] $provenance.fixedPaths.outputDirectoryName -cne
            $expectedEvidenceDirectoryName
    ) { Stop-Promotion 'The protected capture fixed paths changed.' }
    Assert-V2ExactKeys -Value $provenance.windowsProtection -Expected @(
        'daclVerified', 'ownerVerified', 'readLocksHeld', 'reparseFree'
    ) -Label 'Windows protection provenance'
    foreach ($name in @($provenance.windowsProtection.PSObject.Properties.Name)) {
        Assert-V2JsonBoolean -Value $provenance.windowsProtection.$name -Expected $true `
            -Label "Windows protection provenance $name"
    }
    $lookup = $provenance.providerLookup
    Assert-V2ExactKeys -Value $lookup -Expected @(
        'apiOrigin', 'deployment', 'method', 'notAfterUtc', 'notBeforeUtc',
        'pathAndQuery', 'performed', 'providerWrites', 'rawBody'
    ) -Label 'provider lookup provenance'
    Assert-V2JsonBoolean -Value $lookup.performed -Expected $true `
        -Label 'provider lookup performed'
    $lookupProviderWrites = Get-V2JsonInteger -Value $lookup.providerWrites `
        -Label 'provider lookup providerWrites'
    if (
        $lookupProviderWrites -ne 0 -or [string] $lookup.method -cne 'GET' -or
        [string] $lookup.apiOrigin -cne 'https://api.vercel.com' -or
        [string] $lookup.pathAndQuery -cne
            "/v13/deployments/$($Stage.CandidateId)?teamId=$orgId"
    ) { Stop-Promotion 'The staged provider lookup was not exact GET-only provenance.' }
    Assert-V2ExactKeys -Value $lookup.rawBody -Expected @(
        'byteLength', 'path', 'sha256'
    ) -Label 'provider lookup raw-body pin'
    $lookupRawByteLength = Get-V2JsonInteger -Value $lookup.rawBody.byteLength `
        -Label 'provider lookup raw-body byteLength'
    if (
        [string] $lookup.rawBody.path -cne $providerLookupFilename -or
        $lookupRawByteLength -ne $ProviderLookup.Bytes.Length -or
        [string] $lookup.rawBody.sha256 -cne $ProviderLookup.Sha256
    ) { Stop-Promotion 'The provider lookup raw-body pin changed.' }
    $lookupBefore = ConvertFrom-V2Utc -Value ([string] $lookup.notBeforeUtc) `
        -Label 'provider lookup notBeforeUtc'
    $lookupAfter = ConvertFrom-V2Utc -Value ([string] $lookup.notAfterUtc) `
        -Label 'provider lookup notAfterUtc'
    if (
        $lookupBefore -gt $lookupAfter -or
        ($lookupAfter - $lookupBefore).TotalSeconds -gt 20 -or
        $lookupBefore -lt $Stage.CompletedAtUtc
    ) { Stop-Promotion 'The provider lookup UTC bracket is invalid.' }
    Assert-V2ExactKeys -Value $lookup.deployment -Expected @(
        'aliasAssignedAtEpochMs', 'createdAtEpochMs', 'id', 'ownerId',
        'projectId', 'readyState', 'readySubstate', 'target', 'url'
    ) -Label 'provider deployment projection'
    $provider = $ProviderLookup.Value
    $providerAliasAssignedAt = Get-V2JsonInteger -Value $provider.aliasAssignedAt `
        -Label 'provider lookup response aliasAssignedAt'
    $providerCreatedAt = Get-V2JsonInteger -Value $provider.createdAt `
        -Label 'provider lookup response createdAt'
    $lookupAliasAssignedAt = Get-V2JsonInteger -Value $lookup.deployment.aliasAssignedAtEpochMs `
        -Label 'provider deployment projection aliasAssignedAtEpochMs'
    $lookupCreatedAt = Get-V2JsonInteger -Value $lookup.deployment.createdAtEpochMs `
        -Label 'provider deployment projection createdAtEpochMs'
    $providerProjection = [pscustomobject][ordered]@{
        id = [string] $provider.id
        projectId = [string] $provider.projectId
        ownerId = [string] $provider.ownerId
        url = [string] $provider.url
        target = [string] $provider.target
        readyState = [string] $provider.readyState
        readySubstate = [string] $provider.readySubstate
        aliasAssignedAtEpochMs = $providerAliasAssignedAt
        createdAtEpochMs = $providerCreatedAt
    }
    if (
        [string] $lookup.deployment.id -cne $Stage.CandidateId -or
        [string] $lookup.deployment.projectId -cne $projectId -or
        [string] $lookup.deployment.ownerId -cne $orgId -or
        [string] $lookup.deployment.url -cne $Stage.CandidateHost -or
        [string] $lookup.deployment.target -cne 'production' -or
        [string] $lookup.deployment.readyState -cne 'READY' -or
        [string] $lookup.deployment.readySubstate -cne 'STAGED' -or
        $lookupAliasAssignedAt -ne $Stage.StagedAliasAssignedAtEpochMs -or
        $lookupCreatedAt -ne $Stage.CandidateCreatedAtEpochMs -or
        (Get-CanonicalJsonSha256 $lookup.deployment) -cne
            (Get-CanonicalJsonSha256 $providerProjection)
    ) { Stop-Promotion 'The provider lookup projection identity changed.' }
    $binding = [ordered]@{}
    foreach ($property in $Capture.PSObject.Properties) {
        if ($property.Name -cne 'captureBindingSha256') { $binding[$property.Name] = $property.Value }
    }
    if ((Get-CanonicalJsonSha256 ([pscustomobject] $binding)) -cne [string] $Capture.captureBindingSha256) {
        Stop-Promotion 'The capture binding digest changed.'
    }
    Assert-V2ExactKeys -Value $Capture.windowIntent -Expected @(
        'startUtc', 'endUtc', 'days', 'wholeHourUtc', 'intervalSemantics'
    ) -Label 'capture window intent'
    Assert-V2JsonBoolean -Value $Capture.windowIntent.wholeHourUtc -Expected $true `
        -Label 'capture windowIntent.wholeHourUtc'
    $captureWindowDays = Get-V2JsonInteger -Value $Capture.windowIntent.days `
        -Label 'capture windowIntent.days'
    if (
        [string] $Capture.windowIntent.startUtc -cne $CutoverUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'") -or
        [string] $Capture.windowIntent.endUtc -cne $ExpectedEndUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'") -or
        $captureWindowDays -ne 14 -or
        [string] $Capture.windowIntent.intervalSemantics -cne '[startUtc,endUtc)'
    ) {
        Stop-Promotion 'The capture window intent differs from the selected whole-hour window.'
    }
    Assert-V2ExactKeys -Value $Capture.captureTool -Expected @('path', 'sha256') -Label 'capture tool pin'
    Assert-Sha256 -Value $Capture.captureTool.sha256 -Label 'capture tool digest'
    if ([string] $Capture.captureTool.path -cne $captureToolRelativePath) {
        Stop-Promotion 'The capture tool path changed.'
    }
    Assert-V2ExactKeys -Value $Capture.contract -Expected @(
        'version', 'method', 'sequence', 'authenticationHeader',
        'authenticationSource', 'providerIdentityHeader', 'rawBodyPreservation',
        'outputCreation', 'requestTimeoutMs'
    ) -Label 'capture contract'
    $captureRequestTimeoutMs = Get-V2JsonInteger -Value $Capture.contract.requestTimeoutMs `
        -Label 'capture contract requestTimeoutMs'
    if (
        [string] $Capture.contract.version -cne 'origin.window002.baseline-capture.contract.v1' -or
        [string] $Capture.contract.method -cne 'GET' -or
        [string] $Capture.contract.authenticationHeader -cne 'x-admin-key' -or
        [string] $Capture.contract.authenticationSource -cne 'stdin_only' -or
        [string] $Capture.contract.providerIdentityHeader -cne 'x-vercel-id' -or
        [string] $Capture.contract.rawBodyPreservation -cne 'exact_response_bytes' -or
        [string] $Capture.contract.outputCreation -cne
            'protected_wrapper_precreated_empty_fixed_directory' -or
        $captureRequestTimeoutMs -ne 15000
    ) {
        Stop-Promotion 'The capture transport contract changed.'
    }
    Assert-V2ExactKeys -Value $Capture.authentication -Expected @(
        'header', 'source', 'acceptedByAdminOnlyEndpoint', 'acceptedStatus',
        'secretPersisted', 'secretLogged'
    ) -Label 'capture authentication'
    Assert-V2JsonBoolean -Value $Capture.authentication.acceptedByAdminOnlyEndpoint `
        -Expected $true -Label 'capture authentication acceptedByAdminOnlyEndpoint'
    Assert-V2JsonBoolean -Value $Capture.authentication.secretPersisted `
        -Expected $false -Label 'capture authentication secretPersisted'
    Assert-V2JsonBoolean -Value $Capture.authentication.secretLogged `
        -Expected $false -Label 'capture authentication secretLogged'
    $captureAcceptedStatus = Get-V2JsonInteger -Value $Capture.authentication.acceptedStatus `
        -Label 'capture authentication acceptedStatus'
    if (
        [string] $Capture.authentication.header -cne 'x-admin-key' -or
        [string] $Capture.authentication.source -cne 'stdin_only' -or
        $captureAcceptedStatus -ne 200
    ) {
        Stop-Promotion 'The capture authentication evidence changed.'
    }
    if (
        @($Capture.sequence).Count -ne 4 -or @($Capture.requests).Count -ne 4 -or
        @($Capture.contract.sequence).Count -ne 4
    ) { Stop-Promotion 'The capture does not contain exactly four requests.' }
    $exportUrl = "$($Stage.CandidateUrl.TrimEnd('/'))/v1/export?scope=all"
    $reduceUrl = "$($Stage.CandidateUrl.TrimEnd('/'))/v1/reduce?startUtc=$([Uri]::EscapeDataString($Capture.windowIntent.startUtc))&endUtc=$([Uri]::EscapeDataString($Capture.windowIntent.endUtc))"
    $expectedUrls = @($exportUrl, $reduceUrl, $exportUrl, $reduceUrl)
    $providerIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $previousObserved = [DateTimeOffset]::MinValue
    for ($index = 0; $index -lt 4; $index++) {
        if (
            [string] $Capture.sequence[$index] -cne $captureSequence[$index] -or
            [string] $Capture.contract.sequence[$index] -cne $captureSequence[$index]
        ) { Stop-Promotion 'The capture sequence changed.' }
        $request = $Capture.requests[$index]
        Assert-V2ExactKeys -Value $request -Expected @(
            'sequence', 'kind', 'method', 'url', 'status', 'xVercelId',
            'observedAtUtc', 'rawBody'
        ) -Label "capture request $($index + 1)"
        $requestSequence = Get-V2JsonInteger -Value $request.sequence `
            -Label "capture request $($index + 1) sequence"
        $requestStatus = Get-V2JsonInteger -Value $request.status `
            -Label "capture request $($index + 1) status"
        if (
            $requestSequence -ne $index + 1 -or
            [string] $request.kind -cne $captureSequence[$index] -or
            [string] $request.method -cne 'GET' -or
            [string] $request.url -cne $expectedUrls[$index] -or
            $requestStatus -ne 200 -or
            [string] $request.xVercelId -cnotmatch '^[\x21-\x7e]{1,512}$' -or
            -not $providerIds.Add([string] $request.xVercelId)
        ) { Stop-Promotion 'The ordered GET/200 provider provenance is invalid.' }
        $observed = ConvertFrom-V2Utc -Value ([string] $request.observedAtUtc) -Label "capture observation $($index + 1)"
        if ($observed -le $previousObserved) { Stop-Promotion 'Capture observations are not strictly increasing.' }
        $previousObserved = $observed
        Assert-ArtifactPin -Pin $request.rawBody -ExpectedPath $captureBodyFilenames[$index] `
            -ExpectedSha256 $RawBodies[$index].Sha256 -Label "capture raw body $($index + 1) pin"
    }
    if ($lookupAfter -gt (ConvertFrom-V2Utc -Value ([string] $Capture.requests[0].observedAtUtc) `
        -Label 'first capture observation')) {
        Stop-Promotion 'The provider lookup was not bracketed before the capture sequence.'
    }
    return $previousObserved
}

function Assert-ZeroRawCounts {
    param([object] $Counts, [string] $Label)
    Assert-V2ExactKeys -Value $Counts -Expected @(
        'result_view', 'share_created', 'propagated_visit',
        'qualified_result_view', 'qualified_propagation'
    ) -Label $Label
    foreach ($name in @($Counts.PSObject.Properties.Name)) {
        Assert-ZeroNumber -Value $Counts.$name -Label "$Label.$name"
    }
}

function Invoke-IsolatedPinnedNodeProcess {
    param(
        [Parameter(Mandatory = $true)][string] $NodeExecutable,
        [Parameter(Mandatory = $true)][string[]] $Arguments,
        [Parameter(Mandatory = $true)][ValidateRange(1, 300000)]
            [int] $TimeoutMilliseconds,
        [Parameter(Mandatory = $true)][ValidateRange(1, 1048576)]
            [int] $MaximumOutputBytes
    )
    if (-not [IO.Path]::IsPathFullyQualified($NodeExecutable) -or
        -not (Test-Path -LiteralPath $NodeExecutable -PathType Leaf)) {
        Stop-Promotion 'The pinned Node executable is not an absolute plain file.'
    }
    if (@($Arguments).Count -eq 0 -or
        @($Arguments | Where-Object { $null -eq $_ }).Count -ne 0) {
        Stop-Promotion 'The pinned Node argument list is invalid.'
    }

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $NodeExecutable
    foreach ($argument in $Arguments) { $startInfo.ArgumentList.Add($argument) }
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.Environment.Clear()
    $startInfo.Environment['SystemRoot'] = 'C:\Windows'
    $startInfo.Environment['WINDIR'] = 'C:\Windows'
    if ($startInfo.Environment.Count -ne 2 -or
        [string] $startInfo.Environment['SystemRoot'] -cne 'C:\Windows' -or
        [string] $startInfo.Environment['WINDIR'] -cne 'C:\Windows') {
        Stop-Promotion 'The pinned Node child environment is not the exact two-key allowlist.'
    }

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    $stdoutBuffer = [byte[]]::new(4096)
    $stderrBuffer = [byte[]]::new(4096)
    $stdoutBytes = [IO.MemoryStream]::new()
    $stderrBytes = [IO.MemoryStream]::new()
    $stopwatch = [Diagnostics.Stopwatch]::StartNew()
    $started = $false
    try {
        if (-not $process.Start()) {
            Stop-Promotion 'The pinned Node analysis child did not start.'
        }
        $started = $true
        $process.StandardInput.Close()
        $stdoutRead = $process.StandardOutput.BaseStream.ReadAsync(
            $stdoutBuffer, 0, $stdoutBuffer.Length
        )
        $stderrRead = $process.StandardError.BaseStream.ReadAsync(
            $stderrBuffer, 0, $stderrBuffer.Length
        )
        $stdoutComplete = $false
        $stderrComplete = $false
        while (-not ($stdoutComplete -and $stderrComplete)) {
            $remaining = $TimeoutMilliseconds - [int] $stopwatch.ElapsedMilliseconds
            if ($remaining -le 0) {
                Stop-Promotion 'The pinned Node analysis child timed out.'
            }
            [Threading.Tasks.Task[]] $pendingReads = @()
            [string[]] $pendingChannels = @()
            if (-not $stdoutComplete) {
                $pendingReads += [Threading.Tasks.Task] $stdoutRead
                $pendingChannels += 'stdout'
            }
            if (-not $stderrComplete) {
                $pendingReads += [Threading.Tasks.Task] $stderrRead
                $pendingChannels += 'stderr'
            }
            $completedIndex = [Threading.Tasks.Task]::WaitAny($pendingReads, $remaining)
            if ($completedIndex -lt 0) {
                Stop-Promotion 'The pinned Node analysis child timed out.'
            }
            $channel = $pendingChannels[$completedIndex]
            if ($channel -ceq 'stdout') {
                $readCount = $stdoutRead.GetAwaiter().GetResult()
                if ($readCount -eq 0) { $stdoutComplete = $true }
                else {
                    if ($stdoutBytes.Length + $readCount -gt $MaximumOutputBytes) {
                        Stop-Promotion 'The pinned Node analysis exceeded its bounded stdout.'
                    }
                    $stdoutBytes.Write($stdoutBuffer, 0, $readCount)
                    $stdoutRead = $process.StandardOutput.BaseStream.ReadAsync(
                        $stdoutBuffer, 0, $stdoutBuffer.Length
                    )
                }
            } else {
                $readCount = $stderrRead.GetAwaiter().GetResult()
                if ($readCount -eq 0) { $stderrComplete = $true }
                else {
                    if ($stderrBytes.Length + $readCount -gt $MaximumOutputBytes) {
                        Stop-Promotion 'The pinned Node analysis exceeded its bounded stderr.'
                    }
                    $stderrBytes.Write($stderrBuffer, 0, $readCount)
                    $stderrRead = $process.StandardError.BaseStream.ReadAsync(
                        $stderrBuffer, 0, $stderrBuffer.Length
                    )
                }
            }
        }
        $remaining = $TimeoutMilliseconds - [int] $stopwatch.ElapsedMilliseconds
        if ($remaining -le 0 -or -not $process.WaitForExit($remaining)) {
            Stop-Promotion 'The pinned Node analysis child timed out.'
        }
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            StdoutBytes = $stdoutBytes.ToArray()
            StderrBytes = $stderrBytes.ToArray()
        }
    }
    finally {
        $stopwatch.Stop()
        if ($started -and -not $process.HasExited) {
            try { $process.Kill($true) } catch {}
            try { [void] $process.WaitForExit(5000) } catch {}
        }
        $stdoutBytes.Dispose()
        $stderrBytes.Dispose()
        $process.Dispose()
    }
}

function ConvertFrom-PinnedBaselineAnalysisOutput {
    param([Parameter(Mandatory = $true)][object] $ProcessResult)
    if ($ProcessResult.ExitCode -ne 0 -or
        @($ProcessResult.StdoutBytes).Count -eq 0 -or
        @($ProcessResult.StderrBytes).Count -ne 0) {
        Stop-Promotion 'The pinned local projector/reducer analysis failed closed.'
    }
    try {
        $output = [Text.UTF8Encoding]::new($false, $true).GetString(
            [byte[]] $ProcessResult.StdoutBytes
        )
    }
    catch { Stop-Promotion 'The pinned local projector/reducer result is not strict UTF-8.' }
    if ($output.Contains("`r", [StringComparison]::Ordinal) -or
        $output.Contains("`n", [StringComparison]::Ordinal)) {
        Stop-Promotion 'The pinned local projector/reducer result must be exactly one line.'
    }
    try { return $output | ConvertFrom-Json }
    catch { Stop-Promotion 'The pinned local projector/reducer result is invalid.' }
}

function Invoke-ContractPinnedNodeProcessProbe {
    param(
        [Parameter(Mandatory = $true)][string] $NodeExecutable,
        [Parameter(Mandatory = $true)]
            [ValidateSet('Multiline', 'OversizedStdout', 'OversizedStderr', 'Timeout')]
            [string] $ProbeMode
    )
    $source = switch ($ProbeMode) {
        'Multiline' { 'process.stdout.write("{\"first\":true}\n{\"second\":true}");' }
        'OversizedStdout' { 'process.stdout.write("x".repeat(32769));' }
        'OversizedStderr' { 'process.stderr.write("x".repeat(32769));' }
        'Timeout' { 'setInterval(() => {}, 1000);' }
    }
    $result = Invoke-IsolatedPinnedNodeProcess -NodeExecutable $NodeExecutable `
        -Arguments @('--input-type=module', '--eval', $source) `
        -TimeoutMilliseconds $(if ($ProbeMode -ceq 'Timeout') { 250 } else { 5000 }) `
        -MaximumOutputBytes $maxPinnedAnalysisOutputBytes
    if ($ProbeMode -ceq 'Multiline') {
        [void] (ConvertFrom-PinnedBaselineAnalysisOutput -ProcessResult $result)
    }
    Stop-Promotion "The $ProbeMode pinned Node process probe unexpectedly passed."
}

function Invoke-PinnedBaselineAnalysis {
    param(
        [Parameter(Mandatory = $true)][string] $NodeExecutable,
        [Parameter(Mandatory = $true)][string] $ProjectorPath,
        [Parameter(Mandatory = $true)][string] $ReducerPath,
        [Parameter(Mandatory = $true)][object[]] $RawBodies,
        [Parameter(Mandatory = $true)][string] $ServiceRunId,
        [Parameter(Mandatory = $true)][string] $StartUtc,
        [Parameter(Mandatory = $true)][string] $EndUtc
    )
    if (@($RawBodies).Count -ne 4) {
        Stop-Promotion 'The local baseline analysis requires exactly four raw bodies.'
    }
    $analysisSource = @'
import fs from "node:fs";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const [projectorPath, reducerPath, export1Path, reduction1Path, export2Path,
  reduction2Path, serviceRunId, targetRunId, startUtc, endUtc] = process.argv.slice(2);
const environmentKeys = Object.keys(process.env).sort();
if (environmentKeys.length !== 2 || environmentKeys[0] !== "SystemRoot" ||
    environmentKeys[1] !== "WINDIR" || process.env.SystemRoot !== "C:\\Windows" ||
    process.env.WINDIR !== "C:\\Windows") {
  throw new Error("unexpected_child_environment");
}
const projector = await import(pathToFileURL(projectorPath).href);
const reducerModule = await import(pathToFileURL(reducerPath).href);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
    : value;
const canonicalSha256 = (value) => sha256(Buffer.from(JSON.stringify(canonicalize(value)), "utf8"));
const parse = (bytes) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join("\u0000") === [...keys].sort().join("\u0000");
const reducerEvent = (event) => ({
  id: event.id,
  type: event.type,
  runId: event.runId,
  at: event.at,
  slug: event.slug,
  clientHash: event.clientHash,
  creatorHash: event.creatorHash,
  shareTokenFingerprint: event.shareTokenFingerprint,
  seed: event.seed,
  derivedFrom: event.derivedFrom,
  exclusions: event.exclusions,
});
const export1Bytes = fs.readFileSync(export1Path);
const export2Bytes = fs.readFileSync(export2Path);
const reduction1Bytes = fs.readFileSync(reduction1Path);
const reduction2Bytes = fs.readFileSync(reduction2Path);
const projection1 = projector.parseAndProject(export1Bytes, { expectedServiceRunId: serviceRunId });
const projection2 = projector.parseAndProject(export2Bytes, { expectedServiceRunId: serviceRunId });
projector.assertMatchingReads(projection1, projection2);
const export1 = parse(export1Bytes);
const export2 = parse(export2Bytes);
const hosted1Envelope = parse(reduction1Bytes);
const hosted2Envelope = parse(reduction2Bytes);
if (!exactKeys(hosted1Envelope, ["ok", "reduction"]) || hosted1Envelope.ok !== true ||
    !exactKeys(hosted2Envelope, ["ok", "reduction"]) || hosted2Envelope.ok !== true) {
  throw new Error("invalid_hosted_reduction_envelope");
}
const options = { runId: targetRunId, startUtc, endUtc };
const local1 = reducerModule.reduceWindowEvents(export1.events.map(reducerEvent), options);
const local2 = reducerModule.reduceWindowEvents(export2.events.map(reducerEvent), options);
if (!isDeepStrictEqual(local1, hosted1Envelope.reduction) ||
    !isDeepStrictEqual(local2, hosted2Envelope.reduction) ||
    !isDeepStrictEqual(local1, local2)) {
  throw new Error("hosted_reduction_mismatch");
}
process.stdout.write(JSON.stringify({
  exportRead1Sha256: projection1.rawSha256,
  exportRead2Sha256: projection2.rawSha256,
  canonicalEventProjectionSha256: projection1.projectionDigest,
  eventCount: projection1.eventCount,
  activeRunEventCount: projection1.activeRunEventCount,
  wrongRunCount: projection1.wrongRunCount,
  runDistribution: projection1.runDistribution,
  reductionRead1Sha256: sha256(reduction1Bytes),
  reductionRead2Sha256: sha256(reduction2Bytes),
  localReductionCanonicalSha256: canonicalSha256(local1),
}));
'@
    $arguments = @(
        '--input-type=module', '--eval', $analysisSource, '--',
        'origin-window002-promotion-v2-analysis',
        $ProjectorPath, $ReducerPath,
        $RawBodies[0].Path, $RawBodies[1].Path,
        $RawBodies[2].Path, $RawBodies[3].Path,
        $ServiceRunId, $runId, $StartUtc, $EndUtc
    )
    $processResult = Invoke-IsolatedPinnedNodeProcess -NodeExecutable $NodeExecutable `
        -Arguments $arguments -TimeoutMilliseconds $pinnedAnalysisTimeoutMilliseconds `
        -MaximumOutputBytes $maxPinnedAnalysisOutputBytes
    $analysis = ConvertFrom-PinnedBaselineAnalysisOutput -ProcessResult $processResult
    Assert-V2ExactKeys -Value $analysis -Expected @(
        'exportRead1Sha256', 'exportRead2Sha256',
        'canonicalEventProjectionSha256', 'eventCount', 'activeRunEventCount',
        'wrongRunCount', 'runDistribution', 'reductionRead1Sha256',
        'reductionRead2Sha256', 'localReductionCanonicalSha256'
    ) -Label 'pinned local projector/reducer result'
    foreach ($name in @(
        'exportRead1Sha256', 'exportRead2Sha256',
        'canonicalEventProjectionSha256', 'reductionRead1Sha256',
        'reductionRead2Sha256', 'localReductionCanonicalSha256'
    )) { Assert-Sha256 -Value $analysis.$name -Label "local analysis $name" }
    $analysisEventCount = Get-V2JsonInteger -Value $analysis.eventCount `
        -Label 'local analysis eventCount'
    $analysisActiveRunEventCount = Get-V2JsonInteger -Value $analysis.activeRunEventCount `
        -Label 'local analysis activeRunEventCount'
    $analysisWrongRunCount = Get-V2JsonInteger -Value $analysis.wrongRunCount `
        -Label 'local analysis wrongRunCount'
    $analysisOriginalRunCount = Get-V2JsonInteger -Value $analysis.runDistribution.$originalRunId `
        -Label "local analysis runDistribution.$originalRunId"
    $analysisReacceptanceRunCount = Get-V2JsonInteger `
        -Value $analysis.runDistribution.$reacceptanceRunId `
        -Label "local analysis runDistribution.$reacceptanceRunId"
    if (
        $analysisEventCount -ne $historicalEventCount -or
        $analysisActiveRunEventCount -ne 0 -or
        $analysisWrongRunCount -ne $historicalEventCount -or
        $analysisOriginalRunCount -ne 16 -or
        $analysisReacceptanceRunCount -ne 21
    ) { Stop-Promotion 'The pinned historical projection is not exactly 16/21/37 with active-run zero.' }
    return $analysis
}

function Assert-RawLedgerAndReduction {
    param(
        [object[]] $RawBodies,
        [DateTimeOffset] $CutoverUtc,
        [DateTimeOffset] $ExpectedEndUtc,
        [string] $NodeExecutable,
        [string] $ProjectorPath,
        [string] $ReducerPath
    )
    if ($RawBodies[0].Sha256 -cne $RawBodies[2].Sha256) {
        Stop-Promotion 'The two raw exports are not byte-identical.'
    }
    if ($RawBodies[1].Sha256 -cne $RawBodies[3].Sha256) {
        Stop-Promotion 'The two bounded reductions are not byte-identical.'
    }
    $export1 = $RawBodies[0].Value
    $export2 = $RawBodies[2].Value
    foreach ($export in @($export1, $export2)) {
        Assert-V2ExactKeys -Value $export -Expected @(
            'ok', 'scope', 'activeRunId', 'events', 'ledgerSchemaVersion'
        ) -Label 'raw export envelope'
        Assert-V2JsonBoolean -Value $export.ok -Expected $true -Label 'raw export ok'
        if (
            [string] $export.scope -cne 'all' -or
            [string] $export.activeRunId -cne $runId -or
            [string] $export.ledgerSchemaVersion -cne 'v1' -or
            @($export.events).Count -ne $historicalEventCount
        ) { Stop-Promotion 'The raw export is not the retained Window 002 ledger.' }
    }
    $originalCount = 0
    $reacceptanceCount = 0
    $eventIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($event in @($export1.events)) {
        if ([string]::IsNullOrEmpty([string] $event.id) -or -not $eventIds.Add([string] $event.id)) {
            Stop-Promotion 'The retained ledger contains a missing or duplicate event id.'
        }
        [void] (ConvertFrom-V2Utc -Value ([string] $event.at) -Label "event $($event.id) timestamp")
        if ([string] $event.runId -ceq $originalRunId) { $originalCount++ }
        elseif ([string] $event.runId -ceq $reacceptanceRunId) { $reacceptanceCount++ }
        else { Stop-Promotion 'The retained ledger contains an active or unrecognized run.' }
    }
    if ($originalCount -ne 16 -or $reacceptanceCount -ne 21) {
        Stop-Promotion 'The retained ledger is not the exact 16/21 historical split.'
    }
    $expectedStart = $CutoverUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
    $expectedEnd = $ExpectedEndUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
    foreach ($body in @($RawBodies[1], $RawBodies[3])) {
        Assert-V2ExactKeys -Value $body.Value -Expected @('ok', 'reduction') -Label 'bounded reduction envelope'
        Assert-V2JsonBoolean -Value $body.Value.ok -Expected $true `
            -Label 'bounded reduction envelope ok'
        $reduction = $body.Value.reduction
        Assert-V2ExactKeys -Value $reduction -Expected @(
            'runId', 'rawCounts', 'qualifiedResultViews', 'qualifiedPropagations',
            'distinctSharerSessions', 'exclusions', 'disposition', 'window',
            'windowExclusionCounts', 'windowExclusions'
        ) -Label 'bounded reduction'
        Assert-V2ExactKeys -Value $reduction.window -Expected @(
            'startUtc', 'endUtc', 'semantics'
        ) -Label 'bounded reduction window'
        Assert-V2ExactKeys -Value $reduction.windowExclusionCounts -Expected @(
            'wrongRun', 'beforeStart', 'atOrAfterEnd'
        ) -Label 'bounded reduction exclusion counts'
        Assert-V2ExactKeys -Value $reduction.windowExclusions -Expected @(
            'wrongRun', 'beforeStart', 'atOrAfterEnd'
        ) -Label 'bounded reduction exclusions'
        if (
            [string] $reduction.runId -cne $runId -or
            [string] $reduction.window.startUtc -cne $expectedStart -or
            [string] $reduction.window.endUtc -cne $expectedEnd -or
            [string] $reduction.window.semantics -cne '[startUtc,endUtc)' -or
            [string] $reduction.disposition -cne 'HOLD_ONCE'
        ) { Stop-Promotion 'The bounded reduction is not bound to Window 002.' }
        Assert-ZeroRawCounts -Counts $reduction.rawCounts -Label 'bounded reduction rawCounts'
        foreach ($name in @('qualifiedResultViews', 'qualifiedPropagations', 'distinctSharerSessions')) {
            Assert-ZeroNumber -Value $reduction.$name -Label "bounded reduction $name"
        }
        if (@($reduction.exclusions).Count -ne 0) { Stop-Promotion 'The bounded reduction has event exclusions.' }
        $wrongRunCount = Get-V2JsonInteger -Value $reduction.windowExclusionCounts.wrongRun `
            -Label 'bounded reduction wrongRun exclusion count'
        $beforeStartCount = Get-V2JsonInteger -Value $reduction.windowExclusionCounts.beforeStart `
            -Label 'bounded reduction beforeStart exclusion count'
        $atOrAfterEndCount = Get-V2JsonInteger `
            -Value $reduction.windowExclusionCounts.atOrAfterEnd `
            -Label 'bounded reduction atOrAfterEnd exclusion count'
        if (
            $wrongRunCount -ne $historicalEventCount -or
            $beforeStartCount -ne 0 -or
            $atOrAfterEndCount -ne 0 -or
            @($reduction.windowExclusions.wrongRun).Count -ne $historicalEventCount -or
            @($reduction.windowExclusions.beforeStart).Count -ne 0 -or
            @($reduction.windowExclusions.atOrAfterEnd).Count -ne 0
        ) { Stop-Promotion 'The bounded reduction exclusions are not exactly 37/0/0.' }
        $seenWrongRun = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        foreach ($detail in @($reduction.windowExclusions.wrongRun)) {
            if (
                [string] $detail.reason -cne 'wrong_run' -or
                -not $eventIds.Contains([string] $detail.eventId) -or
                -not $seenWrongRun.Add([string] $detail.eventId)
            ) { Stop-Promotion 'The wrong-run exclusion provenance is invalid.' }
        }
    }
    $analysis = Invoke-PinnedBaselineAnalysis -NodeExecutable $NodeExecutable `
        -ProjectorPath $ProjectorPath -ReducerPath $ReducerPath -RawBodies $RawBodies `
        -ServiceRunId $runId `
        -StartUtc $CutoverUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'") `
        -EndUtc $ExpectedEndUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
    if (
        [string] $analysis.exportRead1Sha256 -cne $RawBodies[0].Sha256 -or
        [string] $analysis.exportRead2Sha256 -cne $RawBodies[2].Sha256 -or
        [string] $analysis.reductionRead1Sha256 -cne $RawBodies[1].Sha256 -or
        [string] $analysis.reductionRead2Sha256 -cne $RawBodies[3].Sha256 -or
        [string] $analysis.localReductionCanonicalSha256 -cne
            (Get-CanonicalJsonSha256 $RawBodies[1].Value.reduction)
    ) { Stop-Promotion 'The pinned projector/reducer result differs from reopened raw evidence.' }
    return [pscustomobject]@{
        ExportSha256 = $RawBodies[0].Sha256
        ReductionSha256 = $RawBodies[1].Sha256
        ReductionCanonicalSha256 = Get-CanonicalJsonSha256 $RawBodies[1].Value.reduction
        ProjectionSha256 = [string] $analysis.canonicalEventProjectionSha256
    }
}

function Assert-ZeroBaselineV2 {
    param(
        [object] $ZeroEvidence,
        [object] $CaptureEvidence,
        [object] $Capture,
        [object] $RawFacts,
        [DateTimeOffset] $CutoverUtc,
        [DateTimeOffset] $ExpectedEndUtc,
        [DateTimeOffset] $CaptureObservedAtUtc,
        [DateTimeOffset] $NowUtc
    )
    $zero = $ZeroEvidence.Value
    Assert-V2ExactKeys -Value $zero -Expected @(
        'schemaVersion', 'result', 'runId', 'observedAtUtc', 'captureReceipt',
        'captureProvenance', 'window', 'reads', 'activeRunBaseline',
        'retainedHistoricalLedger', 'unexpectedBoundaryExclusions',
        'ledgerMutation', 'initialActiveRunEventCount', 'initialLedgerEventCount'
    ) -Label 'zero-baseline v2 evidence'
    if ([string] $zero.schemaVersion -cne 'origin.window002.zero-baseline.v2') {
        Stop-Promotion 'A legacy or unknown zero-baseline contract is forbidden.'
    }
    if ([string] $zero.result -cne 'PASS' -or [string] $zero.runId -cne $runId) {
        Stop-Promotion 'The zero-baseline v2 result is not PASS for Window 002.'
    }
    Assert-ArtifactPin -Pin $zero.captureReceipt -ExpectedPath $captureReceiptFilename `
        -ExpectedSha256 $CaptureEvidence.Sha256 -Label 'zero-baseline capture receipt pin'
    Assert-V2ExactKeys -Value $zero.captureProvenance -Expected @(
        'captureBindingSha256', 'captureToolSha256', 'uniqueUrl', 'targetRunId',
        'serviceActiveRunId', 'deploymentSource', 'operatorProvenance',
        'deploymentProtection'
    ) -Label 'zero-baseline capture provenance'
    if (
        [string] $zero.captureProvenance.captureBindingSha256 -cne [string] $Capture.captureBindingSha256 -or
        [string] $zero.captureProvenance.captureToolSha256 -cne [string] $Capture.captureTool.sha256 -or
        [string] $zero.captureProvenance.uniqueUrl -cne [string] $Capture.uniqueUrl -or
        [string] $zero.captureProvenance.targetRunId -cne $runId -or
        [string] $zero.captureProvenance.serviceActiveRunId -cne $runId -or
        (Get-CanonicalJsonSha256 $zero.captureProvenance.deploymentSource) -cne
            (Get-CanonicalJsonSha256 $Capture.deploymentSource) -or
        (Get-CanonicalJsonSha256 $zero.captureProvenance.operatorProvenance) -cne
            (Get-CanonicalJsonSha256 $Capture.operatorProvenance) -or
        (Get-CanonicalJsonSha256 $zero.captureProvenance.deploymentProtection) -cne
            (Get-CanonicalJsonSha256 $Capture.deploymentProtection)
    ) { Stop-Promotion 'The zero-baseline capture provenance changed.' }
    $expectedStart = $CutoverUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
    $expectedEnd = $ExpectedEndUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
    Assert-V2ExactKeys -Value $zero.window -Expected @(
        'startUtc', 'endUtc', 'days', 'intervalSemantics', 'eventTimeAuthority'
    ) -Label 'zero-baseline window'
    $zeroWindowDays = Get-V2JsonInteger -Value $zero.window.days `
        -Label 'zero-baseline window days'
    if (
        [string] $zero.window.startUtc -cne $expectedStart -or
        [string] $zero.window.endUtc -cne $expectedEnd -or
        $zeroWindowDays -ne 14 -or
        [string] $zero.window.intervalSemantics -cne '[startUtc,endUtc)' -or
        [string] $zero.window.eventTimeAuthority -cne 'database_event_time'
    ) { Stop-Promotion 'The zero-baseline window semantics changed.' }
    $readPairs = @(
        @($zero.reads.read1, 0, 1, $Capture.requests[1].observedAtUtc),
        @($zero.reads.read2, 2, 3, $Capture.requests[3].observedAtUtc)
    )
    Assert-V2ExactKeys -Value $zero.reads -Expected @('read1', 'read2') -Label 'zero-baseline reads'
    foreach ($pair in $readPairs) {
        $read = $pair[0]
        Assert-V2ExactKeys -Value $read -Expected @(
            'observedAtUtc', 'rawExport', 'boundedReduction', 'rawExportSha256',
            'canonicalEventProjectionSha256', 'boundedReductionRawSha256',
            'locallyRecomputedServiceReductionCanonicalSha256',
            'locallyRecomputedTargetReductionCanonicalSha256'
        ) -Label 'zero-baseline read'
        $exportIndex = [int] $pair[1]
        $reductionIndex = [int] $pair[2]
        Assert-ArtifactPin -Pin $read.rawExport `
            -ExpectedPath $captureBodyFilenames[$exportIndex] `
            -ExpectedSha256 $RawFacts.ExportSha256 -Label 'zero-baseline raw export pin'
        Assert-ArtifactPin -Pin $read.boundedReduction `
            -ExpectedPath $captureBodyFilenames[$reductionIndex] `
            -ExpectedSha256 $RawFacts.ReductionSha256 -Label 'zero-baseline bounded reduction pin'
        if (
            [string] $read.observedAtUtc -cne [string] $pair[3] -or
            [string] $read.rawExport.sha256 -cne $RawFacts.ExportSha256 -or
            [string] $read.rawExportSha256 -cne $RawFacts.ExportSha256 -or
            [string] $read.boundedReduction.sha256 -cne $RawFacts.ReductionSha256 -or
            [string] $read.boundedReductionRawSha256 -cne $RawFacts.ReductionSha256 -or
            [string] $read.canonicalEventProjectionSha256 -cne $RawFacts.ProjectionSha256 -or
            [string] $read.locallyRecomputedServiceReductionCanonicalSha256 -cne $RawFacts.ReductionCanonicalSha256 -or
            [string] $read.locallyRecomputedTargetReductionCanonicalSha256 -cne $RawFacts.ReductionCanonicalSha256
        ) { Stop-Promotion 'A zero-baseline read digest differs from reopened evidence.' }
        Assert-Sha256 -Value $read.canonicalEventProjectionSha256 `
            -Label 'zero-baseline canonical projection digest'
    }
    if (
        [string] $zero.reads.read1.canonicalEventProjectionSha256 -cne
            [string] $zero.reads.read2.canonicalEventProjectionSha256
    ) { Stop-Promotion 'The two canonical historical projections differ.' }
    if (
        [string] $zero.observedAtUtc -cne $Capture.requests[3].observedAtUtc -or
        $CaptureObservedAtUtc -gt $NowUtc.AddSeconds(5) -or
        $CaptureObservedAtUtc -lt $NowUtc.AddMinutes(-5) -or
        $CaptureObservedAtUtc -ge $CutoverUtc
    ) { Stop-Promotion 'The zero-baseline is not fresh, pre-start, and capture-derived.' }
    $active = $zero.activeRunBaseline
    Assert-V2ExactKeys -Value $active -Expected @(
        'runId', 'rawEventCount', 'qualifiedEventCount', 'rawCounts',
        'qualifiedResultViews', 'qualifiedPropagations', 'distinctSharerSessions',
        'allMetricsZero', 'disposition', 'targetReductionCanonicalSha256'
    ) -Label 'active Window 002 baseline'
    Assert-V2JsonBoolean -Value $active.allMetricsZero -Expected $true `
        -Label 'active baseline allMetricsZero'
    $activeRawEventCount = Get-V2JsonInteger -Value $active.rawEventCount `
        -Label 'active baseline rawEventCount'
    $activeQualifiedEventCount = Get-V2JsonInteger -Value $active.qualifiedEventCount `
        -Label 'active baseline qualifiedEventCount'
    $activeQualifiedResultViews = Get-V2JsonInteger -Value $active.qualifiedResultViews `
        -Label 'active baseline qualifiedResultViews'
    $activeQualifiedPropagations = Get-V2JsonInteger -Value $active.qualifiedPropagations `
        -Label 'active baseline qualifiedPropagations'
    $activeDistinctSharerSessions = Get-V2JsonInteger -Value $active.distinctSharerSessions `
        -Label 'active baseline distinctSharerSessions'
    if (
        [string] $active.runId -cne $runId -or
        $activeRawEventCount -ne 0 -or $activeQualifiedEventCount -ne 0 -or
        $activeQualifiedResultViews -ne 0 -or
        $activeQualifiedPropagations -ne 0 -or
        $activeDistinctSharerSessions -ne 0 -or
        [string] $active.disposition -cne 'HOLD_ONCE' -or
        [string] $active.targetReductionCanonicalSha256 -cne $RawFacts.ReductionCanonicalSha256
    ) { Stop-Promotion 'The active Window 002 baseline is nonzero or inconsistent.' }
    Assert-ZeroRawCounts -Counts $active.rawCounts -Label 'active baseline rawCounts'
    $history = $zero.retainedHistoricalLedger
    Assert-V2ExactKeys -Value $history -Expected @(
        'totalEventCount', 'activeRunEventCount', 'wrongRunCount', 'runDistribution',
        'unknownHistoricalRunIdCount', 'allRunIdsRecognized', 'historyPreserved',
        'rawExportSha256', 'canonicalEventProjectionSha256'
    ) -Label 'retained historical ledger'
    foreach ($entry in @($history.runDistribution)) {
        Assert-V2ExactKeys -Value $entry -Expected @('runId', 'eventCount') `
            -Label 'historical run distribution entry'
    }
    Assert-V2JsonBoolean -Value $history.allRunIdsRecognized -Expected $true `
        -Label 'retained history allRunIdsRecognized'
    Assert-V2JsonBoolean -Value $history.historyPreserved -Expected $true `
        -Label 'retained history historyPreserved'
    $historyTotal = Get-V2JsonInteger -Value $history.totalEventCount `
        -Label 'retained history totalEventCount'
    $historyActive = Get-V2JsonInteger -Value $history.activeRunEventCount `
        -Label 'retained history activeRunEventCount'
    $historyWrong = Get-V2JsonInteger -Value $history.wrongRunCount `
        -Label 'retained history wrongRunCount'
    $historyUnknown = Get-V2JsonInteger -Value $history.unknownHistoricalRunIdCount `
        -Label 'retained history unknownHistoricalRunIdCount'
    $historyOriginal = Get-V2JsonInteger -Value $history.runDistribution[0].eventCount `
        -Label "retained history $originalRunId eventCount"
    $historyReacceptance = Get-V2JsonInteger -Value $history.runDistribution[1].eventCount `
        -Label "retained history $reacceptanceRunId eventCount"
    if (
        $historyTotal -ne 37 -or
        $historyActive -ne 0 -or
        $historyWrong -ne 37 -or
        $historyUnknown -ne 0 -or
        [string] $history.rawExportSha256 -cne $RawFacts.ExportSha256 -or
        [string] $history.canonicalEventProjectionSha256 -cne
            $RawFacts.ProjectionSha256 -or
        @($history.runDistribution).Count -ne 2 -or
        [string] $history.runDistribution[0].runId -cne $originalRunId -or
        $historyOriginal -ne 16 -or
        [string] $history.runDistribution[1].runId -cne $reacceptanceRunId -or
        $historyReacceptance -ne 21
    ) { Stop-Promotion 'The retained historical ledger evidence is not exactly 16/21/37.' }
    $boundary = $zero.unexpectedBoundaryExclusions
    Assert-V2ExactKeys -Value $boundary -Expected @(
        'wrongRunDelta', 'unrecognizedRun', 'beforeStart', 'atOrAfterEnd'
    ) -Label 'unexpected boundary exclusions'
    foreach ($name in @('wrongRunDelta', 'unrecognizedRun', 'beforeStart', 'atOrAfterEnd')) {
        Assert-ZeroNumber -Value $boundary.$name -Label "unexpected boundary $name"
    }
    $mutation = $zero.ledgerMutation
    Assert-V2ExactKeys -Value $mutation -Expected @(
        'detected', 'rawExportsByteIdentical', 'boundedReductionsByteIdentical',
        'canonicalProjectionsEqual', 'deletedEvents', 'updatedEvents'
    ) -Label 'ledger mutation evidence'
    Assert-V2JsonBoolean -Value $mutation.detected -Expected $false `
        -Label 'ledger mutation detected'
    Assert-V2JsonBoolean -Value $mutation.rawExportsByteIdentical -Expected $true `
        -Label 'ledger mutation rawExportsByteIdentical'
    Assert-V2JsonBoolean -Value $mutation.boundedReductionsByteIdentical -Expected $true `
        -Label 'ledger mutation boundedReductionsByteIdentical'
    Assert-V2JsonBoolean -Value $mutation.canonicalProjectionsEqual -Expected $true `
        -Label 'ledger mutation canonicalProjectionsEqual'
    $mutationDeleted = Get-V2JsonInteger -Value $mutation.deletedEvents `
        -Label 'ledger mutation deletedEvents'
    $mutationUpdated = Get-V2JsonInteger -Value $mutation.updatedEvents `
        -Label 'ledger mutation updatedEvents'
    if ($mutationDeleted -ne 0 -or $mutationUpdated -ne 0) {
        Stop-Promotion 'The baseline reports ledger mutation or non-identical reads.'
    }
    $initialActiveRunEventCount = Get-V2JsonInteger `
        -Value $zero.initialActiveRunEventCount -Label 'initialActiveRunEventCount'
    $initialLedgerEventCount = Get-V2JsonInteger `
        -Value $zero.initialLedgerEventCount -Label 'initialLedgerEventCount'
    if (
        $initialActiveRunEventCount -ne 0 -or
        $initialLedgerEventCount -ne 37 -or
        $null -ne $zero.PSObject.Properties['initialEventCount']
    ) { Stop-Promotion 'The separated initial counts are invalid.' }
}

function Get-ProductRoot {
    $scriptDirectory = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($PSCommandPath))
    return [IO.Path]::GetFullPath([IO.Path]::Combine($scriptDirectory, '..', '..'))
}

function Assert-SupplementalSeal {
    param([object] $SealEvidence)
    $seal = $SealEvidence.Value
    Assert-V2ExactKeys -Value $seal -Expected @(
        'schemaVersion', 'result', 'baseRuntimeSeal', 'repository',
        'artifactPins', 'inheritedRuntime'
    ) -Label 'supplemental runtime seal'
    if (
        [string] $seal.schemaVersion -cne 'origin.window002.baseline-supersession-runtime-seal.v2' -or
        [string] $seal.result -cne 'PASS' -or
        [string] $seal.repository -cne 'uridolan77/origin-probe'
    ) { Stop-Promotion 'The supplemental runtime seal is not the versioned PASS contract.' }
    Assert-ArtifactPin -Pin $seal.baseRuntimeSeal -ExpectedPath $expectedBaseRuntimeSealPath `
        -ExpectedSha256 $expectedBaseRuntimeSealSha256 -Label 'base runtime seal'
    Assert-V2ExactKeys -Value $seal.artifactPins -Expected @(
        'historicalProjectionTool', 'historicalProjectionTest',
        'baselineCaptureV2Tool', 'baselineCaptureV2Test',
        'baselineCaptureProtectedV2Tool', 'baselineCaptureProtectedV2Test',
        'zeroBaselineV2Tool', 'zeroBaselineV2Test',
        'promoteV2Tool', 'promoteV2Test'
    ) -Label 'supplemental artifactPins'
    Assert-V2ExactKeys -Value $seal.inheritedRuntime -Expected @(
        'legacyPromotionHelperSha256', 'promotionGuardSha256',
        'vercelCliVersion', 'vercelTreeManifestSha256'
    ) -Label 'supplemental inheritedRuntime'
    if (
        [string] $seal.inheritedRuntime.legacyPromotionHelperSha256 -cne $expectedLegacyPromotionHelperSha256 -or
        [string] $seal.inheritedRuntime.promotionGuardSha256 -cne $expectedPromotionGuardSha256 -or
        [string] $seal.inheritedRuntime.vercelCliVersion -cne $expectedVercelVersion -or
        [string] $seal.inheritedRuntime.vercelTreeManifestSha256 -cne $expectedVercelTreeManifestSha256
    ) { Stop-Promotion 'The inherited sealed runtime identity changed.' }
    $root = Get-ProductRoot
    $pins = @(
        @($seal.artifactPins.historicalProjectionTool, $historicalToolRelativePath, [IO.Path]::Combine($root, 'measurement', 'scripts', 'window002-historical-projection.mjs')),
        @($seal.artifactPins.historicalProjectionTest, $historicalTestRelativePath, [IO.Path]::Combine($root, 'measurement', 'test', 'window002-historical-projection.test.js')),
        @($seal.artifactPins.baselineCaptureV2Tool, $captureToolRelativePath, [IO.Path]::Combine($root, 'measurement', 'scripts', 'window002-baseline-capture-v2.mjs')),
        @($seal.artifactPins.baselineCaptureV2Test, $captureTestRelativePath, [IO.Path]::Combine($root, 'measurement', 'test', 'window002-baseline-capture-v2.test.js')),
        @($seal.artifactPins.baselineCaptureProtectedV2Tool, $protectedCaptureToolRelativePath, [IO.Path]::Combine($root, 'measurement', 'scripts', 'window002-baseline-capture-protected-v2.ps1')),
        @($seal.artifactPins.baselineCaptureProtectedV2Test, $protectedCaptureTestRelativePath, [IO.Path]::Combine($root, 'measurement', 'test', 'window002-baseline-capture-protected-v2.test.js')),
        @($seal.artifactPins.zeroBaselineV2Tool, $zeroToolRelativePath, [IO.Path]::Combine($root, 'measurement', 'scripts', 'window002-zero-baseline-v2.mjs')),
        @($seal.artifactPins.zeroBaselineV2Test, $zeroTestRelativePath, [IO.Path]::Combine($root, 'measurement', 'test', 'window002-zero-baseline-v2.test.js')),
        @($seal.artifactPins.promoteV2Tool, $promotionToolRelativePath, $PSCommandPath),
        @($seal.artifactPins.promoteV2Test, $promotionTestRelativePath, [IO.Path]::Combine($root, 'measurement', 'test', 'window002-promote-v2.test.js'))
    )
    [Collections.Generic.List[object]] $artifacts = @()
    foreach ($entry in $pins) {
        $artifactPath = Assert-PathUnderRoot -LiteralPath $entry[2] -RootPath $root `
            -Label "The supplemental artifact $($entry[1])"
        $expectedSha = Get-BootstrapSha256 -LiteralPath $artifactPath
        Assert-ArtifactPin -Pin $entry[0] -ExpectedPath $entry[1] `
            -ExpectedSha256 $expectedSha -Label "supplemental artifact $($entry[1])"
        $artifacts.Add([pscustomobject]@{
            RelativePath = [string] $entry[1]
            Path = $artifactPath
            Sha256 = $expectedSha
        })
    }
    $manifest = @($artifacts | ForEach-Object {
        [ordered]@{ path = $_.RelativePath; sha256 = $_.Sha256 }
    })
    return [pscustomobject]@{
        Value = $seal
        Artifacts = @($artifacts)
        ManifestSha256 = Get-CanonicalJsonSha256 $manifest
    }
}

function Resolve-V2EvidenceDirectory {
    param([switch] $RequireProtection)
    $directory = [IO.Path]::GetFullPath($EvidenceDirectoryPath).TrimEnd('\')
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        Stop-Promotion 'The v2 evidence directory is absent.'
    }
    $item = Get-Item -LiteralPath $directory -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-Promotion 'The v2 evidence directory is a reparse point.'
    }
    if ($RequireProtection) {
        $expected = [IO.Path]::Combine($storePath, $expectedEvidenceDirectoryName)
        if ($item.FullName.TrimEnd('\') -cne $expected) {
            Stop-Promotion 'The v2 evidence directory is outside its protected pinned location.'
        }
        Assert-RestrictedAcl -LiteralPath $item.FullName -Label 'The v2 evidence directory' -IsDirectory $true
    }
    return $item.FullName
}

function Get-V2ContractEvidence {
    param(
        [string] $StageReceiptPath,
        [DateTimeOffset] $NowUtc,
        [string] $NodeExecutable,
        [switch] $RequireProtection
    )
    $cutover = ConvertFrom-V2Utc -Value $ExpectedCutoverUtc -Label 'expected cutover' -RequireWholeHour
    $expectedEnd = $cutover.Add($windowDuration)
    $directory = Resolve-V2EvidenceDirectory -RequireProtection:$RequireProtection
    $stage = Get-StageContract -LiteralPath $StageReceiptPath
    $stageCopy = Read-JsonEvidence -LiteralPath ([IO.Path]::Combine($directory, $stagedReceiptFilename)) -Label 'captured stage receipt'
    if ($stageCopy.Sha256 -cne $stage.Sha256) {
        Stop-Promotion 'The captured stage receipt differs from the canonical protected stage receipt.'
    }
    $providerLookup = Read-JsonEvidence -LiteralPath ([IO.Path]::Combine($directory, $providerLookupFilename)) -Label 'provider deployment lookup'
    $captureEvidence = Read-JsonEvidence -LiteralPath ([IO.Path]::Combine($directory, $captureReceiptFilename)) -Label 'capture receipt'
    $zeroEvidence = Read-JsonEvidence -LiteralPath ([IO.Path]::Combine($directory, $zeroBaselineFilename)) -Label 'zero-baseline v2 evidence'
    $rawBodies = @(
        $captureBodyFilenames | ForEach-Object {
            Read-JsonEvidence -LiteralPath ([IO.Path]::Combine($directory, $_)) -Label "capture body $_"
        }
    )
    $sealEvidence = Read-JsonEvidence -LiteralPath $SupplementalRuntimeSealPath -Label 'supplemental runtime seal'
    if ($RequireProtection) {
        $sealItem = Get-Item -LiteralPath $sealEvidence.Path -Force
        if (
            $sealItem.FullName -cne [IO.Path]::Combine($storePath, $supplementalSealFilename) -or
            [IO.Path]::GetDirectoryName($sealItem.FullName) -cne $storePath
        ) { Stop-Promotion 'The supplemental runtime seal is outside its protected pinned location.' }
        Assert-RestrictedAcl -LiteralPath $sealItem.FullName -Label 'The supplemental runtime seal' -IsDirectory $false
        foreach ($protectedEvidence in @(
            $stageCopy, $providerLookup, $captureEvidence, $zeroEvidence
        ) + @($rawBodies)) {
            Assert-RestrictedAcl -LiteralPath $protectedEvidence.Path `
                -Label 'A protected baseline evidence file' -IsDirectory $false
        }
    }
    $seal = Assert-SupplementalSeal -SealEvidence $sealEvidence
    $projectorArtifact = @($seal.Artifacts | Where-Object {
        $_.RelativePath -ceq $historicalToolRelativePath
    })
    if ($projectorArtifact.Count -ne 1) {
        Stop-Promotion 'The pinned historical projector artifact is not unique.'
    }
    $reducerPath = Assert-PathUnderRoot `
        -LiteralPath ([IO.Path]::Combine((Get-ProductRoot), 'measurement', 'lib', 'reducer.js')) `
        -RootPath (Get-ProductRoot) -Label 'The pinned Window 002 reducer'
    if ((Get-BootstrapSha256 -LiteralPath $reducerPath) -cne $expectedWindowReducerSha256) {
        Stop-Promotion 'The pinned Window 002 reducer digest changed.'
    }
    $captureObserved = Assert-CaptureReceipt -Capture $captureEvidence.Value -Stage $stage `
        -CutoverUtc $cutover -ExpectedEndUtc $expectedEnd -RawBodies $rawBodies `
        -ProviderLookup $providerLookup
    $rawFacts = Assert-RawLedgerAndReduction -RawBodies $rawBodies -CutoverUtc $cutover `
        -ExpectedEndUtc $expectedEnd -NodeExecutable $NodeExecutable `
        -ProjectorPath $projectorArtifact[0].Path -ReducerPath $reducerPath
    Assert-ZeroBaselineV2 -ZeroEvidence $zeroEvidence -CaptureEvidence $captureEvidence `
        -Capture $captureEvidence.Value -RawFacts $rawFacts -CutoverUtc $cutover `
        -ExpectedEndUtc $expectedEnd -CaptureObservedAtUtc $captureObserved -NowUtc $NowUtc
    if ($captureObserved -le $stage.CompletedAtUtc) {
        Stop-Promotion 'The cutover baseline was not observed after staging completed.'
    }
    if (
        [string] $captureEvidence.Value.captureTool.sha256 -cne
            [string] $seal.Value.artifactPins.baselineCaptureV2Tool.sha256 -or
        [string] $captureEvidence.Value.operatorProvenance.wrapper.sha256 -cne
            [string] $seal.Value.artifactPins.baselineCaptureProtectedV2Tool.sha256
    ) {
        Stop-Promotion 'The capture receipt tool differs from the supplemental seal.'
    }
    return [pscustomobject]@{
        Directory = $directory
        Stage = $stage
        Capture = $captureEvidence
        Zero = $zeroEvidence
        RawBodies = $rawBodies
        StageCopy = $stageCopy
        ProviderLookup = $providerLookup
        Seal = $sealEvidence
        PinnedArtifacts = $seal.Artifacts
        PinnedArtifactManifestSha256 = $seal.ManifestSha256
        ProjectorPath = $projectorArtifact[0].Path
        ReducerPath = $reducerPath
        ReducerSha256 = $expectedWindowReducerSha256
        ObservedAtUtc = $captureObserved
        CutoverUtc = $cutover
        ExpectedEndUtc = $expectedEnd
    }
}

function Import-SealedLegacyFunctions {
    $legacyItem = Get-Item -LiteralPath $legacyPromotionHelperPath -Force
    if (($legacyItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-Promotion 'The sealed v1 promotion helper is a reparse point.'
    }
    $legacyBytes = [IO.File]::ReadAllBytes($legacyItem.FullName)
    if ((Get-BootstrapBytesSha256 -Bytes $legacyBytes) -cne $expectedLegacyPromotionHelperSha256) {
        Stop-Promotion 'The sealed v1 promotion helper digest changed.'
    }
    try { $legacySource = [Text.UTF8Encoding]::new($false, $true).GetString($legacyBytes) }
    catch { Stop-Promotion 'The sealed v1 promotion helper is not strict UTF-8.' }
    $tokens = $null
    $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseInput(
        $legacySource,
        [ref] $tokens,
        [ref] $errors
    )
    if (@($errors).Count -ne 0) { Stop-Promotion 'The sealed v1 helper no longer parses.' }
    $wanted = @(
        'Stop-Promotion', 'Assert-WindowsHost', 'Assert-PlainFile', 'Assert-PlainDirectory',
        'Get-FileSha256', 'Get-BytesSha256', 'Get-StringSha256',
        'Get-DirectoryManifestEvidence', 'New-RestrictedFileAcl', 'Assert-RestrictedAcl',
        'Assert-SealedRuntimeAcl', 'Assert-Store', 'Assert-ExactObjectKeys',
        'ConvertFrom-CanonicalUtc', 'ConvertTo-MillisecondUtc', 'Assert-ZeroInteger',
        'Assert-PromotionExecutionConfig', 'Assert-PromotionExecutionOutputs',
        'Assert-NormalVercelCredentials', 'Assert-PinnedRuntime',
        'Get-StageReceipt',
        'Assert-DeploymentIdentity', 'Get-AliasNames', 'Assert-ExactAliasSet',
        'Assert-AliasMappings', 'Get-ProviderBaseline', 'Get-ProviderPromotionResult',
        'Get-ScratchEvidence', 'Invoke-SinglePromotionCli'
    )
    $definitions = @($ast.FindAll({
        param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst]
    }, $true))
    foreach ($name in $wanted) {
        $matches = @($definitions | Where-Object { $_.Name -ceq $name })
        if ($matches.Count -ne 1) { Stop-Promotion "The sealed v1 function $name is not unique." }
        $body = $matches[0].Body.Extent.Text
        $bodyText = $body.Substring(1, $body.Length - 2)
        Set-Item -Path "Function:script:$name" -Value ([scriptblock]::Create($bodyText))
    }
    [Array]::Clear($legacyBytes, 0, $legacyBytes.Length)
}

function Read-V2BoundedSecretLines {
    $buffer = [char[]]::new($maxStdinCharacters + 1)
    $text = $null
    try {
        $count = [Console]::In.ReadBlock($buffer, 0, $buffer.Length)
        if ($count -gt $maxStdinCharacters -or [Console]::In.Read() -ne -1) {
            Stop-Promotion 'The stdin secret input exceeds the bounded limit.'
        }
        $text = [string]::new($buffer, 0, $count)
        [string[]] $rawLines = [Text.RegularExpressions.Regex]::Split($text, '\r?\n')
        $retainedCount = $rawLines.Count
        while ($retainedCount -gt 0 -and $rawLines[$retainedCount - 1] -ceq '') {
            $retainedCount--
        }
        if ($retainedCount -ne 2) {
            Stop-Promotion 'Promote requires exactly two stdin secret lines.'
        }
        [string[]] $result = @($rawLines[0], $rawLines[1])
        foreach ($line in $result) {
            if ($line -cnotmatch '^[\x21-\x7e]{16,4096}$') {
                Stop-Promotion 'The stdin secret format is invalid.'
            }
        }
        return $result
    }
    finally {
        if ($null -ne $text) { $text = $null }
        [Array]::Clear($buffer, 0, $buffer.Length)
    }
}

function New-V2RestrictedDirectoryAcl {
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = [Security.Principal.SecurityIdentifier]::new(
        [Security.Principal.WellKnownSidType]::LocalSystemSid, $null
    )
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($currentSid)
    $inheritance = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [Security.AccessControl.InheritanceFlags]::ObjectInherit
    foreach ($sid in @($currentSid, $systemSid)) {
        [void] $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid, [Security.AccessControl.FileSystemRights]::FullControl,
            $inheritance, [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        ))
    }
    return $acl
}

function New-ProtectedDirectoryExclusiveV2 {
    param([Parameter(Mandatory = $true)][string] $LiteralPath)
    if ($null -eq ('OriginWindow002PromotionV2.NativeDirectory' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace OriginWindow002PromotionV2 {
    public static class NativeDirectory {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool CreateDirectory(string path, IntPtr securityAttributes);
    }
}
'@
    }
    if (-not [OriginWindow002PromotionV2.NativeDirectory]::CreateDirectory(
        $LiteralPath, [IntPtr]::Zero
    )) {
        Stop-Promotion 'The protected live-gate directory already exists or could not be created.'
    }
    Set-Acl -LiteralPath $LiteralPath -AclObject (New-V2RestrictedDirectoryAcl)
    Assert-PlainDirectory -LiteralPath $LiteralPath -Label 'The protected live-gate directory'
    Assert-RestrictedAcl -LiteralPath $LiteralPath `
        -Label 'The protected live-gate directory' -IsDirectory $true
}

function Test-V2TextContainsCredential {
    param([string] $Text, [string[]] $Secrets)
    foreach ($secret in $Secrets) {
        if ([string]::IsNullOrEmpty($secret)) { continue }
        foreach ($candidate in @(Get-V2CredentialRepresentations -Secret $secret)) {
            if ($Text.IndexOf($candidate, [StringComparison]::Ordinal) -ge 0) { return $true }
        }
    }
    return $false
}

function Add-V2BinaryCredentialRepresentations {
    param(
        [Collections.Generic.HashSet[string]] $Candidates,
        [byte[]] $Bytes
    )
    try {
        $base64 = [Convert]::ToBase64String($Bytes)
        [void] $Candidates.Add($base64)
        [void] $Candidates.Add($base64.TrimEnd('='))
        $base64Url = $base64.Replace('+', '-').Replace('/', '_')
        [void] $Candidates.Add($base64Url)
        [void] $Candidates.Add($base64Url.TrimEnd('='))
        $hex = ([BitConverter]::ToString($Bytes)).Replace('-', '').ToLowerInvariant()
        [void] $Candidates.Add($hex)
        [void] $Candidates.Add($hex.ToUpperInvariant())
    }
    finally { [Array]::Clear($Bytes, 0, $Bytes.Length) }
}

function Get-V2CredentialRepresentations {
    param([Parameter(Mandatory = $true)][string] $Secret)
    $candidates = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    [void] $candidates.Add($Secret)
    $jsonString = ConvertTo-Json -InputObject $Secret -Compress
    [void] $candidates.Add($jsonString.Substring(1, $jsonString.Length - 2))
    [void] $candidates.Add([Uri]::EscapeDataString($Secret))
    [void] $candidates.Add(([Uri]::EscapeDataString($Secret)).ToLowerInvariant())
    [void] $candidates.Add([Uri]::EscapeUriString($Secret))
    [void] $candidates.Add(([Uri]::EscapeUriString($Secret)).ToLowerInvariant())
    [void] $candidates.Add([Net.WebUtility]::UrlEncode($Secret))
    [void] $candidates.Add(([Net.WebUtility]::UrlEncode($Secret)).ToLowerInvariant())
    [void] $candidates.Add([Net.WebUtility]::HtmlEncode($Secret))
    $decimalEntities = -join @($Secret.ToCharArray() | ForEach-Object { '&#{0};' -f [int] $_ })
    $hexEntitiesLower = -join @($Secret.ToCharArray() | ForEach-Object { '&#x{0:x};' -f [int] $_ })
    $hexEntitiesUpper = -join @($Secret.ToCharArray() | ForEach-Object { '&#X{0:X};' -f [int] $_ })
    [void] $candidates.Add($decimalEntities)
    [void] $candidates.Add($hexEntitiesLower)
    [void] $candidates.Add($hexEntitiesUpper)
    $utf8 = [Text.UTF8Encoding]::new($false, $true).GetBytes($Secret)
    try {
        $percentUpper = -join @($utf8 | ForEach-Object { '%{0:X2}' -f $_ })
        [void] $candidates.Add($percentUpper)
        [void] $candidates.Add($percentUpper.ToLowerInvariant())
    }
    finally { [Array]::Clear($utf8, 0, $utf8.Length) }
    foreach ($encoding in @(
        [Text.UTF8Encoding]::new($false, $true),
        [Text.UnicodeEncoding]::new($false, $false, $true),
        [Text.UnicodeEncoding]::new($true, $false, $true),
        [Text.UTF32Encoding]::new($false, $false, $true),
        [Text.UTF32Encoding]::new($true, $false, $true)
    )) {
        Add-V2BinaryCredentialRepresentations -Candidates $candidates `
            -Bytes $encoding.GetBytes($Secret)
    }
    return @($candidates | Where-Object { -not [string]::IsNullOrEmpty($_) })
}

function ConvertFrom-V2PotentialEncodedText {
    param([string] $Text)
    [Collections.Generic.List[string]] $decoded = @()
    foreach ($candidate in @(
        [Uri]::UnescapeDataString($Text),
        [Net.WebUtility]::UrlDecode($Text),
        [Net.WebUtility]::HtmlDecode($Text)
    )) {
        if (-not [string]::IsNullOrEmpty($candidate) -and $candidate -cne $Text) {
            $decoded.Add($candidate)
        }
    }
    if ($Text.IndexOf('\', [StringComparison]::Ordinal) -ge 0) {
        try {
            $jsonEscaped = ('"' + $Text + '"') | ConvertFrom-Json
            if ($jsonEscaped -is [string] -and $jsonEscaped -cne $Text) {
                $decoded.Add($jsonEscaped)
            }
        } catch { }
    }
    [Collections.Generic.List[byte[]]] $byteCandidates = @()
    $base64Text = $Text.Replace('-', '+').Replace('_', '/')
    if ($base64Text -cmatch '^[A-Za-z0-9+/]*={0,2}$') {
        $padding = (4 - ($base64Text.Length % 4)) % 4
        try { $byteCandidates.Add([Convert]::FromBase64String($base64Text + ('=' * $padding))) }
        catch { }
    }
    if ($Text.Length -gt 0 -and $Text.Length % 2 -eq 0 -and $Text -cmatch '^[0-9A-Fa-f]+$') {
        try {
            $hexBytes = [byte[]]::new($Text.Length / 2)
            for ($index = 0; $index -lt $hexBytes.Length; $index++) {
                $hexBytes[$index] = [Convert]::ToByte($Text.Substring($index * 2, 2), 16)
            }
            $byteCandidates.Add($hexBytes)
        } catch { }
    }
    foreach ($bytes in $byteCandidates) {
        try {
            foreach ($encoding in @(
                [Text.UTF8Encoding]::new($false, $true),
                [Text.UnicodeEncoding]::new($false, $false, $true),
                [Text.UnicodeEncoding]::new($true, $false, $true),
                [Text.UTF32Encoding]::new($false, $false, $true),
                [Text.UTF32Encoding]::new($true, $false, $true)
            )) {
                try {
                    $candidate = $encoding.GetString($bytes)
                    if (-not [string]::IsNullOrEmpty($candidate) -and $candidate -cne $Text) {
                        $decoded.Add($candidate)
                    }
                } catch [Text.DecoderFallbackException] { }
            }
        }
        finally { [Array]::Clear($bytes, 0, $bytes.Length) }
    }
    return @($decoded)
}

function Test-V2RecursivelyDecodedTextContainsCredential {
    param(
        [string] $Text,
        [string[]] $Secrets,
        [int] $Depth = 0,
        [Collections.Generic.HashSet[string]] $Seen
    )
    if ($null -eq $Seen) { $Seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal) }
    if ($Text.Length -gt $maxLiveResponseBytes -or -not $Seen.Add($Text)) { return $false }
    if (Test-V2TextContainsCredential -Text $Text -Secrets $Secrets) { return $true }
    if ($Depth -ge 4) { return $false }
    if ($Text -cmatch '^\s*(?:[\[\{"]|true\s*$|false\s*$|null\s*$|-?\d)') {
        try {
            $nested = $Text | ConvertFrom-Json
            if (Test-V2JsonValueContainsCredential -Value $nested -Secrets $Secrets `
                -Depth ($Depth + 1) -Seen $Seen) { return $true }
        } catch { }
    }
    foreach ($decoded in @(ConvertFrom-V2PotentialEncodedText -Text $Text)) {
        if (Test-V2RecursivelyDecodedTextContainsCredential -Text $decoded -Secrets $Secrets `
            -Depth ($Depth + 1) -Seen $Seen) { return $true }
    }
    return $false
}

function Test-V2JsonValueContainsCredential {
    param(
        [object] $Value,
        [string[]] $Secrets,
        [int] $Depth = 0,
        [Collections.Generic.HashSet[string]] $Seen
    )
    if ($null -eq $Value) { return $false }
    if ($Value -is [string]) {
        return Test-V2RecursivelyDecodedTextContainsCredential -Text $Value -Secrets $Secrets `
            -Depth $Depth -Seen $Seen
    }
    if ($Value -is [Collections.IDictionary]) {
        foreach ($key in $Value.Keys) {
            if ((Test-V2JsonValueContainsCredential -Value ([string] $key) -Secrets $Secrets `
                    -Depth $Depth -Seen $Seen) -or
                (Test-V2JsonValueContainsCredential -Value $Value[$key] -Secrets $Secrets `
                    -Depth $Depth -Seen $Seen)) {
                return $true
            }
        }
        return $false
    }
    if ($Value -is [Management.Automation.PSCustomObject]) {
        foreach ($property in $Value.PSObject.Properties) {
            if ((Test-V2JsonValueContainsCredential -Value $property.Name -Secrets $Secrets `
                    -Depth $Depth -Seen $Seen) -or
                (Test-V2JsonValueContainsCredential -Value $property.Value -Secrets $Secrets `
                    -Depth $Depth -Seen $Seen)) {
                return $true
            }
        }
        return $false
    }
    if ($Value -is [Collections.IEnumerable]) {
        foreach ($item in $Value) {
            if (Test-V2JsonValueContainsCredential -Value $item -Secrets $Secrets `
                -Depth $Depth -Seen $Seen) { return $true }
        }
    }
    return $false
}

function ConvertFrom-V2CredentialSafeJsonBytes {
    param([byte[]] $Bytes, [string[]] $Secrets, [string] $Label)
    $text = $null
    try {
        $text = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
        if (Test-V2RecursivelyDecodedTextContainsCredential -Text $text -Secrets $Secrets) {
            Stop-Promotion "$Label reflected a supplied credential."
        }
        try { $value = $text | ConvertFrom-Json }
        catch { Stop-Promotion "$Label is not valid JSON." }
        if (Test-V2JsonValueContainsCredential -Value $value -Secrets $Secrets) {
            Stop-Promotion "$Label decoded to a supplied credential."
        }
        return $value
    }
    catch [Text.DecoderFallbackException] { Stop-Promotion "$Label is not strict UTF-8." }
    finally { $text = $null }
}

function Invoke-ExactApiGet {
    param(
        [Parameter(Mandatory = $true)]
        [ValidatePattern('^/[A-Za-z0-9_./?=&%-]+$')]
        [string] $PathAndQuery,
        [Parameter(Mandatory = $true)][string] $SafeLabel,
        [Parameter(Mandatory = $true)][string] $Token
    )
    Add-Type -AssemblyName System.Net.Http
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $request = $null
    $response = $null
    $bodyBytes = $null
    $body = $null
    try {
        $client.Timeout = [TimeSpan]::FromSeconds(20)
        $request = [Net.Http.HttpRequestMessage]::new(
            [Net.Http.HttpMethod]::Get, [Uri]::new("https://api.vercel.com$PathAndQuery")
        )
        $request.Headers.Authorization =
            [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
        [void] $request.Headers.UserAgent.ParseAdd('origin-window002-promotion-v2/1')
        $response = $client.SendAsync(
            $request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead
        ).GetAwaiter().GetResult()
        if ([int] $response.StatusCode -ge 300 -and [int] $response.StatusCode -lt 400) {
            Stop-Promotion "$SafeLabel returned a redirect."
        }
        if ([int] $response.StatusCode -ne 200) { Stop-Promotion "$SafeLabel did not return HTTP 200." }
        $contentLength = $response.Content.Headers.ContentLength
        if ($null -ne $contentLength -and [int64] $contentLength -gt $maxLiveResponseBytes) {
            Stop-Promotion "$SafeLabel exceeded the reviewed response limit."
        }
        $ids = [Collections.Generic.IEnumerable[string]] $null
        if ($response.Headers.TryGetValues('x-vercel-id', [ref] $ids)) {
            foreach ($id in @($ids)) {
                if (Test-V2RecursivelyDecodedTextContainsCredential -Text ([string] $id) `
                    -Secrets @($Token, $script:adminKey, $script:protectionBypass)) {
                    Stop-Promotion "$SafeLabel provider identity reflected a supplied credential."
                }
            }
        }
        $bodyBytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
        if ($bodyBytes.Length -gt $maxLiveResponseBytes) {
            Stop-Promotion "$SafeLabel exceeded the reviewed response limit."
        }
        $bodyValue = ConvertFrom-V2CredentialSafeJsonBytes -Bytes $bodyBytes `
            -Secrets @($Token, $script:adminKey, $script:protectionBypass) -Label $SafeLabel
        if ($PathAndQuery -cmatch '^/v9/projects/[^/]+/domains\?') {
            foreach ($domain in @($bodyValue.domains)) {
                Assert-V2JsonBoolean -Value $domain.verified -Expected $true `
                    -Label "$SafeLabel domain verified"
            }
        }
        if ($PathAndQuery -cmatch '^/v13/deployments/') {
            if ($null -ne $bodyValue.PSObject.Properties['aliasAssigned']) {
                if ($bodyValue.aliasAssigned -isnot [bool]) {
                    Stop-Promotion "$SafeLabel aliasAssigned is not an exact JSON Boolean."
                }
            }
            foreach ($name in @('aliasAssignedAt', 'createdAt')) {
                if ($null -ne $bodyValue.PSObject.Properties[$name] -and $null -ne $bodyValue.$name) {
                    [void] (Get-V2JsonInteger -Value $bodyValue.$name -Label "$SafeLabel $name")
                }
            }
        }
        return [pscustomobject]@{
            Value = $bodyValue
            RawSha256 = Get-BytesSha256 -Bytes $bodyBytes
            ByteLength = $bodyBytes.Length
        }
    }
    finally {
        $body = $null
        if ($null -ne $bodyBytes) { [Array]::Clear($bodyBytes, 0, $bodyBytes.Length) }
        if ($null -ne $response) { $response.Dispose() }
        if ($null -ne $request) { $request.Dispose() }
        $client.Dispose()
        $handler.Dispose()
    }
}

function Write-ProtectedBytesExclusiveV2 {
    param(
        [Parameter(Mandatory = $true)][string] $LiteralPath,
        [Parameter(Mandatory = $true)][byte[]] $Bytes,
        [Parameter(Mandatory = $true)][string] $Label
    )
    $parent = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($LiteralPath))
    if ($parent -cne $liveGateDirectoryPath) {
        Stop-Promotion "$Label is outside the fixed live-gate directory."
    }
    $stream = $null
    try {
        $stream = [IO.FileStream]::new(
            $LiteralPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write,
            [IO.FileShare]::None, 4096, [IO.FileOptions]::WriteThrough
        )
        $stream.Write($Bytes, 0, $Bytes.Length)
        $stream.Flush($true)
    }
    finally { if ($null -ne $stream) { $stream.Dispose() } }
    Set-Acl -LiteralPath $LiteralPath -AclObject (New-RestrictedFileAcl)
    Assert-PlainFile -LiteralPath $LiteralPath -Label $Label
    Assert-RestrictedAcl -LiteralPath $LiteralPath -Label $Label -IsDirectory $false
    $reopened = [IO.File]::ReadAllBytes($LiteralPath)
    try {
        $digest = Get-BytesSha256 -Bytes $reopened
        if ($digest -cne (Get-BytesSha256 -Bytes $Bytes)) {
            Stop-Promotion "$Label changed while it was sealed."
        }
        return [pscustomobject]@{
            Path = $LiteralPath
            Sha256 = $digest
            ByteLength = $reopened.Length
        }
    }
    finally { [Array]::Clear($reopened, 0, $reopened.Length) }
}

function Invoke-V2AuthenticatedGet {
    param(
        [Parameter(Mandatory = $true)][string] $Url,
        [Parameter(Mandatory = $true)][string] $ExpectedHost,
        [Parameter(Mandatory = $true)][string] $AdminKey,
        [string] $ProtectionBypass,
        [Parameter(Mandatory = $true)][string] $SafeLabel
    )
    $uri = $null
    if (-not [Uri]::TryCreate($Url, [UriKind]::Absolute, [ref] $uri) -or
        $uri.Scheme -cne 'https' -or -not $uri.IsDefaultPort -or
        $uri.Host -cne $ExpectedHost -or
        $ExpectedHost -cnotmatch '^origin-probe-measure(?:-[a-z0-9]+-uridolan77s-projects)?\.vercel\.app$') {
        Stop-Promotion "$SafeLabel URL is not its exact pinned origin."
    }
    Add-Type -AssemblyName System.Net.Http
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $request = $null
    $response = $null
    $stream = $null
    $memory = $null
    try {
        $client.Timeout = [TimeSpan]::FromSeconds(15)
        $request = [Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Get, $uri)
        [void] $request.Headers.TryAddWithoutValidation('x-admin-key', $AdminKey)
        if (-not [string]::IsNullOrEmpty($ProtectionBypass)) {
            [void] $request.Headers.TryAddWithoutValidation(
                'x-vercel-protection-bypass', $ProtectionBypass
            )
        }
        [void] $request.Headers.UserAgent.ParseAdd('origin-window002-promotion-v2/1')
        $notBefore = [DateTimeOffset]::UtcNow
        $response = $client.SendAsync(
            $request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead
        ).GetAwaiter().GetResult()
        if ([int] $response.StatusCode -ge 300 -and [int] $response.StatusCode -lt 400) {
            Stop-Promotion "$SafeLabel returned a redirect."
        }
        if ([int] $response.StatusCode -ne 200) {
            Stop-Promotion "$SafeLabel did not return HTTP 200."
        }
        $contentLength = $response.Content.Headers.ContentLength
        if ($null -ne $contentLength -and [int64] $contentLength -gt $maxLiveResponseBytes) {
            Stop-Promotion "$SafeLabel exceeded the reviewed response limit."
        }
        $ids = [Collections.Generic.IEnumerable[string]] $null
        if (-not $response.Headers.TryGetValues('x-vercel-id', [ref] $ids)) {
            Stop-Promotion "$SafeLabel omitted provider identity."
        }
        [string[]] $providerIds = @($ids)
        if ($providerIds.Count -ne 1 -or $providerIds[0] -cnotmatch '^[\x21-\x7e]{1,512}$') {
            Stop-Promotion "$SafeLabel provider identity is invalid."
        }
        $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $memory = [IO.MemoryStream]::new()
        $buffer = [byte[]]::new(65536)
        while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            if ($memory.Length + $count -gt $maxLiveResponseBytes) {
                Stop-Promotion "$SafeLabel exceeded the reviewed response limit."
            }
            $memory.Write($buffer, 0, $count)
        }
        $bytes = $memory.ToArray()
        $notAfter = [DateTimeOffset]::UtcNow
        return [pscustomobject]@{
            Bytes = $bytes
            XVercelId = $providerIds[0]
            NotBeforeUtc = $notBefore
            NotAfterUtc = $notAfter
        }
    }
    finally {
        if ($null -ne $buffer) { [Array]::Clear($buffer, 0, $buffer.Length) }
        if ($null -ne $memory) { $memory.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
        if ($null -ne $response) { $response.Dispose() }
        if ($null -ne $request) { $request.Dispose() }
        $client.Dispose()
        $handler.Dispose()
    }
}

function Invoke-V2LiveTwoReadGate {
    param(
        [Parameter(Mandatory = $true)][object] $Contract,
        [Parameter(Mandatory = $true)][string] $StartUtc,
        [Parameter(Mandatory = $true)][string] $EndUtc,
        [Parameter(Mandatory = $true)][string[]] $Filenames,
        [Parameter(Mandatory = $true)][string] $AdminKey,
        [Parameter(Mandatory = $true)][string] $ProviderToken,
        [Parameter(Mandatory = $true)][string] $ProtectionBypass,
        [Parameter(Mandatory = $true)][string] $Phase,
        [switch] $CreateDirectory
    )
    if (@($Filenames).Count -ne 4 -or $Phase -cnotmatch '^(pre_promotion|post_promotion_authoritative)$') {
        Stop-Promotion 'The live two-read gate contract is invalid.'
    }
    if ($CreateDirectory) { New-ProtectedDirectoryExclusiveV2 -LiteralPath $liveGateDirectoryPath }
    else {
        Assert-PlainDirectory -LiteralPath $liveGateDirectoryPath -Label 'The protected live-gate directory'
        Assert-RestrictedAcl -LiteralPath $liveGateDirectoryPath `
            -Label 'The protected live-gate directory' -IsDirectory $true
    }
    $requestOrigin = if ($Phase -ceq 'pre_promotion') {
        $Contract.Stage.CandidateUrl.TrimEnd('/')
    } else {
        "https://$publicProductionAliasHost"
    }
    $expectedHost = ([Uri] $requestOrigin).Host
    $exportUrl = "$requestOrigin/v1/export?scope=all"
    $reductionUrl = "$requestOrigin/v1/reduce?startUtc=$([Uri]::EscapeDataString($StartUtc))&endUtc=$([Uri]::EscapeDataString($EndUtc))"
    $urls = @($exportUrl, $reductionUrl, $exportUrl, $reductionUrl)
    $gateBefore = [DateTimeOffset]::UtcNow
    [Collections.Generic.List[object]] $sealedBodies = @()
    $providerIds = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    for ($index = 0; $index -lt 4; $index++) {
        $getParameters = @{
            Url = $urls[$index]
            ExpectedHost = $expectedHost
            AdminKey = $AdminKey
            SafeLabel = "$Phase request $($index + 1)"
        }
        if ($Phase -ceq 'pre_promotion') {
            $getParameters['ProtectionBypass'] = $ProtectionBypass
        }
        $response = Invoke-V2AuthenticatedGet @getParameters
        try {
            $decodedValue = ConvertFrom-V2CredentialSafeJsonBytes -Bytes $response.Bytes `
                -Secrets @($ProviderToken, $AdminKey, $ProtectionBypass) `
                -Label "$Phase response $($index + 1)"
            if (Test-V2RecursivelyDecodedTextContainsCredential `
                -Text ([string] $response.XVercelId) `
                -Secrets @($ProviderToken, $AdminKey, $ProtectionBypass)) {
                Stop-Promotion 'A live-gate provider identity reflected a supplied credential.'
            }
            if (-not $providerIds.Add([string] $response.XVercelId)) {
                Stop-Promotion 'The live-gate provider request identities are not unique.'
            }
            $path = [IO.Path]::Combine($liveGateDirectoryPath, $Filenames[$index])
            $sealed = Write-ProtectedBytesExclusiveV2 -LiteralPath $path `
                -Bytes $response.Bytes -Label "$Phase raw response $($index + 1)"
            $parsed = Read-JsonEvidence -LiteralPath $path `
                -Label "$Phase raw response $($index + 1)"
            if ((Get-CanonicalJsonSha256 $parsed.Value) -cne
                (Get-CanonicalJsonSha256 $decodedValue)) {
                Stop-Promotion 'A live-gate response changed between validation and sealing.'
            }
            $sealedBodies.Add([pscustomobject]@{
                Path = $parsed.Path
                Sha256 = $parsed.Sha256
                Bytes = $parsed.Bytes
                Value = $parsed.Value
                ByteLength = $sealed.ByteLength
                XVercelId = [string] $response.XVercelId
                NotBeforeUtc = $response.NotBeforeUtc
                NotAfterUtc = $response.NotAfterUtc
                RelativePath = $Filenames[$index]
                Url = $urls[$index]
            })
        }
        finally { [Array]::Clear($response.Bytes, 0, $response.Bytes.Length) }
    }
    $gateAfter = [DateTimeOffset]::UtcNow
    if (($gateAfter - $gateBefore).TotalSeconds -gt $maxImmediateGateSeconds) {
        Stop-Promotion 'The live two-read measurement exceeded its maximum UTC bracket.'
    }
    $facts = Assert-RawLedgerAndReduction -RawBodies @($sealedBodies) `
        -CutoverUtc (ConvertFrom-V2Utc -Value $StartUtc -Label "$Phase startUtc") `
        -ExpectedEndUtc (ConvertFrom-V2Utc -Value $EndUtc -Label "$Phase endUtc") `
        -NodeExecutable $nodePath -ProjectorPath $Contract.ProjectorPath `
        -ReducerPath $Contract.ReducerPath
    $acceptedPins = Assert-V2LiveGateAcceptedPins -Contract $Contract -Facts $facts `
        -Phase $Phase -StartUtc $StartUtc -EndUtc $EndUtc
    $readEvidence = @($sealedBodies | ForEach-Object {
        [ordered]@{
            path = $_.RelativePath
            sha256 = $_.Sha256
            byteLength = $_.ByteLength
            xVercelId = $_.XVercelId
            url = $_.Url
            notBeforeUtc = ConvertTo-MillisecondUtc -Value $_.NotBeforeUtc
            notAfterUtc = ConvertTo-MillisecondUtc -Value $_.NotAfterUtc
        }
    })
    return [pscustomobject]@{
        Phase = $Phase
        NotBeforeUtc = $gateBefore
        NotAfterUtc = $gateAfter
        Bodies = @($sealedBodies)
        Receipt = [ordered]@{
            phase = $Phase
            method = 'GET'
            providerWrites = 0
            requestOrigin = $requestOrigin
            routeAuthority = if ($Phase -ceq 'pre_promotion') {
                'staged_unique_url_under_deployment_protection'
            } else {
                'public_production_alias_after_provider_promotion'
            }
            startUtc = $StartUtc
            endUtc = $EndUtc
            intervalSemantics = '[startUtc,endUtc)'
            notBeforeUtc = ConvertTo-MillisecondUtc -Value $gateBefore
            notAfterUtc = ConvertTo-MillisecondUtc -Value $gateAfter
            maximumBracketSeconds = $maxImmediateGateSeconds
            rawBodies = $readEvidence
            acceptedCaptureReceiptSha256 = $Contract.Capture.Sha256
            acceptedCaptureBindingSha256 = [string] $Contract.Capture.Value.captureBindingSha256
            acceptedZeroBaselineReceiptSha256 = $Contract.Zero.Sha256
            exportRawSha256 = $facts.ExportSha256
            boundedReductionRawSha256 = $facts.ReductionSha256
            canonicalEventProjectionSha256 = $facts.ProjectionSha256
            localReductionCanonicalSha256 = $facts.ReductionCanonicalSha256
            acceptedPins = $acceptedPins
            activeRunEventCount = 0
            ledgerEventCount = 37
            historicalRunCounts = [ordered]@{
                $originalRunId = 16
                $reacceptanceRunId = 21
            }
            adminAuthenticationSource = 'stdin_only'
            deploymentProtectionSource = if ($Phase -ceq 'pre_promotion') {
                'stdin_only'
            } else {
                'not_presented_to_public_production_alias'
            }
            deploymentProtectionPresented = ($Phase -ceq 'pre_promotion')
            adminSecretLogged = $false
            adminSecretPersisted = $false
            deploymentProtectionSecretLogged = $false
            deploymentProtectionSecretPersisted = $false
            deploymentProtectionFingerprintSha256 = if ($Phase -ceq 'pre_promotion') {
                Get-StringSha256 -Value $ProtectionBypass
            } else { $null }
            windowReducerSha256 = $Contract.ReducerSha256
        }
    }
}

function Assert-V2LiveGateAcceptedPins {
    param(
        [Parameter(Mandatory = $true)][object] $Contract,
        [Parameter(Mandatory = $true)][object] $Facts,
        [Parameter(Mandatory = $true)][string] $Phase,
        [Parameter(Mandatory = $true)][string] $StartUtc,
        [Parameter(Mandatory = $true)][string] $EndUtc
    )
    $zero = $Contract.Zero.Value
    $capture = $Contract.Capture.Value
    $acceptedExport = [string] $zero.retainedHistoricalLedger.rawExportSha256
    $exportPins = @(
        $acceptedExport,
        [string] $zero.reads.read1.rawExport.sha256,
        [string] $zero.reads.read1.rawExportSha256,
        [string] $zero.reads.read2.rawExport.sha256,
        [string] $zero.reads.read2.rawExportSha256,
        [string] $capture.requests[0].rawBody.sha256,
        [string] $capture.requests[2].rawBody.sha256
    )
    if (@($exportPins | Where-Object { $_ -cne $Facts.ExportSha256 }).Count -ne 0) {
        Stop-Promotion 'The immediate live export raw bytes differ from the accepted retained history.'
    }
    $acceptedProjection = [string] $zero.retainedHistoricalLedger.canonicalEventProjectionSha256
    $projectionPins = @(
        $acceptedProjection,
        [string] $zero.reads.read1.canonicalEventProjectionSha256,
        [string] $zero.reads.read2.canonicalEventProjectionSha256
    )
    if (@($projectionPins | Where-Object { $_ -cne $Facts.ProjectionSha256 }).Count -ne 0) {
        Stop-Promotion 'The immediate live gate differs from the accepted historical projection.'
    }
    $sameAcceptedWindow = $StartUtc -ceq [string] $zero.window.startUtc -and
        $EndUtc -ceq [string] $zero.window.endUtc
    if ($Phase -ceq 'pre_promotion' -and -not $sameAcceptedWindow) {
        Stop-Promotion 'The pre-promotion live gate does not use the accepted selected window.'
    }
    $acceptedReductionRaw = $null
    $acceptedReductionCanonical = $null
    if ($Phase -ceq 'pre_promotion' -or $sameAcceptedWindow) {
        $acceptedReductionRaw = [string] $zero.reads.read1.boundedReductionRawSha256
        $reductionRawPins = @(
            $acceptedReductionRaw,
            [string] $zero.reads.read1.boundedReduction.sha256,
            [string] $zero.reads.read2.boundedReduction.sha256,
            [string] $zero.reads.read2.boundedReductionRawSha256,
            [string] $capture.requests[1].rawBody.sha256,
            [string] $capture.requests[3].rawBody.sha256
        )
        if (@($reductionRawPins | Where-Object { $_ -cne $Facts.ReductionSha256 }).Count -ne 0) {
            Stop-Promotion 'The selected-window live reduction raw bytes differ from accepted evidence.'
        }
        $acceptedReductionCanonical =
            [string] $zero.reads.read1.locallyRecomputedTargetReductionCanonicalSha256
        $reductionCanonicalPins = @(
            $acceptedReductionCanonical,
            [string] $zero.reads.read1.locallyRecomputedServiceReductionCanonicalSha256,
            [string] $zero.reads.read2.locallyRecomputedTargetReductionCanonicalSha256,
            [string] $zero.reads.read2.locallyRecomputedServiceReductionCanonicalSha256,
            [string] $zero.activeRunBaseline.targetReductionCanonicalSha256
        )
        if (@($reductionCanonicalPins | Where-Object {
            $_ -cne $Facts.ReductionCanonicalSha256
        }).Count -ne 0) {
            Stop-Promotion 'The selected-window live reduction canonical digest differs from accepted evidence.'
        }
    }
    return [ordered]@{
        retainedHistoryExportRawSha256 = $acceptedExport
        retainedHistoryProjectionSha256 = $acceptedProjection
        acceptedWindowByteIdentical = $sameAcceptedWindow
        acceptedReductionPinsApplied = ($Phase -ceq 'pre_promotion' -or $sameAcceptedWindow)
        acceptedReductionRawSha256 = $acceptedReductionRaw
        acceptedReductionCanonicalSha256 = $acceptedReductionCanonical
    }
}

function Get-V2ProtectedJsonEvidence {
    param(
        [Parameter(Mandatory = $true)][string] $LiteralPath,
        [Parameter(Mandatory = $true)][string] $Label,
        [string] $ExpectedSha256
    )
    Assert-PlainFile -LiteralPath $LiteralPath -Label $Label
    Assert-RestrictedAcl -LiteralPath $LiteralPath -Label $Label -IsDirectory $false
    $evidence = Read-JsonEvidence -LiteralPath $LiteralPath -Label $Label
    if (-not [string]::IsNullOrEmpty($ExpectedSha256) -and
        $evidence.Sha256 -cne $ExpectedSha256) {
        Stop-Promotion "$Label was replaced or changed."
    }
    return $evidence
}

function Write-V2ProtectedJsonExclusive {
    param(
        [Parameter(Mandatory = $true)][string] $LiteralPath,
        [Parameter(Mandatory = $true)][object] $Value,
        [Parameter(Mandatory = $true)][string] $Label
    )
    $jsonBytes = [Text.UTF8Encoding]::new($false).GetBytes(
        ($Value | ConvertTo-Json -Depth 24) + [Environment]::NewLine
    )
    $stream = $null
    $reopened = $null
    try {
        $stream = [IO.FileStream]::new(
            $LiteralPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write,
            [IO.FileShare]::None, 4096, [IO.FileOptions]::WriteThrough
        )
        $stream.Write($jsonBytes, 0, $jsonBytes.Length)
        $stream.Flush($true)
        $stream.Dispose()
        $stream = $null
        Set-Acl -LiteralPath $LiteralPath -AclObject (New-RestrictedFileAcl)
        Assert-PlainFile -LiteralPath $LiteralPath -Label $Label
        Assert-RestrictedAcl -LiteralPath $LiteralPath -Label $Label -IsDirectory $false
        $reopened = [IO.File]::ReadAllBytes($LiteralPath)
        if (-not [Collections.StructuralComparisons]::StructuralEqualityComparer.Equals(
            $jsonBytes, $reopened
        )) { Stop-Promotion "$Label did not reopen as the exact bytes written." }
        $expectedSha256 = Get-BytesSha256 -Bytes $jsonBytes
        $evidence = Get-V2ProtectedJsonEvidence -LiteralPath $LiteralPath `
            -Label $Label -ExpectedSha256 $expectedSha256
        if ($evidence.Sha256 -cne $expectedSha256) {
            Stop-Promotion "$Label digest changed after reopening."
        }
        return $evidence
    }
    catch {
        if (Test-Path -LiteralPath $LiteralPath) {
            try { Assert-RestrictedAcl -LiteralPath $LiteralPath -Label $Label -IsDirectory $false }
            catch {}
        }
        throw
    }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
        if ($null -ne $reopened) { [Array]::Clear($reopened, 0, $reopened.Length) }
        [Array]::Clear($jsonBytes, 0, $jsonBytes.Length)
    }
}

function Assert-V2InitialPendingContract {
    param([object] $Evidence, [string] $ExpectedAttemptId, [string] $ExpectedSha256)
    if (
        $ExpectedAttemptId -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' -or
        [string] $Evidence.Value.schemaVersion -cne 'origin.window002.promotion-receipt.v2' -or
        [string] $Evidence.Value.attemptId -cne $ExpectedAttemptId -or
        [string] $Evidence.Value.result -cne 'PENDING' -or
        [string] $Evidence.Value.status -cne 'AUTHORIZED_NOT_STARTED' -or
        [string] $Evidence.Value.providerWriteState -cne 'MUTATION_AUTHORIZED_NOT_LAUNCHED' -or
        (-not [string]::IsNullOrEmpty($ExpectedSha256) -and $Evidence.Sha256 -cne $ExpectedSha256)
    ) { Stop-Promotion 'The immutable initial promotion marker was replaced or tampered with.' }
    return $Evidence
}

function Get-V2InitialPendingEvidence {
    param([string] $ExpectedAttemptId, [string] $ExpectedSha256)
    $evidence = Get-V2ProtectedJsonEvidence -LiteralPath $promotionPendingPath `
        -Label 'The immutable initial promotion marker' -ExpectedSha256 $ExpectedSha256
    return Assert-V2InitialPendingContract -Evidence $evidence `
        -ExpectedAttemptId $ExpectedAttemptId -ExpectedSha256 $ExpectedSha256
}

function New-V2InitialPendingMarkerExclusive {
    param([object] $Value)
    $evidence = Write-V2ProtectedJsonExclusive -LiteralPath $promotionPendingPath `
        -Value $Value -Label 'The immutable initial promotion marker'
    return Assert-V2InitialPendingContract -Evidence $evidence `
        -ExpectedAttemptId ([string] $Value.attemptId) -ExpectedSha256 $evidence.Sha256
}

function Assert-V2JournalRecordContract {
    param(
        [object] $Evidence,
        [string] $ExpectedAttemptId,
        [int] $ExpectedSequence,
        [string] $ExpectedState,
        [object] $PreviousEvidence,
        [string] $ExpectedSha256
    )
    Assert-V2ExactKeys -Value $Evidence.Value -Expected @(
        'attemptId', 'previousRecord', 'recordedAtUtc', 'schemaVersion',
        'sequence', 'snapshot', 'state'
    ) -Label 'promotion journal record'
    Assert-V2ExactKeys -Value $Evidence.Value.previousRecord -Expected @(
        'path', 'sha256'
    ) -Label 'promotion journal previous record'
    [void] (ConvertFrom-V2Utc -Value ([string] $Evidence.Value.recordedAtUtc) `
        -Label 'promotion journal recordedAtUtc')
    $recordSequence = Get-V2JsonInteger -Value $Evidence.Value.sequence `
        -Label 'promotion journal sequence'
    if (
        [string] $Evidence.Value.schemaVersion -cne 'origin.window002.promotion-journal-record.v1' -or
        [string] $Evidence.Value.attemptId -cne $ExpectedAttemptId -or
        $recordSequence -ne $ExpectedSequence -or
        [string] $Evidence.Value.state -cne $ExpectedState -or
        [string] $Evidence.Value.previousRecord.path -cne [IO.Path]::GetFileName($PreviousEvidence.Path) -or
        [string] $Evidence.Value.previousRecord.sha256 -cne $PreviousEvidence.Sha256 -or
        [string] $Evidence.Value.snapshot.attemptId -cne $ExpectedAttemptId -or
        [string] $Evidence.Value.snapshot.result -cne 'PENDING' -or
        [string] $Evidence.Value.snapshot.providerWriteState -cne $ExpectedState -or
        [string] $Evidence.Value.snapshot.status -ceq 'PUBLIC_PROBE_WINDOW_RUNNING' -or
        (-not [string]::IsNullOrEmpty($ExpectedSha256) -and $Evidence.Sha256 -cne $ExpectedSha256)
    ) { Stop-Promotion 'The append-only promotion journal chain is invalid.' }
    return $Evidence
}

function New-V2JournalRecordExclusive {
    param(
        [int] $Sequence,
        [string] $AttemptId,
        [object] $PreviousEvidence,
        [object] $Snapshot
    )
    if ($Sequence -lt 1 -or $Sequence -gt $promotionJournalRecordPaths.Count) {
        Stop-Promotion 'The append-only journal sequence is outside its fixed contract.'
    }
    [void] (Get-V2ProtectedJsonEvidence -LiteralPath $PreviousEvidence.Path `
        -Label 'The previous append-only promotion record' `
        -ExpectedSha256 $PreviousEvidence.Sha256)
    $state = $promotionJournalRecordStates[$Sequence - 1]
    $value = [ordered]@{
        schemaVersion = 'origin.window002.promotion-journal-record.v1'
        attemptId = $AttemptId
        sequence = $Sequence
        state = $state
        recordedAtUtc = ConvertTo-MillisecondUtc -Value ([DateTimeOffset]::UtcNow)
        previousRecord = [ordered]@{
            path = [IO.Path]::GetFileName($PreviousEvidence.Path)
            sha256 = $PreviousEvidence.Sha256
        }
        snapshot = $Snapshot
    }
    $evidence = Write-V2ProtectedJsonExclusive `
        -LiteralPath $promotionJournalRecordPaths[$Sequence - 1] `
        -Value $value -Label "Append-only promotion journal record $Sequence"
    return Assert-V2JournalRecordContract -Evidence $evidence `
        -ExpectedAttemptId $AttemptId -ExpectedSequence $Sequence `
        -ExpectedState $state -PreviousEvidence $PreviousEvidence `
        -ExpectedSha256 $evidence.Sha256
}

function Get-V2JournalChainManifest {
    param([object] $InitialEvidence, [object[]] $Records, [string] $AttemptId)
    [Collections.Generic.List[object]] $chain = @()
    [void] (Assert-V2InitialPendingContract -Evidence $InitialEvidence `
        -ExpectedAttemptId $AttemptId -ExpectedSha256 $InitialEvidence.Sha256)
    $chain.Add([ordered]@{
        sequence = 0
        state = 'MUTATION_AUTHORIZED_NOT_LAUNCHED'
        path = [IO.Path]::GetFileName($InitialEvidence.Path)
        sha256 = $InitialEvidence.Sha256
    })
    $previous = $InitialEvidence
    for ($index = 0; $index -lt @($Records).Count; $index++) {
        $sequence = $index + 1
        $record = Get-V2ProtectedJsonEvidence -LiteralPath $Records[$index].Path `
            -Label "Append-only promotion journal record $sequence" `
            -ExpectedSha256 $Records[$index].Sha256
        [void] (Assert-V2JournalRecordContract -Evidence $record `
            -ExpectedAttemptId $AttemptId -ExpectedSequence $sequence `
            -ExpectedState $promotionJournalRecordStates[$index] `
            -PreviousEvidence $previous -ExpectedSha256 $Records[$index].Sha256)
        $chain.Add([ordered]@{
            sequence = $sequence
            state = $promotionJournalRecordStates[$index]
            path = [IO.Path]::GetFileName($record.Path)
            sha256 = $record.Sha256
        })
        $previous = $record
    }
    return @($chain)
}

function Assert-V2ContractJournalManifest {
    param([object] $Manifest)
    Assert-V2ExactKeys -Value $Manifest -Expected @(
        'attemptId', 'initial', 'occupiedNextPath', 'records', 'schemaVersion'
    ) -Label 'contract journal manifest'
    if ([string] $Manifest.schemaVersion -cne 'origin.window002.promotion-journal-contract.v1') {
        Stop-Promotion 'The contract journal manifest schema is invalid.'
    }
    $attemptId = [string] $Manifest.attemptId
    Assert-V2ExactKeys -Value $Manifest.initial -Expected @('path', 'sha256') `
        -Label 'contract journal initial pin'
    $initial = Read-JsonEvidence -LiteralPath ([string] $Manifest.initial.path) `
        -Label 'The contract initial promotion marker'
    if ($initial.Sha256 -cne [string] $Manifest.initial.sha256) {
        Stop-Promotion 'The contract initial promotion marker reopened with different bytes.'
    }
    [void] (Assert-V2InitialPendingContract -Evidence $initial `
        -ExpectedAttemptId $attemptId -ExpectedSha256 ([string] $Manifest.initial.sha256))
    $previous = $initial
    $records = @($Manifest.records)
    if ($records.Count -gt $promotionJournalRecordStates.Count) {
        Stop-Promotion 'The contract journal has an unexpected extra record.'
    }
    for ($index = 0; $index -lt $records.Count; $index++) {
        $entry = $records[$index]
        Assert-V2ExactKeys -Value $entry -Expected @('path', 'sha256', 'state') `
            -Label 'contract journal record pin'
        if ([string] $entry.state -cne $promotionJournalRecordStates[$index]) {
            Stop-Promotion 'The contract journal sequence state is not fixed.'
        }
        $record = Read-JsonEvidence -LiteralPath ([string] $entry.path) `
            -Label 'A contract append-only journal record'
        if ($record.Sha256 -cne [string] $entry.sha256) {
            Stop-Promotion 'A contract journal record reopened with different bytes.'
        }
        [void] (Assert-V2JournalRecordContract -Evidence $record `
            -ExpectedAttemptId $attemptId -ExpectedSequence ($index + 1) `
            -ExpectedState $promotionJournalRecordStates[$index] -PreviousEvidence $previous `
            -ExpectedSha256 ([string] $entry.sha256))
        $previous = $record
    }
    if (-not [string]::IsNullOrWhiteSpace([string] $Manifest.occupiedNextPath) -and
        (Test-Path -LiteralPath ([string] $Manifest.occupiedNextPath))) {
        Stop-Promotion 'The next append-only journal sequence is already occupied.'
    }
    return $records.Count + 1
}

function New-V2ProviderReconciliationEvidence {
    param(
        [object] $Provider,
        [object] $Stage,
        [string] $Phase,
        [DateTimeOffset] $NotBeforeUtc,
        [DateTimeOffset] $NotAfterUtc
    )
    if (($NotAfterUtc - $NotBeforeUtc).TotalSeconds -gt $maxImmediateGateSeconds -or
        $NotAfterUtc -lt $NotBeforeUtc) {
        Stop-Promotion 'The read-only provider reconciliation UTC bracket is invalid.'
    }
    $aliasAssignedAtEpochMs = Get-V2JsonInteger -Value $Provider.AliasAssignedAtEpochMs `
        -Label 'provider result AliasAssignedAtEpochMs'
    return [ordered]@{
        schemaVersion = 'origin.window002.provider-reconciliation.v2'
        phase = $Phase
        providerWrites = 0
        projectId = $projectId
        orgId = $orgId
        candidateDeploymentId = $Stage.CandidateId
        candidateUniqueHost = $Stage.CandidateHost
        candidateReadySubstate = 'PROMOTED'
        aliasAssignedAtEpochMs = $aliasAssignedAtEpochMs
        startUtc = ConvertTo-MillisecondUtc -Value $Provider.StartUtc
        endUtc = ConvertTo-MillisecondUtc -Value $Provider.EndUtc
        aliasMappings = [ordered]@{
            publicAliasHost = $publicProductionAliasHost
            publicAliasDeploymentId = $Stage.CandidateId
            automaticAliasHost = $automaticProtectedAliasHost
            automaticAliasDeploymentId = $Stage.CandidateId
        }
        projectRawSha256 = [string] $Provider.ProjectRawSha256
        domainRawSha256 = [string] $Provider.DomainRawSha256
        candidateRawSha256 = [string] $Provider.CandidateRawSha256
        candidateAliasesRawSha256 = [string] $Provider.CandidateAliasesRawSha256
        supersededRawSha256 = [string] $Provider.AcceptedRawSha256
        supersededAliasesRawSha256 = [string] $Provider.AcceptedAliasesRawSha256
        publicAliasRawSha256 = [string] $Provider.AliasRawSha256[$publicProductionAliasHost]
        automaticAliasRawSha256 = [string] $Provider.AliasRawSha256[$automaticProtectedAliasHost]
        notBeforeUtc = ConvertTo-MillisecondUtc -Value $NotBeforeUtc
        notAfterUtc = ConvertTo-MillisecondUtc -Value $NotAfterUtc
    }
}

function Assert-V2ProviderReconciliationShape {
    param([object] $Value, [string] $ExpectedPhase)
    Assert-V2ExactKeys -Value $Value -Expected @(
        'aliasAssignedAtEpochMs', 'aliasMappings', 'automaticAliasRawSha256',
        'candidateAliasesRawSha256', 'candidateDeploymentId', 'candidateRawSha256',
        'candidateReadySubstate', 'candidateUniqueHost', 'domainRawSha256', 'endUtc',
        'notAfterUtc', 'notBeforeUtc', 'orgId', 'phase', 'projectId', 'projectRawSha256',
        'providerWrites', 'publicAliasRawSha256', 'schemaVersion', 'startUtc',
        'supersededAliasesRawSha256', 'supersededRawSha256'
    ) -Label 'provider reconciliation evidence'
    Assert-V2ExactKeys -Value $Value.aliasMappings -Expected @(
        'automaticAliasDeploymentId', 'automaticAliasHost',
        'publicAliasDeploymentId', 'publicAliasHost'
    ) -Label 'provider alias mappings'
    $notBefore = ConvertFrom-V2Utc -Value ([string] $Value.notBeforeUtc) `
        -Label 'provider reconciliation notBeforeUtc'
    $notAfter = ConvertFrom-V2Utc -Value ([string] $Value.notAfterUtc) `
        -Label 'provider reconciliation notAfterUtc'
    $start = ConvertFrom-V2Utc -Value ([string] $Value.startUtc) `
        -Label 'provider reconciliation startUtc'
    $end = ConvertFrom-V2Utc -Value ([string] $Value.endUtc) `
        -Label 'provider reconciliation endUtc'
    $digests = @(
        $Value.projectRawSha256, $Value.domainRawSha256, $Value.candidateRawSha256,
        $Value.candidateAliasesRawSha256, $Value.supersededRawSha256,
        $Value.supersededAliasesRawSha256, $Value.publicAliasRawSha256,
        $Value.automaticAliasRawSha256
    )
    $providerWrites = Get-V2JsonInteger -Value $Value.providerWrites `
        -Label 'provider reconciliation providerWrites'
    $aliasAssignedAtEpochMs = Get-V2JsonInteger -Value $Value.aliasAssignedAtEpochMs `
        -Label 'provider reconciliation aliasAssignedAtEpochMs'
    if (
        [string] $Value.schemaVersion -cne 'origin.window002.provider-reconciliation.v2' -or
        [string] $Value.phase -cne $ExpectedPhase -or $providerWrites -ne 0 -or
        [string] $Value.projectId -cne $projectId -or [string] $Value.orgId -cne $orgId -or
        [string] $Value.candidateReadySubstate -cne 'PROMOTED' -or
        [string] $Value.aliasMappings.publicAliasHost -cne $publicProductionAliasHost -or
        [string] $Value.aliasMappings.automaticAliasHost -cne $automaticProtectedAliasHost -or
        [string] $Value.aliasMappings.publicAliasDeploymentId -cne [string] $Value.candidateDeploymentId -or
        [string] $Value.aliasMappings.automaticAliasDeploymentId -cne [string] $Value.candidateDeploymentId -or
        $notAfter -lt $notBefore -or ($notAfter - $notBefore).TotalSeconds -gt $maxImmediateGateSeconds -or
        $end -ne $start.AddDays(14) -or
        [DateTimeOffset]::FromUnixTimeMilliseconds($aliasAssignedAtEpochMs) -ne $start -or
        @($digests | Where-Object { [string] $_ -cnotmatch '^[0-9a-f]{64}$' }).Count -ne 0
    ) { Stop-Promotion 'The provider reconciliation evidence is not exact.' }
    return $Value
}

function Assert-V2ProviderReconciliationContinuity {
    param(
        [object] $First,
        [object] $Final,
        [string] $PostGateNotAfterUtc,
        [string] $ExpectedCandidateDeploymentId,
        [string] $ExpectedCandidateUniqueHost
    )
    [void] (Assert-V2ProviderReconciliationShape -Value $First -ExpectedPhase 'post_promotion_initial')
    [void] (Assert-V2ProviderReconciliationShape -Value $Final -ExpectedPhase 'pre_pass_final')
    $postGateAfter = ConvertFrom-V2Utc -Value $PostGateNotAfterUtc `
        -Label 'post-promotion public-alias gate notAfterUtc'
    $finalBefore = ConvertFrom-V2Utc -Value ([string] $Final.notBeforeUtc) `
        -Label 'final provider reconciliation notBeforeUtc'
    $firstAliasAssignedAt = Get-V2JsonInteger -Value $First.aliasAssignedAtEpochMs `
        -Label 'first provider reconciliation aliasAssignedAtEpochMs'
    $finalAliasAssignedAt = Get-V2JsonInteger -Value $Final.aliasAssignedAtEpochMs `
        -Label 'final provider reconciliation aliasAssignedAtEpochMs'
    if (
        $ExpectedCandidateDeploymentId -cnotmatch '^dpl_[A-Za-z0-9]+$' -or
        $ExpectedCandidateUniqueHost -cnotmatch
            '^origin-probe-measure-[a-z0-9]+-uridolan77s-projects\.vercel\.app$' -or
        [string] $First.candidateDeploymentId -cne $ExpectedCandidateDeploymentId -or
        [string] $Final.candidateDeploymentId -cne $ExpectedCandidateDeploymentId -or
        [string] $First.candidateUniqueHost -cne $ExpectedCandidateUniqueHost -or
        [string] $Final.candidateUniqueHost -cne $ExpectedCandidateUniqueHost -or
        [string] $First.candidateDeploymentId -cne [string] $Final.candidateDeploymentId -or
        [string] $First.candidateUniqueHost -cne [string] $Final.candidateUniqueHost -or
        $firstAliasAssignedAt -ne $finalAliasAssignedAt -or
        [string] $First.startUtc -cne [string] $Final.startUtc -or
        [string] $First.endUtc -cne [string] $Final.endUtc -or
        [string] $First.aliasMappings.publicAliasDeploymentId -cne
            [string] $Final.aliasMappings.publicAliasDeploymentId -or
        [string] $First.aliasMappings.automaticAliasDeploymentId -cne
            [string] $Final.aliasMappings.automaticAliasDeploymentId -or
        $finalBefore -lt $postGateAfter
    ) { Stop-Promotion 'Provider aliases or authoritative window changed before PASS finalization.' }
    return $Final
}

function Assert-NoPriorPromotionAttemptV2 {
    foreach ($path in @(
        $promotionPendingPath, $promotionPassPath,
        $legacyPromotionPendingPath, $legacyPromotionPassPath
    ) + $promotionJournalRecordPaths) {
        if (Test-Path -LiteralPath $path) {
            Assert-PlainFile -LiteralPath $path -Label 'A prior Window 002 promotion marker'
            Stop-Promotion 'A prior promotion marker exists; reconcile state and never retry.'
        }
    }
    if (Test-Path -LiteralPath $liveGateDirectoryPath) {
        Assert-PlainDirectory -LiteralPath $liveGateDirectoryPath `
            -Label 'A prior Window 002 live measurement directory'
        Stop-Promotion 'A prior promotion evidence directory exists; reconcile state and never retry.'
    }
}

function Open-V2ExecutionReadLocks {
    param([object] $Contract)
    [Collections.Generic.List[IO.FileStream]] $locks = @()
    try {
        [string[]] $paths = @(
            $PSCommandPath, $legacyPromotionHelperPath, $stageHelperPath, $nodePath,
            $promotionGuard, $promotionExecutionConfigJson, $vercelAuthJson,
            $vercelConfigJson, $stagePassPath, $Contract.Capture.Path,
            $Contract.Zero.Path, $Contract.Seal.Path,
            $Contract.StageCopy.Path, $Contract.ProviderLookup.Path,
            $Contract.ReducerPath
        ) + @($Contract.RawBodies | ForEach-Object { $_.Path }) + @(
            $Contract.PinnedArtifacts | ForEach-Object { $_.Path }
        ) + @(
            Get-ChildItem -LiteralPath $vercelRoot -Recurse -Force -File |
                ForEach-Object { $_.FullName }
        )
        $paths = @($paths | Sort-Object -Unique)
        foreach ($path in $paths) {
            Assert-PlainFile -LiteralPath $path -Label 'A promotion v2 execution input'
            $locks.Add([IO.FileStream]::new(
                $path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
            ))
        }
        return $locks
    }
    catch {
        foreach ($lock in $locks) { $lock.Dispose() }
        throw
    }
}

if ($Mode -ceq 'ContractTest') {
    try {
        if ([string]::IsNullOrWhiteSpace($ContractStageReceiptPath)) {
            Stop-Promotion 'ContractTest requires ContractStageReceiptPath.'
        }
        if (
            [string]::IsNullOrWhiteSpace($ContractNodePath) -or
            -not (Test-Path -LiteralPath $ContractNodePath -PathType Leaf)
        ) { Stop-Promotion 'ContractTest requires a local Node executable.' }
        if (-not [string]::IsNullOrWhiteSpace($ContractPinnedNodeProbeMode)) {
            Invoke-ContractPinnedNodeProcessProbe -NodeExecutable $ContractNodePath `
                -ProbeMode $ContractPinnedNodeProbeMode
        }
        $now = if ([string]::IsNullOrWhiteSpace($ContractNowUtc)) {
            [DateTimeOffset]::UtcNow
        } else {
            ConvertFrom-V2Utc -Value $ContractNowUtc -Label 'contract nowUtc'
        }
        $contract = Get-V2ContractEvidence -StageReceiptPath $ContractStageReceiptPath `
            -NowUtc $now -NodeExecutable $ContractNodePath
        $journalChainChecks = 0
        if (-not [string]::IsNullOrWhiteSpace($ContractJournalManifestPath)) {
            $journalManifest = Read-JsonEvidence -LiteralPath $ContractJournalManifestPath `
                -Label 'The contract append-only journal manifest'
            $journalChainChecks = Assert-V2ContractJournalManifest `
                -Manifest $journalManifest.Value
        }
        $providerContinuityChecks = 0
        if (-not [string]::IsNullOrWhiteSpace($ContractProviderReconciliationPath)) {
            $providerProbe = Read-JsonEvidence -LiteralPath $ContractProviderReconciliationPath `
                -Label 'The contract provider reconciliation probe'
            Assert-V2ExactKeys -Value $providerProbe.Value -Expected @(
                'expectedCandidateDeploymentId', 'expectedCandidateUniqueHost',
                'final', 'first', 'postGateNotAfterUtc', 'schemaVersion'
            ) -Label 'contract provider reconciliation probe'
            if ([string] $providerProbe.Value.schemaVersion -cne
                'origin.window002.provider-reconciliation-contract.v1') {
                Stop-Promotion 'The contract provider reconciliation probe schema is invalid.'
            }
            [void] (Assert-V2ProviderReconciliationContinuity `
                -First $providerProbe.Value.first -Final $providerProbe.Value.final `
                -PostGateNotAfterUtc ([string] $providerProbe.Value.postGateNotAfterUtc) `
                -ExpectedCandidateDeploymentId ([string] $providerProbe.Value.expectedCandidateDeploymentId) `
                -ExpectedCandidateUniqueHost ([string] $providerProbe.Value.expectedCandidateUniqueHost))
            $providerContinuityChecks = 1
        }
        $liveGateContractChecks = 0
        if (-not [string]::IsNullOrWhiteSpace($ContractLiveGateProbePath)) {
            $liveGateProbe = Read-JsonEvidence -LiteralPath $ContractLiveGateProbePath `
                -Label 'The contract live-gate probe'
            Assert-V2ExactKeys -Value $liveGateProbe.Value -Expected @(
                'endUtc', 'phase', 'rawBodyPaths', 'schemaVersion', 'startUtc'
            ) -Label 'contract live-gate probe'
            if ([string] $liveGateProbe.Value.schemaVersion -cne
                'origin.window002.live-gate-contract.v1' -or
                [string] $liveGateProbe.Value.phase -cnotmatch
                    '^(pre_promotion|post_promotion_authoritative)$' -or
                @($liveGateProbe.Value.rawBodyPaths).Count -ne 4) {
                Stop-Promotion 'The contract live-gate probe is invalid.'
            }
            [Collections.Generic.List[object]] $probeBodies = @()
            foreach ($path in @($liveGateProbe.Value.rawBodyPaths)) {
                $probeBodies.Add((Read-JsonEvidence -LiteralPath ([string] $path) `
                    -Label 'A contract live-gate raw body'))
            }
            $probeFacts = Assert-RawLedgerAndReduction -RawBodies @($probeBodies) `
                -CutoverUtc (ConvertFrom-V2Utc -Value ([string] $liveGateProbe.Value.startUtc) `
                    -Label 'contract live-gate startUtc') `
                -ExpectedEndUtc (ConvertFrom-V2Utc -Value ([string] $liveGateProbe.Value.endUtc) `
                    -Label 'contract live-window endUtc') `
                -NodeExecutable $ContractNodePath -ProjectorPath $contract.ProjectorPath `
                -ReducerPath $contract.ReducerPath
            [void] (Assert-V2LiveGateAcceptedPins -Contract $contract -Facts $probeFacts `
                -Phase ([string] $liveGateProbe.Value.phase) `
                -StartUtc ([string] $liveGateProbe.Value.startUtc) `
                -EndUtc ([string] $liveGateProbe.Value.endUtc))
            $liveGateContractChecks = 1
        }
        $credentialReflectionChecks = 0
        if (-not [string]::IsNullOrWhiteSpace($ContractCredentialProbePath)) {
            $credentialProbe = Read-JsonEvidence -LiteralPath $ContractCredentialProbePath `
                -Label 'The contract credential-reflection probe'
            Assert-V2ExactKeys -Value $credentialProbe.Value -Expected @(
                'adminKey', 'cliStderr', 'cliStdout', 'protectionBypass',
                'providerIdentity', 'providerResponseBase64', 'providerToken',
                'schemaVersion', 'serviceResponseBase64'
            ) -Label 'contract credential-reflection probe'
            if ([string] $credentialProbe.Value.schemaVersion -cne
                'origin.window002.credential-reflection-contract.v1') {
                Stop-Promotion 'The contract credential-reflection probe schema is invalid.'
            }
            $probeSecrets = @(
                [string] $credentialProbe.Value.providerToken,
                [string] $credentialProbe.Value.adminKey,
                [string] $credentialProbe.Value.protectionBypass
            )
            if (@($probeSecrets | Where-Object { $_ -cnotmatch '^[\x21-\x7e]{16,4096}$' }).Count -ne 0 -or
                @($probeSecrets | Select-Object -Unique).Count -ne 3) {
                Stop-Promotion 'The contract credential-reflection secrets are invalid.'
            }
            try {
                foreach ($encodedBody in @(
                    @($credentialProbe.Value.serviceResponseBase64, 'service'),
                    @($credentialProbe.Value.providerResponseBase64, 'provider')
                )) {
                    try { $probeBytes = [Convert]::FromBase64String([string] $encodedBody[0]) }
                    catch { Stop-Promotion "The contract $($encodedBody[1]) response is not base64." }
                    try {
                        [void] (ConvertFrom-V2CredentialSafeJsonBytes -Bytes $probeBytes `
                            -Secrets $probeSecrets -Label "The contract $($encodedBody[1]) response")
                    }
                    finally {
                        if ($null -ne $probeBytes) {
                            [Array]::Clear($probeBytes, 0, $probeBytes.Length)
                            $probeBytes = $null
                        }
                    }
                }
                foreach ($textProbe in @(
                    [string] $credentialProbe.Value.providerIdentity,
                    [string] $credentialProbe.Value.cliStdout,
                    [string] $credentialProbe.Value.cliStderr
                )) {
                    if (Test-V2RecursivelyDecodedTextContainsCredential `
                        -Text $textProbe -Secrets $probeSecrets) {
                        Stop-Promotion 'The contract metadata reflected a supplied credential.'
                    }
                }
                $credentialReflectionChecks = 1
            }
            finally {
                if ($null -ne $probeBytes) { [Array]::Clear($probeBytes, 0, $probeBytes.Length) }
                [Array]::Clear($probeSecrets, 0, $probeSecrets.Length)
            }
        }
        $pathInputs = @(@($ContractPathProbePath, $ContractPathProbeRoot) |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if ($pathInputs.Count -ne 0 -and $pathInputs.Count -ne 2) {
            Stop-Promotion 'ContractTest path-probe inputs are incomplete.'
        }
        $pathProbeChecks = 0
        if ($pathInputs.Count -eq 2) {
            [void] (Assert-PathUnderRoot -LiteralPath $ContractPathProbePath `
                -RootPath $ContractPathProbeRoot -Label 'The contract artifact path probe')
            $pathProbeChecks = 1
        }
        [Console]::Out.WriteLine(([ordered]@{
            schemaVersion = 'origin.window002.promotion-contract-test.v2'
            result = 'PASS'
            providerWrites = 0
            filesystemWrites = 0
            journalWrites = 0
            runId = $runId
            stageReceiptSha256 = $contract.Stage.Sha256
            captureReceiptSha256 = $contract.Capture.Sha256
            zeroBaselineV2ReceiptSha256 = $contract.Zero.Sha256
            supplementalRuntimeSealSha256 = $contract.Seal.Sha256
            initialActiveRunEventCount = 0
            initialLedgerEventCount = 37
            immediateGateContract = 'synthetic_two_read_export_reduction_recomputed'
            canonicalEventProjectionSha256 = $contract.Zero.Value.retainedHistoricalLedger.canonicalEventProjectionSha256
            pinnedArtifactManifestSha256 = $contract.PinnedArtifactManifestSha256
            windowReducerSha256 = $contract.ReducerSha256
            journalChainChecks = $journalChainChecks
            providerContinuityChecks = $providerContinuityChecks
            liveGateContractChecks = $liveGateContractChecks
            credentialReflectionChecks = $credentialReflectionChecks
            pathProbeChecks = $pathProbeChecks
        } | ConvertTo-Json -Compress))
        return
    }
    catch {
        $message = $_.Exception.Message
        if ($message.StartsWith($safeErrorPrefix, [StringComparison]::Ordinal)) {
            $message = $message.Substring($safeErrorPrefix.Length)
        } else { $message = 'The promotion v2 contract fixture failed closed.' }
        [Console]::Error.WriteLine('ERROR: {0}', $message)
        exit 1
    }
}

Assert-ProtectedRuntimeCopiesBootstrap
Import-SealedLegacyFunctions
$promotionMutex = $null
$mutexAcquired = $false
$executionLocks = $null
$liveGateLocks = $null
$journalLocks = $null
$journalRecords = $null
$providerToken = $null
$adminKey = $null
$protectionBypass = $null
try {
    Assert-WindowsHost
    Assert-RestrictedAcl -LiteralPath $protectedRuntimeRoot `
        -Label 'The protected promotion runtime directory' -IsDirectory $true
    foreach ($protectedRuntimeFile in @($stageHelperPath, $legacyPromotionHelperPath)) {
        Assert-PlainFile -LiteralPath $protectedRuntimeFile -Label 'A protected promotion runtime helper'
        Assert-RestrictedAcl -LiteralPath $protectedRuntimeFile `
            -Label 'A protected promotion runtime helper' -IsDirectory $false
    }
    $createdNewMutex = $false
    $promotionMutex = [Threading.Mutex]::new($false, $mutexName, [ref] $createdNewMutex)
    try { $mutexAcquired = $promotionMutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $mutexAcquired = $true }
    if (-not $mutexAcquired) { Stop-Promotion 'Another Window 002 promotion process is active.' }

    Assert-Store
    Assert-NoPriorPromotionAttemptV2
    $nowBeforeValidation = [DateTimeOffset]::UtcNow
    $wrapperBeforeSha256 = Get-FileSha256 -LiteralPath $PSCommandPath
    $contractBefore = Get-V2ContractEvidence -StageReceiptPath $stagePassPath `
        -NowUtc $nowBeforeValidation -NodeExecutable $nodePath -RequireProtection
    $legacyStageBefore = Get-StageReceipt
    if ($legacyStageBefore.Sha256 -cne $contractBefore.Stage.Sha256) {
        Stop-Promotion 'The original and versioned stage validators disagree.'
    }
    $runtimeBefore = Assert-PinnedRuntime
    $normalAuthBeforeSha256 = Get-FileSha256 -LiteralPath $vercelAuthJson

    $executionLocks = Open-V2ExecutionReadLocks -Contract $contractBefore
    $runtimeLocked = Assert-PinnedRuntime
    $contractLocked = Get-V2ContractEvidence -StageReceiptPath $stagePassPath `
        -NowUtc ([DateTimeOffset]::UtcNow) -NodeExecutable $nodePath -RequireProtection
    if (
        $runtimeLocked.FileCount -ne $runtimeBefore.FileCount -or
        $runtimeLocked.ManifestSha256 -cne $runtimeBefore.ManifestSha256 -or
        $contractLocked.Stage.Sha256 -cne $contractBefore.Stage.Sha256 -or
        $contractLocked.Capture.Sha256 -cne $contractBefore.Capture.Sha256 -or
        $contractLocked.Zero.Sha256 -cne $contractBefore.Zero.Sha256 -or
        $contractLocked.Seal.Sha256 -cne $contractBefore.Seal.Sha256 -or
        $contractLocked.PinnedArtifactManifestSha256 -cne
            $contractBefore.PinnedArtifactManifestSha256 -or
        (Get-FileSha256 -LiteralPath $contractLocked.ReducerPath) -cne
            $contractLocked.ReducerSha256 -or
        (Get-FileSha256 -LiteralPath $PSCommandPath) -cne $wrapperBeforeSha256
    ) { Stop-Promotion 'A promotion v2 input changed while read locks were acquired.' }
    $credentials = Assert-NormalVercelCredentials
    $providerToken = $credentials.Token
    if ((Get-FileSha256 -LiteralPath $vercelAuthJson) -cne $normalAuthBeforeSha256) {
        Stop-Promotion 'The normal Vercel authentication file changed before provider preflight.'
    }
    $scratchBefore = Get-ScratchEvidence -RequireEmpty
    $providerBefore = Get-ProviderBaseline -Token $providerToken -Stage $legacyStageBefore

    if ($Mode -ceq 'Preflight') {
        $nowUtc = [DateTimeOffset]::UtcNow
        if ($contractLocked.CutoverUtc -lt $nowUtc.AddMinutes(-5)) {
            Stop-Promotion 'The selected whole-hour cutover is outside its launch window.'
        }
        Assert-PromotionExecutionOutputs
        $normalAuthAfterSha256 = Get-FileSha256 -LiteralPath $vercelAuthJson
        if ($normalAuthAfterSha256 -cne $normalAuthBeforeSha256) {
            Stop-Promotion 'The normal Vercel authentication file changed during preflight.'
        }
        [Console]::Out.WriteLine(([ordered]@{
            schemaVersion = 'origin.window002.promotion-preflight.v2'
            recordedAtUtc = ConvertTo-MillisecondUtc -Value $nowUtc
            result = 'PASS'
            providerWrites = 0
            runId = $runId
            projectId = $projectId
            expectedCutoverUtc = $ExpectedCutoverUtc
            expectedEndUtc = ConvertTo-MillisecondUtc -Value $contractLocked.ExpectedEndUtc
            candidateDeploymentId = $legacyStageBefore.CandidateId
            candidateUniqueUrl = $legacyStageBefore.CandidateUrl
            stageReceiptSha256 = $contractLocked.Stage.Sha256
            captureReceiptSha256 = $contractLocked.Capture.Sha256
            zeroBaselineV2ReceiptSha256 = $contractLocked.Zero.Sha256
            supplementalRuntimeSealSha256 = $contractLocked.Seal.Sha256
            initialActiveRunEventCount = 0
            initialLedgerEventCount = 37
            providerBaseline = $providerBefore
            vercelCliVersion = $expectedVercelVersion
            vercelTreeManifestSha256 = $runtimeLocked.ManifestSha256
            promotionGuardSha256 = $expectedPromotionGuardSha256
            pinnedArtifactManifestSha256 = $contractLocked.PinnedArtifactManifestSha256
            windowReducerSha256 = $contractLocked.ReducerSha256
            normalAuthSha256Before = $normalAuthBeforeSha256
            normalAuthSha256After = $normalAuthAfterSha256
        } | ConvertTo-Json -Depth 10 -Compress))
        return
    }

    $launchGateUtc = [DateTimeOffset]::UtcNow
    if ($launchGateUtc -lt $contractLocked.CutoverUtc -or
        $launchGateUtc -ge $contractLocked.CutoverUtc.AddMinutes(5)) {
        Stop-Promotion 'Promote may launch only in [cutover,cutover+5m).'
    }
    [void] (Assert-PinnedRuntime)
    [void] (Get-ScratchEvidence -RequireEmpty)
    $contractValidationUtc = [DateTimeOffset]::UtcNow
    $contractAtLaunch = Get-V2ContractEvidence -StageReceiptPath $stagePassPath `
        -NowUtc $contractValidationUtc -NodeExecutable $nodePath -RequireProtection
    if (
        $contractAtLaunch.Zero.Sha256 -cne $contractLocked.Zero.Sha256 -or
        $contractAtLaunch.Capture.Sha256 -cne $contractLocked.Capture.Sha256 -or
        $contractAtLaunch.Seal.Sha256 -cne $contractLocked.Seal.Sha256 -or
        $contractAtLaunch.PinnedArtifactManifestSha256 -cne
            $contractLocked.PinnedArtifactManifestSha256 -or
        (Get-FileSha256 -LiteralPath $vercelAuthJson) -cne $normalAuthBeforeSha256
    ) { Stop-Promotion 'The v2 baseline or authentication changed before launch.' }

    [string[]] $stdinSecrets = @(Read-V2BoundedSecretLines)
    $adminKey = [string] $stdinSecrets[0]
    $protectionBypass = [string] $stdinSecrets[1]
    [Array]::Clear($stdinSecrets, 0, $stdinSecrets.Length)
    if ($adminKey -ceq $protectionBypass) {
        Stop-Promotion 'The two stdin credentials must be distinct.'
    }
    $bypassFingerprint = Get-StringSha256 -Value $protectionBypass
    if ($bypassFingerprint -cne
        [string] $contractAtLaunch.Capture.Value.deploymentProtection.fingerprintSha256) {
        Stop-Promotion 'The stdin deployment-protection credential does not match captured provenance.'
    }
    $preGate = Invoke-V2LiveTwoReadGate -Contract $contractAtLaunch `
        -StartUtc $ExpectedCutoverUtc `
        -EndUtc (ConvertTo-MillisecondUtc -Value $contractAtLaunch.ExpectedEndUtc) `
        -Filenames $liveGatePreBodyFilenames -AdminKey $adminKey -ProviderToken $providerToken `
        -ProtectionBypass $protectionBypass -Phase 'pre_promotion' -CreateDirectory
    [Collections.Generic.List[IO.FileStream]] $liveGateLocks = @()
    foreach ($body in $preGate.Bodies) {
        Assert-RestrictedAcl -LiteralPath $body.Path `
            -Label 'A pre-promotion live measurement evidence file' -IsDirectory $false
        $liveGateLocks.Add([IO.FileStream]::new(
            $body.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
        ))
    }

    $attemptId = [Guid]::NewGuid().ToString('D')
    $createdAtUtc = [DateTimeOffset]::UtcNow
    $promotionReceipt = [ordered]@{
        schemaVersion = 'origin.window002.promotion-receipt.v2'
        attemptId = $attemptId
        createdAtUtc = ConvertTo-MillisecondUtc -Value $createdAtUtc
        updatedAtUtc = ConvertTo-MillisecondUtc -Value $createdAtUtc
        completedAtUtc = $null
        result = 'PENDING'
        providerWriteState = 'MUTATION_AUTHORIZED_NOT_LAUNCHED'
        providerWriteRetryPolicy = 'one_exact_guarded_promote_post_no_redirect_no_rebuild_no_retry'
        runId = $runId
        projectId = $projectId
        orgId = $orgId
        scope = $scope
        expectedCutoverUtc = $ExpectedCutoverUtc
        expectedIntentEndUtc = ConvertTo-MillisecondUtc -Value $contractAtLaunch.ExpectedEndUtc
        stageReceiptSha256 = $contractAtLaunch.Stage.Sha256
        zeroBaselineV2ReceiptSha256 = $contractAtLaunch.Zero.Sha256
        captureReceiptSha256 = $contractAtLaunch.Capture.Sha256
        supplementalRuntimeSealSha256 = $contractAtLaunch.Seal.Sha256
        pinnedArtifactManifestSha256 = $contractAtLaunch.PinnedArtifactManifestSha256
        windowReducerSha256 = $contractAtLaunch.ReducerSha256
        zeroBaselineObservedAtUtc = ConvertTo-MillisecondUtc -Value $contractAtLaunch.ObservedAtUtc
        candidateDeploymentId = $legacyStageBefore.CandidateId
        candidateUniqueUrl = $legacyStageBefore.CandidateUrl
        supersededDeploymentId = $acceptedDeploymentId
        stagedAliasAssignedAtEpochMs = $legacyStageBefore.StagedAliasAssignedAtEpochMs
        initialActiveRunEventCount = 0
        initialLedgerEventCount = 37
        protectedLiveGateDirectory = $liveGateDirectoryName
        prePromotionImmediateGate = $preGate.Receipt
        postPromotionAuthoritativeGate = $null
        lastReadToMutationMaximumSeconds = $maxLastReadToMutationSeconds
        stagedTrafficControl = 'deployment_protection_blocks_public_pre_promotion_traffic'
        localUtcBeforeCli = $null
        localUtcAfterCli = $null
        cliTimedOut = $null
        cliExitCode = $null
        cliStdoutSha256 = $null
        cliStderrSha256 = $null
        providerBaseline = $providerBefore
        providerReconciliation = $null
        providerFinalizationReconciliation = $null
        startUtc = $null
        endUtc = $null
        status = 'AUTHORIZED_NOT_STARTED'
        productFreeze = $true
        wrapperSha256Before = $wrapperBeforeSha256
        wrapperSha256After = $null
        legacyPromotionHelperSha256 = $expectedLegacyPromotionHelperSha256
        normalAuthSha256Before = $normalAuthBeforeSha256
        normalAuthSha256After = $null
        vercelCliVersion = $expectedVercelVersion
        vercelTreeManifestSha256 = $runtimeLocked.ManifestSha256
        promotionGuardSha256 = $expectedPromotionGuardSha256
        executionReadLockCount = @($executionLocks).Count + $liveGateLocks.Count
        scratchManifestSha256Before = $scratchBefore.ManifestSha256
        scratchManifestSha256After = $null
        terminalJournalRecordPath = $null
        terminalJournalRecordSha256 = $null
        journalChain = $null
    }
    $initialPendingEvidence = New-V2InitialPendingMarkerExclusive -Value $promotionReceipt
    [Collections.Generic.List[object]] $journalRecords = @()
    [Collections.Generic.List[IO.FileStream]] $journalLocks = @()
    $journalLocks.Add([IO.FileStream]::new(
        $initialPendingEvidence.Path, [IO.FileMode]::Open,
        [IO.FileAccess]::Read, [IO.FileShare]::Read
    ))
    $previousJournalEvidence = $initialPendingEvidence

    foreach ($artifact in $contractAtLaunch.PinnedArtifacts) {
        if ((Get-FileSha256 -LiteralPath $artifact.Path) -cne $artifact.Sha256) {
            Stop-Promotion 'A locked supplemental artifact changed before provider mutation.'
        }
    }
    if ((Get-FileSha256 -LiteralPath $contractAtLaunch.ReducerPath) -cne
        $contractAtLaunch.ReducerSha256) {
        Stop-Promotion 'The locked Window 002 reducer changed before provider mutation.'
    }
    Assert-RestrictedAcl -LiteralPath $protectedRuntimeRoot `
        -Label 'The protected promotion runtime directory' -IsDirectory $true
    foreach ($protectedRuntimeFile in @($stageHelperPath, $legacyPromotionHelperPath)) {
        Assert-RestrictedAcl -LiteralPath $protectedRuntimeFile `
            -Label 'A protected promotion runtime helper' -IsDirectory $false
    }
    $localUtcBeforeCli = [DateTimeOffset]::UtcNow
    if ($localUtcBeforeCli -lt $contractLocked.CutoverUtc -or
        $localUtcBeforeCli -ge $contractLocked.CutoverUtc.AddMinutes(5) -or
        ($localUtcBeforeCli - $preGate.NotAfterUtc).TotalSeconds -gt
            $maxLastReadToMutationSeconds) {
        Stop-Promotion 'The immediate baseline-to-mutation launch window expired; pending blocks retry.'
    }
    $promotionReceipt['localUtcBeforeCli'] = ConvertTo-MillisecondUtc -Value $localUtcBeforeCli
    $promotionReceipt['updatedAtUtc'] = $promotionReceipt['localUtcBeforeCli']
    $promotionReceipt['providerWriteState'] = 'LAUNCHED_SINGLE_ATTEMPT'
    $journalRecord = New-V2JournalRecordExclusive -Sequence 1 -AttemptId $attemptId `
        -PreviousEvidence $previousJournalEvidence -Snapshot $promotionReceipt
    $journalRecords.Add($journalRecord)
    $journalLocks.Add([IO.FileStream]::new(
        $journalRecord.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
    ))
    $previousJournalEvidence = $journalRecord
    # This is the unavoidable last-read-to-alias micro-window. It is capped at
    # ten seconds, and staged deployment protection blocks public traffic until
    # the single provider mutation moves the aliases.
    if (([DateTimeOffset]::UtcNow - $preGate.NotAfterUtc).TotalSeconds -gt
        $maxLastReadToMutationSeconds) {
        Stop-Promotion 'The immutable launch record crossed the immediate launch deadline; pending blocks retry.'
    }

    $cliResult = Invoke-SinglePromotionCli -Token $providerToken -CandidateId $legacyStageBefore.CandidateId
    $localUtcAfterCli = [DateTimeOffset]::UtcNow
    if ((Test-V2RecursivelyDecodedTextContainsCredential `
            -Text ([string] $cliResult.StandardOutput) `
            -Secrets @($providerToken, $adminKey, $protectionBypass)) -or
        (Test-V2RecursivelyDecodedTextContainsCredential `
            -Text ([string] $cliResult.StandardError) `
            -Secrets @($providerToken, $adminKey, $protectionBypass))) {
        Stop-Promotion 'The promotion CLI output reflected a supplied credential; no output was journaled.'
    }
    $promotionReceipt['localUtcAfterCli'] = ConvertTo-MillisecondUtc -Value $localUtcAfterCli
    $promotionReceipt['cliTimedOut'] = $cliResult.TimedOut
    $promotionReceipt['cliExitCode'] = $cliResult.ExitCode
    $promotionReceipt['cliStdoutSha256'] = Get-StringSha256 -Value $cliResult.StandardOutput
    $promotionReceipt['cliStderrSha256'] = Get-StringSha256 -Value $cliResult.StandardError
    $promotionReceipt['updatedAtUtc'] = ConvertTo-MillisecondUtc -Value ([DateTimeOffset]::UtcNow)
    $promotionReceipt['providerWriteState'] = 'CLI_RETURNED_RECONCILIATION_REQUIRED'
    $journalRecord = New-V2JournalRecordExclusive -Sequence 2 -AttemptId $attemptId `
        -PreviousEvidence $previousJournalEvidence -Snapshot $promotionReceipt
    $journalRecords.Add($journalRecord)
    $journalLocks.Add([IO.FileStream]::new(
        $journalRecord.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
    ))
    $previousJournalEvidence = $journalRecord
    if ($cliResult.TimedOut) { Stop-Promotion 'The promotion CLI timed out; pending blocks every retry.' }
    if ($cliResult.ExitCode -ne 0) { Stop-Promotion 'The promotion CLI returned nonzero; pending blocks every retry.' }

    $firstProviderReadNotBeforeUtc = [DateTimeOffset]::UtcNow
    $providerAfter = Get-ProviderPromotionResult -Token $providerToken -Stage $legacyStageBefore `
        -CutoverUtc $contractAtLaunch.CutoverUtc -NotBeforeUtc $localUtcBeforeCli `
        -NotAfterUtc $localUtcAfterCli
    $firstProviderReadNotAfterUtc = [DateTimeOffset]::UtcNow
    $authoritativeStartUtc = ConvertTo-MillisecondUtc -Value $providerAfter.StartUtc
    $authoritativeEndUtc = ConvertTo-MillisecondUtc -Value $providerAfter.EndUtc
    $providerReconciliation = New-V2ProviderReconciliationEvidence `
        -Provider $providerAfter -Stage $legacyStageBefore `
        -Phase 'post_promotion_initial' -NotBeforeUtc $firstProviderReadNotBeforeUtc `
        -NotAfterUtc $firstProviderReadNotAfterUtc
    [void] (Assert-V2ProviderReconciliationShape -Value $providerReconciliation `
        -ExpectedPhase 'post_promotion_initial')
    $promotionReceipt['providerWriteState'] = 'PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PENDING'
    $promotionReceipt['providerReconciliation'] = $providerReconciliation
    $promotionReceipt['startUtc'] = $authoritativeStartUtc
    $promotionReceipt['endUtc'] = $authoritativeEndUtc
    $promotionReceipt['status'] = 'INTEGRITY_WITHDRAWAL_REQUIRED_UNTIL_AUTHORITATIVE_GATE_PASSES'
    $promotionReceipt['updatedAtUtc'] = ConvertTo-MillisecondUtc -Value ([DateTimeOffset]::UtcNow)
    $journalRecord = New-V2JournalRecordExclusive -Sequence 3 -AttemptId $attemptId `
        -PreviousEvidence $previousJournalEvidence -Snapshot $promotionReceipt
    $journalRecords.Add($journalRecord)
    $journalLocks.Add([IO.FileStream]::new(
        $journalRecord.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
    ))
    $previousJournalEvidence = $journalRecord

    # Complete every local integrity check before the public-alias truth read and
    # final provider reconciliation, so no stale provider result is followed by
    # discretionary work before the PASS anchor is created.
    $scratchAfter = Get-ScratchEvidence
    Assert-PromotionExecutionOutputs
    $normalAuthAfterSha256 = Get-FileSha256 -LiteralPath $vercelAuthJson
    $wrapperAfterSha256 = Get-FileSha256 -LiteralPath $PSCommandPath
    if (
        $normalAuthAfterSha256 -cne $normalAuthBeforeSha256 -or
        $wrapperAfterSha256 -cne $wrapperBeforeSha256 -or
        (Get-FileSha256 -LiteralPath $stagePassPath) -cne $contractAtLaunch.Stage.Sha256 -or
        (Get-FileSha256 -LiteralPath $contractAtLaunch.Capture.Path) -cne $contractAtLaunch.Capture.Sha256 -or
        (Get-FileSha256 -LiteralPath $contractAtLaunch.Zero.Path) -cne $contractAtLaunch.Zero.Sha256 -or
        (Get-FileSha256 -LiteralPath $contractAtLaunch.Seal.Path) -cne $contractAtLaunch.Seal.Sha256
    ) { Stop-Promotion 'A promotion v2 input changed during promotion.' }
    foreach ($artifact in $contractAtLaunch.PinnedArtifacts) {
        if ((Get-FileSha256 -LiteralPath $artifact.Path) -cne $artifact.Sha256) {
            Stop-Promotion 'A locked supplemental artifact changed during promotion.'
        }
    }
    if ((Get-FileSha256 -LiteralPath $contractAtLaunch.ReducerPath) -cne
        $contractAtLaunch.ReducerSha256) {
        Stop-Promotion 'The locked Window 002 reducer changed during promotion.'
    }
    Assert-RestrictedAcl -LiteralPath $protectedRuntimeRoot `
        -Label 'The final protected promotion runtime directory' -IsDirectory $true
    Assert-RestrictedAcl -LiteralPath $liveGateDirectoryPath `
        -Label 'The final protected live-gate directory' -IsDirectory $true
    foreach ($protectedRuntimeFile in @($stageHelperPath, $legacyPromotionHelperPath)) {
        Assert-RestrictedAcl -LiteralPath $protectedRuntimeFile `
            -Label 'A final protected promotion runtime helper' -IsDirectory $false
    }
    foreach ($body in @($preGate.Bodies)) {
        Assert-RestrictedAcl -LiteralPath $body.Path `
            -Label 'A final protected live measurement evidence file' -IsDirectory $false
        if ((Get-FileSha256 -LiteralPath $body.Path) -cne $body.Sha256) {
            Stop-Promotion 'A protected live measurement evidence file changed during promotion.'
        }
    }

    $postGate = Invoke-V2LiveTwoReadGate -Contract $contractAtLaunch `
        -StartUtc $authoritativeStartUtc -EndUtc $authoritativeEndUtc `
        -Filenames $liveGatePostBodyFilenames -AdminKey $adminKey -ProviderToken $providerToken `
        -ProtectionBypass $protectionBypass -Phase 'post_promotion_authoritative'
    foreach ($body in $postGate.Bodies) {
        Assert-RestrictedAcl -LiteralPath $body.Path `
            -Label 'A post-promotion live measurement evidence file' -IsDirectory $false
        $liveGateLocks.Add([IO.FileStream]::new(
            $body.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
        ))
    }
    $promotionReceipt['postPromotionAuthoritativeGate'] = $postGate.Receipt
    $promotionReceipt['executionReadLockCount'] = @($executionLocks).Count + $liveGateLocks.Count
    $promotionReceipt['providerWriteState'] =
        'PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PASSED_FINAL_RECONCILIATION_PENDING'
    $promotionReceipt['updatedAtUtc'] = ConvertTo-MillisecondUtc -Value ([DateTimeOffset]::UtcNow)
    $journalRecord = New-V2JournalRecordExclusive -Sequence 4 -AttemptId $attemptId `
        -PreviousEvidence $previousJournalEvidence -Snapshot $promotionReceipt
    $journalRecords.Add($journalRecord)
    $journalLocks.Add([IO.FileStream]::new(
        $journalRecord.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
    ))
    $previousJournalEvidence = $journalRecord
    foreach ($body in @($postGate.Bodies)) {
        Assert-RestrictedAcl -LiteralPath $body.Path `
            -Label 'A final protected live measurement evidence file' -IsDirectory $false
        if ((Get-FileSha256 -LiteralPath $body.Path) -cne $body.Sha256) {
            Stop-Promotion 'A protected live measurement evidence file changed during promotion.'
        }
    }

    $finalProviderReadNotBeforeUtc = [DateTimeOffset]::UtcNow
    if (($finalProviderReadNotBeforeUtc - $postGate.NotAfterUtc).TotalSeconds -gt
        $maxFinalReconciliationToPassSeconds) {
        Stop-Promotion 'The public-alias gate to final provider reconciliation interval expired.'
    }
    $providerFinal = Get-ProviderPromotionResult -Token $providerToken -Stage $legacyStageBefore `
        -CutoverUtc $contractAtLaunch.CutoverUtc -NotBeforeUtc $localUtcBeforeCli `
        -NotAfterUtc $localUtcAfterCli
    $finalProviderReadNotAfterUtc = [DateTimeOffset]::UtcNow
    $providerFinalizationReconciliation = New-V2ProviderReconciliationEvidence `
        -Provider $providerFinal -Stage $legacyStageBefore -Phase 'pre_pass_final' `
        -NotBeforeUtc $finalProviderReadNotBeforeUtc -NotAfterUtc $finalProviderReadNotAfterUtc
    [void] (Assert-V2ProviderReconciliationContinuity `
        -First $providerReconciliation -Final $providerFinalizationReconciliation `
        -PostGateNotAfterUtc (ConvertTo-MillisecondUtc -Value $postGate.NotAfterUtc) `
        -ExpectedCandidateDeploymentId $legacyStageBefore.CandidateId `
        -ExpectedCandidateUniqueHost $legacyStageBefore.CandidateHost)
    $promotionReceipt['providerFinalizationReconciliation'] = $providerFinalizationReconciliation
    $promotionReceipt['providerWriteState'] =
        'PROMOTED_RECONCILED_AUTHORITATIVE_GATE_PASSED_FINAL_RECONCILIATION_VERIFIED_PASS_PENDING'
    $promotionReceipt['updatedAtUtc'] = ConvertTo-MillisecondUtc -Value ([DateTimeOffset]::UtcNow)
    $journalRecord = New-V2JournalRecordExclusive -Sequence 5 -AttemptId $attemptId `
        -PreviousEvidence $previousJournalEvidence -Snapshot $promotionReceipt
    $journalRecords.Add($journalRecord)
    $journalLocks.Add([IO.FileStream]::new(
        $journalRecord.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
    ))
    $previousJournalEvidence = $journalRecord
    $journalChain = @(Get-V2JournalChainManifest -InitialEvidence $initialPendingEvidence `
        -Records @($journalRecords) -AttemptId $attemptId)
    if ($journalChain.Count -ne 6 -or
        ([DateTimeOffset]::UtcNow - $finalProviderReadNotAfterUtc).TotalSeconds -gt
            $maxFinalReconciliationToPassSeconds) {
        Stop-Promotion 'The final provider truth is stale or its append-only chain is incomplete.'
    }

    $promotionReceipt['providerWriteState'] = 'PROMOTED_AND_RECONCILED_FINAL_PROVIDER_VERIFIED'
    $promotionReceipt['status'] = 'PUBLIC_PROBE_WINDOW_RUNNING'
    $promotionReceipt['scratchManifestSha256After'] = $scratchAfter.ManifestSha256
    $promotionReceipt['normalAuthSha256After'] = $normalAuthAfterSha256
    $promotionReceipt['wrapperSha256After'] = $wrapperAfterSha256
    $promotionReceipt['completedAtUtc'] = ConvertTo-MillisecondUtc -Value ([DateTimeOffset]::UtcNow)
    $promotionReceipt['updatedAtUtc'] = $promotionReceipt['completedAtUtc']
    $promotionReceipt['result'] = 'PASS'
    $promotionReceipt['terminalJournalRecordPath'] = [IO.Path]::GetFileName($previousJournalEvidence.Path)
    $promotionReceipt['terminalJournalRecordSha256'] = $previousJournalEvidence.Sha256
    $promotionReceipt['journalChain'] = $journalChain
    $passEvidence = Write-V2ProtectedJsonExclusive -LiteralPath $promotionPassPath `
        -Value $promotionReceipt -Label 'The immutable completed promotion v2 marker'
    if ([string] $passEvidence.Value.result -cne 'PASS' -or
        [string] $passEvidence.Value.status -cne 'PUBLIC_PROBE_WINDOW_RUNNING' -or
        [string] $passEvidence.Value.attemptId -cne $attemptId -or
        [string] $passEvidence.Value.terminalJournalRecordSha256 -cne
            $previousJournalEvidence.Sha256 -or
        @($passEvidence.Value.journalChain).Count -ne 6) {
        Stop-Promotion 'The immutable PASS anchor does not bind the full append-only chain.'
    }
    [Console]::Out.WriteLine(($promotionReceipt | ConvertTo-Json -Depth 16 -Compress))
}
catch {
    $message = $_.Exception.Message
    if ($message.StartsWith($safeErrorPrefix, [StringComparison]::Ordinal)) {
        $message = $message.Substring($safeErrorPrefix.Length)
    }
    elseif (Test-Path -LiteralPath $promotionPendingPath) {
        $message = 'Promotion stopped after its durable pending marker was created; reconcile provider state and never retry.'
    }
    else { $message = 'The Window 002 promotion v2 helper failed before provider mutation authorization.' }
    [Console]::Error.WriteLine('ERROR: {0}', $message)
    exit 1
}
finally {
    $providerToken = $null
    $adminKey = $null
    $protectionBypass = $null
    if ($null -ne $journalLocks) { foreach ($lock in $journalLocks) { $lock.Dispose() } }
    if ($null -ne $liveGateLocks) { foreach ($lock in $liveGateLocks) { $lock.Dispose() } }
    if ($null -ne $executionLocks) { foreach ($lock in $executionLocks) { $lock.Dispose() } }
    if ($mutexAcquired -and $null -ne $promotionMutex) {
        try { $promotionMutex.ReleaseMutex() } catch {}
    }
    if ($null -ne $promotionMutex) { $promotionMutex.Dispose() }
}
