// ==UserScript==
// @name         Volleyball training view enhancer
// @namespace    https://vm-manager.org/
// @version      0.2.0
// @description  Highlights risky and wasteful training choices in senior and junior training views.
// @match        *://*.vm-manager.org/*
// @updateURL    https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-training-view-engancer.user.js
// @downloadURL  https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-training-view-engancer.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    maxAttributeEpsilon: 0.05,
    lowAfterCritical: 4,
    lowAfterWarning: 10,
    lowAfterCaution: 20,
    savingAttributeValue: 45,
    savingBarAfter: 25,
    rerenderDelayMs: 80,
  };

  const VIEW_CONFIGS = [
    {
      key: 'senior',
      label: 'Seniorzy',
      formId: 'trening_options',
      selectId: 'trening_type_senior',
      inputPrefix: 'trening_option_',
      panelId: 'vte-panel-senior',
      maxAttributeValue: 50.5,
      hasTrainingBar: true,
    },
    {
      key: 'junior',
      label: 'Juniorzy',
      formId: 'young_trening_options',
      selectId: 'trening_type_junior',
      inputPrefix: 'young_trening_option_',
      panelId: 'vte-panel-junior',
      maxAttributeValue: 30.5,
      hasTrainingBar: false,
    },
  ];

  const SKILL_LABELS = {
    UM_SERWIS: 'Serwis',
    UM_SILA_SERWISU: 'Sila serwisu',
    UM_PRZYJECIE: 'Przyjecie',
    UM_ROZGRYWANIE: 'Rozgrywanie',
    UM_WYSTAWA: 'Wystawa',
    UM_ATAK_ZE_SKRZYDLA: 'Atak ze skrzydla',
    UM_ATAK_ZE_SRODKA: 'Atak ze srodka',
    UM_ATAK_2L: 'Atak z 2 linii',
    UM_OMIJANIE_BLOKU: 'Omijanie bloku',
    UM_KIWKA: 'Kiwka',
    UM_ATAK_BO: 'Atak blok-aut',
    UM_OBRONA: 'Obrona',
    UM_ASEKURACJA: 'Asekuracja',
    UM_BLOK_AKTYWNY: 'Blok',
    UM_BLOK_PASYWNY: 'Blok pasywny',
    UM_USTAWIANIE: 'Ustawianie sie do bloku',
  };

  let renderTimer = 0;
  let observer = null;

  function injectStyles() {
    if (document.getElementById('vte-styles')) return;

    const style = document.createElement('style');
    style.id = 'vte-styles';
    style.textContent = `
      .vte-panel {
        margin: 6px 0;
        padding: 7px 10px;
        border: 1px solid rgba(93, 176, 225, 0.32);
        background: rgba(5, 23, 35, 0.72);
        color: #dceefa;
        font-size: 11px;
        line-height: 1.35;
        border-radius: 3px;
      }

      .vte-panel strong {
        color: #ffffff;
      }

      .vte-panel .vte-panel-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .vte-panel .vte-panel-warnings {
        margin-top: 5px;
        color: #ffd36b;
      }

      .vte-row-save-bar:not(.vte-row-low-after):not(.vte-row-critical-after) td.second {
        background-color: rgba(245, 158, 11, 0.08);
      }

      .vte-row-low-after:not(.vte-row-critical-after) td.second {
        background-color: rgba(251, 191, 36, 0.10);
      }

      .vte-row-critical-after td.second {
        background-color: rgba(239, 68, 68, 0.15);
      }

      .vte-row-max-selected:not(.vte-row-critical-after):not(.vte-row-low-after) td.second {
        background-color: rgba(220, 38, 38, 0.08);
      }

      .vte-badge {
        display: inline-block;
        margin: 2px 3px 0 0;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
        vertical-align: baseline;
        box-shadow: none;
      }

      .vte-badge-caution {
        color: #111827;
        background: #fbbf24;
      }

      .vte-badge-warning {
        color: #111827;
        background: #f97316;
      }

      .vte-badge-critical {
        color: #ffffff;
        background: #dc2626;
      }

      .vte-badge-save {
        color: #111827;
        background: #f59e0b;
      }

      .vte-badge-max {
        color: #ffffff;
        background: #be123c;
      }

      .vte-attr {
        font-weight: 700;
      }

      .vte-attr-low {
        color: #ff7b7b !important;
      }

      .vte-attr-mid {
        color: #ffd36b !important;
      }

      .vte-attr-good {
        color: #7ddf94 !important;
      }

      .vte-attr-high {
        color: #49d4ff !important;
      }

      .vte-attr-max {
        color: #ff5c5c !important;
        text-shadow: 0 0 5px rgba(255, 92, 92, 0.45);
      }
    `;
    document.head.appendChild(style);
  }

  function parseNumber(text) {
    const match = String(text || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function getSelectedSkill(view) {
    const select = document.getElementById(view.selectId);
    return select ? select.value : null;
  }

  function getTrainingCost(option) {
    if (option === 'wybrany') return 4;
    if (option === 'wytrz' || option === 'odp') return 1;
    return 0;
  }

  function clearPreviousEnhancements(form) {
    form.querySelectorAll('.vte-badge').forEach((badge) => badge.remove());
    form.querySelectorAll('.vte-row-low-after, .vte-row-critical-after, .vte-row-save-bar, .vte-row-max-selected').forEach((row) => {
      row.classList.remove('vte-row-low-after', 'vte-row-critical-after', 'vte-row-save-bar', 'vte-row-max-selected');
    });
  }

  function getTrainingRoot(view) {
    const form = document.getElementById(view.formId);
    if (form) return form;

    const select = document.getElementById(view.selectId);
    if (select) return document.body;

    const trainingInput = document.querySelector(`input[type="radio"][name^="${view.inputPrefix}"]`);
    if (trainingInput) return document.body;

    return null;
  }

  function colorAttributeValues(form, view) {
    form.querySelectorAll('font.link').forEach((node) => {
      const value = parseNumber(node.textContent);
      if (value === null) return;

      node.classList.add('vte-attr');
      node.classList.remove('vte-attr-low', 'vte-attr-mid', 'vte-attr-good', 'vte-attr-high', 'vte-attr-max');

      if (isMaxAttribute(value, view)) {
        node.classList.add('vte-attr-max');
      } else if (value < view.maxAttributeValue * 0.4) {
        node.classList.add('vte-attr-low');
      } else if (value < view.maxAttributeValue * 0.7) {
        node.classList.add('vte-attr-mid');
      } else if (value < view.maxAttributeValue * 0.9) {
        node.classList.add('vte-attr-good');
      } else {
        node.classList.add('vte-attr-high');
      }
    });
  }

  function isMaxAttribute(value, view) {
    return value >= view.maxAttributeValue - CONFIG.maxAttributeEpsilon;
  }

  function getPlayerRows(form, view) {
    const names = new Set(Array.from(form.querySelectorAll(`input[type="radio"][name^="${view.inputPrefix}"]`)).map((input) => input.name));

    return Array.from(names)
      .map((name) => {
        const inputs = Array.from(form.querySelectorAll(`input[type="radio"][name="${cssEscape(name)}"]`));
        const row = inputs[0] ? inputs[0].closest('tr') : null;
        if (!row || !row.querySelector('.small_link')) return null;
        return { name, row, inputs };
      })
      .filter(Boolean);
  }

  function getBarPercent(row) {
    const percentNode = Array.from(row.querySelectorAll('i')).find((node) => /%/.test(node.textContent));
    return percentNode ? parseNumber(percentNode.textContent) : null;
  }

  function getSelectedAttributeValue(row, selectedInput, selectedSkill) {
    if (!selectedInput || selectedInput.value === 'nietrenuj') return null;

    if (selectedInput.value === 'wybrany') {
      const skillNode = selectedSkill ? row.querySelector(`span[name="span_player_value_${cssEscape(selectedSkill)}"]`) : null;
      return skillNode ? parseNumber(skillNode.textContent) : null;
    }

    const valueCell = selectedInput.closest('td') ? selectedInput.closest('td').nextElementSibling : null;
    return valueCell ? parseNumber(valueCell.textContent) : null;
  }

  function appendBadge(target, label, className, title) {
    const badge = document.createElement('span');
    badge.className = `vte-badge ${className}`;
    badge.textContent = label;
    if (title) badge.title = title;
    target.appendChild(badge);
  }

  function getBadgeTarget(row, selectedInput) {
    if (selectedInput && selectedInput.closest('td') && selectedInput.closest('td').nextElementSibling) {
      return selectedInput.closest('td').nextElementSibling;
    }
    return row.querySelector('.small_link') || row;
  }

  function evaluateRow(player, selectedSkill, view) {
    const selectedInput = player.inputs.find((input) => input.checked);
    const selectedOption = selectedInput ? selectedInput.value : 'nietrenuj';
    const cost = getTrainingCost(selectedOption);
    const barBefore = view.hasTrainingBar ? getBarPercent(player.row) : null;
    const attrValue = getSelectedAttributeValue(player.row, selectedInput, selectedSkill);
    const barAfter = view.hasTrainingBar && barBefore !== null ? barBefore - cost : null;

    return {
      ...player,
      selectedInput,
      selectedOption,
      cost,
      barBefore,
      attrValue,
      barAfter,
      trains: cost > 0,
      impossible: view.hasTrainingBar && cost > 0 && barBefore !== null && barBefore < cost,
      maxSelected: cost > 0 && attrValue !== null && isMaxAttribute(attrValue, view),
      saveBar: view.hasTrainingBar && cost > 0 && attrValue !== null && barAfter !== null && attrValue >= CONFIG.savingAttributeValue && barAfter < CONFIG.savingBarAfter,
      lowAfter: view.hasTrainingBar && cost > 0 && barAfter !== null && barAfter < CONFIG.lowAfterCaution,
      criticalAfter: view.hasTrainingBar && cost > 0 && barAfter !== null && barAfter < CONFIG.lowAfterCritical,
    };
  }

  function applyRowWarnings(result) {
    if (!result.trains) return;

    const target = getBadgeTarget(result.row, result.selectedInput);

    if (result.criticalAfter || result.impossible) {
      result.row.classList.add('vte-row-critical-after');
      const label = result.impossible ? 'brak paska' : `po ${result.barAfter}%`;
      appendBadge(target, label, 'vte-badge-critical', 'Po treningu pasek bedzie krytycznie niski albo zawodnik nie ma wymaganej ilosci paska.');
    } else if (result.lowAfter) {
      result.row.classList.add('vte-row-low-after');
      const badgeClass = result.barAfter < CONFIG.lowAfterWarning ? 'vte-badge-warning' : 'vte-badge-caution';
      appendBadge(target, `po ${result.barAfter}%`, badgeClass, 'Po treningu pasek bedzie niski.');
    }

    if (result.saveBar) {
      result.row.classList.add('vte-row-save-bar');
      appendBadge(target, 'oszczedz pasek', 'vte-badge-save', 'Atrybut jest juz wysoki, a pasek po treningu bedzie niski.');
    }

    if (result.maxSelected) {
      result.row.classList.add('vte-row-max-selected');
      appendBadge(target, 'MAX', 'vte-badge-max', 'Wybrano trening atrybutu, ktory ma juz maksymalna wartosc.');
    }
  }

  function ensurePanel(form, view) {
    let panel = document.getElementById(view.panelId);
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = view.panelId;
    panel.className = 'vte-panel';

    const anchor = form.querySelector(`#${view.selectId}`) || document.getElementById(view.selectId);
    const formTable = form.tagName === 'FORM' ? form.firstElementChild : null;

    if (formTable && formTable.parentElement === form) {
      form.insertBefore(panel, formTable);
    } else if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(panel, anchor.parentElement.firstChild);
    } else if (form.firstElementChild) {
      form.insertBefore(panel, form.firstElementChild);
    } else {
      form.appendChild(panel);
    }

    return panel;
  }

  function renderPanel(panel, results, selectedSkill, view) {
    const trained = results.filter((result) => result.trains);
    const impossible = results.filter((result) => result.impossible);
    const lowAfter = results.filter((result) => result.lowAfter && !result.impossible);
    const saveBar = results.filter((result) => result.saveBar);
    const maxSelected = results.filter((result) => result.maxSelected);
    const selectedSkillName = SKILL_LABELS[selectedSkill] || selectedSkill || 'brak';

    const warnings = [];
    if (impossible.length) warnings.push(`${impossible.length} zawodnikow nie ma wymaganego paska.`);
    if (lowAfter.length) warnings.push(`${lowAfter.length} zawodnikow bedzie mialo niski pasek po treningu.`);
    if (saveBar.length) warnings.push(`${saveBar.length} wyborow wyglada na slabe uzycie paska.`);
    if (maxSelected.length) warnings.push(`${maxSelected.length} razy wybrano atrybut na maksymalnej wartosci.`);

    panel.innerHTML = `
      <div class="vte-panel-grid">
        <div><strong>${escapeHtml(view.label)}:</strong> ${escapeHtml(selectedSkillName)}</div>
        <div><strong>Trenuje:</strong> ${trained.length}</div>
        <div><strong>${view.hasTrainingBar ? 'Niski pasek po' : 'Max atrybutu'}:</strong> ${view.hasTrainingBar ? lowAfter.length : view.maxAttributeValue}</div>
        <div><strong>MAX:</strong> ${maxSelected.length}</div>
      </div>
      ${warnings.length ? `<div class="vte-panel-warnings">${warnings.map(escapeHtml).join(' ')}</div>` : ''}
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function enhanceTrainingView(view) {
    const form = getTrainingRoot(view);
    if (!form) return;

    if (observer) observer.disconnect();

    injectStyles();
    clearPreviousEnhancements(form);
    colorAttributeValues(form, view);

    const selectedSkill = getSelectedSkill(view);
    const results = getPlayerRows(form, view).map((player) => evaluateRow(player, selectedSkill, view));
    results.forEach(applyRowWarnings);

    renderPanel(ensurePanel(form, view), results, selectedSkill, view);

    if (observer) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function enhanceTrainingViews() {
    VIEW_CONFIGS.forEach(enhanceTrainingView);
  }

  function scheduleEnhance() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(enhanceTrainingViews, CONFIG.rerenderDelayMs);
  }

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (VIEW_CONFIGS.some((view) => target.id === view.selectId || target.matches(`input[type="radio"][name^="${view.inputPrefix}"]`))) {
      scheduleEnhance();
    }
  });

  observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scheduleEnhance();
})();
