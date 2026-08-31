#requires -Version 7.4

<#
.SYNOPSIS
Runs the Window 002 baseline capture from fixed, protected Windows paths.

.DESCRIPTION
This wrapper is the only production authority for the v2 capture tool. Its
evidence is trusted-operator TLS capture plus an independent read-only Vercel
lookup; it is deliberately not represented as a cryptographic signature.
ContractTest validates an inline synthetic contract and returns before any
credential read, provider request, filesystem mutation, or child process.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('ContractTest', 'PreRotationCapture', 'StagedCapture')]
    [string] $Mode,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$')]
    [string] $ExpectedStartUtc,

    [string] $ContractFixtureBase64
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$safeErrorPrefix = 'origin_window002_capture_protected_v2_safe:'
$runId = 'ORIGIN-G2-PUBLIC-PROBE-AUTH-002'
$preRotationRunId = 'ORIGIN-G2R-UI-REACCEPTANCE-001'
$projectId = 'prj_BGVULzAdg0iZSZPUwdUdVO0RO0cY'
$orgId = 'team_OD1jaVJioNw3IjsSJdp5fMwB'
$scope = 'uridolan77s-projects'
$acceptedDeploymentId = 'dpl_FzYtRPK5oxnoG4TJnjNxEYrcZbs7'
$trustModel = 'trusted_operator_tls_capture_plus_read_only_provider_lookup_not_a_signature'
$storePath = 'C:\Users\urido\OriginProbeOperator'
$stagePassPath = [IO.Path]::Combine($storePath, 'window002-stage-pass.json')
$preOutputPath = [IO.Path]::Combine($storePath, 'window002-baseline-supersession-pre-rotation')
$stagedOutputPath = [IO.Path]::Combine($storePath, 'window002-baseline-supersession')
$providerLookupFilename = 'vercel-deployment-lookup.json'
$outputGuardFilename = '.origin-window002-capture-directory.lock'
$nodePath = 'C:\Progra~1\nodejs\node.exe'
$expectedNodeSha256 = '33b1bc1a8aca11fd5a4f2699e51019c63c0af30cf437701d07af69be7706771b'
$captureScriptPath = [IO.Path]::Combine($PSScriptRoot, 'window002-baseline-capture-v2.mjs')
$expectedCaptureScriptSha256 = '5b5975f44e3bcbd87af702696e53af49783cd13d3ac3108ea23adffe9cd75276'
$projectorScriptPath = [IO.Path]::Combine($PSScriptRoot, 'window002-historical-projection.mjs')
$expectedProjectorScriptSha256 = 'c9c18c829da7e4cf553b2aca3f3e74e70c6912d34c1a99e6b26f8dcc0ba6ccd2'
$runtimePath = [IO.Path]::Combine($storePath, 'window002-runtime')
$legacyPromotionHelperPath = [IO.Path]::Combine($runtimePath, 'origin-g2-window002-promote.ps1')
$expectedLegacyPromotionHelperSha256 = '76b3c3d6ce64f02ecaa6ee36f0f6800d2fd8bf9e17c12c973197700de9affede'
$vercelGlobalConfig = 'C:\Users\urido\AppData\Roaming\com.vercel.cli\Data'
$vercelAuthJson = [IO.Path]::Combine($vercelGlobalConfig, 'auth.json')
$vercelConfigJson = [IO.Path]::Combine($vercelGlobalConfig, 'config.json')
$expectedVercelConfigSha256 = '610d361e025dde51b866344c55ea5546f98ed353c87f09a97b336f393e87e8a8'
$expectedRepairedCommit = '2e4f33c334f5eb07204d6a69481b5c85fe15e45a'
$expectedRepairedMeasurementTree = '76218da5886b022ec7d7310dfc6c79f00228a17e'
$expectedVercelVersion = '57.0.0'
$expectedVercelTreeManifestSha256 = '21545361d00941da2994447db68cbd5c5ddc2899a326974996fe05210e80b994'
$expectedStageHelperSha256 = '0447b882e6f1b521f7945bb42460770dbbcd778111645959df83b6568bb2a6cd'
$stageHelperPath = [IO.Path]::Combine($runtimePath, 'origin-g2-window002-stage.ps1')
$maxProviderBytes = 5MB
$maxStdinCharacters = 8196

function Stop-Capture {
    param([Parameter(Mandatory = $true)][string] $Message)
    throw [InvalidOperationException]::new("$safeErrorPrefix$Message")
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][byte[]] $Bytes)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($hasher.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally { $hasher.Dispose() }
}

