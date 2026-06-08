#!/usr/bin/env node

'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var schedule = require('../vm-matches-schedule.js');

var root = path.resolve(__dirname, '..');
var fixture = fs.readFileSync(path.join(root, 'raw_data', 'fixture.md'), 'utf8');
var html = schedule.extractVmBody(fixture);
var rows = schedule.parseMatchRowsFromHtml(html);
var leagueRows = schedule.getLeagueRows(rows);
var result = schedule.computeSeasonSchedule(html, { currentDate: '2026-06-18' });

assert.ok(rows.length >= 10, 'expected multiple matches in fixture');
assert.ok(leagueRows.length < rows.length, 'fixture should include non-league matches');
assert.strictEqual(result.lastMatchDate, '2026-06-18', 'last league match date from fixture');
assert.strictEqual(result.lastLeagueMatchDate, '2026-06-18');
assert.strictEqual(result.seasonEndDate, '2026-06-23', 'season end should be last league match + 5 days');
assert.strictEqual(result.daysLeftInSeason, 5, 'days left from 2026-06-18 to 2026-06-23');
assert.strictEqual(result.currentDateSource, 'explicit');
assert.strictEqual(result.matchTypeFilter, 'league');

var forward = schedule.parseForwardMonthLink(html);
assert.deepStrictEqual(forward, { teamId: '128789', month: 7, year: 2026 }, 'forward month link from fixture');

var emptyNextMonth = schedule.computeSeasonScheduleFromMonthPages([
  { html: html },
  { html: '<table><tr><td class="second">Brak meczy</td></tr></table>' },
], { currentDate: '2026-06-08' });

assert.strictEqual(emptyNextMonth.lastMatchDate, '2026-06-18');
assert.strictEqual(emptyNextMonth.seasonEndedBecauseEmptyMonth, true);
assert.strictEqual(emptyNextMonth.daysLeftInSeason, 15);
assert.strictEqual(emptyNextMonth.monthsWithLeagueMatches, 1);

var friendlyOnlyNextMonth = schedule.computeSeasonScheduleFromMonthPages([
  { html: html },
  { html: ''
    + '<tr><td class="second_left_right"></td>'
    + '<td class="second">2026-07-05 11:00</td>'
    + '<td class="second"><img class=\'flagSmall\' src=\'pic/match/friendly.jpg\' alt=\'PL\'></td>'
    + '</tr>' },
], { currentDate: '2026-06-08' });

assert.strictEqual(friendlyOnlyNextMonth.lastMatchDate, '2026-06-18');
assert.strictEqual(friendlyOnlyNextMonth.seasonEndedBecauseEmptyMonth, true);
assert.strictEqual(friendlyOnlyNextMonth.daysLeftInSeason, 15);

var browserToday = schedule.computeSeasonSchedule(html, {
  currentDate: schedule.getLocalDateOnly(new Date('2026-06-08T12:00:00')),
});
assert.strictEqual(browserToday.currentDate, '2026-06-08');
assert.strictEqual(browserToday.daysLeftInSeason, 15);

console.log('vm-matches-schedule: all tests passed');
