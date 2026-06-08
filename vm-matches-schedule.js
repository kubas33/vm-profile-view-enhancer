// ==UserScript==
// @name         VM Matches Schedule Parser
// @namespace    https://vm-manager.org/
// @version      1.2.0
// @description  Parses VM Manager match schedule HTML and estimates days left in season.
// @grant        none
// @run-at       document-start
// @updateURL    https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-matches-schedule.js
// @downloadURL  https://github.com/kubas33/vm-enhanced-pack/raw/refs/heads/main/vm-matches-schedule.js
// ==/UserScript==

(function (root, factory) {
  var api = factory(root);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.VMMatchesSchedule = api;
  }
}(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var DEFAULT_SEASON_END_BUFFER_DAYS = 5;
  var MAX_MONTHS_TO_FETCH = 12;

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

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function getLocalDateOnly(date) {
    var current = date || new Date();
    return current.getFullYear() + '-' + pad2(current.getMonth() + 1) + '-' + pad2(current.getDate());
  }

  function parseDateOnly(dateTime) {
    return String(dateTime || '').slice(0, 10);
  }

  function toUtcDay(dateOnly) {
    var parts = String(dateOnly).split('-').map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }

  function daysBetween(fromDateOnly, toDateOnly) {
    var diff = toUtcDay(toDateOnly) - toUtcDay(fromDateOnly);
    return Math.round(diff / 86400000);
  }

  function addDays(dateOnly, days) {
    var date = new Date(toUtcDay(dateOnly));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function maxDateOnly(dates) {
    return dates.reduce(function (best, current) {
      return !best || current > best ? current : best;
    }, '');
  }

  function parseMatchTypeFromChunk(chunk) {
    if (/pic\/match\/league\.jpg/i.test(chunk)) {
      return 'league';
    }
    if (/pic\/match\/friendly\.jpg/i.test(chunk)) {
      return 'friendly';
    }
    if (/pic\/match\/cup_int\.jpg/i.test(chunk)) {
      return 'cup_int';
    }
    if (/pic\/match\/cup\.jpg/i.test(chunk)) {
      return 'cup';
    }
    return 'unknown';
  }

  function isLeagueRow(row) {
    return row && row.type === 'league';
  }

  function getLeagueRows(rows) {
    return (rows || []).filter(isLeagueRow);
  }

  function parseMatchRowsFromHtml(html) {
    var source = String(html || '');
    var rows = [];
    var chunks = source.split(/<tr><td class=(["'])second_left_right\1><\/td>/i);
    var i;
    var chunk;
    var dateMatch;
    var played;

    for (i = 1; i < chunks.length; i += 1) {
      chunk = chunks[i];
      dateMatch = chunk.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);

      if (!dateMatch) {
        continue;
      }

      played = /MatchDetail&matchId=\d+/i.test(chunk)
        && /<b>\s*\d+\s*<\/b>\s*:\s*<b>\s*\d+\s*<\/b>/i.test(chunk);

      rows.push({
        dateTime: dateMatch[1],
        date: parseDateOnly(dateMatch[1]),
        played: played,
        type: parseMatchTypeFromChunk(chunk),
      });
    }

    return rows;
  }

  function parseForwardMonthLink(html) {
    var source = String(html || '');
    var regex = /callGetViewPanelBody\('Matches&teamId=(\d+)&month=(\d+)&year=(\d+)&stopLink=0'\);[\s\S]{0,60}?>>/gi;
    var match;
    var last = null;

    while ((match = regex.exec(source)) !== null) {
      last = {
        teamId: match[1],
        month: Number(match[2]),
        year: Number(match[3]),
      };
    }

    return last;
  }

  function resolveCurrentDate(options) {
    if (options && options.currentDate) {
      return parseDateOnly(options.currentDate);
    }

    return getLocalDateOnly();
  }

  function buildScheduleResult(rows, options, meta) {
    var opts = options || {};
    var extra = meta || {};
    var bufferDays = Number(opts.bufferDays);
    var leagueRows = getLeagueRows(rows);
    var leagueDates = leagueRows.map(function (row) { return row.date; });
    var lastLeagueMatchDate = maxDateOnly(leagueDates);
    var currentDate = resolveCurrentDate(opts);
    var seasonEndDate = null;
    var daysLeftInSeason = null;

    if (!bufferDays || Number.isNaN(bufferDays)) {
      bufferDays = DEFAULT_SEASON_END_BUFFER_DAYS;
    }

    if (lastLeagueMatchDate) {
      seasonEndDate = addDays(lastLeagueMatchDate, bufferDays);
    }

    if (seasonEndDate && currentDate) {
      daysLeftInSeason = Math.max(0, daysBetween(currentDate, seasonEndDate));
    }

    return Object.assign({
      rows: rows,
      leagueRows: leagueRows,
      matchCount: rows.length,
      leagueMatchCount: leagueRows.length,
      lastMatchDate: lastLeagueMatchDate,
      lastLeagueMatchDate: lastLeagueMatchDate,
      seasonEndDate: seasonEndDate,
      currentDate: currentDate,
      currentDateSource: opts.currentDate ? 'explicit' : 'browser',
      daysLeftInSeason: daysLeftInSeason,
      bufferDays: bufferDays,
      matchTypeFilter: 'league',
    }, extra);
  }

  function computeSeasonSchedule(html, options) {
    return buildScheduleResult(parseMatchRowsFromHtml(html), options, {
      monthsFetched: 1,
      seasonEndedBecauseEmptyMonth: false,
    });
  }

  function collectSeasonRowsFromMonthPages(monthPages) {
    var allRows = [];
    var monthsWithLeagueMatches = 0;
    var seasonEndedBecauseEmptyMonth = false;
    var i;
    var page;
    var rows;
    var leagueRows;

    for (i = 0; i < monthPages.length; i += 1) {
      page = monthPages[i];
      rows = parseMatchRowsFromHtml(page.html);
      leagueRows = getLeagueRows(rows);

      if (!leagueRows.length) {
        if (monthsWithLeagueMatches > 0) {
          seasonEndedBecauseEmptyMonth = true;
        }
        break;
      }

      allRows = allRows.concat(leagueRows);
      monthsWithLeagueMatches += 1;
    }

    return {
      rows: allRows,
      monthsFetched: monthPages.length,
      monthsWithMatches: monthsWithLeagueMatches,
      monthsWithLeagueMatches: monthsWithLeagueMatches,
      seasonEndedBecauseEmptyMonth: seasonEndedBecauseEmptyMonth,
    };
  }

  function computeSeasonScheduleFromMonthPages(monthPages, options) {
    var collected = collectSeasonRowsFromMonthPages(monthPages);
    return buildScheduleResult(collected.rows, options, {
      monthsFetched: collected.monthsFetched,
      monthsWithMatches: collected.monthsWithMatches,
      monthsWithLeagueMatches: collected.monthsWithLeagueMatches,
      seasonEndedBecauseEmptyMonth: collected.seasonEndedBecauseEmptyMonth,
    });
  }

  function findTeamIdFromHtml(html) {
    var match = String(html || '').match(/Club&teamId=(\d+)/i);
    return match ? match[1] : null;
  }

  function buildMatchesUrl(teamId, month, year) {
    var url = '/Ajax_handler.php?phpsite=view_body.php&action=Matches';

    if (teamId) {
      url += '&teamId=' + encodeURIComponent(teamId);
    }

    if (month != null && year != null) {
      url += '&month=' + encodeURIComponent(month) + '&year=' + encodeURIComponent(year);
    }

    return url;
  }

  function fetchMatchesHtml(fetchFn, teamId, month, year) {
    return fetchFn(buildMatchesUrl(teamId, month, year), {
      credentials: 'same-origin',
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Matches fetch failed with status ' + response.status);
      }
      return response.text();
    });
  }

  function fetchSeasonSchedule(fetchImpl, options) {
    var opts = options || {};
    var fetchFn = fetchImpl || (root && root.fetch);
    var teamId = opts.teamId;
    var visited = {};
    var monthPages = [];
    var monthsFetched = 0;

    if (!fetchFn) {
      return Promise.reject(new Error('fetch is not available'));
    }

    function visitMonth(html) {
      var rows = parseMatchRowsFromHtml(html);
      var leagueRows = getLeagueRows(rows);
      var collected;
      var next;
      var visitKey;

      monthPages.push({ html: html, rows: rows });
      monthsFetched += 1;
      teamId = teamId || findTeamIdFromHtml(html);
      collected = collectSeasonRowsFromMonthPages(monthPages);

      if (!leagueRows.length && collected.monthsWithLeagueMatches > 0) {
        return buildScheduleResult(collected.rows, opts, {
          teamId: teamId,
          monthsFetched: monthsFetched,
          monthsWithMatches: collected.monthsWithMatches,
          monthsWithLeagueMatches: collected.monthsWithLeagueMatches,
          seasonEndedBecauseEmptyMonth: true,
        });
      }

      if (monthsFetched >= MAX_MONTHS_TO_FETCH) {
        return finalize();
      }

      next = parseForwardMonthLink(html);
      if (!next) {
        return finalize();
      }

      visitKey = next.year + '-' + next.month;
      if (visited[visitKey]) {
        return finalize();
      }
      visited[visitKey] = true;
      teamId = teamId || next.teamId;

      return fetchMatchesHtml(fetchFn, teamId, next.month, next.year)
        .then(function (text) {
          return visitMonth(extractVmBody(text));
        });
    }

    function finalize() {
      var collected = collectSeasonRowsFromMonthPages(monthPages);
      return buildScheduleResult(collected.rows, opts, {
        teamId: teamId,
        monthsFetched: monthsFetched,
        monthsWithMatches: collected.monthsWithMatches,
        monthsWithLeagueMatches: collected.monthsWithLeagueMatches,
        seasonEndedBecauseEmptyMonth: collected.seasonEndedBecauseEmptyMonth,
      });
    }

    return fetchMatchesHtml(fetchFn, teamId, null, null)
      .then(function (text) {
        return visitMonth(extractVmBody(text));
      });
  }

  return {
    DEFAULT_SEASON_END_BUFFER_DAYS: DEFAULT_SEASON_END_BUFFER_DAYS,
    MAX_MONTHS_TO_FETCH: MAX_MONTHS_TO_FETCH,
    extractVmBody: extractVmBody,
    getLocalDateOnly: getLocalDateOnly,
    parseMatchRowsFromHtml: parseMatchRowsFromHtml,
    parseMatchTypeFromChunk: parseMatchTypeFromChunk,
    getLeagueRows: getLeagueRows,
    parseForwardMonthLink: parseForwardMonthLink,
    computeSeasonSchedule: computeSeasonSchedule,
    collectSeasonRowsFromMonthPages: collectSeasonRowsFromMonthPages,
    computeSeasonScheduleFromMonthPages: computeSeasonScheduleFromMonthPages,
    findTeamIdFromHtml: findTeamIdFromHtml,
    buildMatchesUrl: buildMatchesUrl,
    fetchSeasonSchedule: fetchSeasonSchedule,
  };
}));