function Get-FileDigest {
    param([Parameter(Mandatory = $true)][string] $LiteralPath)
    return (Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-ExactKeys {
    param([AllowNull()][object] $Value, [string[]] $Expected, [string] $Label)
    if ($null -eq $Value -or $Value -is [Array] -or $Value -isnot [psobject]) {
        Stop-Capture "$Label is not an object."
    }
    [string[]] $actual = @($Value.PSObject.Properties.Name)
    [string[]] $wanted = @($Expected)
    [Array]::Sort($actual, [StringComparer]::Ordinal)
    [Array]::Sort($wanted, [StringComparer]::Ordinal)
    if ($actual.Count -ne $wanted.Count) { Stop-Capture "$Label field set changed." }
    for ($index = 0; $index -lt $wanted.Count; $index++) {
        if ($actual[$index] -cne $wanted[$index]) { Stop-Capture "$Label field set changed." }
    }
}

function Assert-ExactJsonBoolean {
    param([AllowNull()][object] $Value, [bool] $Expected, [string] $Label)
    if ($Value -isnot [bool] -or [bool] $Value -cne $Expected) {
        Stop-Capture "$Label is not the exact JSON Boolean."
    }
}

function Get-ExactJsonInteger {
    param([AllowNull()][object] $Value, [string] $Label)
    if ($Value -isnot [int] -and $Value -isnot [long]) {
        Stop-Capture "$Label is not an exact JSON integer."
    }
    return [long] $Value
}

function ConvertFrom-MillisecondUtc {
    param([string] $Value, [string] $Label)
    $parsed = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParseExact(
        $Value, "yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AssumeUniversal -bor
            [Globalization.DateTimeStyles]::AdjustToUniversal,
        [ref] $parsed
    )) { Stop-Capture "$Label is not canonical millisecond UTC." }
    return $parsed
}

function Assert-FullStageReceipt {
    param([object] $Receipt, [string] $RawText)
    if ($RawText -cmatch '"(?:adminKey|clientSalt|hmacSecret|originCid|protectionBypass|providerToken|refreshToken|token|password)"\s*:') {
        Stop-Capture 'The stage receipt contains a forbidden secret key.'
    }
    Assert-ExactKeys -Value $Receipt -Label 'stage receipt' -Expected @(
        'acceptedDeploymentId', 'archiveTarBytes', 'archiveTarSha256', 'attemptId',
        'cliExitCode', 'cliStderrSha256', 'cliStdoutSha256', 'cliTimedOut',
        'completedAtUtc', 'createdAtUtc', 'deployFileCountBefore',
        'deployManifestSha256After', 'deployManifestSha256Before',
        'executionReadLockCount', 'expectedMeasurementConfigFingerprint',
        'localUtcAfterCli', 'localUtcBeforeCli', 'nodeSha256', 'nodeVersion',
        'noRetryPreloadSha256', 'normalAuthSha256After', 'normalAuthSha256Before',
        'orgId', 'productionAliasesRemainOnAcceptedDeployment', 'projectId',
        'projectNodeVersion', 'providerBaseline', 'providerBearerExpiresAtEpochSeconds',
        'providerCredentialMode', 'providerExecutionConfigSha256',
        'providerReconciliation', 'providerWriteRetryPolicy', 'providerWriteState',
        'repairedCommit', 'repairedMeasurementTree', 'result', 'rotationAttemptId',
        'rotationReceiptSha256', 'runId', 'schemaVersion', 'scope',
        'scratchFileCountAfter', 'scratchFileCountBefore', 'scratchItemCountAfter',
        'scratchItemCountBefore', 'scratchManifestSha256After',
        'scratchManifestSha256Before', 'scratchTotalBytesAfter', 'secretSetFingerprint',
        'stagedDeployment', 'updatedAtUtc', 'vercelCliVersion',
        'vercelTreeManifestSha256', 'wrapperSha256After', 'wrapperSha256Before'
    )
    Assert-ExactJsonBoolean $Receipt.cliTimedOut $false 'stage cliTimedOut'
    Assert-ExactJsonBoolean $Receipt.productionAliasesRemainOnAcceptedDeployment `
        $true 'stage productionAliasesRemainOnAcceptedDeployment'
    $cliExitCode = Get-ExactJsonInteger $Receipt.cliExitCode 'stage cliExitCode'
    $archiveTarBytes = Get-ExactJsonInteger $Receipt.archiveTarBytes 'stage archiveTarBytes'
    $deployFileCountBefore = Get-ExactJsonInteger `
        $Receipt.deployFileCountBefore 'stage deployFileCountBefore'
    $executionReadLockCount = Get-ExactJsonInteger `
        $Receipt.executionReadLockCount 'stage executionReadLockCount'
    $providerBearerExpiresAtEpochSeconds = Get-ExactJsonInteger `
        $Receipt.providerBearerExpiresAtEpochSeconds 'stage providerBearerExpiresAtEpochSeconds'
    [void] (Get-ExactJsonInteger $Receipt.scratchItemCountBefore 'stage scratchItemCountBefore')
    [void] (Get-ExactJsonInteger $Receipt.scratchFileCountBefore 'stage scratchFileCountBefore')
    [void] (Get-ExactJsonInteger $Receipt.scratchItemCountAfter 'stage scratchItemCountAfter')
    [void] (Get-ExactJsonInteger $Receipt.scratchFileCountAfter 'stage scratchFileCountAfter')
    [void] (Get-ExactJsonInteger $Receipt.scratchTotalBytesAfter 'stage scratchTotalBytesAfter')
    if (
        [string] $Receipt.schemaVersion -cne 'origin.window002.staged-deployment-receipt.v1' -or
        [string] $Receipt.result -cne 'PASS' -or
        [string] $Receipt.providerWriteState -cne 'STAGED_READY_NOT_PROMOTED' -or
        [string] $Receipt.runId -cne $runId -or
        [string] $Receipt.projectId -cne $projectId -or
        [string] $Receipt.orgId -cne $orgId -or
        [string] $Receipt.scope -cne $scope -or
        [string] $Receipt.repairedCommit -cne $expectedRepairedCommit -or
        [string] $Receipt.repairedMeasurementTree -cne $expectedRepairedMeasurementTree -or
        [string] $Receipt.vercelCliVersion -cne $expectedVercelVersion -or
        [string] $Receipt.vercelTreeManifestSha256 -cne $expectedVercelTreeManifestSha256 -or
        [string] $Receipt.wrapperSha256Before -cne $expectedStageHelperSha256 -or
        [string] $Receipt.wrapperSha256After -cne $expectedStageHelperSha256 -or
        [string] $Receipt.acceptedDeploymentId -cne $acceptedDeploymentId -or
        $cliExitCode -ne 0 -or $archiveTarBytes -ne 184320 -or
        $deployFileCountBefore -ne 26 -or $executionReadLockCount -le 0 -or
        $providerBearerExpiresAtEpochSeconds -le 0
    ) { Stop-Capture 'The full stage receipt does not pin the sealed PASS.' }
    Assert-ExactKeys -Value $Receipt.stagedDeployment -Label 'staged deployment' -Expected @(
        'id', 'inspectorUrl', 'readyState', 'readySubstate', 'target', 'uniqueUrl'
    )
    Assert-ExactKeys -Value $Receipt.providerBaseline -Label 'provider baseline' -Expected @(
        'acceptedAliasesRawSha256', 'acceptedDeploymentRawSha256', 'aliasRawSha256',
        'domainRawSha256', 'projectRawSha256'
    )
    Assert-ExactKeys -Value $Receipt.providerReconciliation -Label 'provider reconciliation' -Expected @(
        'candidateAliasAssignedAtEpochMs', 'candidateAliasAssignedSemantics',
        'candidateAliasSetRawSha256', 'candidateCreatedAtEpochMs',
        'candidateDeploymentRawBytes', 'candidateDeploymentRawSha256',
        'postStageAcceptedAliasesRawSha256', 'postStageAcceptedDeploymentRawSha256',
        'postStageDomainRawSha256', 'postStageProjectRawSha256'
    )
    $candidateAliasAssignedAtEpochMs = Get-ExactJsonInteger `
        $Receipt.providerReconciliation.candidateAliasAssignedAtEpochMs `
        'stage candidateAliasAssignedAtEpochMs'
    $candidateCreatedAtEpochMs = Get-ExactJsonInteger `
        $Receipt.providerReconciliation.candidateCreatedAtEpochMs `
        'stage candidateCreatedAtEpochMs'
    $candidateDeploymentRawBytes = Get-ExactJsonInteger `
        $Receipt.providerReconciliation.candidateDeploymentRawBytes `
        'stage candidateDeploymentRawBytes'
    if (
        [string] $Receipt.stagedDeployment.id -cnotmatch '^dpl_[A-Za-z0-9]+$' -or
        [string] $Receipt.stagedDeployment.target -cne 'production' -or
        [string] $Receipt.stagedDeployment.readyState -cne 'READY' -or
        [string] $Receipt.stagedDeployment.readySubstate -cne 'STAGED' -or
        $candidateAliasAssignedAtEpochMs -le 0 -or
        $candidateCreatedAtEpochMs -le 0 -or $candidateDeploymentRawBytes -le 0
    ) { Stop-Capture 'The stage deployment or timestamps are invalid.' }
    $created = ConvertFrom-MillisecondUtc ([string] $Receipt.createdAtUtc) 'stage createdAtUtc'
    $before = ConvertFrom-MillisecondUtc ([string] $Receipt.localUtcBeforeCli) 'stage localUtcBeforeCli'
    $after = ConvertFrom-MillisecondUtc ([string] $Receipt.localUtcAfterCli) 'stage localUtcAfterCli'
    $completed = ConvertFrom-MillisecondUtc ([string] $Receipt.completedAtUtc) 'stage completedAtUtc'
    $updated = ConvertFrom-MillisecondUtc ([string] $Receipt.updatedAtUtc) 'stage updatedAtUtc'
    if ($created -gt $before -or $before -gt $after -or $after -gt $completed -or $completed -ne $updated) {
        Stop-Capture 'The stage receipt time order changed.'
    }
}

function Get-ProviderProjection {
    param([object] $Value)
    $aliasAssignedAtEpochMs = Get-ExactJsonInteger `
        $Value.aliasAssignedAt 'provider aliasAssignedAt'
    $createdAtEpochMs = Get-ExactJsonInteger $Value.createdAt 'provider createdAt'
    return [ordered]@{
        id = [string] $Value.id
        projectId = [string] $Value.projectId
        ownerId = [string] $Value.ownerId
        url = [string] $Value.url
        target = [string] $Value.target
        readyState = [string] $Value.readyState
        readySubstate = [string] $Value.readySubstate
        aliasAssignedAtEpochMs = $aliasAssignedAtEpochMs
        createdAtEpochMs = $createdAtEpochMs
    }
}

function Assert-ProviderProjection {
    param([object] $Deployment, [object] $Stage)
    Assert-ExactKeys -Value $Deployment -Label 'provider deployment projection' -Expected @(
        'aliasAssignedAtEpochMs', 'createdAtEpochMs', 'id', 'ownerId', 'projectId',
        'readyState', 'readySubstate', 'target', 'url'
    )
    $deploymentAliasAssignedAtEpochMs = Get-ExactJsonInteger `
        $Deployment.aliasAssignedAtEpochMs 'provider projection aliasAssignedAtEpochMs'
    $deploymentCreatedAtEpochMs = Get-ExactJsonInteger `
        $Deployment.createdAtEpochMs 'provider projection createdAtEpochMs'
    $stageAliasAssignedAtEpochMs = Get-ExactJsonInteger `
        $Stage.providerReconciliation.candidateAliasAssignedAtEpochMs `
        'stage candidateAliasAssignedAtEpochMs'
    $stageCreatedAtEpochMs = Get-ExactJsonInteger `
        $Stage.providerReconciliation.candidateCreatedAtEpochMs `
        'stage candidateCreatedAtEpochMs'
    $deploymentHost = ([Uri] [string] $Stage.stagedDeployment.uniqueUrl).Host
    if (
        [string] $Deployment.id -cne [string] $Stage.stagedDeployment.id -or
        [string] $Deployment.projectId -cne $projectId -or
        [string] $Deployment.ownerId -cne $orgId -or
        [string] $Deployment.url -cne $deploymentHost -or
        [string] $Deployment.target -cne 'production' -or
        [string] $Deployment.readyState -cne 'READY' -or
        [string] $Deployment.readySubstate -cne 'STAGED' -or
        $deploymentAliasAssignedAtEpochMs -ne $stageAliasAssignedAtEpochMs -or
        $deploymentCreatedAtEpochMs -ne $stageCreatedAtEpochMs
    ) { Stop-Capture 'The independent provider lookup differs from the stage receipt.' }
}

function ConvertFrom-SecretLines {
    param([AllowEmptyString()][string] $Text, [int] $ExpectedCount)
    if ($Text.Length -gt $maxStdinCharacters) {
        Stop-Capture 'The stdin secret input exceeds the bounded limit.'
    }
    [string[]] $rawLines = [Text.RegularExpressions.Regex]::Split($Text, '\r?\n')
    $retainedCount = $rawLines.Count
    while ($retainedCount -gt 0 -and $rawLines[$retainedCount - 1] -ceq '') {
        $retainedCount--
    }
    if ($retainedCount -ne $ExpectedCount) {
        Stop-Capture 'The stdin secret line count is invalid.'
    }
    [string[]] $result = [string[]]::new($retainedCount)
    if ($retainedCount -gt 0) {
        [Array]::Copy($rawLines, 0, $result, 0, $retainedCount)
    }
    foreach ($line in $result) {
        if ($line -cnotmatch '^[\x21-\x7e]{16,4096}$') {
            Stop-Capture 'The stdin secret format is invalid.'
        }
    }
    return $result
}

function Read-BoundedStandardInput {
    $buffer = [char[]]::new($maxStdinCharacters + 1)
    try {
        $count = [Console]::In.ReadBlock($buffer, 0, $buffer.Length)
        if ($count -gt $maxStdinCharacters -or [Console]::In.Read() -ne -1) {
            Stop-Capture 'The stdin secret input exceeds the bounded limit.'
        }
        return [string]::new($buffer, 0, $count)
    }
    finally { [Array]::Clear($buffer, 0, $buffer.Length) }
}

function ConvertTo-StandardUriComponentEncoding {
    param([Parameter(Mandatory = $true)][byte[]] $Bytes)
    $builder = [Text.StringBuilder]::new($Bytes.Length * 3)
    foreach ($byte in $Bytes) {
        $isUnescaped =
            ($byte -ge 0x41 -and $byte -le 0x5a) -or
            ($byte -ge 0x61 -and $byte -le 0x7a) -or
            ($byte -ge 0x30 -and $byte -le 0x39) -or
            $byte -in @(0x2d, 0x5f, 0x2e, 0x21, 0x7e, 0x2a, 0x27, 0x28, 0x29)
        if ($isUnescaped) { [void] $builder.Append([char] $byte) }
        else { [void] $builder.Append('%').Append($byte.ToString('X2')) }
    }
    return $builder.ToString()
}

function Get-CredentialReflectionCandidates {
    param([AllowNull()][string[]] $Secrets)
    $candidates = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($secret in $Secrets) {
        if ([string]::IsNullOrEmpty($secret)) { continue }
        $secretBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($secret)
        try {
            [void] $candidates.Add($secret)
            $fullPercent = [string]::Concat(@($secretBytes | ForEach-Object {
                '%' + $_.ToString('X2')
            }))
            [void] $candidates.Add($fullPercent)
            [void] $candidates.Add($fullPercent.ToLowerInvariant())
            [void] $candidates.Add((ConvertTo-StandardUriComponentEncoding $secretBytes))
            [void] $candidates.Add([Uri]::EscapeDataString($secret))
            $base64 = [Convert]::ToBase64String($secretBytes)
            $base64Unpadded = $base64.TrimEnd('=')
            $base64UrlUnpadded = $base64Unpadded.Replace('+', '-').Replace('/', '_')
            $base64UrlPadded = $base64UrlUnpadded +
                ('=' * ((4 - ($base64UrlUnpadded.Length % 4)) % 4))
            foreach ($candidate in @(
                $base64, $base64Unpadded, $base64UrlPadded, $base64UrlUnpadded
            )) { if ($candidate.Length -gt 0) { [void] $candidates.Add($candidate) } }
            $hexUpper = [Convert]::ToHexString($secretBytes)
            [void] $candidates.Add($hexUpper)
            [void] $candidates.Add($hexUpper.ToLowerInvariant())
        }
        finally { [Array]::Clear($secretBytes, 0, $secretBytes.Length) }
    }
    return [string[]] @($candidates)
}

function Test-StringContainsSecret {
    param([AllowNull()][string] $Value, [AllowNull()][string[]] $Candidates)
    if ($null -eq $Value) { return $false }
    foreach ($candidate in $Candidates) {
        if (-not [string]::IsNullOrEmpty($candidate) -and
            $Value.Contains($candidate, [StringComparison]::Ordinal)) {
            return $true
        }
    }
    return $false
}

function Test-DecodedValueContainsSecret {
    param([AllowNull()][object] $Value, [AllowNull()][string[]] $Candidates)
    if ($null -eq $Value) { return $false }
    if ($Value -is [string]) {
        return Test-StringContainsSecret ([string] $Value) $Candidates
    }
    if ($Value -is [Collections.IDictionary]) {
        foreach ($key in $Value.Keys) {
            if (Test-StringContainsSecret ([string] $key) $Candidates) { return $true }
            if (Test-DecodedValueContainsSecret $Value[$key] $Candidates) { return $true }
        }
        return $false
    }
    if ($Value -is [Collections.IEnumerable] -and $Value -isnot [string]) {
        foreach ($entry in $Value) {
            if (Test-DecodedValueContainsSecret $entry $Candidates) { return $true }
        }
        return $false
    }
    if ($Value -is [pscustomobject]) {
        foreach ($property in $Value.PSObject.Properties) {
            if (Test-StringContainsSecret ([string] $property.Name) $Candidates) { return $true }
            if (Test-DecodedValueContainsSecret $property.Value $Candidates) { return $true }
        }
    }
    return $false
}

function Test-ContainsSecretText {
    param([Parameter(Mandatory = $true)][string] $Text, [AllowNull()][string[]] $Secrets)
    [string[]] $candidates = @(Get-CredentialReflectionCandidates $Secrets)
    foreach ($candidate in $candidates) {
        if ($Text.Contains($candidate, [StringComparison]::Ordinal)) { return $true }
        $encoded = ConvertTo-Json -InputObject $candidate -Compress
        if ($encoded.Length -ge 2) {
            $escaped = $encoded.Substring(1, $encoded.Length - 2)
            if ($escaped.Length -gt 0 -and
                $Text.Contains($escaped, [StringComparison]::Ordinal)) {
                return $true
            }
        }
    }
    try {
        $decoded = $Text | ConvertFrom-Json -DateKind String -ErrorAction Stop
        if (Test-DecodedValueContainsSecret $decoded $candidates) { return $true }
    } catch {}
    try {
        $decodedFragment = ('"' + $Text + '"') |
            ConvertFrom-Json -DateKind String -ErrorAction Stop
        if (Test-DecodedValueContainsSecret $decodedFragment $candidates) { return $true }
    } catch {}
    return $false
}

function Test-ContainsSecret {
    param([Parameter(Mandatory = $true)][byte[]] $Bytes, [AllowNull()][string[]] $Secrets)
    try {
        $text = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes)
    } catch {
        Stop-Capture 'Credential-reflection evidence is not strict UTF-8.'
    }
    return Test-ContainsSecretText $text $Secrets
}

function New-CaptureChildStartInfo {
    param([Parameter(Mandatory = $true)][string] $Phase)
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $nodePath
    $startInfo.ArgumentList.Add($captureScriptPath)
    $startInfo.ArgumentList.Add($Phase)
    $startInfo.ArgumentList.Add($ExpectedStartUtc)
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.Environment.Clear()
    $startInfo.Environment['SystemRoot'] = 'C:\Windows'
    $startInfo.Environment['WINDIR'] = 'C:\Windows'
    return $startInfo
}

if ($Mode -ceq 'ContractTest') {
    try {
        if ([string]::IsNullOrWhiteSpace($ContractFixtureBase64)) {
            Stop-Capture 'ContractTest requires ContractFixtureBase64.'
        }
        $bytes = [Convert]::FromBase64String($ContractFixtureBase64)
        try {
            $text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
            $fixture = $text | ConvertFrom-Json -DateKind String
            Assert-ExactKeys -Value $fixture -Label 'contract fixture' -Expected @(
                'phase', 'providerDeployment', 'secretScanSecrets', 'secretScanText',
                'stageReceipt', 'stdinText'
            )
            Assert-FullStageReceipt -Receipt $fixture.stageReceipt `
                -RawText ($fixture.stageReceipt | ConvertTo-Json -Depth 12 -Compress)
            Assert-ProviderProjection -Deployment $fixture.providerDeployment `
                -Stage $fixture.stageReceipt
            $fixturePhase = [string] $fixture.phase
            if ($fixturePhase -cnotin @('pre_rotation', 'staged')) {
                Stop-Capture 'The contract fixture phase is invalid.'
            }
            $fixtureExpectedLineCount = if ($fixturePhase -ceq 'staged') { 2 } else { 1 }
            [string[]] $fixtureSecretLines = @(ConvertFrom-SecretLines `
                -Text ([string] $fixture.stdinText) -ExpectedCount $fixtureExpectedLineCount)
            if ($fixtureSecretLines.Count -ne $fixtureExpectedLineCount) {
                Stop-Capture 'The contract fixture secret parser changed.'
            }
            [string[]] $fixtureScanSecrets = @($fixture.secretScanSecrets)
            if ($fixtureScanSecrets.Count -eq 0 -or
                $fixtureScanSecrets.Count -gt 16 -or
                @($fixtureScanSecrets | Where-Object {
                    [string]::IsNullOrEmpty([string] $_)
                }).Count -ne 0) {
                Stop-Capture 'The contract fixture scanner secrets are invalid.'
            }
            if (Test-ContainsSecretText ([string] $fixture.secretScanText) $fixtureScanSecrets) {
                Stop-Capture 'The synthetic credential-reflection scanner detected credential material.'
            }
            $fixtureStartInfo = New-CaptureChildStartInfo -Phase $fixturePhase
            [string[]] $fixtureEnvironmentKeys = @($fixtureStartInfo.Environment.Keys)
            [Array]::Sort($fixtureEnvironmentKeys, [StringComparer]::Ordinal)
            if (($fixtureEnvironmentKeys -join "`n") -cne "SystemRoot`nWINDIR" -or
                [string] $fixtureStartInfo.Environment['SystemRoot'] -cne 'C:\Windows' -or
                [string] $fixtureStartInfo.Environment['WINDIR'] -cne 'C:\Windows') {
                Stop-Capture 'The capture child environment allowlist changed.'
            }
        }
        finally { [Array]::Clear($bytes, 0, $bytes.Length) }
        [Console]::Out.WriteLine(([ordered]@{
            schemaVersion = 'origin.window002.baseline-capture-protected-contract-test.v1'
            result = 'PASS'
            trustModel = $trustModel
            credentialReads = 0
            providerReads = 0
            providerWrites = 0
            filesystemWrites = 0
            childEnvironment = [ordered]@{
                SystemRoot = 'C:\Windows'
                WINDIR = 'C:\Windows'
            }
        } | ConvertTo-Json -Compress))
        return
    }
    catch {
        $message = $_.Exception.Message
        if ($message.StartsWith($safeErrorPrefix, [StringComparison]::Ordinal)) {
            $message = $message.Substring($safeErrorPrefix.Length)
        } else { $message = 'The protected capture contract fixture failed closed.' }
        [Console]::Error.WriteLine('ERROR: {0}', $message)
        exit 1
    }
}

