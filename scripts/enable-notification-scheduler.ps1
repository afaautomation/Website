# Run only when ready to dispatch opted-in pending notifications.
# The worker secret stays in temporary files and Supabase Vault, never stdout.
$ErrorActionPreference = 'Stop'
$projectRef = 'xgnluardsgflfxttvgwc'
$temporaryPrefix = Join-Path ([IO.Path]::GetTempPath()) ('kompetenzen-mail-' + [guid]::NewGuid().ToString('N'))
$envFile = $temporaryPrefix + '.env'
$sqlFile = $temporaryPrefix + '.sql'
$logFile = $temporaryPrefix + '.log'
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$workerSecret = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
try {
    [IO.File]::WriteAllText($envFile, "NOTIFICATION_WORKER_SECRET=$workerSecret")
    $ErrorActionPreference = 'Continue'
    & npx --yes supabase secrets set --env-file $envFile --project-ref $projectRef *> $logFile
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure worker authentication; scheduler was not enabled.' }
    $sql = @"
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do `$setup`$
declare existing_id uuid;
begin
  select id into existing_id from vault.secrets where name='notification_worker_secret';
  if existing_id is null then
    perform vault.create_secret('$workerSecret','notification_worker_secret','Background notification worker authentication');
  else
    perform vault.update_secret(existing_id,'$workerSecret');
  end if;
end;
`$setup`$;
select cron.schedule('kompetenzen-notification-worker','* * * * *',
  `$job`$select net.http_post(
    url := 'https://$projectRef.supabase.co/functions/v1/notification-worker',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='notification_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );`$job`$);
commit;
"@
    [IO.File]::WriteAllText($sqlFile, $sql)
    $ErrorActionPreference = 'Continue'
    & npx --yes supabase db query --linked --project-ref $projectRef --file $sqlFile --output-format json *> $logFile
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) {
        $safeLog = [IO.File]::ReadAllText($logFile).Replace($workerSecret, '[REDACTED]')
        throw ("Could not enable scheduler: " + $safeLog)
    }
    Write-Output 'Notification scheduler enabled: every minute. Worker secret stored in Vault.'
} finally {
    foreach ($temporaryFile in @($envFile, $sqlFile, $logFile)) {
        if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force }
    }
}
