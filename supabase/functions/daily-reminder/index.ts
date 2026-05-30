// Supabase Edge Function: daily-reminder
// Läuft täglich um 18:00 Uhr (Europe/Berlin) via pg_cron
// Schickt OneSignal Push an alle Spieler die noch nicht getippt haben

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ONESIGNAL_APP_ID  = Deno.env.get("ONESIGNAL_APP_ID")  ?? "";
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY") ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")       ?? "";
const SUPABASE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const PLAYERS = [
  "Alexander","Axel","Bastian","Christian","Klaus","Lars",
  "Maik","Matthias","Michael","Roland","Sabine","Steffen","Thomas","Usman"
];

// Alle WM+DFB Spiele (IDs + Datum + Uhrzeit) — muss mit index.html synchron sein
const GAMES: {id:number, date:string, time:string, home:string, away:string}[] = [
  {id:201,date:"2026-05-31",time:"18:45",home:"Deutschland",away:"Finnland"},
  {id:202,date:"2026-06-06",time:"18:30",home:"USA",away:"Deutschland"},
  {id:1,date:"2026-06-11",time:"21:00",home:"Mexiko",away:"Ecuador"},
  {id:2,date:"2026-06-12",time:"00:00",home:"USA",away:"Kanada"},
  {id:3,date:"2026-06-12",time:"21:00",home:"Uruguay",away:"Kenia"},
  {id:4,date:"2026-06-13",time:"00:00",home:"Deutschland",away:"Japan"},
  {id:5,date:"2026-06-13",time:"03:00",home:"Spanien",away:"Bahrain"},
  {id:6,date:"2026-06-13",time:"21:00",home:"Frankreich",away:"Kolumbien"},
  {id:7,date:"2026-06-14",time:"00:00",home:"Brasilien",away:"Kamerun"},
  {id:8,date:"2026-06-14",time:"03:00",home:"England",away:"Serbien"},
  {id:9,date:"2026-06-14",time:"21:00",home:"Portugal",away:"Angola"},
  {id:10,date:"2026-06-15",time:"00:00",home:"Argentinien",away:"Irak"},
  {id:11,date:"2026-06-15",time:"03:00",home:"Panama",away:"Neuseeland"},
  {id:12,date:"2026-06-15",time:"21:00",home:"Niederlande",away:"Senegal"},
  {id:43,date:"2026-06-25",time:"21:00",home:"Deutschland",away:"Australien"},
  {id:61,date:"2026-06-21",time:"00:00",home:"Deutschland",away:"Guinea"},
  // Weitere Spiele hier ergänzen falls nötig
];

Deno.serve(async (req) => {
  // Nur POST von Supabase Cron oder manuell
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const now = new Date();

  // Spiele der nächsten 24 Stunden finden
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const upcoming = GAMES.filter(g => {
    const [h, m] = g.time.split(":").map(Number);
    const ko = new Date(`${g.date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`);
    return ko > now && ko < in24h;
  });

  if (upcoming.length === 0) {
    return new Response(JSON.stringify({ message: "Keine Spiele in den nächsten 24h" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Vorhandene Tipps laden
  const gameIds = upcoming.map(g => g.id);
  const { data: tips } = await supabase
    .from("tips")
    .select("player, game_id")
    .in("game_id", gameIds);

  const tipped = new Set((tips ?? []).map((t: any) => `${t.player}_${t.game_id}`));

  const results: string[] = [];

  for (const player of PLAYERS) {
    const missing = upcoming.filter(g => !tipped.has(`${player}_${g.id}`));
    if (missing.length === 0) continue;

    const gameNames = missing.map(g => `${g.home} vs ${g.away}`).join(", ");
    const body = `${missing.length} Spiel${missing.length > 1 ? "e" : ""} ohne Tipp: ${gameNames}`;

    // OneSignal Push an Spieler mit Tag player=NAME
    const pushRes = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        filters: [{ field: "tag", key: "player", relation: "=", value: player }],
        headings: { de: "⏰ WM 2026 Tippspiel — " + player },
        contents: { de: body },
        url: "https://mbclaude.github.io/wm2026-tippspiel/",
      }),
    });

    const pushData = await pushRes.json();
    results.push(`${player}: ${pushData.id ? "✓ gesendet" : "✗ " + JSON.stringify(pushData.errors)}`);
  }

  return new Response(JSON.stringify({ sent: results }), {
    headers: { "Content-Type": "application/json" }
  });
});