function Assert-WindowsHost {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        Stop-Capture 'Real capture modes require Windows.'
    }
}

function Assert-PlainPath {
    param([string] $LiteralPath, [bool] $Directory, [string] $Label)
    $type = if ($Directory) { 'Container' } else { 'Leaf' }
    if (-not (Test-Path -LiteralPath $LiteralPath -PathType $type)) {
        Stop-Capture "$Label is absent."
    }
    $item = Get-Item -LiteralPath $LiteralPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-Capture "$Label is a reparse point."
    }
    return $item
}

function Assert-RestrictedAclLocal {
    param([string] $LiteralPath, [bool] $Directory, [string] $Label)
    $item = Assert-PlainPath $LiteralPath $Directory $Label
    $current = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = [Security.Principal.SecurityIdentifier]::new(
        [Security.Principal.WellKnownSidType]::LocalSystemSid, $null
    )
    $acl = Get-Acl -LiteralPath $item.FullName
    $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier])
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if (-not $acl.AreAccessRulesProtected -or $owner.Value -cne $current.Value -or $rules.Count -ne 2) {
        Stop-Capture "$Label owner or DACL changed."
    }
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($rule in $rules) {
        $sid = ([Security.Principal.SecurityIdentifier] $rule.IdentityReference).Value
        if (
            $sid -cnotin @($current.Value, $system.Value) -or
            $rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
            $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or
            $rule.IsInherited -or -not $seen.Add($sid)
        ) { Stop-Capture "$Label contains an unreviewed DACL rule." }
    }
    return $item
}

