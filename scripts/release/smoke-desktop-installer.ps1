param(
  [Parameter(Mandatory = $true)]
  [string] $SetupPath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class NativeWindow {
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr window);
}
'@

function Get-ProcessTreeIds([int] $RootProcessId) {
  $processes = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
  $ids = [System.Collections.Generic.HashSet[int]]::new()
  [void] $ids.Add($RootProcessId)
  do {
    $added = $false
    foreach ($candidate in $processes) {
      if ($ids.Contains([int] $candidate.ParentProcessId) -and $ids.Add([int] $candidate.ProcessId)) {
        $added = $true
      }
    }
  } while ($added)
  return @($ids)
}

$setup = Resolve-Path $SetupPath
$workingRoot = Join-Path $env:TEMP "mineko-herness-installer-smoke-$([Guid]::NewGuid().ToString('N'))"
# Keep the NSIS /D value free of spaces: NSIS treats it as one unquoted option.
# The product identity itself is verified separately through the installed exe,
# archive, window title, and shortcut metadata.
$installRoot = Join-Path $workingRoot 'install'
$runtimeRoot = Join-Path $workingRoot 'home'
$applicationProcess = $null

try {
  $install = Start-Process -FilePath $setup -ArgumentList @('/S', "/D=$installRoot") -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "NSIS installer exited with code $($install.ExitCode)."
  }

  # Keep this aligned with win.executableName in electron-builder.yml. The
  # product name is user-facing; the executable identity is intentionally
  # the compact taskbar-safe MiNekoHerness name.
  $application = Join-Path $installRoot 'MiNekoHerness.exe'
  $asar = Join-Path $installRoot 'resources/app.asar'
  $uninstallers = @(Get-ChildItem -LiteralPath $installRoot -File -Filter 'Uninstall*.exe')
  if (!(Test-Path -LiteralPath $application -PathType Leaf)) {
    throw "Installed application is missing: $application"
  }
  if (!(Test-Path -LiteralPath $asar -PathType Leaf)) {
    throw "Installed application archive is missing: $asar"
  }
  if ($uninstallers.Count -ne 1) {
    throw "Expected exactly one uninstaller, found $($uninstallers.Count)."
  }

  $env:MNH_HOME = $runtimeRoot
  $env:MNH_TELEMETRY_DISABLED = '1'
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  $applicationProcess = Start-Process -FilePath $application -WorkingDirectory $installRoot -PassThru
  $readyDeadline = [DateTime]::UtcNow.AddSeconds(45)
  $composer = $null
  do {
    Start-Sleep -Milliseconds 250
    $applicationProcess.Refresh()
    if ($applicationProcess.HasExited) {
      throw "Installed desktop exited before becoming ready with code $($applicationProcess.ExitCode)."
    }
    $window = $applicationProcess.MainWindowHandle
    if ($window -eq 0 -or ![NativeWindow]::IsWindowVisible($window) -or
      !$applicationProcess.Responding -or $applicationProcess.MainWindowTitle -ne 'MiNeko Herness') {
      continue
    }
    try {
      $automationRoot = [System.Windows.Automation.AutomationElement]::FromHandle($window)
      $editCondition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Edit
      )
      $composer = $automationRoot.FindFirst(
        [System.Windows.Automation.TreeScope]::Descendants,
        $editCondition
      )
    } catch [System.Windows.Automation.ElementNotAvailableException] {
      $composer = $null
    }
  } while ($null -eq $composer -and [DateTime]::UtcNow -lt $readyDeadline)
  if ($null -eq $composer) {
    throw 'Installed desktop did not expose its ready composer within 45 seconds.'
  }

  for ($sample = 0; $sample -lt 4; $sample += 1) {
    $treeIds = @(Get-ProcessTreeIds $applicationProcess.Id)
    $listeners = @(Get-NetTCPConnection -State Listen | Where-Object {
      $treeIds -contains [int] $_.OwningProcess
    })
    if ($listeners.Count -ne 0) {
      $details = $listeners |
        Select-Object LocalAddress, LocalPort, OwningProcess |
        Format-Table -AutoSize |
        Out-String
      throw "Installed desktop process tree opened TCP listener(s):`n$details"
    }
    Start-Sleep -Milliseconds 500
  }

  if (!$applicationProcess.CloseMainWindow()) {
    throw 'Installed desktop refused a normal main-window close request.'
  }
  if (!$applicationProcess.WaitForExit(15000)) {
    throw 'Installed desktop did not exit within 15 seconds after closing its main window.'
  }
  if ($applicationProcess.ExitCode -ne 0) {
    throw "Installed desktop exited with code $($applicationProcess.ExitCode)."
  }
  $applicationProcess = $null

  $uninstall = Start-Process -FilePath $uninstallers[0].FullName -ArgumentList '/S' -Wait -PassThru
  if ($uninstall.ExitCode -ne 0) {
    throw "NSIS uninstaller exited with code $($uninstall.ExitCode)."
  }
  if ((Test-Path -LiteralPath $application) -or (Test-Path -LiteralPath $asar)) {
    throw 'NSIS uninstaller left application files behind.'
  }
  if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot 'desktop') -PathType Container)) {
    throw 'NSIS uninstaller removed MiNeko Herness user data.'
  }

  Write-Host 'Desktop installer smoke passed: install, launch, zero listeners, normal exit, uninstall, and user-data retention.'
} finally {
  if ($null -ne $applicationProcess) {
    $applicationProcess.Refresh()
    if (!$applicationProcess.HasExited) {
      $treeIds = @(Get-ProcessTreeIds $applicationProcess.Id)
      Stop-Process -Id $treeIds -Force -ErrorAction SilentlyContinue
    }
  }
}
