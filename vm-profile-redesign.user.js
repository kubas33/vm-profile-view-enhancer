// ==UserScript==
// @name         VM Profile Redesign
// @namespace    https://vm-manager.org/
// @version      0.1.0
// @description  Adds a redesigned VM Manager player profile view compatible with the existing profile enhancer.
// @match        *://*.vm-manager.org/*
// @grant        none
// @run-at       document-end
// @updateURL    https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-profile-redesign.user.js
// @downloadURL  https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-profile-redesign.user.js
// ==/UserScript==

(function (root, factory) {
  var api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root && root.document) {
    api.start();
  }
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  var MAX_ATTRIBUTE = 50.5;
  var STYLE_ID = 'vmpr-style';
  var WRAPPER_CLASS = 'vmpr-profile';
  var SOURCE_ATTR = 'data-vmpr-source';
  var SIGNATURE_ATTR = 'data-vmpr-signature';

  var ATTRIBUTE_NAMES = [
    'Serwis',
    'Siła serwisu',
    'Atak ze skrzydła',
    'Atak ze środka',
    'Kiwka',
    'Atak z 2 linii',
    'Omijanie bloku',
    'Atak blok-aut',
    'Rozgrywanie',
    'Wystawa',
    'Przyjęcie',
    'Obrona',
    'Asekuracja',
    'Ustawianie się do bloku',
    'Blok',
    'Blok pasywny',
    'Odporność na stres',
    'Wytrzymałość'
  ];

  var SPECIAL_SCALE_ATTRIBUTES = makeSet(['Odporność na stres', 'Wytrzymałość']);
  var BASIC_LABELS = makeSet(['Wzrost', 'Wartość', 'Pensja', 'Pozycja', 'Doświadczenie']);

  var POSITION_RULES = {
    'Atakujący': {
      primary: ['Ustawianie się do bloku', 'Blok', 'Asekuracja', 'Obrona'],
      secondary: ['Serwis', 'Atak ze skrzydła', 'Kiwka', 'Atak z 2 linii', 'Omijanie bloku']
    },
    'Libero': {
      primary: ['Przyjęcie', 'Obrona', 'Asekuracja'],
      secondary: []
    },
    'Przyjmujący': {
      primary: ['Przyjęcie', 'Obrona', 'Asekuracja', 'Ustawianie się do bloku', 'Blok'],
      secondary: ['Serwis', 'Atak ze skrzydła', 'Kiwka', 'Atak z 2 linii', 'Omijanie bloku']
    },
    'Rozgrywający': {
      primary: ['Rozgrywanie', 'Wystawa', 'Obrona', 'Asekuracja'],
      secondary: ['Ustawianie się do bloku', 'Blok']
    },
    'Środkowy': {
      primary: ['Atak ze środka', 'Omijanie bloku', 'Ustawianie się do bloku', 'Blok'],
      secondary: ['Serwis', 'Kiwka']
    }
  };

  var ATTRIBUTE_SET = makeSet(ATTRIBUTE_NAMES);
  var scheduleTimer = null;

  function makeSet(items) {
    return items.reduce(function (result, item) {
      result[item] = true;
      return result;
    }, {});
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function unescapeVmString(value) {
    return String(value || '')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  function extractVmBody(responseText) {
    var parsed;
    var bodyMatch;

    if (!responseText) {
      return '';
    }

    try {
      parsed = JSON.parse(responseText);
      if (parsed && typeof parsed.body === 'string') {
        return parsed.body;
      }
    } catch (error) {
      // VM ajax responses are often object-like strings rather than strict JSON.
    }

    bodyMatch = String(responseText).match(/body:\s*'((?:\\'|[^'])*)'/);
    if (bodyMatch) {
      return unescapeVmString(bodyMatch[1]);
    }

    return String(responseText);
  }

  function parseAttributeValue(value) {
    var match = normalizeText(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);

    return match ? Number(match[0]) : null;
  }

  function getGradeClass(value) {
    if (value <= 9.9) {
      return 'vmpr-grade-very-weak';
    }
    if (value <= 20.5) {
      return 'vmpr-grade-weak';
    }
    if (value <= 30.5) {
      return 'vmpr-grade-solid';
    }
    if (value <= 40.5) {
      return 'vmpr-grade-good';
    }
    if (value <= 47.5) {
      return 'vmpr-grade-very-good';
    }
    return 'vmpr-grade-elite';
  }

  function getSpecialGradeClass(value) {
    if (value < 20) {
      return 'vmpr-special-low';
    }
    if (value < 35) {
      return 'vmpr-special-medium';
    }
    if (value < 45) {
      return 'vmpr-special-high';
    }
    return 'vmpr-special-elite';
  }

  function getAttributeGradeClass(attribute) {
    if (SPECIAL_SCALE_ATTRIBUTES[attribute.name]) {
      return getSpecialGradeClass(attribute.value);
    }

    return getGradeClass(attribute.value);
  }

  function getImportance(position, name) {
    var rules = POSITION_RULES[position];

    if (!rules) {
      return 'none';
    }

    if (rules.primary.indexOf(name) !== -1) {
      return 'primary';
    }

    if (rules.secondary.indexOf(name) !== -1) {
      return 'secondary';
    }

    return 'none';
  }

  function average(values) {
    if (!values.length) {
      return null;
    }

    return values.reduce(function (sum, value) {
      return sum + value;
    }, 0) / values.length;
  }

  function calculateSummary(position, attributes) {
    var primary = [];
    var secondary = [];
    var weightedSum = 0;
    var weightTotal = 0;

    attributes.forEach(function (attribute) {
      var importance = getImportance(position, attribute.name);
      var weight = 0;

      if (importance === 'primary') {
        primary.push(attribute.value);
        weight = 1;
      } else if (importance === 'secondary') {
        secondary.push(attribute.value);
        weight = 0.5;
      }

      if (weight > 0) {
        weightedSum += attribute.value * weight;
        weightTotal += weight;
      }
    });

    return {
      primaryAverage: average(primary),
      secondaryAverage: average(secondary),
      fit: weightTotal > 0 ? (weightedSum / (MAX_ATTRIBUTE * weightTotal)) * 100 : null
    };
  }

  function formatAverage(value) {
    return value === null || Number.isNaN(value) ? '--' : value.toFixed(1);
  }

  function closestTableByWidth(element, width) {
    var current = element;

    while (current && current.nodeType === 1) {
      if (current.tagName === 'TABLE' && String(current.getAttribute('width') || '') === String(width)) {
        return current;
      }
      current = current.parentNode;
    }

    return null;
  }

  function collectAttributeRows(container) {
    var rows = Array.prototype.slice.call(container.querySelectorAll('tr'));
    var result = [];

    rows.forEach(function (row) {
      var cells = Array.prototype.slice.call(row.children);
      var name;
      var value;

      if (cells.length < 3) {
        return;
      }

      name = normalizeText(cells[1].textContent).replace(/^[★•]\s*/, '');
      if (!ATTRIBUTE_SET[name]) {
        return;
      }

      value = parseAttributeValue(cells[2].textContent);
      if (value === null || Number.isNaN(value)) {
        return;
      }

      result.push({
        name: name,
        value: value,
        valueHtml: cells[2].innerHTML,
        valueTitle: cells[2].getAttribute('title') || ''
      });
    });

    return result;
  }

  function findBasicValue(container, label) {
    var rows = Array.prototype.slice.call(container.querySelectorAll('tr'));
    var i;
    var cells;

    for (i = 0; i < rows.length; i += 1) {
      cells = Array.prototype.slice.call(rows[i].children);
      if (cells.length >= 2 && normalizeText(cells[0].textContent) === label) {
        return normalizeText(cells[1].textContent);
      }
    }

    return '';
  }

  function collectBasicInfo(container) {
    var rows = Array.prototype.slice.call(container.querySelectorAll('tr'));
    var result = [];

    rows.forEach(function (row) {
      var cells = Array.prototype.slice.call(row.children);
      var label;

      if (cells.length < 2) {
        return;
      }

      label = normalizeText(cells[0].textContent);
      if (BASIC_LABELS[label]) {
        result.push({
          label: label,
          value: normalizeText(cells[1].textContent)
        });
      }
    });

    return result;
  }

  function findProfileContentCells(documentRef) {
    var candidates = Array.prototype.slice.call(documentRef.querySelectorAll('td.second[width="684"], td.second'));

    return candidates.filter(function (candidate) {
      var attributes = collectAttributeRows(candidate);
      var position = findBasicValue(candidate, 'Pozycja');

      return Boolean(position && attributes.length >= 8 && closestTableByWidth(candidate, 716));
    });
  }

  function parseHeader(profileTable) {
    var idMatch = normalizeText(profileTable.textContent).match(/ID:\s*(\d+)/);
    var flag = profileTable.querySelector('img.flagSmall');
    var titleCell = null;
    var titleText;
    var titleMatch;
    var clubLink;

    Array.prototype.slice.call(profileTable.querySelectorAll('td.fourth')).forEach(function (cell) {
      var text = normalizeText(cell.textContent);
      if (!titleCell && /\(\s*.+,\s*\d+\s*lat\)/.test(text)) {
        titleCell = cell;
      }
    });

    titleText = normalizeText(titleCell ? titleCell.textContent : '');
    titleMatch = titleText.match(/^(.+?)\s*\((.+),\s*(\d+)\s*lat\)$/);
    clubLink = titleCell ? titleCell.querySelector('.link, [onclick], [OnClick]') : null;

    return {
      playerId: idMatch ? idMatch[1] : '',
      name: titleMatch ? normalizeText(titleMatch[1]) : '',
      club: titleMatch ? normalizeText(titleMatch[2]) : '',
      age: titleMatch ? Number(titleMatch[3]) : null,
      clubHtml: clubLink ? clubLink.outerHTML : '',
      flagSrc: flag ? flag.getAttribute('src') || '' : '',
      flagAlt: flag ? flag.getAttribute('alt') || '' : ''
    };
  }

  function findProfileActionTable(profileTable) {
    var next = profileTable.nextElementSibling;

    while (next) {
      if (next.tagName === 'TABLE' && String(next.getAttribute('width') || '') === '716') {
        if (/Zwolnij|Sprzedaj|Wystaw zawodnika/.test(normalizeText(next.textContent))) {
          return next;
        }
        return null;
      }
      next = next.nextElementSibling;
    }

    return null;
  }

  function parseOptionalActions(actionTable) {
    var fireSource = null;
    var sellSource = null;
    var input = null;
    var priceText = '';

    if (!actionTable) {
      return {
        fireSource: null,
        sellSource: null,
        sellInputValue: '',
        sellPriceText: ''
      };
    }

    Array.prototype.slice.call(actionTable.querySelectorAll('.link, [onclick], [OnClick]')).forEach(function (element) {
      var text = normalizeText(element.textContent);
      if (!fireSource && text.indexOf('Zwolnij') !== -1) {
        fireSource = element;
      } else if (!sellSource && text.indexOf('Sprzedaj') !== -1) {
        sellSource = element;
      }
    });

    input = actionTable.querySelector('input#sell_value, input.input_normal');
    Array.prototype.slice.call(actionTable.querySelectorAll('td')).forEach(function (cell) {
      var text = normalizeText(cell.textContent);
      if (!priceText && cell.querySelectorAll('table').length === 0 && text.indexOf('Wystaw zawodnika') !== -1) {
        priceText = text;
      }
    });

    return {
      fireSource: fireSource,
      sellSource: sellSource,
      sellInputValue: input ? input.getAttribute('value') || input.value || '' : '',
      sellPriceText: priceText
    };
  }

  function parseSideInfo(container) {
    var rows = Array.prototype.slice.call(container.querySelectorAll('tr'));
    var viewSelect = container.querySelector('select[name="view_options"]');
    var clubInfo = [];
    var commissions = [];
    var seen = {};

    rows.forEach(function (row) {
      var text = normalizeText(row.textContent);

      if (row.querySelector('.vmp-panel, .vmp-panel-row')) {
        return;
      }

      if (row.querySelectorAll('tr').length > 0) {
        return;
      }

      if (!text ||
        seen[text] ||
        ATTRIBUTE_SET[text] ||
        BASIC_LABELS[text] ||
        text.indexOf('Kluczowe śr.') !== -1 ||
        text.indexOf('Drugorzędne śr.') !== -1 ||
        text.indexOf('Dopasowanie') !== -1 ||
        text.indexOf('Rodzaj widoku') !== -1 ||
        text.indexOf('Prowizje przy sprzedaży zawodnika') !== -1) {
        return;
      }

      if (/^\d+%\s+/.test(text)) {
        commissions.push(text);
        seen[text] = true;
      } else if (/Zawodnik|klub|w klubie|wychowankiem/i.test(text) && text.length <= 140) {
        clubInfo.push(text);
        seen[text] = true;
      }
    });

    return {
      clubInfo: clubInfo,
      commissions: commissions,
      viewSelect: viewSelect
    };
  }

  function splitAttributes(attributes) {
    var middle = Math.ceil(attributes.length / 2);

    return [
      attributes.slice(0, middle),
      attributes.slice(middle)
    ];
  }

  function parseProfileFromContainer(container) {
    var profileTable = closestTableByWidth(container, 716);
    var actionTable = profileTable ? findProfileActionTable(profileTable) : null;
    var header = profileTable ? parseHeader(profileTable) : null;
    var attributes = collectAttributeRows(container);
    var position = findBasicValue(container, 'Pozycja');
    var avatar = container.querySelector('img[src*="pic/player/"]');
    var editFace = null;
    var sideInfo = parseSideInfo(container);
    var actions = parseOptionalActions(actionTable);
    var summary;

    Array.prototype.slice.call(container.querySelectorAll('.link, [onclick], [OnClick]')).forEach(function (element) {
      var onclick = element.getAttribute('onclick') || element.getAttribute('OnClick') || '';
      if (!editFace && onclick.indexOf('PlayerFaceEdit') !== -1) {
        editFace = element;
      }
    });

    if (!profileTable || !header || !header.playerId || !position || attributes.length < 8) {
      return null;
    }

    summary = calculateSummary(position, attributes);

    return {
      playerId: header.playerId,
      name: header.name,
      club: header.club,
      age: header.age,
      clubHtml: header.clubHtml,
      flagSrc: header.flagSrc,
      flagAlt: header.flagAlt,
      position: position,
      avatarSrc: avatar ? avatar.getAttribute('src') || '' : '',
      editFaceSource: editFace,
      basicInfo: collectBasicInfo(container),
      attributes: attributes,
      attributeColumns: splitAttributes(attributes),
      sideInfo: sideInfo,
      actions: actions,
      summary: summary,
      sourceTable: profileTable,
      actionTable: actionTable
    };
  }

  function parseProfileFromText(html) {
    var source = String(html || '');
    var titleMatch = normalizeText(source).match(/ID:\s*(\d+)\s*(.+?)\s*\((.+?),\s*(\d+)\s*lat\)/);
    var positionMatch = source.match(/<TD[^>]*>\s*Pozycja\s*<\/TD>\s*<TD[^>]*>([\s\S]*?)<\/TD>/i);
    var flagMatch = source.match(/<img[^>]+class=['"]flagSmall['"][^>]+src=['"]([^'"]+)['"][^>]*alt=['"]?([^'"\s>]*)/i);
    var avatarMatch = source.match(/<img[^>]+src=['"]([^'"]*pic\/player\/[^'"]+)['"][^>]*>/i);
    var selectMatch = source.match(/<SELECT[\s\S]*?name=['"]view_options['"][\s\S]*?<\/SELECT>/i);
    var selectedMatch = selectMatch ? selectMatch[0].match(/<OPTION\s+selected[\s\S]*?>([^<]+)/i) : null;
    var inputMatch = source.match(/<input[^>]+id=['"]sell_value['"][^>]+value=['"]([^'"]*)/i);
    var attrRegex = /<TD[^>]*>\s*([^<]+?)\s*<\/TD>\s*<TD[^>]*align=right[^>]*>([\s\S]*?)<\/TD>/gi;
    var basicRegex = /<TD[^>]*>\s*(Wzrost|Wartość|Pensja|Pozycja|Doświadczenie)\s*<\/TD>\s*<TD[^>]*>([\s\S]*?)<\/T[DR]>/gi;
    var attrMatch;
    var basicMatch;
    var attributes = [];
    var basicInfo = [];
    var position = positionMatch ? normalizeText(positionMatch[1]) : '';
    var profile;

    while ((attrMatch = attrRegex.exec(source)) !== null) {
      var name = normalizeText(attrMatch[1]).replace(/^[★•]\s*/, '');
      var value = parseAttributeValue(attrMatch[2]);

      if (ATTRIBUTE_SET[name] && value !== null && !Number.isNaN(value)) {
        attributes.push({
          name: name,
          value: value,
          valueHtml: attrMatch[2],
          valueTitle: ''
        });
      }
    }

    while ((basicMatch = basicRegex.exec(source)) !== null) {
      basicInfo.push({
        label: normalizeText(basicMatch[1]),
        value: normalizeText(basicMatch[2])
      });
    }

    if (!titleMatch || !position || attributes.length < 8) {
      return null;
    }

    profile = {
      playerId: titleMatch[1],
      name: normalizeText(titleMatch[2]),
      club: normalizeText(titleMatch[3]),
      age: Number(titleMatch[4]),
      clubHtml: '',
      flagSrc: flagMatch ? flagMatch[1] : '',
      flagAlt: flagMatch ? flagMatch[2] : '',
      position: position,
      avatarSrc: avatarMatch ? avatarMatch[1] : '',
      editFaceSource: null,
      basicInfo: basicInfo,
      attributes: attributes,
      attributeColumns: splitAttributes(attributes),
      sideInfo: {
        clubInfo: /Zawodnik jest wychowankiem klubu/.test(source) ? ['Zawodnik jest wychowankiem klubu'] : [],
        commissions: (source.match(/<b>\d+%<\/b>\s*[^<]+/g) || []).map(normalizeText),
        viewSelect: null,
        selectedViewLabel: selectedMatch ? normalizeText(selectedMatch[1]) : ''
      },
      actions: {
        fireSource: null,
        sellSource: null,
        sellInputValue: inputMatch ? inputMatch[1] : '',
        sellPriceText: /Wystaw zawodnika/.test(source) ? 'Wystaw zawodnika na listę transferową po cenie:' : ''
      }
    };
    profile.summary = calculateSummary(position, attributes);

    return profile;
  }

  function parseProfileFromHtml(html) {
    var parser;
    var documentRef;
    var cells;

    if (root && root.DOMParser) {
      parser = new root.DOMParser();
      documentRef = parser.parseFromString(html, 'text/html');
      cells = findProfileContentCells(documentRef);

      return cells.length ? parseProfileFromContainer(cells[0]) : null;
    }

    return parseProfileFromText(html);
  }

  function createSignature(profile) {
    return [
      profile.playerId,
      profile.position,
      profile.attributes.map(function (attribute) {
        return attribute.name + '=' + attribute.value;
      }).join('|'),
      profile.sideInfo.viewSelect ? profile.sideInfo.viewSelect.value : ''
    ].join('::');
  }

  function injectStyles(documentRef) {
    var style;

    if (documentRef.getElementById(STYLE_ID)) {
      return;
    }

    style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.vmpr-profile { width: 100%; max-width: 100%; margin: 0 0 2px 0; padding: 10px; border: 1px solid rgba(71, 159, 214, 0.55); border-radius: 8px; background: linear-gradient(135deg, rgba(4, 24, 38, 0.98), rgba(6, 42, 66, 0.94)); color: #dbeafb; box-sizing: border-box; font-size: 11px; line-height: 1.28; }',
      '.vmpr-profile, .vmpr-profile * { box-sizing: border-box; }',
      '.vmpr-top { display: grid; grid-template-columns: 150px minmax(0, 1fr) 28px; gap: 8px; align-items: center; margin-bottom: 12px; }',
      '.vmpr-id { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border: 1px solid rgba(84, 169, 226, 0.38); border-radius: 6px; background: rgba(14, 58, 91, 0.7); color: #bad4f0; font-size: 14px; font-weight: bold; }',
      '.vmpr-title { min-width: 0; color: #eef6ff; font-size: 16px; font-weight: bold; text-align: center; }',
      '.vmpr-title .link { color: #ffc72f !important; }',
      '.vmpr-flag { max-width: 24px; justify-self: end; }',
      '.vmpr-grid { display: grid; grid-template-columns: minmax(0, 25%) minmax(0, 48%) minmax(0, 27%); gap: 10px; align-items: start; }',
      '.vmpr-card { border: 1px solid rgba(84, 169, 226, 0.4); border-radius: 8px; background: rgba(5, 31, 50, 0.72); overflow: hidden; }',
      '.vmpr-photo { display: flex; min-height: 176px; padding: 16px 22px 8px 22px; align-items: center; justify-content: flex-end; flex-direction: column; gap: 6px; background: rgba(0, 14, 24, 0.35); }',
      '.vmpr-photo img { max-width: 130px; width: 100%; height: auto; }',
      '.vmpr-face-edit { display: block; width: 100%; margin: 0; padding: 6px 10px; border: 1px solid rgba(84, 169, 226, 0.45); border-radius: 6px; background: rgba(14, 58, 91, 0.7); color: #dbeafb !important; font-size: 11px; text-align: center; }',
      '.vmpr-facts { margin-top: 8px; }',
      '.vmpr-fact { display: flex; justify-content: space-between; gap: 8px; padding: 7px 9px; border-top: 1px solid rgba(84, 169, 226, 0.22); }',
      '.vmpr-fact:first-child { border-top: 0; }',
      '.vmpr-label { color: #9ec6e8; }',
      '.vmpr-fact-value { color: #eef6ff; font-weight: bold; text-align: right; }',
      '.vmpr-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }',
      '.vmpr-metric { min-height: 58px; padding: 9px 10px; border: 1px solid rgba(84, 169, 226, 0.42); border-radius: 6px; background: rgba(9, 43, 68, 0.78); }',
      '.vmpr-metric-label { display: block; color: #adc8df; font-size: 11px; }',
      '.vmpr-metric-value { display: block; margin-top: 2px; font-size: 22px; line-height: 1; font-weight: bold; }',
      '.vmpr-metric-primary .vmpr-metric-value { color: #4fa4ff; }',
      '.vmpr-metric-secondary .vmpr-metric-value { color: #9a7cff; }',
      '.vmpr-metric-fit .vmpr-metric-value { color: #80d35e; }',
      '.vmpr-attributes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid rgba(84, 169, 226, 0.4); border-radius: 8px; background: rgba(3, 25, 41, 0.78); overflow: hidden; }',
      '.vmpr-attr-col + .vmpr-attr-col { border-left: 1px solid rgba(84, 169, 226, 0.26); }',
      '.vmpr-attr { display: grid; grid-template-columns: minmax(0, 1fr) 42px; gap: 6px; align-items: center; min-height: 28px; padding: 5px 8px; border-top: 1px solid rgba(84, 169, 226, 0.16); }',
      '.vmpr-attr:first-child { border-top: 0; }',
      '.vmpr-attr-primary { background: rgba(255, 214, 74, 0.14); }',
      '.vmpr-attr-secondary { background: rgba(99, 183, 255, 0.10); }',
      '.vmpr-attr-other { opacity: 0.78; }',
      '.vmpr-attr-name { min-width: 0; overflow-wrap: anywhere; }',
      '.vmpr-attr-value { text-align: right; font-weight: bold; }',
      '.vmpr-side { display: grid; gap: 10px; }',
      '.vmpr-side-card { padding: 12px; }',
      '.vmpr-side-line { margin: 0 0 12px 0; color: #dbeafb; font-size: 11px; }',
      '.vmpr-side-title { margin: 0 0 8px 0; color: #eef6ff; font-size: 13px; font-weight: bold; }',
      '.vmpr-list { margin: 0; padding-left: 16px; }',
      '.vmpr-list li { margin: 0 0 8px 0; }',
      '.vmpr-select-wrap select { width: 100%; max-width: 100%; min-height: 28px; padding: 4px 7px; }',
      '.vmpr-actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(130px, 190px) auto 88px 82px; gap: 8px; align-items: center; margin-top: 10px; padding: 10px; }',
      '.vmpr-sell-text { color: #eef6ff; font-size: 12px; font-weight: bold; }',
      '.vmpr-sell-input { width: 100%; min-height: 30px; padding: 5px 8px; border: 1px solid rgba(84, 169, 226, 0.5); border-radius: 6px; background: rgba(4, 21, 35, 0.88); color: #eef6ff; font-size: 12px; text-align: right; }',
      '.vmpr-action { display: inline-block; min-width: 0; padding: 7px 10px; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 6px; color: #ffffff !important; font-size: 12px; text-align: center; font-weight: bold; }',
      '.vmpr-action-sell { background: #248b3d; }',
      '.vmpr-action-fire { background: #b52d28; }',
      '.vmpr-grade-very-weak, .vmpr-grade-very-weak span, .vmpr-grade-very-weak .link { color: #8f9ba3 !important; }',
      '.vmpr-grade-weak, .vmpr-grade-weak span, .vmpr-grade-weak .link { color: #d98b61 !important; }',
      '.vmpr-grade-solid, .vmpr-grade-solid span, .vmpr-grade-solid .link { color: #ffd45c !important; }',
      '.vmpr-grade-good, .vmpr-grade-good span, .vmpr-grade-good .link { color: #73d87a !important; }',
      '.vmpr-grade-very-good, .vmpr-grade-very-good span, .vmpr-grade-very-good .link { color: #4bd6d6 !important; }',
      '.vmpr-grade-elite, .vmpr-grade-elite span, .vmpr-grade-elite .link { color: #ff76d6 !important; }',
      '.vmpr-special-low, .vmpr-special-low span, .vmpr-special-low .link { color: #d98b61 !important; }',
      '.vmpr-special-medium, .vmpr-special-medium span, .vmpr-special-medium .link { color: #ffd45c !important; }',
      '.vmpr-special-high, .vmpr-special-high span, .vmpr-special-high .link { color: #73d87a !important; }',
      '.vmpr-special-elite, .vmpr-special-elite span, .vmpr-special-elite .link { color: #ff76d6 !important; }',
      '@media (max-width: 760px) { .vmpr-profile { padding: 8px; font-size: 10px; } .vmpr-grid { grid-template-columns: 24% minmax(0, 49%) 27%; gap: 7px; } .vmpr-top { grid-template-columns: 125px minmax(0, 1fr) 24px; } .vmpr-id { font-size: 12px; } .vmpr-title { font-size: 13px; } .vmpr-photo { min-height: 150px; padding: 12px 16px 6px 16px; } .vmpr-photo img { max-width: 100px; } .vmpr-summary { gap: 6px; } .vmpr-metric { min-height: 48px; padding: 7px 8px; } .vmpr-metric-label { font-size: 10px; } .vmpr-metric-value { font-size: 18px; } .vmpr-attr { min-height: 24px; padding: 4px 6px; grid-template-columns: minmax(0, 1fr) 34px; } .vmpr-side-card { padding: 8px; } .vmpr-actions { grid-template-columns: minmax(0, 1fr) minmax(90px, 150px) auto 68px 62px; gap: 6px; } .vmpr-action, .vmpr-sell-input, .vmpr-sell-text { font-size: 10px; } }'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function createText(documentRef, className, text) {
    var element = documentRef.createElement('span');

    element.className = className;
    element.textContent = text;

    return element;
  }

  function cloneVmElement(documentRef, source) {
    var clone;

    if (!source) {
      return null;
    }

    clone = documentRef.createElement('span');
    clone.innerHTML = source.innerHTML;
    Array.prototype.slice.call(source.attributes || []).forEach(function (attribute) {
      clone.setAttribute(attribute.name, attribute.value);
    });

    return clone;
  }

  function createMetric(documentRef, className, label, value) {
    var metric = documentRef.createElement('div');

    metric.className = 'vmpr-metric ' + className;
    metric.appendChild(createText(documentRef, 'vmpr-metric-label', label));
    metric.appendChild(createText(documentRef, 'vmpr-metric-value', value));

    return metric;
  }

  function createTop(documentRef, profile) {
    var top = documentRef.createElement('div');
    var id = documentRef.createElement('div');
    var title = documentRef.createElement('div');
    var flag;

    top.className = 'vmpr-top';
    id.className = 'vmpr-id';
    id.textContent = 'ID: ' + profile.playerId;
    title.className = 'vmpr-title';
    title.appendChild(documentRef.createTextNode(profile.name || 'Zawodnik'));
    title.appendChild(documentRef.createTextNode(' ('));
    if (profile.clubHtml) {
      title.insertAdjacentHTML('beforeend', profile.clubHtml);
    } else {
      title.appendChild(documentRef.createTextNode(profile.club || '--'));
    }
    title.appendChild(documentRef.createTextNode(', ' + (profile.age === null ? '--' : profile.age) + ' lat)'));

    top.appendChild(id);
    top.appendChild(title);

    if (profile.flagSrc) {
      flag = documentRef.createElement('img');
      flag.className = 'vmpr-flag';
      flag.src = profile.flagSrc;
      flag.alt = profile.flagAlt || '';
      top.appendChild(flag);
    } else {
      top.appendChild(documentRef.createElement('span'));
    }

    return top;
  }

  function createLeftPanel(documentRef, profile) {
    var panel = documentRef.createElement('div');
    var photo = documentRef.createElement('div');
    var img;
    var edit;
    var facts = documentRef.createElement('div');

    panel.className = 'vmpr-left';
    photo.className = 'vmpr-card vmpr-photo';
    if (profile.avatarSrc) {
      img = documentRef.createElement('img');
      img.src = profile.avatarSrc;
      img.alt = '';
      photo.appendChild(img);
    }

    if (profile.editFaceSource) {
      edit = cloneVmElement(documentRef, profile.editFaceSource);
      edit.className = 'link vmpr-face-edit';
      photo.appendChild(edit);
    }
    panel.appendChild(photo);

    facts.className = 'vmpr-card vmpr-facts';
    profile.basicInfo.forEach(function (item) {
      var row = documentRef.createElement('div');
      row.className = 'vmpr-fact';
      row.appendChild(createText(documentRef, 'vmpr-label', item.label));
      row.appendChild(createText(documentRef, 'vmpr-fact-value', item.value));
      facts.appendChild(row);
    });
    panel.appendChild(facts);

    return panel;
  }

  function createAttributeRow(documentRef, profile, attribute) {
    var row = documentRef.createElement('div');
    var name = documentRef.createElement('span');
    var value = documentRef.createElement('span');
    var importance = getImportance(profile.position, attribute.name);

    row.className = 'vmpr-attr vmpr-attr-' + importance;
    name.className = 'vmpr-attr-name';
    name.textContent = attribute.name;
    value.className = 'vmpr-attr-value ' + getAttributeGradeClass(attribute);
    value.innerHTML = attribute.valueHtml;
    if (attribute.valueTitle) {
      value.setAttribute('title', attribute.valueTitle);
    }

    row.appendChild(name);
    row.appendChild(value);

    return row;
  }

  function createMainPanel(documentRef, profile) {
    var main = documentRef.createElement('div');
    var summary = documentRef.createElement('div');
    var attributes = documentRef.createElement('div');

    main.className = 'vmpr-main';
    summary.className = 'vmpr-summary';
    summary.appendChild(createMetric(documentRef, 'vmpr-metric-primary', 'Kluczowe śr.', formatAverage(profile.summary.primaryAverage)));
    summary.appendChild(createMetric(documentRef, 'vmpr-metric-secondary', 'Drugorzędne śr.', formatAverage(profile.summary.secondaryAverage)));
    summary.appendChild(createMetric(documentRef, 'vmpr-metric-fit', 'Dopasowanie', profile.summary.fit === null ? '--' : profile.summary.fit.toFixed(1) + '%'));
    main.appendChild(summary);

    attributes.className = 'vmpr-attributes';
    profile.attributeColumns.forEach(function (column) {
      var columnNode = documentRef.createElement('div');
      columnNode.className = 'vmpr-attr-col';
      column.forEach(function (attribute) {
        columnNode.appendChild(createAttributeRow(documentRef, profile, attribute));
      });
      attributes.appendChild(columnNode);
    });
    main.appendChild(attributes);

    return main;
  }

  function createSidePanel(documentRef, profile) {
    var side = documentRef.createElement('div');
    var infoCard = documentRef.createElement('div');
    var viewCard;
    var title;
    var selectWrap;

    side.className = 'vmpr-side';
    infoCard.className = 'vmpr-card vmpr-side-card';

    profile.sideInfo.clubInfo.forEach(function (line) {
      var item = documentRef.createElement('p');
      item.className = 'vmpr-side-line';
      item.textContent = line;
      infoCard.appendChild(item);
    });

    if (profile.sideInfo.commissions.length) {
      title = documentRef.createElement('div');
      title.className = 'vmpr-side-title';
      title.textContent = 'Prowizje przy sprzedaży zawodnika:';
      infoCard.appendChild(title);
      var list = documentRef.createElement('ul');
      list.className = 'vmpr-list';
      profile.sideInfo.commissions.forEach(function (line) {
        var item = documentRef.createElement('li');
        item.textContent = normalizeText(line);
        list.appendChild(item);
      });
      infoCard.appendChild(list);
    }

    if (!infoCard.childNodes.length) {
      infoCard.appendChild(createText(documentRef, 'vmpr-side-line', 'Pozycja: ' + profile.position));
    }
    side.appendChild(infoCard);

    if (profile.sideInfo.viewSelect) {
      viewCard = documentRef.createElement('div');
      title = documentRef.createElement('div');
      selectWrap = documentRef.createElement('div');
      viewCard.className = 'vmpr-card vmpr-side-card';
      title.className = 'vmpr-side-title';
      title.textContent = 'Rodzaj widoku:';
      selectWrap.className = 'vmpr-select-wrap';
      selectWrap.appendChild(profile.sideInfo.viewSelect.cloneNode(true));
      viewCard.appendChild(title);
      viewCard.appendChild(selectWrap);
      side.appendChild(viewCard);
    }

    return side;
  }

  function createActions(documentRef, profile) {
    var actions = documentRef.createElement('div');
    var text = documentRef.createElement('div');
    var input;
    var currency;
    var sell;
    var fire;

    if (!profile.actions.sellSource && !profile.actions.fireSource) {
      return null;
    }

    actions.className = 'vmpr-card vmpr-actions';
    text.className = 'vmpr-sell-text';
    text.textContent = profile.actions.sellPriceText || 'Wystaw zawodnika na listę transferową po cenie:';
    actions.appendChild(text);

    if (profile.actions.sellSource) {
      input = documentRef.createElement('input');
      input.id = 'sell_value';
      input.className = 'input_normal vmpr-sell-input';
      input.value = profile.actions.sellInputValue || '';
      actions.appendChild(input);

      currency = documentRef.createElement('span');
      currency.textContent = '€';
      actions.appendChild(currency);

      sell = cloneVmElement(documentRef, profile.actions.sellSource);
      sell.className = 'link vmpr-action vmpr-action-sell';
      actions.appendChild(sell);
    } else {
      actions.appendChild(documentRef.createElement('span'));
      actions.appendChild(documentRef.createElement('span'));
      actions.appendChild(documentRef.createElement('span'));
    }

    if (profile.actions.fireSource) {
      fire = cloneVmElement(documentRef, profile.actions.fireSource);
      fire.className = 'link vmpr-action vmpr-action-fire';
      actions.appendChild(fire);
    }

    return actions;
  }

  function renderProfile(documentRef, profile) {
    var wrapper = documentRef.createElement('div');
    var grid = documentRef.createElement('div');
    var actions;

    wrapper.className = WRAPPER_CLASS;
    wrapper.setAttribute(SOURCE_ATTR, profile.playerId);
    wrapper.setAttribute(SIGNATURE_ATTR, createSignature(profile));
    wrapper.appendChild(createTop(documentRef, profile));

    grid.className = 'vmpr-grid';
    grid.appendChild(createLeftPanel(documentRef, profile));
    grid.appendChild(createMainPanel(documentRef, profile));
    grid.appendChild(createSidePanel(documentRef, profile));
    wrapper.appendChild(grid);

    actions = createActions(documentRef, profile);
    if (actions) {
      wrapper.appendChild(actions);
    }

    return wrapper;
  }

  function replaceProfile(documentRef, profile) {
    var signature = createSignature(profile);
    var existing = documentRef.querySelector('.' + WRAPPER_CLASS + '[' + SOURCE_ATTR + '="' + profile.playerId + '"]');
    var wrapper;

    if (existing && existing.getAttribute(SIGNATURE_ATTR) === signature) {
      return;
    }

    wrapper = renderProfile(documentRef, profile);
    profile.sourceTable.parentNode.insertBefore(wrapper, profile.sourceTable);
    profile.sourceTable.remove();
    if (profile.actionTable && profile.actionTable.parentNode) {
      profile.actionTable.remove();
    }
    if (existing && existing.parentNode) {
      existing.remove();
    }
  }

  function enhanceProfiles() {
    var documentRef = root.document;

    injectStyles(documentRef);
    findProfileContentCells(documentRef).forEach(function (container) {
      var profile = parseProfileFromContainer(container);
      if (profile) {
        replaceProfile(documentRef, profile);
      }
    });
  }

  function scheduleEnhancement() {
    if (scheduleTimer) {
      root.clearTimeout(scheduleTimer);
    }

    scheduleTimer = root.setTimeout(function () {
      scheduleTimer = null;
      enhanceProfiles();
    }, 120);
  }

  function start() {
    if (!root || !root.document || !root.MutationObserver) {
      return;
    }

    enhanceProfiles();

    new root.MutationObserver(scheduleEnhancement).observe(root.document.body, {
      childList: true,
      subtree: true
    });
  }

  return {
    calculateSummary: calculateSummary,
    extractVmBody: extractVmBody,
    parseAttributeValue: parseAttributeValue,
    parseProfileFromHtml: parseProfileFromHtml,
    start: start
  };
}));
