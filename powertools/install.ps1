param(
  [ValidateSet('Install','Uninstall')][string]$Mode='Install',
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments
)
$ErrorActionPreference='Stop'
$agyCandidates=@()
$agyCommand=Get-Command node -CommandType Application -ErrorAction SilentlyContinue
if($agyCommand){$agyCandidates+=$agyCommand.Source}
$agyAppData=[Environment]::GetFolderPath('ApplicationData')
$agyCandidates+=(Join-Path $agyAppData 'Antigravity/bin/agy-node.cmd')
$agyRuntime=$null
foreach($agyCandidate in $agyCandidates){
  if(-not (Test-Path -LiteralPath $agyCandidate)){continue}
  $agyVersion=& $agyCandidate -p "Number(process.versions.node.split('.')[0])>22||(Number(process.versions.node.split('.')[0])===22&&Number(process.versions.node.split('.')[1])>=13)" 2>$null
  if($LASTEXITCODE -eq 0 -and "$agyVersion".Trim() -eq 'true'){$agyRuntime=$agyCandidate;break}
}
if(-not $agyRuntime){throw '未找到可用的 Node.js。请安装 Node.js 22.13 或更高版本，或先启动 Antigravity。'}
$agyScript=if($Mode -eq 'Uninstall'){'scripts/uninstall.mjs'}else{'scripts/install.mjs'}
& $agyRuntime (Join-Path $PSScriptRoot $agyScript) @Arguments
exit $LASTEXITCODE
