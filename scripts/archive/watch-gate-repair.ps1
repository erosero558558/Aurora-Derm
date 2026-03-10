$ErrorActionPreference = 'Stop'
$repo = 'erosero558558/piel-en-armonia'
$runId = 22282547130
for($i=1; $i -le 50; $i++) {
  $gateResp = Invoke-WebRequest -UseBasicParsing -Uri "https://api.github.com/repos/$repo/actions/runs/$runId" -Headers @{ 'User-Agent'='codex-bg'; 'Accept'='application/vnd.github+json' }
  $gate = $gateResp.Content | ConvertFrom-Json
  Write-Output ("{0} gate status={1} conclusion={2}" -f (Get-Date -Format o), $gate.status, $gate.conclusion)
  if ($gate.status -eq 'completed') {
    $repairResp = Invoke-WebRequest -UseBasicParsing -Uri "https://api.github.com/repos/$repo/actions/workflows/repair-git-sync.yml/runs?per_page=3" -Headers @{ 'User-Agent'='codex-bg'; 'Accept'='application/vnd.github+json' }
    $repair = ($repairResp.Content | ConvertFrom-Json).workflow_runs | Select-Object -First 1
    if ($null -ne $repair) {
      Write-Output ("{0} repair latest: id={1} status={2} conclusion={3} head={4} url={5}" -f (Get-Date -Format o), $repair.id, $repair.status, $repair.conclusion, $repair.head_sha.Substring(0,7), $repair.html_url)
    } else {
      Write-Output ("{0} repair latest: none" -f (Get-Date -Format o))
    }
    break
  }
  Start-Sleep -Seconds 20
}
