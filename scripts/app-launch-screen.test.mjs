import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/components/app-launch-screen.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

async function scenario({ slow = false, imageError = false } = {}) {
  let now = 0, id = 0, pageReady = !slow, artworkReady = !imageError;
  let effect, cleanup;
  const frames = new Map(), timers = new Map(), events = new Map();
  const progress = [], phases = [];
  let stateIndex = 0;
  const root = { querySelector: selector => selector === "[data-app-loading]" ? (pageReady ? null : {}) : {} };
  const image = { complete: artworkReady, addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  const module = { exports: {} };
  const context = {
    exports: module.exports, module,
    require(name) {
      if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null, Fragment: "fragment" };
      if (name === "react") return {
        useRef: () => ({ current: root }), useEffect: fn => { effect = fn; },
        useState: initial => { const index = stateIndex++; return [initial, value => (index === 0 ? progress : phases).push(value)]; },
      };
      throw new Error(name);
    },
    performance: { now: () => now },
    document: { querySelector: () => image, fonts: { ready: Promise.resolve() } },
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: key => frames.delete(key),
    window: { setTimeout: (fn, delay) => { timers.set(++id, { fn, due: now + delay }); return id; } },
    clearTimeout: key => timers.delete(key),
  };
  context.window.clearTimeout = context.clearTimeout;
  vm.runInNewContext(source, context);
  module.exports.AppLaunchScreen({ children: null });
  cleanup = effect();
  await Promise.resolve();
  const advance = target => {
    for (; now <= target; now += 20) {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now));
      for (const [key, timer] of timers) if (timer.due <= now) { timers.delete(key); timer.fn(); }
    }
  };
  advance(1480);
  assert.equal(phases.length, 0, "never dismiss before 1.5 seconds");
  if (slow || imageError) {
    advance(5000);
    assert.equal(phases.length, 0, "slow page or artwork stays covered");
    assert.ok(progress.every(value => value < 100));
    pageReady = true;
    if (imageError) events.get("error")();
  }
  advance(now + 500);
  assert.deepEqual(phases, ["leaving", "done"]);
  assert.equal(progress.at(-1), 100);
  assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]), "progress never goes backwards");
  assert.equal(frames.size, 0, "stops polling after completion");
  cleanup();
  assert.equal(events.size, 0, "cleans up listeners");
}

await scenario();
await scenario({ slow: true });
await scenario({ imageError: true });
console.log("PASS: fast launch, slow data, failed artwork, minimum duration, monotonic progress, cleanup");
