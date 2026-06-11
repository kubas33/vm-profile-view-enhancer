#!/usr/bin/env node

'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var enhancer = require('../vm-individual-tactics-enhancer.user.js');

var root = path.resolve(__dirname, '..');
var fixture = fs.readFileSync(path.join(root, 'raw_data', 'individual-tactics-view.md'), 'utf8');
var html = enhancer.extractVmBody(fixture);
var view = enhancer.parseIndividualViewFromHtml(html);
var capleRow = view.rows.find(function (row) {
  return row.playerId === '1976867';
});
var cimirotRow = view.rows.find(function (row) {
  return row.playerId === '1974424';
});

assert.ok(html.indexOf('IndividualSave') !== -1, 'expected individual tactics html');
assert.strictEqual(view.scenarioOpt, 'Squad&opt=atk1b1l', 'expected selected scenario opt');
assert.strictEqual(enhancer.getViewType(view), 'attack', 'expected attack view type');
assert.deepStrictEqual(
  view.columns.map(function (column) {
    return column.field;
  }),
  ['atak', 'kiwka', 'out'],
  'expected attack column fields'
);
assert.strictEqual(view.rows.length, 2, 'expected two player rows in fixture');
assert.ok(capleRow, 'expected Caple row');
assert.strictEqual(capleRow.fields.atak.value, 1, 'expected Caple normal attack value');

var defenseFixture = fs.readFileSync(path.join(root, 'raw_data', 'individual-tactics-defense-view.md'), 'utf8');
var defenseView = enhancer.parseIndividualViewFromHtml(enhancer.extractVmBody(defenseFixture));

assert.strictEqual(enhancer.getViewType(defenseView), 'defense', 'expected defense view type');
assert.strictEqual(defenseView.columns.length, 2, 'expected two defense columns');
assert.strictEqual(enhancer.buildPresetActions(defenseView, null, null).length, 2, 'expected two defense presets');

var serveFixture = fs.readFileSync(path.join(root, 'raw_data', 'individual-tactics-serve-view.md'), 'utf8');
var serveView = enhancer.parseIndividualViewFromHtml(enhancer.extractVmBody(serveFixture));

assert.strictEqual(enhancer.getViewType(serveView), 'serve', 'expected serve view type');
assert.strictEqual(serveView.columns.length, 4, 'expected four serve columns');
assert.strictEqual(enhancer.getPresetColumns(serveView).length, 3, 'expected three preset columns without power');
assert.strictEqual(enhancer.buildPresetActions(serveView, null, null).length, 3, 'expected three serve presets');
assert.strictEqual(enhancer.SERVE_GLOBAL_PRESETS[0].values.join('/'), '8/1/1', 'expected first serve preset values');

console.log('individual tactics parser ok');
