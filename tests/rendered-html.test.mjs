import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Notewise practice shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Notewise — MIDI-тренажёр нот<\/title>/i);
  assert.match(html, /notewise/i);
  assert.match(html, /Чтение нот/);
  assert.match(html, /Сессии/);
  assert.match(html, /Точность/);
  assert.match(html, /Подключить MIDI|Ищем MIDI/);
  assert.match(html, /Экранная клавиатура/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps the training capabilities in separate modules", async () => {
  const [midi, audio, trainer, app, flow, freePlay, placement, history, settings, notation, launcher, css, packageJson] =
    await Promise.all([
    readFile(new URL("../app/hooks/useMidi.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/audioEngine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trainers/noteReading.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PracticeApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FlowStaff.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FreePlayStaff.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PlacementStaff.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sessionHistory.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SettingsMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/drawNotation.ts", import.meta.url), "utf8"),
    readFile(new URL("../notewise-local.bat", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(midi, /requestMIDIAccess/);
  assert.match(midi, /command === 0x90/);
  assert.match(midi, /command === 0x80/);
  assert.match(midi, /selectedInputId/);
  assert.match(midi, /setDevices/);
  assert.match(audio, /AudioContext/);
  assert.match(audio, /oscillator\.frequency/);
  assert.match(audio, /setVolume/);
  assert.match(audio, /pendingNotes/);
  assert.match(audio, /metronomeTick/);
  assert.match(trainer, /createQuestion/);
  assert.match(trainer, /isCorrect/);
  assert.match(trainer, /KEY_SIGNATURES/);
  assert.match(trainer, /displayAccidental/);
  assert.match(app, /nextAttempt === 2/);
  assert.match(app, /MIN_FLOW_BPM/);
  assert.match(app, /MIN_FLOW_BPM = 1/);
  assert.match(app, /MAX_FLOW_BPM/);
  assert.match(app, /adaptiveFlowBpm/);
  assert.match(app, /recognitionTotalMs/);
  assert.match(app, /event\.code === "KeyT"/);
  assert.match(app, /tool === "training"/);
  assert.match(app, /flowWindowRef\.current\.length === 5/);
  assert.match(app, /hydratedRef\.current/);
  assert.match(app, /delay:\s*480/);
  assert.match(flow, /requestAnimationFrame/);
  assert.match(flow, /onTimeout/);
  assert.match(flow, /questions\.slice\(0, 5\)/);
  assert.doesNotMatch(flow, /const settled/);
  assert.match(freePlay, /PlayedNote/);
  assert.match(freePlay, /requestAnimationFrame/);
  assert.match(placement, /getDiatonicIndexAtY/);
  assert.match(placement, /onPointerMove/);
  assert.match(history, /localStorage/);
  assert.match(history, /MAX_SESSIONS = 20/);
  assert.match(history, /notewise\.session-count\.v1/);
  assert.match(settings, /Чтение на скорость/);
  assert.match(settings, /Расстановка нот/);
  assert.match(settings, /Фиксированный BPM/);
  assert.match(settings, /min="1" max="200" step="1"/);
  assert.match(settings, /Свободный режим/);
  assert.match(settings, /Громкость/);
  assert.match(settings, /<select/);
  assert.match(settings, /Альтерации вне тональности/);
  assert.match(settings, /MIDI-вход/);
  assert.match(notation, /KEY_SIGNATURES/);
  assert.match(notation, /displayAccidental/);
  assert.match(launcher, /3000\.\.3010/);
  assert.match(launcher, /PORT_FILE/);
  assert.match(css, /html\[data-theme="light"\]/);
  assert.match(css, /scrollbar-color/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(
    access(new URL("../app/_sites-preview/", import.meta.url)),
  );
});
