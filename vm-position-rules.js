// ==UserScript==
// @name         VM Position Rules
// @namespace    https://vm-manager.org/
// @version      1.0.0
// @description  Shared position-to-attribute rules and label/code mappings for VM Manager enhancers.
// @grant        none
// @run-at       document-start
// @updateURL    https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-position-rules.js
// @downloadURL  https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-position-rules.js
// ==/UserScript==

(function (root, factory) {
  var api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VMPositionRules = api;
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var MAX_JUNIOR_LEVEL = 30.5;

  var POSITION_SHORT_NAMES = {
    'At': 'Atakujący',
    'L': 'Libero',
    'P': 'Przyjmujący',
    'R': 'Rozgrywający',
    'Sr': 'Środkowy',
    'Śr': 'Środkowy',
  };

  var POSITION_RULES = {
    'Atakujący': {
      primary: ['Ustawianie się do bloku', 'Blok', 'Asekuracja', 'Obrona'],
      secondary: ['Serwis', 'Atak ze skrzydła', 'Kiwka', 'Atak z 2 linii', 'Omijanie bloku'],
    },
    'Libero': {
      primary: ['Przyjęcie', 'Obrona', 'Asekuracja'],
      secondary: [],
    },
    'Przyjmujący': {
      primary: ['Przyjęcie', 'Obrona', 'Asekuracja', 'Ustawianie się do bloku', 'Blok'],
      secondary: ['Serwis', 'Atak ze skrzydła', 'Kiwka', 'Atak z 2 linii', 'Omijanie bloku'],
    },
    'Rozgrywający': {
      primary: ['Rozgrywanie', 'Wystawa', 'Obrona', 'Asekuracja'],
      secondary: ['Ustawianie się do bloku', 'Blok'],
    },
    'Środkowy': {
      primary: ['Atak ze środka', 'Omijanie bloku', 'Ustawianie się do bloku', 'Blok'],
      secondary: ['Serwis', 'Kiwka'],
    },
  };

  var ATTRIBUTE_CODES = {
    UM_SERWIS: 'Serwis',
    UM_SILA_SERWISU: 'Siła serwisu',
    UM_PRZYJECIE: 'Przyjęcie',
    UM_ROZGRYWANIE: 'Rozgrywanie',
    UM_WYSTAWA: 'Wystawa',
    UM_ATAK_ZE_SKRZYDLA: 'Atak ze skrzydła',
    UM_ATAK_ZE_SRODKA: 'Atak ze środka',
    UM_ATAK_2L: 'Atak z 2 linii',
    UM_OMIJANIE_BLOKU: 'Omijanie bloku',
    UM_KIWKA: 'Kiwka',
    UM_ATAK_BO: 'Atak blok-aut',
    UM_OBRONA: 'Obrona',
    UM_ASEKURACJA: 'Asekuracja',
    UM_BLOK_AKTYWNY: 'Blok',
    UM_BLOK_PASYWNY: 'Blok pasywny',
    UM_USTAWIANIE: 'Ustawianie się do bloku',
  };

  var ATTRIBUTE_LABEL_TO_CODE = Object.keys(ATTRIBUTE_CODES).reduce(function (map, code) {
    map[ATTRIBUTE_CODES[code]] = code;
    return map;
  }, {});

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizePosition(position) {
    var normalized = normalizeText(position);

    if (!normalized) {
      return '';
    }

    return POSITION_SHORT_NAMES[normalized] || normalized;
  }

  function getImportance(position, attributeLabel) {
    var rules = POSITION_RULES[normalizePosition(position)];

    if (!rules) {
      return 'none';
    }

    if (rules.primary.indexOf(attributeLabel) !== -1) {
      return 'primary';
    }

    if (rules.secondary.indexOf(attributeLabel) !== -1) {
      return 'secondary';
    }

    return 'none';
  }

  function isTrainableLevel(level, maxLevel) {
    var limit = maxLevel == null ? MAX_JUNIOR_LEVEL : maxLevel;
    return level < limit - 0.001;
  }

  function getRecommendedTrainableSkills(position, attributes, options) {
    var opts = options || {};
    var maxLevel = opts.maxLevel == null ? MAX_JUNIOR_LEVEL : opts.maxLevel;
    var rules = POSITION_RULES[normalizePosition(position)];
    var result = [];
    var seen = {};
    var groups;
    var g;
    var i;
    var label;
    var code;
    var level;

    if (!rules || !attributes) {
      return result;
    }

    groups = [rules.primary, rules.secondary];

    for (g = 0; g < groups.length; g += 1) {
      for (i = 0; i < groups[g].length; i += 1) {
        label = groups[g][i];
        code = ATTRIBUTE_LABEL_TO_CODE[label];

        if (!code || seen[code] || attributes[code] == null) {
          continue;
        }

        level = Number(attributes[code]);

        if (Number.isNaN(level) || !isTrainableLevel(level, maxLevel)) {
          continue;
        }

        seen[code] = true;
        result.push({
          code: code,
          level: level,
          targetLevel: maxLevel,
        });
      }
    }

    return result;
  }

  return {
    MAX_JUNIOR_LEVEL: MAX_JUNIOR_LEVEL,
    POSITION_SHORT_NAMES: POSITION_SHORT_NAMES,
    POSITION_RULES: POSITION_RULES,
    ATTRIBUTE_CODES: ATTRIBUTE_CODES,
    ATTRIBUTE_LABEL_TO_CODE: ATTRIBUTE_LABEL_TO_CODE,
    normalizePosition: normalizePosition,
    getImportance: getImportance,
    getRecommendedTrainableSkills: getRecommendedTrainableSkills,
    isTrainableLevel: isTrainableLevel,
  };
}));