function New-RestrictedAcl {
    param([bool] $Directory)
    $current = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = [Security.Principal.SecurityIdentifier]::new(
        [Security.Principal.WellKnownSidType]::LocalSystemSid, $null
    )
    $acl = if ($Directory) {
        [Security.AccessControl.DirectorySecurity]::new()
    } else { [Security.AccessControl.FileSecurity]::new() }
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($current)
    $inheritance = if ($Directory) {
        [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
            [Security.AccessControl.InheritanceFlags]::ObjectInherit
    } else { [Security.AccessControl.InheritanceFlags]::None }
    foreach ($sid in @($current, $system)) {
        [void] $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid, [Security.AccessControl.FileSystemRights]::FullControl,
            $inheritance, [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        ))
    }
    return $acl
}

function Read-LockedBytes {
    param(
        [Parameter(Mandatory = $true)][IO.FileStream] $Stream,
        [Parameter(Mandatory = $true)][int64] $MaximumBytes,
        [Parameter(Mandatory = $true)][string] $Label
    )
    if (-not $Stream.CanRead -or $Stream.Length -le 0 -or $Stream.Length -gt $MaximumBytes) {
        Stop-Capture "$Label size is invalid."
    }
    $bytes = [byte[]]::new([int] $Stream.Length)
    $originalPosition = $Stream.Position
    try {
        $Stream.Position = 0
        $offset = 0
        while ($offset -lt $bytes.Length) {
            $count = $Stream.Read($bytes, $offset, $bytes.Length - $offset)
            if ($count -le 0) { Stop-Capture "$Label read was short." }
            $offset += $count
        }
        return $bytes
    }
    catch {
        [Array]::Clear($bytes, 0, $bytes.Length)
        throw
    }
    finally { $Stream.Position = $originalPosition }
}

