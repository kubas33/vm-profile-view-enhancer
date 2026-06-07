// ==UserScript==
// @name         VM DOM Utils
// @namespace    https://vm-manager.org/
// @version      1.0.0
// @description  Shared DOM helpers for VM Manager enhancer userscripts. Loaded automatically via @require from other scripts; manual install is optional.
// @grant        none
// @run-at       document-start
// @updateURL    https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-dom-utils.js
// @downloadURL  https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-dom-utils.js
// ==/UserScript==

(function (root, factory) {
  var api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VMDomUtils = api;
  }
}(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  function cssEscape(value) {
    if (root && root.CSS && typeof root.CSS.escape === 'function') {
      return root.CSS.escape(String(value));
    }

    return String(value).replace(/["\\]/g, '\\$&');
  }

  function isVisibleElement(element) {
    var rect;
    var parent;

    if (!element || element.nodeType !== 1) {
      return false;
    }

    parent = element;
    while (parent && parent.nodeType === 1) {
      if (parent.style && (parent.style.display === 'none' || parent.style.visibility === 'hidden')) {
        return false;
      }
      parent = parent.parentElement;
    }

    if (!element.getBoundingClientRect) {
      return true;
    }

    rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  function getElementsById(documentRef, id) {
    var escaped = cssEscape(id);
    var nodes = documentRef.querySelectorAll('[id="' + escaped + '"]');

    if (nodes.length) {
      return Array.prototype.slice.call(nodes);
    }

    return documentRef.getElementById(id) ? [documentRef.getElementById(id)] : [];
  }

  function getVisibleElementById(documentRef, id) {
    var nodes = getElementsById(documentRef, id);
    var i;

    for (i = 0; i < nodes.length; i += 1) {
      if (isVisibleElement(nodes[i])) {
        return nodes[i];
      }
    }

    return null;
  }

  function queryVisibleAll(documentRef, selector, scope) {
    var rootNode = scope || documentRef;
    var nodes = Array.prototype.slice.call(rootNode.querySelectorAll(selector));

    return nodes.filter(isVisibleElement);
  }

  function queryVisibleFirst(documentRef, selector, scope) {
    var nodes = queryVisibleAll(documentRef, selector, scope);

    return nodes.length ? nodes[0] : null;
  }

  function removeHiddenById(documentRef, id) {
    var nodes = getElementsById(documentRef, id);
    var removed = false;

    nodes.forEach(function (node) {
      if (!isVisibleElement(node)) {
        node.remove();
        removed = true;
      }
    });

    return removed;
  }

  function hideElement(element, markerAttr) {
    if (!element) {
      return;
    }

    if (markerAttr) {
      element.setAttribute(markerAttr, '1');
    }

    element.style.display = 'none';
  }

  function restoreHiddenElements(documentRef, markerAttr) {
    if (!markerAttr) {
      return;
    }

    Array.prototype.slice.call(documentRef.querySelectorAll('[' + markerAttr + '="1"]')).forEach(function (element) {
      element.style.display = '';
      element.removeAttribute(markerAttr);
    });
  }

  function createViewScheduler(options) {
    var scheduleTimer = null;
    var wasActive = false;
    var delayMs = options.delayMs || 120;
    var documentRef = options.document || (root && root.document) || null;
    var observerTarget = options.observerTarget || (documentRef && documentRef.body);

    function run() {
      var active = options.isActive(documentRef);

      if (!active) {
        if (wasActive && options.onDeactivate) {
          options.onDeactivate(documentRef);
        }
        wasActive = false;
        return;
      }

      wasActive = true;

      if (options.onEnhance) {
        options.onEnhance(documentRef);
      }
    }

    function schedule() {
      if (scheduleTimer) {
        clearTimeout(scheduleTimer);
      }

      scheduleTimer = setTimeout(function () {
        scheduleTimer = null;
        run();
      }, delayMs);
    }

    function start() {
      if (!documentRef || !observerTarget) {
        return;
      }

      run();

      new MutationObserver(schedule).observe(observerTarget, {
        childList: true,
        subtree: true
      });
    }

    return {
      start: start,
      run: run,
      schedule: schedule
    };
  }

  return {
    cssEscape: cssEscape,
    isVisibleElement: isVisibleElement,
    getElementsById: getElementsById,
    getVisibleElementById: getVisibleElementById,
    queryVisibleAll: queryVisibleAll,
    queryVisibleFirst: queryVisibleFirst,
    removeHiddenById: removeHiddenById,
    hideElement: hideElement,
    restoreHiddenElements: restoreHiddenElements,
    createViewScheduler: createViewScheduler
  };
}));
