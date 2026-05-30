# Setup: Tägliche 18:00 Push-Benachrichtigung

## 1. Supabase CLI installieren
```
npm install -g supabase
supabase login
```

## 2. Edge Function deployen
```
cd C:\ClaudeProjects\wm2026-tippspiel
supabase link --project-ref zewalniirmsuclbcdrlv
supabase functions deploy daily-reminder
```

## 3. Umgebungsvariablen setzen (Supabase Dashboard → Settings → Edge Functions → Secrets)
```
ONESIGNAL_APP_ID      = deine-onesignal-app-id
ONESIGNAL_API_KEY     = dein-onesignal-rest-api-key  (OneSignal → Settings → Keys & IDs → REST API Key)
SUPABASE_URL          = https://zewalniirmsuclbcdrlv.supabase.co
SUPABASE_SERVICE_ROLE_KEY = dein-service-role-key
```

## 4. Cron-Job einrichten (Supabase Dashboard → Database → Extensions → pg_cron aktivieren)
Dann im SQL-Editor:
```sql
select cron.schedule(
  'daily-reminder-18uhr',
  '0 16 * * *',   -- 16:00 UTC = 18:00 MESZ
  $$
  select net.http_post(
    url := 'https://zewalniirmsuclbcdrlv.supabase.co/functions/v1/daily-reminder',
    headers := '{"Authorization": "Bearer DEIN_ANON_KEY"}'::jsonb
  )
  $$
);
```

## 5. OneSignal einrichten
- onesignal.com → New App → Web Push → deine GitHub Pages URL eintragen
- App ID in die index.html eintragen (Setup-Banner)
- Spieler müssen einmal auf der Seite "Push aktivieren" klicken
