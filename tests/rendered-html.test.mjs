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

test("keeps the new training capabilities in separate modules", async () => {
  const [midi, audio, trainer, app, flow, history, settings, css, packageJson] =
    await Promise.all([
    readFile(new URL("../app/hooks/useMidi.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/audioEngine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trainers/noteReading.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PracticeApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FlowStaff.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/sessionHistory.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SettingsMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(midi, /requestMIDIAccess/);
  assert.match(midi, /command === 0x90/);
  assert.match(midi, /command === 0x80/);
  assert.match(audio, /AudioContext/);
  assert.match(audio, /oscillator\.frequency/);
  assert.match(audio, /setVolume/);
  assert.match(trainer, /createQuestion/);
  assert.match(trainer, /isCorrect/);
  assert.match(app, /nextAttempt === 2/);
  assert.match(app, /MIN_FLOW_DURATION/);
  assert.match(app, /MAX_FLOW_DURATION/);
  assert.match(app, /delay:\s*480/);
  assert.match(flow, /requestAnimationFrame/);
  assert.match(flow, /onTimeout/);
  assert.match(history, /localStorage/);
  assert.match(settings, /Чтение на скорость/);
  assert.match(settings, /Громкость/);
  assert.match(css, /html\[data-theme="light"\]/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(
    access(new URL("../app/_sites-preview/", import.meta.url)),
  );
});
