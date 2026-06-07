#!/usr/bin/env node

'use strict';

var assert = require('assert');
var dom = require('../vm-dom-utils.js');

function createMockElement(visible) {
  return {
    nodeType: 1,
    style: visible ? {} : { display: 'none' },
    parentElement: null,
    getBoundingClientRect: function () {
      return visible ? { width: 10, height: 10 } : { width: 0, height: 0 };
    },
    remove: function () {
      this.removed = true;
    }
  };
}

function createMockDocument(ids) {
  var store = ids || {};

  return {
    getElementById: function (id) {
      return store[id] ? store[id][0] : null;
    },
    querySelectorAll: function (selector) {
      if (selector.indexOf('[id="') === 0) {
        var id = selector.slice(5, -2);
        return store[id] || [];
      }
      return [];
    }
  };
}

var visible = createMockElement(true);
var hidden = createMockElement(false);

assert.strictEqual(dom.isVisibleElement(visible), true);
assert.strictEqual(dom.isVisibleElement(hidden), false);
assert.strictEqual(dom.getVisibleElementById(createMockDocument({
  foo: [visible, hidden]
}), 'foo'), visible);
assert.strictEqual(dom.removeHiddenById(createMockDocument({
  foo: [hidden]
}), 'foo'), true);
assert.strictEqual(hidden.removed, true);

console.log('dom utils ok');
