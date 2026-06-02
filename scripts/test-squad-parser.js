#!/usr/bin/env node

'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var squadEnhancer = require('../vm-squad-view-enhancer.user.js');

var root = path.resolve(__dirname, '..');
var trainingFixture = fs.readFileSync(path.join(root, 'raw_data', 'training-panel.md'), 'utf8');
var trainingHtml = squadEnhancer.extractVmBody(trainingFixture);
var squadIds = squadEnhancer.parseSquadPlayerIdsFromHtml(trainingHtml);
var trainingPercentMap = squadEnhancer.parseTrainingPercentMapFromHtml(trainingHtml);
var trainingPlayerData = squadEnhancer.parseTrainingPlayerDataFromHtml(trainingHtml);
var manso = trainingPlayerData['2060721'];
var missingSummary = squadEnhancer.calculateSummary('Atakujący', {
  Blok: 34.9,
  Obrona: 30.1
});

assert.strictEqual(squadIds.length, 24, 'expected 24 squad players in fixture');
assert.strictEqual(Object.keys(trainingPercentMap).length, 24, 'expected 24 training rows in fixture');
assert.strictEqual(Object.keys(trainingPlayerData).length, 24, 'expected 24 training player data rows in fixture');
assert.strictEqual(trainingPercentMap['2060721'], 94, 'expected Manso training progress');
assert.strictEqual(trainingPercentMap['1976867'], 27, 'expected Caple training progress');
assert.strictEqual(trainingPercentMap['2088564'], 0, 'expected Zagalo training progress');
assert.strictEqual(manso.trainingPercent, 94, 'expected Manso training progress in player data');
assert.strictEqual(manso.position, 'Atakujący', 'expected Manso position');
assert.strictEqual(manso.attributes.Blok, 34.9, 'expected Manso block value');
assert.strictEqual(manso.attributes['Ustawianie się do bloku'], 38.8, 'expected Manso block positioning value');
assert.strictEqual(manso.attributes.Obrona, 30.1, 'expected Manso defense value');
assert.strictEqual(manso.attributes.Asekuracja, 30.0, 'expected Manso cover value');
assert.strictEqual(Number(manso.fitSummary.fit.toFixed(4)), 61.9802, 'expected Manso fit value');
assert.strictEqual(missingSummary.fit, null, 'expected incomplete primary attributes to return missing fit');

squadIds.forEach(function (playerId) {
  assert.ok(
    Object.prototype.hasOwnProperty.call(trainingPercentMap, playerId),
    'missing training progress for playerId=' + playerId
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(trainingPlayerData, playerId),
    'missing training player data for playerId=' + playerId
  );
});

console.log('squad parser ok: ' + squadIds.length + ' players matched');
