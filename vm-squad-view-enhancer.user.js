// ==UserScript==
// @name         VM Squad View Enhancer
// @namespace    https://vm-manager.org/
// @version      0.1.6
// @description  Enhances VM Manager squad view with training bar progress.
// @match        *://*.vm-manager.org/*
// @grant        none
// @run-at       document-end
// @updateURL    https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-squad-view-enhancer.user.js
// @downloadURL  https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-squad-view-enhancer.user.js
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

  var STYLE_ID = 'vms-style';
  var HEADER_CLASS = 'vms-training-header';
  var CELL_CLASS = 'vms-training-cell';
  var SORTABLE_HEADER_CLASS = 'vms-sortable-header';
  var SORT_MARKER_CLASS = 'vms-sort-marker';
  var BAR_CLASS = 'vms-training-bar';
  var FILL_CLASS = 'vms-training-fill';
  var TEXT_CLASS = 'vms-training-text';
  var ENHANCED_TABLE_ATTR = 'data-vms-enhanced-table';
  var SQUAD_SIGNATURE_ATTR = 'data-vms-squad-signature';
  var TRAINING_URL = '/Ajax_handler.php?phpsite=view_body.php&action=Training';
  var CACHE_KEY = 'vms.trainingPercentMap.v1';
  var CACHE_TTL_MS = 5 * 60 * 1000;
  var COLUMN_WIDTH = 64;
  var SORT_COLUMNS = {
    'Zawodnik': 'name',
    'Wiek': 'age',
    'Wzrost': 'height',
    'Forma': 'form',
    'Trening': 'training',
    'Doś.': 'experience',
    'Pensja': 'salary',
    'Wartość': 'value'
  };

  var scheduleTimer = null;
  var trainingPromise = null;
  var trainingState = {
    status: 'idle',
    values: null
  };

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
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

  function parseSquadPlayerIdsFromHtml(html) {
    var ids = [];
    var seen = {};
    var regex = /Player&playerId=(\d+)/g;
    var match;

    while ((match = regex.exec(String(html || ''))) !== null) {
      if (!seen[match[1]]) {
        seen[match[1]] = true;
        ids.push(match[1]);
      }
    }

    return ids;
  }

  function parseTrainingPercentMapFromHtml(html) {
    var result = {};
    var regex = /playerId=(\d+)[\s\S]*?&nbsp;\s*(\d+)\s*%/g;
    var match;
    var percent;

    while ((match = regex.exec(String(html || ''))) !== null) {
      percent = Number(match[2]);
      if (!Number.isNaN(percent)) {
        result[match[1]] = Math.max(0, Math.min(100, percent));
      }
    }

    return result;
  }

  function injectStyles(documentRef) {
    var style;

    if (documentRef.getElementById(STYLE_ID)) {
      return;
    }

    style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.vms-training-header {',
      '  color: #d7edf8;',
      '}',
      '.vms-sortable-header {',
      '  cursor: pointer;',
      '  user-select: none;',
      '}',
      '.vms-sortable-header:hover {',
      '  color: #ffffff;',
      '}',
      '.vms-sort-marker {',
      '  display: inline-block;',
      '  width: 8px;',
      '  margin-left: 2px;',
      '  color: #8fd0ff;',
      '  font-size: 9px;',
      '  line-height: 1;',
      '  text-align: left;',
      '}',
      '.vms-training-cell {',
      '  box-sizing: border-box;',
      '  white-space: nowrap;',
      '  padding-left: 3px;',
      '  padding-right: 3px;',
      '}',
      '.vms-training-wrap {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 4px;',
      '  width: 58px;',
      '  min-width: 58px;',
      '  vertical-align: middle;',
      '}',
      '.vms-training-bar {',
      '  position: relative;',
      '  display: inline-block;',
      '  width: 28px;',
      '  height: 7px;',
      '  overflow: hidden;',
      '  border: 1px solid rgba(80, 156, 202, 0.55);',
      '  background: rgba(1, 18, 28, 0.72);',
      '  box-sizing: border-box;',
      '}',
      '.vms-training-fill {',
      '  display: block;',
      '  height: 100%;',
      '  width: 0%;',
      '  background: #47a6dc;',
      '}',
      '.vms-training-text {',
      '  display: inline-block;',
      '  width: 24px;',
      '  color: #d7edf8;',
      '  font-size: 10px;',
      '  line-height: 1;',
      '  text-align: right;',
      '}',
      '.vms-training-loading .vms-training-text,',
      '.vms-training-missing .vms-training-text {',
      '  color: #8fa8b8;',
      '  text-align: center;',
      '}',
      '.vms-training-low .vms-training-fill { background: #b66b58; }',
      '.vms-training-mid .vms-training-fill { background: #d4b64f; }',
      '.vms-training-good .vms-training-fill { background: #4fad7c; }',
      '.vms-training-ready .vms-training-fill { background: #45b7e8; }',
      '.vms-training-low .vms-training-text { color: #d98b61; }',
      '.vms-training-mid .vms-training-text { color: #ffd45c; }',
      '.vms-training-good .vms-training-text { color: #73d87a; }',
      '.vms-training-ready .vms-training-text { color: #8fd0ff; }'
    ].join('\n');
    documentRef.head.appendChild(style);
  }

  function getPercentClass(percent) {
    if (percent <= 24) {
      return 'vms-training-low';
    }
    if (percent <= 59) {
      return 'vms-training-mid';
    }
    if (percent <= 84) {
      return 'vms-training-good';
    }
    return 'vms-training-ready';
  }

  function parseNumber(value) {
    var normalized = normalizeText(value)
      .replace(/\u00a0/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[^\d,.-]/g, '')
      .replace(/\s+/g, '')
      .replace(',', '.');
    var number;

    if (!/\d/.test(normalized)) {
      return null;
    }

    number = Number(normalized);

    return Number.isNaN(number) ? null : number;
  }

  function createTrainingContent(documentRef, state, percent) {
    var wrapper = documentRef.createElement('span');
    var bar = documentRef.createElement('span');
    var fill = documentRef.createElement('span');
    var text = documentRef.createElement('span');

    wrapper.className = 'vms-training-wrap';
    bar.className = BAR_CLASS;
    fill.className = FILL_CLASS;
    text.className = TEXT_CLASS;

    if (state === 'loading') {
      wrapper.className += ' vms-training-loading';
      text.textContent = '...';
    } else if (state === 'missing') {
      wrapper.className += ' vms-training-missing';
      text.textContent = '--';
    } else {
      wrapper.className += ' ' + getPercentClass(percent);
      fill.style.width = percent + '%';
      text.textContent = percent + '%';
    }

    bar.appendChild(fill);
    wrapper.appendChild(bar);
    wrapper.appendChild(text);

    return wrapper;
  }

  function setTrainingCell(cell, percent) {
    var state = percent === null ? 'missing' : 'ready';

    cell.textContent = '';
    cell.appendChild(createTrainingContent(cell.ownerDocument, state, percent));
  }

  function setTrainingCellLoading(cell) {
    cell.textContent = '';
    cell.appendChild(createTrainingContent(cell.ownerDocument, 'loading', null));
  }

  function getPlayerIdFromRow(row) {
    var links = Array.prototype.slice.call(row.querySelectorAll('[onclick], [OnClick]'));
    var i;
    var text;
    var match;

    for (i = 0; i < links.length; i += 1) {
      text = links[i].getAttribute('onclick') || links[i].getAttribute('OnClick') || '';
      match = text.match(/Player&playerId=(\d+)/);
      if (match) {
        return match[1];
      }
    }

    return '';
  }

  function findPlayerLinkCell(row) {
    var cells = Array.prototype.slice.call(row.children);
    var i;

    for (i = 0; i < cells.length; i += 1) {
      if (getPlayerIdFromRow(cells[i])) {
        return {
          cell: cells[i],
          index: i
        };
      }
    }

    return null;
  }

  function incrementTableColspans(table) {
    var cells;

    if (!table || table.getAttribute(ENHANCED_TABLE_ATTR) === '1') {
      return;
    }

    cells = Array.prototype.slice.call(table.querySelectorAll('td[colspan]'));
    cells.forEach(function (cell) {
      var value = Number(cell.getAttribute('colspan'));
      if (!Number.isNaN(value) && value > 0) {
        cell.setAttribute('colspan', String(value + 1));
      }
    });

    table.setAttribute(ENHANCED_TABLE_ATTR, '1');
  }

  function enhanceHeaderRow(row) {
    var cells = Array.prototype.slice.call(row.children);
    var i;
    var headerCell;
    var newCell;

    if (row.querySelector('.' + HEADER_CLASS)) {
      return;
    }

    for (i = 0; i < cells.length; i += 1) {
      if (normalizeText(cells[i].textContent) === 'Forma') {
        headerCell = cells[i];
        break;
      }
    }

    if (!headerCell) {
      return;
    }

    newCell = headerCell.ownerDocument.createElement('td');
    newCell.className = headerCell.className + ' ' + HEADER_CLASS;
    newCell.setAttribute('width', String(COLUMN_WIDTH));
    newCell.setAttribute('align', 'center');
    newCell.innerHTML = '<b>Trening</b>';
    headerCell.parentNode.insertBefore(newCell, headerCell.nextSibling);
    incrementTableColspans(row.closest('table'));
  }

  function getHeaderLabel(cell) {
    return normalizeText(cell.textContent).replace(/\s+[v^]$/, '');
  }

  function ensureSortMarker(cell) {
    var marker = cell.querySelector('.' + SORT_MARKER_CLASS);

    if (!marker) {
      marker = cell.ownerDocument.createElement('span');
      marker.className = SORT_MARKER_CLASS;
      marker.setAttribute('aria-hidden', 'true');
      cell.appendChild(marker);
    }

    return marker;
  }

  function updateSortMarkers(documentRef, activeKey, direction) {
    var headers = Array.prototype.slice.call(documentRef.querySelectorAll('.' + SORTABLE_HEADER_CLASS));

    headers.forEach(function (header) {
      var marker = ensureSortMarker(header);
      marker.textContent = header.getAttribute('data-vms-sort-key') === activeKey ? (direction === 'asc' ? '^' : 'v') : '';
    });
  }

  function enableHeaderSorting(row) {
    var cells = Array.prototype.slice.call(row.children);

    cells.forEach(function (cell) {
      var label = getHeaderLabel(cell);
      var sortKey = SORT_COLUMNS[label];

      if (!sortKey || cell.getAttribute('data-vms-sort-ready') === '1') {
        return;
      }

      cell.className += ' ' + SORTABLE_HEADER_CLASS;
      cell.setAttribute('data-vms-sort-ready', '1');
      cell.setAttribute('data-vms-sort-key', sortKey);
      cell.setAttribute('title', 'Sortuj po: ' + label);
      ensureSortMarker(cell);

      cell.addEventListener('click', function () {
        sortSquadBy(sortKey, cell.ownerDocument);
      });
    });
  }

  function findHeaderRows(documentRef) {
    var rows = Array.prototype.slice.call(documentRef.querySelectorAll('tr'));

    return rows.filter(function (row) {
      var cellTexts = Array.prototype.slice.call(row.children).map(function (cell) {
        return normalizeText(cell.textContent);
      });

      return cellTexts.indexOf('Forma') !== -1 &&
        cellTexts.some(function (text) { return text.indexOf('Zawodnik') !== -1; }) &&
        cellTexts.some(function (text) { return text.indexOf('Pensja') !== -1; }) &&
        cellTexts.some(function (text) { return text.indexOf('Wartość') !== -1; });
    });
  }

  function findSquadPlayerRows(documentRef) {
    var rows = Array.prototype.slice.call(documentRef.querySelectorAll('tr'));

    return rows.filter(function (row) {
      var link = findPlayerLinkCell(row);
      var text = normalizeText(row.textContent);
      return Boolean(link && row.children[link.index + 5] && text.indexOf('€') !== -1);
    });
  }

  function enhancePlayerRow(row) {
    var existing = row.querySelector('.' + CELL_CLASS);
    var linkInfo;
    var formCellIndex;
    var formCell;
    var newCell;
    var playerId;

    if (existing) {
      return existing;
    }

    linkInfo = findPlayerLinkCell(row);
    if (!linkInfo) {
      return null;
    }

    formCellIndex = linkInfo.index + 5;
    formCell = row.children[formCellIndex];
    if (!formCell) {
      return null;
    }

    playerId = getPlayerIdFromRow(row);
    newCell = row.ownerDocument.createElement('td');
    newCell.className = formCell.className + ' ' + CELL_CLASS;
    newCell.setAttribute('width', String(COLUMN_WIDTH));
    newCell.setAttribute('align', 'center');
    newCell.setAttribute('data-vms-player-id', playerId);
    setTrainingCellLoading(newCell);

    formCell.parentNode.insertBefore(newCell, formCell.nextSibling);
    incrementTableColspans(row.closest('table'));

    return newCell;
  }

  function getCellTextByIndex(row, index) {
    return row.children[index] ? normalizeText(row.children[index].textContent) : '';
  }

  function getSortValue(row, sortKey) {
    var linkInfo = findPlayerLinkCell(row);
    var text;
    var value;

    if (!linkInfo) {
      return null;
    }

    if (sortKey === 'name') {
      return getCellTextByIndex(row, linkInfo.index).toLocaleLowerCase();
    }

    if (sortKey === 'age') {
      return parseNumber(getCellTextByIndex(row, linkInfo.index + 3));
    }

    if (sortKey === 'height') {
      return parseNumber(getCellTextByIndex(row, linkInfo.index + 4));
    }

    if (sortKey === 'form') {
      return parseNumber(getCellTextByIndex(row, linkInfo.index + 5));
    }

    if (sortKey === 'training') {
      text = row.querySelector('.' + CELL_CLASS + ' .' + TEXT_CLASS);
      return text ? parseNumber(text.textContent) : null;
    }

    if (sortKey === 'experience') {
      return parseNumber(getCellTextByIndex(row, linkInfo.index + 7));
    }

    if (sortKey === 'salary') {
      return parseNumber(getCellTextByIndex(row, linkInfo.index + 8));
    }

    if (sortKey === 'value') {
      value = parseNumber(getCellTextByIndex(row, linkInfo.index + 9));
      return value;
    }

    return null;
  }

  function getPlayerBlock(row) {
    var innerTable = row.closest('table');
    var tableCell = innerTable ? innerTable.parentNode : null;
    var blockRow = tableCell && tableCell.tagName && tableCell.tagName.toLowerCase() === 'td' ? tableCell.parentNode : null;
    var spacerRow = blockRow ? blockRow.nextElementSibling : null;

    if (!blockRow || !blockRow.parentNode || blockRow.tagName.toLowerCase() !== 'tr') {
      return null;
    }

    if (spacerRow && spacerRow.tagName.toLowerCase() === 'tr' && !getPlayerIdFromRow(spacerRow)) {
      return {
        row: row,
        blockRow: blockRow,
        spacerRow: spacerRow
      };
    }

    return {
      row: row,
      blockRow: blockRow,
      spacerRow: null
    };
  }

  function compareSortValues(left, right, direction) {
    var multiplier = direction === 'asc' ? 1 : -1;

    if (left.value === null && right.value === null) {
      return left.index - right.index;
    }
    if (left.value === null) {
      return 1;
    }
    if (right.value === null) {
      return -1;
    }
    if (typeof left.value === 'string' || typeof right.value === 'string') {
      return String(left.value).localeCompare(String(right.value), 'pl') * multiplier || left.index - right.index;
    }
    if (left.value === right.value) {
      return left.index - right.index;
    }

    return (left.value - right.value) * multiplier;
  }

  function sortSquadBy(sortKey, documentRef) {
    var rows = findSquadPlayerRows(documentRef);
    var currentKey = documentRef.body.getAttribute('data-vms-sort-key');
    var currentDirection = documentRef.body.getAttribute('data-vms-sort-direction') || 'desc';
    var nextDirection = currentKey === sortKey && currentDirection === 'desc' ? 'asc' : 'desc';
    var blocks;
    var parent;

    blocks = rows.map(function (row, index) {
      var block = getPlayerBlock(row);

      if (!block) {
        return null;
      }

      return {
        index: index,
        value: getSortValue(row, sortKey),
        block: block
      };
    }).filter(Boolean);

    if (!blocks.length) {
      return;
    }

    parent = blocks[0].block.blockRow.parentNode;
    blocks.sort(function (left, right) {
      return compareSortValues(left, right, nextDirection);
    });

    blocks.forEach(function (item) {
      parent.appendChild(item.block.blockRow);
      if (item.block.spacerRow) {
        parent.appendChild(item.block.spacerRow);
      }
    });

    documentRef.body.setAttribute('data-vms-sort-key', sortKey);
    documentRef.body.setAttribute('data-vms-sort-direction', nextDirection);
    documentRef.body.removeAttribute(SQUAD_SIGNATURE_ATTR);
    updateSortMarkers(documentRef, sortKey, nextDirection);
  }

  function createSquadSignature(rows) {
    return rows.map(function (row) {
      return getPlayerIdFromRow(row);
    }).join('|');
  }

  function readTrainingCache(storage) {
    var raw;
    var parsed;

    if (!storage) {
      return null;
    }

    try {
      raw = storage.getItem(CACHE_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }

    if (!parsed || !parsed.createdAt || !parsed.values) {
      return null;
    }

    if (Date.now() - parsed.createdAt > CACHE_TTL_MS) {
      return null;
    }

    return parsed.values;
  }

  function writeTrainingCache(storage, values) {
    if (!storage) {
      return;
    }

    try {
      storage.setItem(CACHE_KEY, JSON.stringify({
        createdAt: Date.now(),
        values: values
      }));
    } catch (error) {
      // Cache failures should not affect the squad view.
    }
  }

  function fetchTrainingValues() {
    var cached;

    if (trainingState.status === 'loaded') {
      return Promise.resolve(trainingState.values);
    }

    if (trainingPromise) {
      return trainingPromise;
    }

    cached = readTrainingCache(root.sessionStorage);
    if (cached) {
      trainingState.status = 'loaded';
      trainingState.values = cached;
      return Promise.resolve(cached);
    }

    trainingState.status = 'loading';
    trainingPromise = root.fetch(TRAINING_URL, {
      credentials: 'same-origin'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Training fetch failed with status ' + response.status);
      }
      return response.text();
    }).then(function (text) {
      var html = extractVmBody(text);
      var values = parseTrainingPercentMapFromHtml(html);

      trainingState.status = 'loaded';
      trainingState.values = values;
      writeTrainingCache(root.sessionStorage, values);

      return values;
    }).catch(function (error) {
      trainingState.status = 'error';
      trainingState.values = null;
      throw error;
    }).finally(function () {
      trainingPromise = null;
    });

    return trainingPromise;
  }

  function applyTrainingValues(values) {
    var cells = Array.prototype.slice.call(root.document.querySelectorAll('.' + CELL_CLASS));

    cells.forEach(function (cell) {
      var playerId = cell.getAttribute('data-vms-player-id');
      var percent = values && Object.prototype.hasOwnProperty.call(values, playerId) ? values[playerId] : null;
      setTrainingCell(cell, percent);
    });
  }

  function applyTrainingError() {
    var cells = Array.prototype.slice.call(root.document.querySelectorAll('.' + CELL_CLASS));

    cells.forEach(function (cell) {
      setTrainingCell(cell, null);
    });
  }

  function enhanceSquad() {
    var documentRef = root.document;
    var headerRows = findHeaderRows(documentRef);
    var playerRows = findSquadPlayerRows(documentRef);
    var signature;

    if (!headerRows.length || !playerRows.length) {
      return;
    }

    injectStyles(documentRef);
    signature = createSquadSignature(playerRows);

    if (documentRef.body.getAttribute(SQUAD_SIGNATURE_ATTR) === signature &&
      Array.prototype.slice.call(documentRef.querySelectorAll('.' + CELL_CLASS)).length >= playerRows.length) {
      if (trainingState.status === 'loaded') {
        applyTrainingValues(trainingState.values);
      }
      return;
    }

    headerRows.forEach(enhanceHeaderRow);
    headerRows.forEach(enableHeaderSorting);
    playerRows.forEach(enhancePlayerRow);
    documentRef.body.setAttribute(SQUAD_SIGNATURE_ATTR, signature);

    fetchTrainingValues().then(applyTrainingValues).catch(applyTrainingError);
  }

  function scheduleEnhancement() {
    if (scheduleTimer) {
      root.clearTimeout(scheduleTimer);
    }

    scheduleTimer = root.setTimeout(function () {
      scheduleTimer = null;
      enhanceSquad();
    }, 120);
  }

  function start() {
    if (!root || !root.document || !root.fetch) {
      return;
    }

    enhanceSquad();

    new root.MutationObserver(scheduleEnhancement).observe(root.document.body, {
      childList: true,
      subtree: true
    });
  }

  return {
    extractVmBody: extractVmBody,
    parseSquadPlayerIdsFromHtml: parseSquadPlayerIdsFromHtml,
    parseTrainingPercentMapFromHtml: parseTrainingPercentMapFromHtml,
    start: start
  };
}));
