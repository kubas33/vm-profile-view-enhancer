#!/usr/bin/env node

'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var profileRedesign = require('../vm-profile-redesign.user.js');

var root = path.resolve(__dirname, '..');
var profileFixture = fs.readFileSync(path.join(root, 'raw_data', 'profile-page.md'), 'utf8');
var profileHtml = profileRedesign.extractVmBody(profileFixture);
var profile = profileRedesign.parseProfileFromHtml(profileHtml);

assert.ok(profile, 'expected profile fixture to parse');
assert.strictEqual(profile.playerId, '2004221', 'expected player id');
assert.strictEqual(profile.name, 'Wasyliszyn, Franciszek', 'expected player name');
assert.strictEqual(profile.club, 'AKS Andrut Kalisz 🧇', 'expected club name');
assert.strictEqual(profile.age, 20, 'expected player age');
assert.strictEqual(profile.position, 'Środkowy', 'expected player position');
assert.strictEqual(profile.flagSrc, 'pic/flag/POL.gif', 'expected flag path');
assert.strictEqual(profile.avatarSrc, 'pic/player/non.gif', 'expected avatar path');
assert.strictEqual(profile.attributes.length, 18, 'expected advanced profile attributes');
assert.strictEqual(profile.attributeColumns.length, 2, 'expected two attribute columns');
assert.strictEqual(profile.attributeColumns[0].length, 9, 'expected left attribute column');
assert.strictEqual(profile.attributeColumns[1].length, 9, 'expected right attribute column');
assert.strictEqual(profile.attributes[0].name, 'Serwis', 'expected original attribute order');
assert.strictEqual(profile.attributes[0].value, 9.4, 'expected serve value');
assert.strictEqual(profile.attributes[3].name, 'Atak ze środka', 'expected original middle attack position');
assert.strictEqual(profile.attributes[3].value, 31.7, 'expected middle attack value');
assert.strictEqual(profile.attributes[14].name, 'Ustawianie się do bloku', 'expected original block positioning position');
assert.strictEqual(profile.attributes[14].value, 43.9, 'expected block positioning value');
assert.strictEqual(profile.attributes[15].name, 'Blok', 'expected original block position');
assert.strictEqual(profile.attributes[15].value, 45.5, 'expected block value');
assert.strictEqual(profile.actions.sellInputValue, '80039', 'expected sell input value');
assert.strictEqual(profile.sideInfo.selectedViewLabel, 'Rozszerzony', 'expected selected view label in text parser');
assert.strictEqual(profile.sideInfo.commissions[0], '2% dla pośrednika sprzedaży', 'expected clean commission text');
assert.strictEqual(Number(profile.summary.primaryAverage.toFixed(1)), 37.9, 'expected primary average');
assert.strictEqual(Number(profile.summary.secondaryAverage.toFixed(1)), 19.9, 'expected secondary average');
assert.strictEqual(Number(profile.summary.fit.toFixed(1)), 67.9, 'expected fit value');

console.log('profile redesign parser ok: ' + profile.attributes.length + ' attributes matched');
