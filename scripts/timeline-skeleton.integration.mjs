import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire, Module } from 'node:module';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const file = resolve('src/components/timeline-skeleton.tsx');
const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
const module = new Module(file); module.filename = file; module.paths = Module._nodeModulePaths(resolve('src/components')); module.require = createRequire(file); module._compile(compiled, file);
const markup = renderToStaticMarkup(React.createElement(module.exports.TimelineRouteLoading));
const browser = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'timeline-loading', ...args], { encoding: 'utf8', timeout: 45000 });
const evaluate = code => JSON.parse(browser('eval', code));
try {
  browser('open', 'http://localhost:8001'); browser('wait', 'body');
  evaluate(`document.body.innerHTML=${JSON.stringify(markup)};true`);
  for (const theme of ['light', 'dark']) {
    evaluate(`document.documentElement.classList.toggle('dark',${theme === 'dark'});true`);
    for (const width of [320, 390, 768]) {
      browser('set', 'viewport', String(width), '844');
      assert.equal(evaluate(`document.querySelectorAll('.timeline-skeleton-nav > div').length`), 5);
      assert.equal(evaluate(`document.querySelectorAll('.timeline-skeleton-days > span').length`), 5);
      assert(evaluate(`document.documentElement.scrollWidth<=innerWidth+1`));
      assert(evaluate(`document.querySelector('.trip-detail-image-frame').getBoundingClientRect().height>=280`));
      assert(evaluate(`document.querySelector('.timeline-skeleton').getAttribute('aria-busy')==='true'`));
      if (width === 390) browser('screenshot', `/tmp/timeline-skeleton-${theme}.png`);
    }
  }
  for (const path of ['app/trips/[id]/loading.tsx', 'app/trips/[id]/itinerary/loading.tsx']) assert.match(readFileSync(path, 'utf8'), /TimelineRouteLoading/);
  assert.match(readFileSync('src/components/bn-trip-app.tsx', 'utf8'), /page === "trip" \|\| page === "timeline" \? <TimelineSkeleton/);
  console.log('PASS shared route/client skeleton, cover dimensions, five tabs/day placeholders, accessible busy state, light/dark and responsive bounds');
} finally { browser('close'); }
