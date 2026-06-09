#!/usr/bin/env node

'use strict';

var assert = require('assert');
var rules = require('../vm-position-rules.js');

assert.strictEqual(rules.normalizePosition('At'), 'Atakujący', 'expected At short name normalization');
assert.strictEqual(rules.normalizePosition('Środkowy'), 'Środkowy', 'expected full position name to pass through');
assert.strictEqual(rules.getImportance('At', 'Blok'), 'primary', 'expected Blok primary for attacker');
assert.strictEqual(rules.getImportance('Libero', 'Serwis'), 'none', 'expected Serwis not important for libero');

var attributes = {
  UM_PRZYJECIE: 16,
  UM_OBRONA: 30.5,
  UM_ASEKURACJA: 12,
  UM_BLOK_AKTYWNY: 8.4,
  UM_SERWIS: 13.7,
};

var recommended = rules.getRecommendedTrainableSkills('Przyjmujący', attributes);

assert.deepStrictEqual(
  recommended.map(function (skill) { return skill.code; }),
  ['UM_PRZYJECIE', 'UM_ASEKURACJA', 'UM_BLOK_AKTYWNY', 'UM_SERWIS'],
  'expected primary then secondary trainable skills in position order'
);
assert.ok(
  recommended.every(function (skill) { return skill.level < 30.5; }),
  'recommended skills should be trainable only'
);

assert.deepStrictEqual(
  rules.getRecommendedTrainableSkills('Nieznana', attributes),
  [],
  'unknown position should return empty list'
);

assert.deepStrictEqual(
  rules.getRecommendedTrainableSkills('Libero', { UM_OBRONA: 30.5, UM_ASEKURACJA: 30.5, UM_PRZYJECIE: 30.5 }),
  [],
  'all skills at max should return empty list'
);

console.log('vm-position-rules: all tests passed');