function Import-SealedFunctions {
    param([Parameter(Mandatory = $true)][byte[]] $LegacyHelperBytes)
    if ((Get-Sha256 $LegacyHelperBytes) -cne $expectedLegacyPromotionHelperSha256) {
        Stop-Capture 'The sealed v1 promotion helper digest changed.'
    }
    $helperText = [Text.UTF8Encoding]::new($false, $true).GetString($LegacyHelperBytes)
    $tokens = $null
    $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseInput(
        $helperText, $legacyPromotionHelperPath, [ref] $tokens, [ref] $errors
    )
    if (@($errors).Count -ne 0) { Stop-Capture 'The sealed v1 helper no longer parses.' }
    $wanted = @(
        'Stop-Promotion', 'Assert-PlainFile', 'Assert-PlainDirectory', 'Get-FileSha256',
        'Assert-RestrictedAcl', 'ConvertFrom-CanonicalUtc', 'Assert-NormalVercelCredentials',
        'Get-StageReceipt', 'Assert-DeploymentIdentity'
    )
    $definitions = @($ast.FindAll({
        param($node)
        $node -is [Management.Automation.Language.FunctionDefinitionAst]
    }, $true))
    foreach ($name in $wanted) {
        $match = @($definitions | Where-Object { $_.Name -ceq $name })
        if ($match.Count -ne 1) { Stop-Capture "The sealed function $name is not unique." }
        $body = $match[0].Body.Extent.Text
        Set-Item -Path "Function:script:$name" -Value `
            ([scriptblock]::Create($body.Substring(1, $body.Length - 2)))
    }
}

function Open-ReadLock {
    param([string] $LiteralPath, [string] $Label)
    [void] (Assert-PlainPath $LiteralPath $false $Label)
    return [IO.FileStream]::new(
        $LiteralPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read
    )
}

function Assert-LockedDependencyDigest {
    param(
        [Parameter(Mandatory = $true)][IO.FileStream] $Stream,
        [Parameter(Mandatory = $true)][string] $LiteralPath,
        [Parameter(Mandatory = $true)][string] $ExpectedSha256,
        [Parameter(Mandatory = $true)][string] $Label
    )
    [void] (Assert-PlainPath $LiteralPath $false $Label)
    $bytes = Read-LockedBytes -Stream $Stream -MaximumBytes 2MB -Label $Label
    try {
        if ((Get-Sha256 $bytes) -cne $ExpectedSha256 -or
            (Get-FileDigest $LiteralPath) -cne $ExpectedSha256) {
            Stop-Capture "$Label digest or pathname identity changed."
        }
    }
    finally { [Array]::Clear($bytes, 0, $bytes.Length) }
}

function Open-OutputDirectoryGuard {
    param([string] $DirectoryPath)
    [void] (Assert-RestrictedAclLocal $DirectoryPath $true 'The fixed phase output directory')
    $guardPath = [IO.Path]::Combine($DirectoryPath, $outputGuardFilename)
    $guardBytes = [Text.UTF8Encoding]::new($false).GetBytes(
        'origin-window002-capture-directory-identity-guard-v1'
    )
    $stream = $null
    try {
        $stream = [IO.FileStream]::new(
            $guardPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite,
            [IO.FileShare]::Read
        )
        $stream.Write($guardBytes, 0, $guardBytes.Length)
        $stream.Flush($true)
        Set-Acl -LiteralPath $guardPath -AclObject (New-RestrictedAcl $false)
        [void] (Assert-RestrictedAclLocal $guardPath $false 'The output directory identity guard')
        return $stream
    }
    catch {
        if ($null -ne $stream) { $stream.Dispose() }
        throw
    }
    finally { [Array]::Clear($guardBytes, 0, $guardBytes.Length) }
}

function Invoke-ProviderLookupRaw {
    param([string] $Token, [string] $DeploymentId)
    Add-Type -AssemblyName System.Net.Http
    $pathAndQuery = "/v13/deployments/$DeploymentId`?teamId=$orgId"
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $request = [Net.Http.HttpRequestMessage]::new(
        [Net.Http.HttpMethod]::Get, [Uri]::new("https://api.vercel.com$pathAndQuery")
    )
    $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
    [void] $request.Headers.UserAgent.ParseAdd('origin-window002-protected-capture/2')
    $response = $null
    $stream = $null
    $memory = [IO.MemoryStream]::new()
    $buffer = [byte[]]::new(8192)
    $notBefore = [DateTimeOffset]::UtcNow
    try {
        $client.Timeout = [TimeSpan]::FromSeconds(20)
        $response = $client.SendAsync($request, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        if ([int] $response.StatusCode -ne 200) { Stop-Capture 'The provider lookup did not return HTTP 200.' }
        $length = $response.Content.Headers.ContentLength
        if ($null -ne $length -and [int64] $length -gt $maxProviderBytes) {
            Stop-Capture 'The provider lookup exceeded 5 MiB.'
        }
        $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            if ($memory.Length + $count -gt $maxProviderBytes) {
                Stop-Capture 'The provider lookup exceeded 5 MiB.'
            }
            $memory.Write($buffer, 0, $count)
        }
        $bytes = $memory.ToArray()
        $text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
        return [pscustomobject]@{
            Bytes = $bytes
            Value = $text | ConvertFrom-Json -DateKind String
            Sha256 = Get-Sha256 $bytes
            ByteLength = $bytes.Length
            PathAndQuery = $pathAndQuery
            NotBeforeUtc = $notBefore
            NotAfterUtc = [DateTimeOffset]::UtcNow
        }
    }
    finally {
        [Array]::Clear($buffer, 0, $buffer.Length)
        $memory.Dispose()
        if ($null -ne $stream) { $stream.Dispose() }
        if ($null -ne $response) { $response.Dispose() }
        $request.Dispose()
        $client.Dispose()
        $handler.Dispose()
    }
}

function Write-ExclusiveProtectedBytes {
    param([string] $LiteralPath, [byte[]] $Bytes)
    $stream = [IO.FileStream]::new(
        $LiteralPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite,
        [IO.FileShare]::Read
    )
    try {
        $stream.Write($Bytes, 0, $Bytes.Length)
        $stream.Flush($true)
        Set-Acl -LiteralPath $LiteralPath -AclObject (New-RestrictedAcl $false)
        [void] (Assert-RestrictedAclLocal $LiteralPath $false 'A protected capture artifact')
        $stream.Position = 0
        return $stream
    }
    catch {
        $stream.Dispose()
        throw
    }
}

$locks = [Collections.Generic.List[IDisposable]]::new()
$providerToken = $null
$adminKey = $null
$protectionBypass = $null
$providerBytes = $null
$outputGuardPath = $null
$legacyPromotionHelperBytes = $null
$stageHelperBytes = $null
try {
    Assert-WindowsHost
    [void] (ConvertFrom-MillisecondUtc $ExpectedStartUtc 'expected start')
    [void] (Assert-RestrictedAclLocal $storePath $true 'The protected operator store')
    [void] (Assert-PlainPath $captureScriptPath $false 'The capture tool')
    [void] (Assert-PlainPath $projectorScriptPath $false 'The imported historical projector')
    [void] (Assert-PlainPath $PSCommandPath $false 'The protected capture wrapper')
    [void] (Assert-PlainPath $nodePath $false 'The pinned Node executable')
    [void] (Assert-RestrictedAclLocal $runtimePath $true 'The fixed helper runtime directory')
    [void] (Assert-RestrictedAclLocal $legacyPromotionHelperPath $false 'The sealed v1 promotion helper')
    [void] (Assert-RestrictedAclLocal $stageHelperPath $false 'The reviewed stage helper')
    $legacyPromotionHelperLock = Open-ReadLock $legacyPromotionHelperPath 'The sealed v1 promotion helper'
    $locks.Add($legacyPromotionHelperLock)
    $stageHelperLock = Open-ReadLock $stageHelperPath 'The reviewed stage helper'
    $locks.Add($stageHelperLock)
    $legacyPromotionHelperBytes = Read-LockedBytes `
        -Stream $legacyPromotionHelperLock -MaximumBytes 2MB `
        -Label 'The sealed v1 promotion helper'
    $stageHelperBytes = Read-LockedBytes `
        -Stream $stageHelperLock -MaximumBytes 2MB `
        -Label 'The reviewed stage helper'
    if ((Get-Sha256 $stageHelperBytes) -cne $expectedStageHelperSha256) {
        Stop-Capture 'The reviewed stage helper digest changed.'
    }
    Import-SealedFunctions -LegacyHelperBytes $legacyPromotionHelperBytes

    $phase = if ($Mode -ceq 'StagedCapture') { 'staged' } else { 'pre_rotation' }
    $outputPath = if ($phase -ceq 'staged') { $stagedOutputPath } else { $preOutputPath }
    if (Test-Path -LiteralPath $outputPath) {
        Stop-Capture 'The fixed phase output directory already exists.'
    }
    [void] [IO.Directory]::CreateDirectory($outputPath)
    Set-Acl -LiteralPath $outputPath -AclObject (New-RestrictedAcl $true)
    [void] (Assert-RestrictedAclLocal $outputPath $true 'The fixed phase output directory')
    $outputGuardPath = [IO.Path]::Combine($outputPath, $outputGuardFilename)
    $locks.Add((Open-OutputDirectoryGuard $outputPath))
    $captureScriptLock = Open-ReadLock $captureScriptPath 'The capture tool'
    $locks.Add($captureScriptLock)
    $projectorScriptLock = Open-ReadLock `
        $projectorScriptPath 'The imported historical projector'
    $locks.Add($projectorScriptLock)
    $locks.Add((Open-ReadLock $PSCommandPath 'The protected capture wrapper'))
    $locks.Add((Open-ReadLock $nodePath 'The pinned Node executable'))
    Assert-LockedDependencyDigest -Stream $captureScriptLock `
        -LiteralPath $captureScriptPath -ExpectedSha256 $expectedCaptureScriptSha256 `
        -Label 'The capture tool'
    Assert-LockedDependencyDigest -Stream $projectorScriptLock `
        -LiteralPath $projectorScriptPath -ExpectedSha256 $expectedProjectorScriptSha256 `
        -Label 'The imported historical projector'
    if ((Get-FileDigest $nodePath) -cne $expectedNodeSha256) {
        Stop-Capture 'The pinned Node executable digest changed.'
    }

    $stage = $null
    $stageRaw = $null
    $lookup = $null
    if ($phase -ceq 'staged') {
        [void] (Assert-RestrictedAclLocal $stagePassPath $false 'The fixed stage PASS')
        $locks.Add((Open-ReadLock $stagePassPath 'The fixed stage PASS'))
        $stageRaw = [IO.File]::ReadAllBytes($stagePassPath)
        $stageText = [Text.UTF8Encoding]::new($false, $true).GetString($stageRaw)
        $stageValue = $stageText | ConvertFrom-Json -DateKind String
        Assert-FullStageReceipt -Receipt $stageValue -RawText $stageText
        $stage = Get-StageReceipt
        if ($stage.Sha256 -cne (Get-Sha256 $stageRaw)) {
            Stop-Capture 'The full and sealed v1 stage validators disagree.'
        }
        foreach ($credentialPath in @($vercelConfigJson, $vercelAuthJson)) {
            [void] (Assert-RestrictedAclLocal $credentialPath $false 'A fixed Vercel credential input')
            $locks.Add((Open-ReadLock $credentialPath 'A fixed Vercel credential input'))
        }
        $credentials = Assert-NormalVercelCredentials
        $providerToken = $credentials.Token
        if (Test-ContainsSecret $stageRaw @($providerToken)) {
            Stop-Capture 'The stage receipt contains the provider credential.'
        }
        $lookup = Invoke-ProviderLookupRaw -Token $providerToken -DeploymentId $stage.CandidateId
        $providerBytes = $lookup.Bytes
        $projection = Get-ProviderProjection $lookup.Value
        Assert-ProviderProjection -Deployment $projection -Stage $stageValue
        $lookupPath = [IO.Path]::Combine($outputPath, $providerLookupFilename)
    }

    $stdinText = Read-BoundedStandardInput
    $expectedLineCount = if ($phase -ceq 'staged') { 2 } else { 1 }
    [string[]] $lines = @(ConvertFrom-SecretLines -Text $stdinText -ExpectedCount $expectedLineCount)
    $adminKey = [string] $lines[0]
    $protectionBypass = if ($phase -ceq 'staged') { [string] $lines[1] } else { $null }
    foreach ($bytes in @($stageRaw, $providerBytes)) {
        if ($null -ne $bytes -and (Test-ContainsSecret $bytes @($providerToken, $adminKey, $protectionBypass))) {
            Stop-Capture 'Protected evidence contains credential material.'
        }
    }
    if ($phase -ceq 'staged') {
        $locks.Add((Write-ExclusiveProtectedBytes `
            -LiteralPath $lookupPath -Bytes $providerBytes))
    }
    $bypassFingerprint = if ($null -eq $protectionBypass) { $null } else {
        $secretBytes = [Text.UTF8Encoding]::new($false).GetBytes($protectionBypass)
        try { Get-Sha256 $secretBytes } finally { [Array]::Clear($secretBytes, 0, $secretBytes.Length) }
    }
    $providerProvenance = if ($phase -ceq 'staged') {
        [ordered]@{
            performed = $true
            providerWrites = 0
            method = 'GET'
            apiOrigin = 'https://api.vercel.com'
            pathAndQuery = $lookup.PathAndQuery
            notBeforeUtc = $lookup.NotBeforeUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
            notAfterUtc = $lookup.NotAfterUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
            rawBody = [ordered]@{
                path = $providerLookupFilename
                sha256 = $lookup.Sha256
                byteLength = $lookup.ByteLength
            }
            deployment = $projection
        }
    } else {
        [ordered]@{ performed = $false; providerWrites = 0; reason = 'pre_rotation_exact_public_alias' }
    }
    $wrapperRelativePath = 'measurement/scripts/window002-baseline-capture-protected-v2.ps1'
    $provenance = [ordered]@{
        schemaVersion = 'origin.window002.baseline-capture-provenance.v1'
        trustModel = $trustModel
        phase = $phase
        deploymentProtectionFingerprintSha256 = $bypassFingerprint
        wrapper = [ordered]@{ path = $wrapperRelativePath; sha256 = Get-FileDigest $PSCommandPath }
        fixedPaths = [ordered]@{
            protectedStore = 'OriginProbeOperator'
            stagePass = if ($phase -ceq 'staged') { 'window002-stage-pass.json' } else { $null }
            outputDirectoryName = [IO.Path]::GetFileName($outputPath)
        }
        windowsProtection = [ordered]@{
            ownerVerified = $true; daclVerified = $true; reparseFree = $true; readLocksHeld = $true
        }
        providerLookup = $providerProvenance
    }
    $protectedInput = [ordered]@{
        schemaVersion = 'origin.window002.baseline-capture-protected-input.v1'
        adminKey = $adminKey
        protectionBypass = $protectionBypass
        provenance = $provenance
    } | ConvertTo-Json -Depth 12 -Compress

    $startInfo = New-CaptureChildStartInfo -Phase $phase
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        [void] (Assert-RestrictedAclLocal $outputPath $true 'The fixed phase output directory')
        if (-not $process.Start()) { Stop-Capture 'The capture child did not start.' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write($protectedInput)
        $process.StandardInput.Close()
        $protectedInput = $null
        if (-not $process.WaitForExit(90000)) {
            try { $process.Kill($true) } catch {}
            Stop-Capture 'The capture child timed out.'
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        Assert-LockedDependencyDigest -Stream $captureScriptLock `
            -LiteralPath $captureScriptPath -ExpectedSha256 $expectedCaptureScriptSha256 `
            -Label 'The capture tool'
        Assert-LockedDependencyDigest -Stream $projectorScriptLock `
            -LiteralPath $projectorScriptPath -ExpectedSha256 $expectedProjectorScriptSha256 `
            -Label 'The imported historical projector'
        foreach ($childOutput in @($stdout, $stderr)) {
            if (Test-ContainsSecretText $childOutput @($providerToken, $adminKey, $protectionBypass)) {
                Stop-Capture 'The capture child emitted credential material.'
            }
        }
        if ($process.ExitCode -ne 0) { Stop-Capture 'The capture child failed closed.' }
        [void] (Assert-RestrictedAclLocal $outputPath $true 'The fixed phase output directory')
    }
    finally { $process.Dispose() }

    $expectedFiles = @(
        'read-1-export-all.json', 'read-1-bounded-reduction.json',
        'read-2-export-all.json', 'read-2-bounded-reduction.json',
        'window002-baseline-capture-v2.json'
    )
    if ($phase -ceq 'staged') {
        $expectedFiles += @('staged-deployment-receipt.json', $providerLookupFilename)
    }
    [void] (Assert-RestrictedAclLocal $outputPath $true 'The fixed phase output directory')
    [void] (Assert-RestrictedAclLocal $outputGuardPath $false 'The output directory identity guard')
    [string[]] $actualFiles = @(Get-ChildItem -LiteralPath $outputPath -Force -File |
        Where-Object Name -CNE $outputGuardFilename | ForEach-Object Name)
    [Array]::Sort($actualFiles, [StringComparer]::Ordinal)
    [Array]::Sort($expectedFiles, [StringComparer]::Ordinal)
    if (($actualFiles -join "`n") -cne ($expectedFiles -join "`n")) {
        Stop-Capture 'The protected capture output set changed.'
    }
    foreach ($name in $actualFiles) {
        $artifact = [IO.Path]::Combine($outputPath, $name)
        Set-Acl -LiteralPath $artifact -AclObject (New-RestrictedAcl $false)
        [void] (Assert-RestrictedAclLocal $artifact $false 'A protected capture artifact')
        $artifactBytes = [IO.File]::ReadAllBytes($artifact)
        try {
            if (Test-ContainsSecret $artifactBytes @($providerToken, $adminKey, $protectionBypass)) {
                Stop-Capture 'A protected capture artifact contains credential material.'
            }
        } finally { [Array]::Clear($artifactBytes, 0, $artifactBytes.Length) }
    }
    [void] (Assert-RestrictedAclLocal $outputPath $true 'The fixed phase output directory')
    [Console]::Out.WriteLine(([ordered]@{
        schemaVersion = 'origin.window002.baseline-capture-protected-result.v1'
        result = 'PASS'
        trustModel = $trustModel
        phase = $phase
        serviceActiveRunId = if ($phase -ceq 'staged') { $runId } else { $preRotationRunId }
        outputDirectoryName = [IO.Path]::GetFileName($outputPath)
        providerReads = if ($phase -ceq 'staged') { 1 } else { 0 }
        providerWrites = 0
        wrapperSha256 = Get-FileDigest $PSCommandPath
        captureReceiptSha256 = Get-FileDigest ([IO.Path]::Combine($outputPath, 'window002-baseline-capture-v2.json'))
    } | ConvertTo-Json -Compress))
}
catch {
    $message = $_.Exception.Message
    if ($message.StartsWith($safeErrorPrefix, [StringComparison]::Ordinal)) {
        $message = $message.Substring($safeErrorPrefix.Length)
    } else { $message = 'The protected capture failed closed.' }
    [Console]::Error.WriteLine('ERROR: {0}', $message)
    exit 1
}
finally {
    $providerToken = $null
    $adminKey = $null
    $protectionBypass = $null
    if ($null -ne $providerBytes) { [Array]::Clear($providerBytes, 0, $providerBytes.Length) }
    if ($null -ne $legacyPromotionHelperBytes) {
        [Array]::Clear($legacyPromotionHelperBytes, 0, $legacyPromotionHelperBytes.Length)
    }
    if ($null -ne $stageHelperBytes) {
        [Array]::Clear($stageHelperBytes, 0, $stageHelperBytes.Length)
    }
    foreach ($lock in $locks) { $lock.Dispose() }
    if ($null -ne $outputGuardPath -and (Test-Path -LiteralPath $outputGuardPath -PathType Leaf)) {
        Remove-Item -LiteralPath $outputGuardPath -Force
    }
}
