/**
 * LoLLife - 遊戲核心控制器 (App Controller)
 * 完整實作 1~5 階段：
 * 1. 互動式 BP 選角與 7 階段戰術決策對決
 * 2. 英雄池 7 級熟練度與自主特訓
 * 3. 40+ 寫實事件卡與 19 種特質自動解鎖
 * 4. 轉會市場、合約談判與 LCK/LPL 旅外挑戰
 * 5. 名人堂退役結算與 Canvas 高清圖片下載按鈕
 */

import { RNG } from './rng.js';
import { CHAMPIONS, getChampionById, getMasteryInfo } from '../data/champions.js';
import { TEAMS, getTeamById, REGIONS } from '../data/teams.js';
import { SPLITS, INTERNATIONAL_TOURNAMENTS } from '../data/leagues.js';
import { EVENTS, getRandomEvent } from '../data/events.js';
import { TRAITS, getTraitById } from '../data/traits.js';
import { generateSplitMeta, calculateChampionMetaBonus } from '../data/meta.js';
import { HOF_TIERS, RetirementManager } from './retirement.js';

// ==================== 全域狀態與種子初始化 ====================
let SEED = new URLSearchParams(location.search).get('seed') || Math.random().toString(36).slice(2, 10);
let rng = new RNG(SEED);
let S = null; // 當前生涯狀態
let TL = []; // 生涯時間軸紀錄
let _curYearBody = null;
const MAX_YEARS = 10;
let _allowLeave = false;

const ABL = {
  mechanics: '操作',
  laning: '對線',
  macro: '觀念',
  teamfight: '團戰',
  championPool: '英雄池',
  mental: '心態',
  communication: '溝通',
  discipline: '紀律',
};

const POS_NAMES = {
  TOP: '上路 (TOP)',
  JUG: '打野 (JUG)',
  MID: '中路 (MID)',
  ADC: '下路 (ADC)',
  SUP: '輔助 (SUP)',
};

const ROLE_WEIGHTS = {
  TOP: { mechanics: 0.20, laning: 0.25, macro: 0.15, teamfight: 0.15, championPool: 0.10, mental: 0.05, communication: 0.05, discipline: 0.05 },
  JUG: { mechanics: 0.15, laning: 0.05, macro: 0.30, teamfight: 0.15, championPool: 0.10, mental: 0.10, communication: 0.10, discipline: 0.05 },
  MID: { mechanics: 0.25, laning: 0.20, macro: 0.15, teamfight: 0.15, championPool: 0.10, mental: 0.05, communication: 0.05, discipline: 0.05 },
  ADC: { mechanics: 0.25, laning: 0.20, macro: 0.10, teamfight: 0.25, championPool: 0.05, mental: 0.10, communication: 0.02, discipline: 0.03 },
  SUP: { mechanics: 0.10, laning: 0.10, macro: 0.25, teamfight: 0.20, championPool: 0.05, mental: 0.10, communication: 0.15, discipline: 0.05 },
};

// ==================== 選手狀態構建 ====================
function newPlayerState(name, inGameId, pos) {
  const ab = {
    mechanics: rng.range(44, 58),
    laning: rng.range(42, 56),
    macro: rng.range(40, 52),
    teamfight: rng.range(42, 56),
    championPool: rng.range(42, 54),
    mental: rng.range(44, 56),
    communication: rng.range(40, 54),
    discipline: rng.range(45, 62),
  };

  if (pos === 'MID' || pos === 'ADC') { ab.mechanics += 6; ab.laning += 4; }
  else if (pos === 'JUG' || pos === 'SUP') { ab.macro += 6; ab.communication += 5; }
  else if (pos === 'TOP') { ab.laning += 6; ab.mechanics += 4; }

  // 潛力上限 (64~84)
  const pot = {};
  Object.keys(ab).forEach(k => {
    pot[k] = Math.min(85, ab[k] + rng.range(16, 28));
  });

  // 初始英雄池 (1~2 招牌, 4~6 熟練)
  const masteries = {};
  const roleChamps = CHAMPIONS.filter(c => c.primaryRole === pos || c.roles.includes(pos));
  const shuffled = [...roleChamps].sort(() => rng.next() - 0.5);
  
  // 招牌英雄 (120~150 點)
  if (shuffled[0]) masteries[shuffled[0].id] = rng.range(125, 150);
  if (shuffled[1]) masteries[shuffled[1].id] = rng.range(120, 140);
  // 熟練英雄 (75~100 點)
  for (let i = 2; i < 6 && i < shuffled.length; i++) {
    masteries[shuffled[i].id] = rng.range(75, 95);
  }

  return {
    name,
    inGameId,
    pos,
    seed: SEED,
    age: 16,
    year: 2026,
    stage: 'AMATEUR', // 'AMATEUR' -> 'PRO' -> 'RETIRED'
    stageYr: 1,
    team: '台灣業餘體系',
    teamId: 'TW_AMATEUR_ROOKIE',
    region: 'AMATEUR_TW',
    salary: 0,
    money: 20000,
    ab,
    pot,
    carry: {}, // 未滿一級的經驗槽
    masteries,
    signatureChamps: [shuffled[0]?.id, shuffled[1]?.id].filter(Boolean),
    traits: {},
    removed: [],
    wristHealth: 100,
    sleepHealth: 95,
    fatigue: 10,
    stress: 15,
    coachTrust: 60,
    teamAffinity: 60,
    popularity: 10,
    stats: { matchesPlayed: 0, matchesWon: 0, kills: 0, deaths: 0, assists: 0, titlesWon: 0, intlTitles: 0, worldsTitles: 0, pogCount: 0, champsUsed: {}, teamHistory: [] },
    done: false,
  };
}

function ensureSeasonProperties() {
  if (!S) return;
  if (S.rosterStatus === undefined) S.rosterStatus = 'STARTER';
  if (S.benchCompetitorOvr === undefined) S.benchCompetitorOvr = rng.range(65, 75);
  if (S.wristHealth === undefined) S.wristHealth = 100;
  if (S.fatigue === undefined) S.fatigue = 10;
  if (S.coachTrust === undefined) S.coachTrust = 60;
  if (S.injuryRoundsLeft === undefined) S.injuryRoundsLeft = 0;
  if (S.injuryType === undefined) S.injuryType = null;
  if (S.tactics === undefined) {
    S.tactics = {
      banPickPreference: 'META',
      style: 'BALANCED'
    };
  }
  if (S.season && S.season.standings && !S.season.academyStandings) {
    S.season.academyStandings = {};
    Object.keys(S.season.standings).forEach(id => {
      S.season.academyStandings[id] = { wins: S.season.standings[id].wins, losses: S.season.standings[id].losses };
    });
  }
}

function recordMatchStats(won, isManual, manualK = 0, manualD = 0, manualA = 0) {
  if (!S) return { k: 0, d: 0, a: 0, pog: false };
  if (!S.currentSplitStats) {
    S.currentSplitStats = { matchesPlayed: 0, matchesWon: 0, kills: 0, deaths: 0, assists: 0, pogCount: 0 };
  }
  
  let k = 0, d = 0, a = 0, pog = false;
  if (isManual) {
    k = manualK;
    d = manualD;
    a = manualA;
    pog = won && (k >= 6 || a >= 10 || ovr() >= 68);
  } else {
    k = rng.range(4, 15);
    d = rng.range(2, 9);
    a = rng.range(8, 25);
    pog = won && (rng.next() < (ovr() / 120));
  }
  
  S.stats.kills += k;
  S.stats.deaths += d;
  S.stats.assists += a;
  if (pog) S.stats.pogCount += 1;
  
  S.currentSplitStats.kills += k;
  S.currentSplitStats.deaths += d;
  S.currentSplitStats.assists += a;
  if (pog) S.currentSplitStats.pogCount += 1;
  
  return { k, d, a, pog };
}

// ==================== 核心輔助計算 ====================
function ovr() {
  if (!S) return 50;
  ensureSeasonProperties();
  const w = ROLE_WEIGHTS[S.pos] || ROLE_WEIGHTS.MID;
  let sum = 0;
  Object.keys(S.ab).forEach(k => sum += (S.ab[k] || 20) * (w[k] || 0.125));
  let factor = 1.0;
  if (S.fatigue > 70) factor -= 0.08;
  if (S.wristHealth < 50) factor -= 0.08;
  let val = Math.round(sum * factor);
  if (S.injuryRoundsLeft && S.injuryRoundsLeft > 0) {
    val = Math.max(20, val - 15); // -15 OVR injury penalty
  }
  return val;
}

function playerType() {
  if (!S) return '新星';
  const a = S.ab;
  if (S.pos === 'MID' && a.mechanics >= 68) return '極限操作狂';
  if (S.pos === 'ADC' && a.teamfight >= 68) return '團戰死神';
  if (S.pos === 'JUG' && a.macro >= 68) return '節奏大腦';
  if (S.pos === 'TOP' && a.laning >= 68) return '邊線霸主';
  if (S.pos === 'SUP' && a.communication >= 68) return '指揮大腦';
  if (ovr() >= 72) return '全能明星';
  return '潛力新秀';
}

function getAbBaseCost(val) {
  if (val < 50) return 1;
  const n = Math.floor((val - 50) / 10);
  return Math.pow(2, n + 1);
}

function addAb(k, v) {
  if (!S || !(k in S.ab)) return 0;
  const o = S.ab[k];
  if (v < 0) { S.ab[k] = Math.max(20, Math.min(99, o + v)); return S.ab[k] - o; }
  let cur = o, bud = v + (S.carry[k] || 0);
  const pk = S.pot[k] || 75;
  while (bud > 0 && cur < 99) {
    let cost = getAbBaseCost(cur);
    if (cur >= pk) cost *= 3;
    if (bud >= cost) { bud -= cost; cur++; } else break;
  }
  S.carry[k] = cur >= 99 ? 0 : bud;
  S.ab[k] = cur;
  return cur - o;
}

function abCost(k) {
  if (!S) return 1;
  const cur = S.ab[k], pk = S.pot[k] || 75;
  let c = getAbBaseCost(cur);
  if (cur >= pk) c *= 3;
  return c;
}

// ==================== UI 基礎與卡片流 ====================
const $ = id => document.getElementById(id);
function logTarget() { return _curYearBody || $('log'); }

function scrollBottom() {
  try { requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight)); }
  catch (e) { try { window.scrollTo(0, document.body.scrollHeight); } catch (_) {} }
}

function card(cls, title, html) {
  const d = document.createElement('div');
  d.className = 'card ' + (cls || '');
  d.innerHTML = (title ? `<h4>${title}</h4>` : '') + html;
  logTarget().appendChild(d);
  renderTraits();
  checkTraitsAutoUnlock();
  scrollBottom();
}

function divider(t) {
  const log = $('log');
  const blocks = log.querySelectorAll('.yr-block');
  const prev = blocks[blocks.length - 1];
  if (prev) {
    const h = prev.querySelector('.yr-head');
    if (h && prev.querySelector('.yr-body').children.length) h.classList.add('has-body');
  }
  const prevPrev = blocks[blocks.length - 2];
  if (prevPrev) prevPrev.classList.add('collapsed');

  const block = document.createElement('div');
  block.className = 'yr-block';
  const head = document.createElement('div');
  head.className = 'yr-head';
  head.textContent = t;
  const body = document.createElement('div');
  body.className = 'yr-body';
  head.onclick = () => block.classList.toggle('collapsed');
  block.appendChild(head);
  block.appendChild(body);
  log.appendChild(block);
  _curYearBody = body;

  const newBlocks = log.querySelectorAll('.yr-block');
  if (newBlocks.length > MAX_YEARS) {
    for (let i = 0; i < newBlocks.length - MAX_YEARS; i++) newBlocks[i].remove();
  }
}

function board(phase = 0) {
  if (!S) return;
  ensureSeasonProperties();
  renderTraits();
  $('board').style.display = 'block';

  $('bd-name').innerHTML = `${S.inGameId}<small>${S.name}·${POS_NAMES[S.pos]}·${playerType()}</small>`;
  const teamObj = getTeamById(S.teamId);
  const statusStr = S.rosterStatus === 'SUB' ? '【替補】' : S.rosterStatus === 'ACADEMY' ? '【二軍】' : '【先發】';
  const teamNameStr = S.rosterStatus === 'ACADEMY' 
    ? (teamObj ? `${teamObj.shortName} Acad` : `${S.team} 二隊`)
    : (teamObj ? teamObj.shortName : S.team);
  $('bd-team').innerText = `${statusStr} ${teamNameStr}${teamObj ? ` (${teamObj.region})` : ''}`;

  $('bd-age').innerText = S.age;
  $('bd-year').innerText = S.year;
  $('bd-ovr').innerText = ovr();

  const salP = S.salary >= 10000 ? (S.salary / 10000).toFixed(1) : S.salary.toLocaleString();
  const salU = S.salary >= 10000 ? '生涯薪(億)' : '生涯薪(萬)';
  $('bd-sal').innerText = salP;
  $('bd-sal-lbl').innerText = salU;

  // 燈號
  ['lp0', 'lp1', 'lp2'].forEach((lp, idx) => {
    $(lp).classList.toggle('on', idx === phase);
  });

  renderTimeline();
}

function choose(title, opts) {
  const act = $('act');
  act.style.display = 'block';
  act.innerHTML = `<div class="title">${title}</div>` + opts.map((o, i) => `
    <button class="btn${o.main ? ' main' : ''}${o.warn ? ' warn' : ''}" data-idx="${i}" ${o.disabled ? 'disabled style="opacity:0.4; cursor:default;"' : ''}>
      ${o.t}
      ${o.s ? `<small>${o.s}</small>` : ''}
    </button>
  `).join('');

  act.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      if (btn.hasAttribute('disabled')) return;
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      act.style.display = 'none';
      if (opts[idx] && opts[idx].f) opts[idx].f();
    };
  });
  scrollBottom();
}

// ==================== 骰子與加點系統 (支援退回與依序消耗) ====================
function rollDice(count = 4, label = '季前特訓加點', onComplete) {
  const act = $('act');
  act.style.display = 'block';
  let dice = [];
  for (let i = 0; i < count; i++) dice.push(rng.range(1, 6));
  let idx = 0;
  let hist = []; // [{ key, got, prevCarry }]

  function remaining() {
    return dice.length - idx;
  }

  function renderAlloc() {
    const activeVal = idx < dice.length ? dice[idx] : 0;

    act.innerHTML = `
      <div class="title">${label}</div>
      <div id="dice">
        ${dice.map((v, i) => `
          <div class="die ${i < idx ? 'used' : ''} ${i === idx ? 'active' : ''} ${v === 6 ? 'six' : ''}">${v}</div>
        `).join('')}
      </div>
      <div class="pool">
        ${remaining() > 0 
          ? `當前骰子：<b class="hl">${activeVal} 點</b>（點擊下方能力直接挹注，剩餘 ${remaining()} 顆）` 
          : `<b class="hl">所有骰子已分配完畢！</b>`}
      </div>
      <div id="alloc-rows">
        ${Object.keys(ABL).map(k => {
          const cur = S.ab[k];
          const pot = S.pot[k] || 75;
          const pct = Math.min(100, Math.round((cur / 99) * 100));
          const potPct = Math.min(100, Math.round((pot / 99) * 100));
          const cost = abCost(k);
          const cr = (S.carry && S.carry[k]) || 0;
          const cap = cur >= 99;
          return `
            <div class="abrow${cap ? ' capped' : ''}" data-key="${k}">
              <div class="nm">${ABL[k]}</div>
              <div class="bar">
                <i style="width:${pct}%;"></i>
                <em style="left:${potPct}%;"></em>
              </div>
              <div class="val">
                ${cur}<small style="opacity:0.5;">/${pot}</small>
                ${cost > 1 ? `<span style="display:block;opacity:0.5;font-size:10.5px;margin-top:-2px;">${cr}/${cost}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="row2" style="margin-top:10px;">
        <button class="btn" id="btn-undo-alloc" style="text-align:center; ${hist.length === 0 ? 'opacity:0.4; cursor:default;' : ''}" ${hist.length === 0 ? 'disabled' : ''}>
          ↩ 退回上一步
        </button>
        ${remaining() === 0 ? `
          <button class="btn main" id="btn-finish-alloc" style="text-align:center;">
            完成分配 ▸ 繼續
          </button>
        ` : `
          <button class="btn" style="text-align:center; opacity:0.4; cursor:default;" disabled>
            剩餘 ${remaining()} 顆骰子
          </button>
        `}
      </div>
    `;

    // 點擊能力直接注入整顆骰子
    act.querySelectorAll('.abrow').forEach(row => {
      row.onclick = () => {
        if (remaining() <= 0) return;
        const k = row.getAttribute('data-key');
        if (S.ab[k] >= 99) return;

        const amt = dice[idx];
        const prevCarry = (S.carry && S.carry[k]) || 0;
        const got = addAb(k, amt);

        hist.push({ key: k, got, prevCarry });
        idx++;
        board(0);
        renderAlloc();
      };
    });

    // 退回
    const btnUndo = $('btn-undo-alloc');
    if (btnUndo && hist.length > 0) {
      btnUndo.onclick = () => {
        const last = hist.pop();
        S.ab[last.key] -= last.got;
        if (S.carry) S.carry[last.key] = last.prevCarry;
        idx--;
        board(0);
        renderAlloc();
      };
    }

    // 完成
    const btnFinish = $('btn-finish-alloc');
    if (btnFinish) {
      btnFinish.onclick = () => {
        act.style.display = 'none';
        if (onComplete) onComplete();
      };
    }
  }

  renderAlloc();

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const diceEls = act.querySelectorAll('#dice .die');
    diceEls.forEach((el, i) => {
      el.classList.add('rolling');
      const iv = setInterval(() => { el.textContent = 1 + Math.floor(Math.random() * 6); }, 60);
      setTimeout(() => {
        clearInterval(iv);
        el.classList.remove('rolling');
        el.textContent = dice[i];
        if (dice[i] === 6) el.classList.add('six');
      }, 200 + i * 80);
    });
  }
}

// ==================== 特質側欄與自動解鎖 ====================
function renderTraits() {
  const el = $('trait-tags');
  if (!el || !S) return;
  const list = Object.keys(S.traits).filter(k => S.traits[k]);
  if (list.length === 0) {
    el.innerHTML = '<span style="color:var(--dim);font-size:11px;">暫無解鎖特質</span>';
    return;
  }
  el.innerHTML = list.map(tId => {
    const t = getTraitById(tId);
    if (!t) return '';
    return `<div class="trow"><span class="tag">${t.name}</span><span class="td">${t.desc}</span></div>`;
  }).join('');
}

function unlockTrait(tId) {
  if (!S || S.traits[tId]) return;
  S.traits[tId] = true;
  const t = getTraitById(tId);
  card('gold', `隱藏特質解鎖：${t ? t.name : tId}`, t ? t.desc : '');
  board();
}

function checkTraitsAutoUnlock() {
  if (!S) return;
  if (!S.traits.LADDER_MONSTER && S.ab.mechanics >= 72 && S.ab.laning >= 70) unlockTrait('LADDER_MONSTER');
  if (!S.traits.BIG_STAGE_HERO && (S.stats.worldsTitles >= 1 || S.stats.intlTitles >= 2)) unlockTrait('BIG_STAGE_HERO');
  if (!S.traits.CHAMPION_OCEAN && S.ab.championPool >= 72) unlockTrait('CHAMPION_OCEAN');
  if (!S.traits.IRON_MAN && S.age >= 23 && S.ab.discipline >= 70 && S.wristHealth >= 85) unlockTrait('IRON_MAN');
  if (!S.traits.STREAMER_MINDSET && S.popularity >= 80) unlockTrait('STREAMER_MINDSET');
  if (!S.traits.GLASS_WRIST && S.wristHealth <= 35) unlockTrait('GLASS_WRIST');
}

// ==================== 生涯時間軸 ====================
function tlPush(note = '') {
  if (!S) return;
  TL.push({ year: S.year, age: S.age, stage: S.stage, team: S.team, note, el: _curYearBody });
  renderTimeline();
}

function renderTimeline() {
  const list = $('tl-list');
  const strip = $('tl-strip');
  if (list) {
    list.innerHTML = '<div id="tl-wrap">' + TL.map((e, i) => `
      <div class="tl-item${i === TL.length - 1 ? ' now' : ''}">
        <span class="dot"></span>
        <span class="t">${e.year} (${e.age}歲) ${e.team} <b>${e.note || ''}</b></span>
      </div>
    `).join('') + '</div>';
    list.scrollTop = list.scrollHeight;
  }
  if (strip) {
    strip.innerHTML = TL.map((e, i) => `
      <span class="tl-chip${i === TL.length - 1 ? ' now' : ''}">${e.year}${e.note ? '★' : ''}</span>
    `).join('');
    strip.scrollLeft = strip.scrollWidth;
  }
}

// ==================== 1. BP 選角與 7 階段實時賽況對決 ====================
function interactiveBPDraft(oppTeam, meta, onDraftFinished) {
  const act = $('act');
  act.style.display = 'block';

  // 1. Initialize Side Selection
  const isPlayerBlue = rng.next() < 0.5;
  const playerTeamName = getTeamById(S.teamId)?.shortName || S.team;
  const oppTeamName = oppTeam.shortName || oppTeam.name;
  const blueTeamName = isPlayerBlue ? playerTeamName : oppTeamName;
  const redTeamName = isPlayerBlue ? oppTeamName : playerTeamName;

  // 2. Initialize Pick Order (Roles)
  const bluePicksRoles = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'].sort(() => rng.next() - 0.5);
  const redPicksRoles = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'].sort(() => rng.next() - 0.5);

  // 3. Initialize Draft State
  const blueBans = [];
  const redBans = [];
  const bluePicks = {};
  const redPicks = {};
  const allPicked = new Set();
  const allBanned = new Set();
  
  let currentStepIndex = 0;
  
  // 4. Initialize Picker Filters
  let searchVal = '';
  let posFilter = 'ALL';
  let tagFilter = 'ALL';
  let sortMethod = 'meta';
  let selectedChampId = null;

  const draftSteps = [
    { type: 'ban', side: 'blue', idx: 0 },
    { type: 'ban', side: 'red', idx: 0 },
    { type: 'ban', side: 'blue', idx: 1 },
    { type: 'ban', side: 'red', idx: 1 },
    { type: 'ban', side: 'blue', idx: 2 },
    { type: 'ban', side: 'red', idx: 2 },
    
    { type: 'pick', side: 'blue', idx: 0 }, // Pick 1
    { type: 'pick', side: 'red', idx: 0 },  // Pick 1
    { type: 'pick', side: 'red', idx: 1 },  // Pick 2
    { type: 'pick', side: 'blue', idx: 1 }, // Pick 2
    { type: 'pick', side: 'blue', idx: 2 }, // Pick 3
    { type: 'pick', side: 'red', idx: 2 },  // Pick 3
    
    { type: 'ban', side: 'red', idx: 3 },
    { type: 'ban', side: 'blue', idx: 3 },
    { type: 'ban', side: 'red', idx: 4 },
    { type: 'ban', side: 'blue', idx: 4 },
    
    { type: 'pick', side: 'red', idx: 3 },  // Pick 4
    { type: 'pick', side: 'blue', idx: 3 }, // Pick 4
    { type: 'pick', side: 'blue', idx: 4 }, // Pick 5
    { type: 'pick', side: 'red', idx: 4 },  // Pick 5
  ];

  function runDraftStep() {
    if (currentStepIndex >= draftSteps.length) {
      renderFinalRosters();
      return;
    }
    
    const step = draftSteps[currentStepIndex];
    const isPlayerPick = (step.type === 'pick' && 
      ((step.side === 'blue' && isPlayerBlue && bluePicksRoles[step.idx] === S.pos) ||
       (step.side === 'red' && !isPlayerBlue && redPicksRoles[step.idx] === S.pos)));
       
    if (isPlayerPick) {
      updateUI(true);
      return;
    }
    
    updateUI(false);
    
    setTimeout(() => {
      if (step.type === 'ban') {
        const metaChamps = [];
        if (meta && meta.sTierChampions) {
          Object.values(meta.sTierChampions).flat().forEach(cId => {
            if (getChampionById(cId)) metaChamps.push(cId);
          });
        }
        const poolForBan = metaChamps.length > 0 ? metaChamps : CHAMPIONS.map(c => c.id);
        const availableBans = poolForBan.filter(cId => !allBanned.has(cId) && !allPicked.has(cId));
        let banChampId = availableBans.length > 0 ? rng.choice(availableBans) : CHAMPIONS.find(c => !allBanned.has(c.id) && !allPicked.has(c.id))?.id;
        
        if (step.side === 'blue') {
          blueBans.push(banChampId);
        } else {
          redBans.push(banChampId);
        }
        allBanned.add(banChampId);
        
      } else if (step.type === 'pick') {
        const role = (step.side === 'blue') ? bluePicksRoles[step.idx] : redPicksRoles[step.idx];
        const roleChamps = CHAMPIONS.filter(c => !allBanned.has(c.id) && !allPicked.has(c.id) && (c.primaryRole === role || c.roles.includes(role)));
        let pickChampId;
        if (roleChamps.length > 0) {
          const metaRoleChamps = roleChamps.filter(c => meta && meta.sTierChampions && Object.values(meta.sTierChampions).flat().includes(c.id));
          if (metaRoleChamps.length > 0 && rng.next() < 0.7) {
            pickChampId = rng.choice(metaRoleChamps).id;
          } else {
            pickChampId = rng.choice(roleChamps).id;
          }
        } else {
          pickChampId = CHAMPIONS.find(c => !allBanned.has(c.id) && !allPicked.has(c.id))?.id;
        }
        
        if (step.side === 'blue') {
          bluePicks[role] = pickChampId;
        } else {
          redPicks[role] = pickChampId;
        }
        allPicked.add(pickChampId);
      }
      
      currentStepIndex++;
      runDraftStep();
    }, 350);
  }

  function updateUI(isPlayerTurn) {
    const step = draftSteps[currentStepIndex];
    let statusText = '';
    if (step) {
      const teamName = step.side === 'blue' ? blueTeamName : redTeamName;
      if (step.type === 'ban') {
        statusText = `正在進行：${step.idx >= 3 ? '第二階段' : '第一階段'} Ban 英雄 (${teamName})`;
      } else {
        const role = step.side === 'blue' ? bluePicksRoles[step.idx] : redPicksRoles[step.idx];
        statusText = isPlayerTurn ? `🔴 輪到你選擇英雄！` : `正在進行：選角中 (${teamName} - ${POS_NAMES[role] || role})`;
      }
    }
    
    act.innerHTML = `
      <div class="bp-board">
        <div class="bp-header">
          <div class="bp-team blue">
            <span class="side-badge blue">BLUE</span>
            <span class="team-name" style="color:#00f2fe;">${blueTeamName}</span>
          </div>
          <div class="bp-vs">VS</div>
          <div class="bp-team red">
            <span class="team-name" style="color:#ff4d4f;">${redTeamName}</span>
            <span class="side-badge red">RED</span>
          </div>
        </div>
        
        <div class="bp-status">${statusText}</div>
        
        <div class="bp-bans-row">
          <div class="blue-bans">
            ${Array.from({ length: 5 }).map((_, i) => {
              const champId = blueBans[i];
              const champ = champId ? getChampionById(champId) : null;
              return `<div class="ban-slot ${champ ? 'banned' : ''}" title="${champ ? champ.name : ''}">${champ ? champ.name.slice(0, 2) : ''}</div>`;
            }).join('')}
          </div>
          <div class="bans-label">BANS</div>
          <div class="red-bans">
            ${Array.from({ length: 5 }).map((_, i) => {
              const champId = redBans[i];
              const champ = champId ? getChampionById(champId) : null;
              return `<div class="ban-slot ${champ ? 'banned' : ''}" title="${champ ? champ.name : ''}">${champ ? champ.name.slice(0, 2) : ''}</div>`;
            }).join('')}
          </div>
        </div>
        
        <div class="bp-picks-container">
          <div class="blue-picks">
            ${bluePicksRoles.map((role, i) => {
              const isTurn = (step && step.type === 'pick' && step.side === 'blue' && step.idx === i);
              const isPlayerSlot = (isPlayerBlue && role === S.pos);
              const champId = bluePicks[role];
              const champ = champId ? getChampionById(champId) : null;
              return `
                <div class="pick-slot ${isTurn ? 'active' : ''}">
                  <span class="role-badge">${POS_NAMES[role] ? POS_NAMES[role].slice(0, 2) : role}</span>
                  <span class="champ-name" style="${isTurn ? 'color:var(--accent); font-weight:bold;' : ''}">${champ ? champ.name : (isTurn ? '選角中...' : '---')}</span>
                  ${isPlayerSlot ? '<span class="player-indicator">YOU</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          <div class="red-picks">
            ${redPicksRoles.map((role, i) => {
              const isTurn = (step && step.type === 'pick' && step.side === 'red' && step.idx === i);
              const isPlayerSlot = (!isPlayerBlue && role === S.pos);
              const champId = redPicks[role];
              const champ = champId ? getChampionById(champId) : null;
              return `
                <div class="pick-slot ${isTurn ? 'active' : ''}">
                  <span class="champ-name" style="${isTurn ? 'color:var(--accent); font-weight:bold;' : ''}">${champ ? champ.name : (isTurn ? '選角中...' : '---')}</span>
                  <span class="role-badge">${POS_NAMES[role] ? POS_NAMES[role].slice(0, 2) : role}</span>
                  ${isPlayerSlot ? '<span class="player-indicator">YOU</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <div id="bp-picker" style="display: ${isPlayerTurn ? 'block' : 'none'};">
          <hr class="bp-divider">
          <div class="picker-header">🔴 輪到你選角 (安排順位：${bluePicksRoles.indexOf(S.pos) === 0 || redPicksRoles.indexOf(S.pos) === 0 ? '先手首選' : bluePicksRoles.indexOf(S.pos) >= 3 || redPicksRoles.indexOf(S.pos) >= 3 ? '後手反制' : '常規選角'})</div>
          
          <div class="picker-search-bar">
            <input type="text" id="picker-search-input" placeholder="🔍 搜尋英雄名稱...">
          </div>
          
          <div class="picker-filter-row" id="picker-pos-filters">
            <button class="filter-chip ${posFilter === 'ALL' ? 'on' : ''}" data-pos="ALL">全部</button>
            <button class="filter-chip ${posFilter === 'TOP' ? 'on' : ''}" data-pos="TOP">上路</button>
            <button class="filter-chip ${posFilter === 'JUG' ? 'on' : ''}" data-pos="JUG">打野</button>
            <button class="filter-chip ${posFilter === 'MID' ? 'on' : ''}" data-pos="MID">中路</button>
            <button class="filter-chip ${posFilter === 'ADC' ? 'on' : ''}" data-pos="ADC">下路</button>
            <button class="filter-chip ${posFilter === 'SUP' ? 'on' : ''}" data-pos="SUP">輔助</button>
          </div>

          <div class="picker-filter-row" id="picker-tag-filters">
            <button class="filter-chip ${tagFilter === 'ALL' ? 'on' : ''}" data-tag="ALL">全部類型</button>
            <button class="filter-chip ${tagFilter === 'teamfight' ? 'on' : ''}" data-tag="teamfight">團戰</button>
            <button class="filter-chip ${tagFilter === 'splitpush' ? 'on' : ''}" data-tag="splitpush">單帶</button>
            <button class="filter-chip ${tagFilter === 'engage' ? 'on' : ''}" data-tag="engage">強開</button>
            <button class="filter-chip ${tagFilter === 'poke' ? 'on' : ''}" data-tag="poke">消耗</button>
            <button class="filter-chip ${tagFilter === 'tank' ? 'on' : ''}" data-tag="tank">坦克</button>
            <button class="filter-chip ${tagFilter === 'assassin' ? 'on' : ''}" data-tag="assassin">刺客</button>
            <button class="filter-chip ${tagFilter === 'enchanter' ? 'on' : ''}" data-tag="enchanter">保排</button>
          </div>

          <div class="picker-sort-row">
            <span>排序方式：</span>
            <div class="seg two" id="picker-sort-seg" style="margin-top:0;">
              <button data-sort="meta" class="${sortMethod === 'meta' ? 'on' : ''}">版本強度</button>
              <button data-sort="mastery" class="${sortMethod === 'mastery' ? 'on' : ''}">個人熟練度</button>
            </div>
          </div>

          <div class="picker-coach-box" id="picker-coach-advice"></div>

          <div class="picker-grid" id="picker-candidates-grid"></div>

          <button class="btn main" id="btn-lock-champ" ${selectedChampId ? '' : 'disabled'} style="text-align:center;">🔒 鎖定英雄</button>
        </div>
      </div>
    `;
    
    if (isPlayerTurn) {
      hookPickerEvents();
      renderCandidatesList();
      updateCoachAdvice();
      const searchInput = $('picker-search-input');
      if (searchInput && searchVal) {
        searchInput.value = searchVal;
        searchInput.focus();
      }
    }
  }

  function hookPickerEvents() {
    const searchInput = $('picker-search-input');
    if (searchInput) {
      searchInput.oninput = () => {
        searchVal = searchInput.value;
        renderCandidatesList();
      };
    }
    
    const posButtons = document.querySelectorAll('#picker-pos-filters .filter-chip');
    posButtons.forEach(btn => {
      btn.onclick = () => {
        posButtons.forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        posFilter = btn.getAttribute('data-pos');
        renderCandidatesList();
      };
    });
    
    const tagButtons = document.querySelectorAll('#picker-tag-filters .filter-chip');
    tagButtons.forEach(btn => {
      btn.onclick = () => {
        tagButtons.forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        tagFilter = btn.getAttribute('data-tag');
        renderCandidatesList();
      };
    });
    
    const sortButtons = document.querySelectorAll('#picker-sort-seg button');
    sortButtons.forEach(btn => {
      btn.onclick = () => {
        sortButtons.forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        sortMethod = btn.getAttribute('data-sort');
        renderCandidatesList();
      };
    });
    
    const lockBtn = $('btn-lock-champ');
    if (lockBtn) {
      lockBtn.onclick = () => {
        if (selectedChampId) {
          lockPlayerChoice();
        }
      };
    }
  }

  function renderCandidatesList() {
    let list = CHAMPIONS.filter(c => !allBanned.has(c.id) && !allPicked.has(c.id));
    
    if (searchVal) {
      const q = searchVal.trim().toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (c.title && c.title.toLowerCase().includes(q)));
    }
    
    if (posFilter && posFilter !== 'ALL') {
      list = list.filter(c => c.primaryRole === posFilter || c.roles.includes(posFilter));
    }
    
    if (tagFilter && tagFilter !== 'ALL') {
      list = list.filter(c => c.tags && c.tags.includes(tagFilter));
    }
    
    list.sort((a, b) => {
      if (sortMethod === 'mastery') {
        const ptsA = S.masteries[a.id] || 0;
        const ptsB = S.masteries[b.id] || 0;
        return ptsB - ptsA;
      } else {
        const getMetaScore = (champ) => {
          if (!meta || !meta.sTierChampions) return 0;
          if (meta.sTierChampions.S?.includes(champ.id)) return 3;
          if (meta.sTierChampions.A?.includes(champ.id)) return 2;
          if (meta.sTierChampions.B?.includes(champ.id)) return 1;
          return 0;
        };
        return getMetaScore(b) - getMetaScore(a);
      }
    });
    
    const grid = $('picker-candidates-grid');
    if (!grid) return;
    
    grid.innerHTML = list.map(c => {
      const isSelected = (c.id === selectedChampId);
      const pts = S.masteries[c.id] || 0;
      const mi = getMasteryInfo(pts);
      const isOffMeta = c.primaryRole !== S.pos && !c.roles.includes(S.pos);
      
      let metaTag = '';
      if (meta && meta.sTierChampions) {
        if (meta.sTierChampions.S?.includes(c.id)) metaTag = '<span class="tag gold" style="font-size:8px;padding:0 3px;margin:0 2px;">T0</span>';
        else if (meta.sTierChampions.A?.includes(c.id)) metaTag = '<span class="tag" style="color:var(--accent);font-size:8px;padding:0 3px;margin:0 2px;">T1</span>';
        else if (meta.sTierChampions.B?.includes(c.id)) metaTag = '<span class="tag" style="color:var(--dim);font-size:8px;padding:0 3px;margin:0 2px;">T2</span>';
      }
      
      return `
        <div class="picker-champ-card ${isSelected ? 'selected' : ''} ${isOffMeta ? 'off-meta' : ''}" data-id="${c.id}">
          <div class="name">${c.name}</div>
          <div class="desc">${isOffMeta ? '非主流' : mi.name} ${metaTag}</div>
        </div>
      `;
    }).join('');
    
    grid.querySelectorAll('.picker-champ-card').forEach(card => {
      card.onclick = () => {
        selectedChampId = card.getAttribute('data-id');
        grid.querySelectorAll('.picker-champ-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        const lockBtn = $('btn-lock-champ');
        if (lockBtn) {
          lockBtn.disabled = false;
        }
        
        updateCoachAdvice();
      };
    });
  }

  function updateCoachAdvice() {
    const box = $('picker-coach-advice');
    if (!box) return;
    
    if (!selectedChampId) {
      const recommended = CHAMPIONS.filter(c => !allBanned.has(c.id) && !allPicked.has(c.id) && (c.primaryRole === S.pos || c.roles.includes(S.pos)));
      recommended.sort((a, b) => {
        const getMetaScore = (champ) => {
          if (!meta || !meta.sTierChampions) return 0;
          if (meta.sTierChampions.S?.includes(champ.id)) return 3;
          if (meta.sTierChampions.A?.includes(champ.id)) return 2;
          return 0;
        };
        const scoreDiff = getMetaScore(b) - getMetaScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return (S.masteries[b.id] || 0) - (S.masteries[a.id] || 0);
      });
      
      const recNames = recommended.slice(0, 3).map(c => c.name).join('、');
      box.innerHTML = `📋 **教練團戰術室建議**：本局推薦搶下 <b class="hl">${recNames || '任意常規英雄'}</b>，較符合當前聯賽版本節奏。`;
    } else {
      const c = getChampionById(selectedChampId);
      const pts = S.masteries[c.id] || 0;
      const mi = getMasteryInfo(pts);
      const isOffMeta = c.primaryRole !== S.pos && !c.roles.includes(S.pos);
      
      if (isOffMeta) {
        box.innerHTML = `⚠️ **非主流黑科技警告**：教練皺起眉頭：「用 ${c.name} 打 ${POS_NAMES[S.pos] || S.pos} 缺乏陣容容錯率。如果前期崩盤，戰術體系將完全失衡，你確定嗎？」`;
      } else if (mi.level >= 5) {
        box.innerHTML = `🔥 **招牌絕活認可**：教練點頭微笑：「鎖下你的招牌絕活 ${c.name}！用你的熟練度撕裂敵方的防線吧！」`;
      } else {
        box.innerHTML = `👍 **陣容適配**：教練認可：「選擇 ${c.name} 是個紮實穩健的選擇，配合團隊打出常規節奏即可。」`;
      }
    }
  }

  function lockPlayerChoice() {
    const role = S.pos;
    if (isPlayerBlue) {
      bluePicks[role] = selectedChampId;
    } else {
      redPicks[role] = selectedChampId;
    }
    
    allPicked.add(selectedChampId);
    
    const selectedChamp = getChampionById(selectedChampId);
    const isOffMeta = selectedChamp.primaryRole !== S.pos && !selectedChamp.roles.includes(S.pos);
    if (isOffMeta) {
      S.coachTrust = Math.max(0, S.coachTrust - 5);
    }
    
    currentStepIndex++;
    selectedChampId = null;
    searchVal = '';
    
    runDraftStep();
  }

  function renderFinalRosters() {
    const getTeamRosterHTML = (side, teamName, picksRoles, picks) => {
      return `
        <div style="font-size:12px;background:var(--panel2);border:1px solid var(--edge);border-radius:4px;padding:8px;">
          <strong style="color:${side === 'blue' ? '#00f2fe' : '#ff4d4f'};">${teamName} 陣容：</strong>
          <ul style="list-style:none;padding-left:0;margin-top:4px;line-height:1.6;">
            ${picksRoles.map(role => {
              const isPlayer = (side === 'blue' && isPlayerBlue && role === S.pos) || (side === 'red' && !isPlayerBlue && role === S.pos);
              const champId = picks[role];
              const champ = getChampionById(champId);
              return `
                <li style="display:flex;justify-content:space-between;gap:4px;">
                  <span>${POS_NAMES[role] ? POS_NAMES[role].slice(0, 2) : role}：${isPlayer ? `<b>${S.inGameId} (YOU)</b>` : `AI`}</span>
                  <span class="hl">${champ ? champ.name : '---'}</span>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      `;
    };
    
    act.innerHTML = `
      <div class="title">⚔️ 召喚峽谷 雙方陣容已鎖定</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        ${getTeamRosterHTML('blue', blueTeamName, bluePicksRoles, bluePicks)}
        ${getTeamRosterHTML('red', redTeamName, redPicksRoles, redPicks)}
      </div>
      <button class="btn main" id="btn-start-fight" style="text-align:center;">⚔️ 鎖定陣容，進入召喚峽谷 ▸</button>
    `;
    
    $('btn-start-fight').onclick = () => {
      act.style.display = 'none';
      const playerChosenChampId = isPlayerBlue ? bluePicks[S.pos] : redPicks[S.pos];
      
      const blueLineup = bluePicksRoles.map(role => `${POS_NAMES[role] ? POS_NAMES[role].slice(0,2) : role}: ${getChampionById(bluePicks[role])?.name || '未知'}`).join(' / ');
      const redLineup = redPicksRoles.map(role => `${POS_NAMES[role] ? POS_NAMES[role].slice(0,2) : role}: ${getChampionById(redPicks[role])?.name || '未知'}`).join(' / ');
      
      card('info', '⚔️ 雙方陣容鎖定', `
        <b>藍方 ${blueTeamName}</b>：${blueLineup}<br>
        <b>紅方 ${redTeamName}</b>：${redLineup}
      `);
      
      run7PhaseMatch(oppTeam, playerChosenChampId, onDraftFinished);
    };
  }

  // Start the BP draft!
  runDraftStep();
}

// 7 階段戰術決策推進
function run7PhaseMatch(oppTeam, chosenChampId, onMatchDone) {
  const champ = getChampionById(chosenChampId);
  const masteryPts = S.masteries[chosenChampId] || 0;
  const mastery = getMasteryInfo(masteryPts);
  const isOffMeta = champ.primaryRole !== S.pos && !champ.roles.includes(S.pos);

  // 記錄使用英雄
  S.stats.champsUsed[chosenChampId] = (S.stats.champsUsed[chosenChampId] || 0) + 1;
  S.masteries[chosenChampId] = (S.masteries[chosenChampId] || 0) + 10;

  card('info', `⚔️ 系列賽開打 · 鎖定 ${champ.name}`, `你鎖定了 <b class="hl">${champ.name}</b> (${mastery.name})${isOffMeta ? ' 祭出非主流黑科技套路！' : ''}，全場焦點凝聚於召喚峽谷！`);

  const playerOvr = ovr() + getTacticModifier();
  const oppOvr = oppTeam.baseRating || 72;
  let winRate = (playerOvr / (playerOvr + oppOvr)) * 100;
  // 加入一些隨機性波動開局
  winRate = Math.max(25, Math.min(75, Math.round(winRate + rng.range(-6, 6))));
  const winRateHistory = [winRate];

  let currentPhase = 1;
  let goldDiff = 0;
  let kills = 0, deaths = 0, assists = 0;

  function generateWinRateSVG(history) {
    const points = [];
    const width = 360;
    const height = 180;
    const paddingX = 40;
    const paddingY = 20;
    
    const stepX = (width - paddingX * 2) / (history.length - 1);
    const stepY = (height - paddingY * 2);

    for (let i = 0; i < history.length; i++) {
      const x = paddingX + i * stepX;
      const y = paddingY + stepY - (history[i] / 100) * stepY;
      points.push({ x, y, val: history[i] });
    }
    
    const pathD = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
    
    const pointsHTML = points.map((p, i) => `
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="${i === points.length - 1 ? '#00f2fe' : '#ffffff'}" stroke="#0f142c" stroke-width="1.5" />
      <text x="${p.x}" y="${p.y - 7}" fill="#ffffff" font-size="8.5" font-weight="bold" text-anchor="middle" style="text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${p.val}%</text>
      <text x="${p.x}" y="${height - 2}" fill="rgba(255,255,255,0.4)" font-size="8" text-anchor="middle">P${i}</text>
    `).join('');

    return `
      <div style="margin-top: 15px; margin-bottom: 5px;">
        <div style="font-size:12px; font-weight:bold; color:var(--text); margin-bottom:6px; text-align:center;">📊 本局雙方勝率波動曲線圖</div>
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:160px; background:#0f142c; border-radius:var(--r); border:1px solid rgba(255,255,255,0.06); padding-top:6px; overflow:visible;">
          <!-- Grid horizontal lines -->
          <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3" />
          <line x1="${paddingX}" y1="${paddingY + stepY * 0.25}" x2="${width - paddingX}" y2="${paddingY + stepY * 0.25}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3" />
          <line x1="${paddingX}" y1="${paddingY + stepY * 0.5}" x2="${width - paddingX}" y2="${paddingY + stepY * 0.5}" stroke="rgba(0, 242, 254, 0.2)" stroke-width="1.5" stroke-dasharray="5 3" /> <!-- 50% baseline -->
          <line x1="${paddingX}" y1="${paddingY + stepY * 0.75}" x2="${width - paddingX}" y2="${paddingY + stepY * 0.75}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3" />
          <line x1="${paddingX}" y1="${paddingY + stepY}" x2="${width - paddingX}" y2="${paddingY + stepY}" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3" />
          
          <!-- Y-Axis labels -->
          <text x="10" y="${paddingY + 3}" fill="rgba(255,255,255,0.4)" font-size="8.5">100%</text>
          <text x="15" y="${paddingY + stepY * 0.5 + 3}" fill="rgba(255,255,255,0.5)" font-size="8.5">50%</text>
          <text x="20" y="${paddingY + stepY + 3}" fill="rgba(255,255,255,0.4)" font-size="8.5">0%</text>
          
          <!-- Win rate Trend Line -->
          <path d="${pathD}" fill="none" stroke="#00f2fe" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          
          <!-- Interactive markers and labels -->
          ${pointsHTML}
        </svg>
        <div style="font-size:9.5px; color:var(--text-dim); text-align:center; margin-top:4px;">P0:開局 | P1-P7:決策階段輪次</div>
      </div>
    `;
  }

  function runNextPhase() {
    if (currentPhase > 7 || Math.abs(goldDiff) >= 8000) {
      // 比賽結束結算
      const won = goldDiff >= 0;
      S.stats.matchesPlayed += 1;
      if (won) S.stats.matchesWon += 1;

      kills += rng.range(2, 6);
      deaths += rng.range(1, 3);
      assists += rng.range(4, 9);
      
      const { pog: isPog } = recordMatchStats(won, true, kills, deaths, assists);
      if (!S.currentSplitStats) S.currentSplitStats = { matchesPlayed: 0, matchesWon: 0, kills: 0, deaths: 0, assists: 0, pogCount: 0 };
      S.currentSplitStats.matchesPlayed += 1;
      if (won) S.currentSplitStats.matchesWon += 1;

      const chartHTML = generateWinRateSVG(winRateHistory);

      card(won ? 'gold' : 'bad', won ? '🏆 VICTORY 勝利！' : '💀 DEFEAT 戰敗', `
        面對 <b class="hl">${oppTeam.name}</b>，全隊以 <b class="${won ? 'up' : 'dn'}">${won ? '2:0 拿下系列賽' : '1:2 遺憾告負'}</b>！<br>
        個人本局數據：<b class="hl">${kills} 殺 / ${deaths} 死 / ${assists} 助攻</b>${isPog ? ' · 榮獲單場 MVP (POG)！🔥' : ''}
        ${chartHTML}
      `);

      onMatchDone(won);
      return;
    }

    const phases = [
      null,
      {
        name: '階段 1 一級團與野區布防',
        choices: [
          { t: '五人集結入侵敵方野區 (一級團強碰)', s: '拼操作與進攻性', risk: 0.45, attr: 'mechanics', successTxt: '【一級團大勝】你的精準技能施放成功逼出敵方雙閃，並由你斬獲一血！', failTxt: '遭對手完美防守眼位提前探知並反包抄，你送出了一血。' },
          { t: '常規五點防守，做好防守眼位', s: '極其穩健安全開局', risk: 0.8, attr: 'macro', successTxt: '常規防守眼位完美探知敵方野區動向，野區平穩開局。', failTxt: '做眼過深被敵方抓到位置，交出閃現驚險逃生，野區節奏略微受限。' },
          { t: '單人潛入敵方 Buff 處插防守眼', s: '用視野刺探敵方打野動線', risk: 0.65, attr: 'macro', successTxt: '成功探知敵方打野鏡像路線，為我方打野前期控資源爭取主動。', failTxt: '被敵方人堆堵住，被迫交出閃現，前期防線受阻。' },
          { t: '紅開/藍開出其不意鏡像交換野區', s: '利用英雄特性進行策略換野', risk: 0.75, attr: 'championPool', successTxt: '完美鏡像換野，避開對手強勢期，前期營運取得小幅領先。', failTxt: '換野路線被敵方插眼探知，敵方三包一入侵將你逼退。' },
          { t: '五人抱團蹲在河道草叢嘗試海釣抓人', s: '出其不意的反蹲埋伏', risk: 0.55, attr: 'communication', successTxt: '成功蹲到敵方探視野的輔助，將其控住秒殺，收下首殺！', failTxt: '久蹲無果，反而導致自家野區被對手偷掉一組野怪。' }
        ]
      },
      {
        name: '階段 2 首輪對線與打野動向',
        choices: [
          { t: '搶二/搶三主動發難，線上壓制嘗試單殺', s: '考驗線上純操作與換血技巧', risk: 0.5, attr: 'laning', successTxt: '【極限單殺！】你抓準對手補兵空檔打出完美連招將其單殺，引爆全場！', failTxt: '換血過於激進，結果被敵方反蹲的打野配合線上將你擊殺。' },
          { t: '控線防守，呼叫打野越塔 Gank', s: '打野聯動越塔擊殺', risk: 0.7, attr: 'communication', successTxt: '兵線完美控在塔前，配合打野完美抗塔將敵方越塔擊殺！', failTxt: '抗塔順序出錯，越塔失敗反而被敵方換掉人頭，兵線崩潰。' },
          { t: '放線抗壓，專注於補兵防守', s: '穩健發育，規避敵方 Gank', risk: 0.85, attr: 'discipline', successTxt: '穩健塔下控線補刀，成功規避敵方打野連續兩次草叢蹲伏。', failTxt: '兵線被控在敵方塔前，被敵方打野繞後 Gank 逼退回城，補刀落後。' },
          { t: '放棄部分兵線，積極遊走支援野區與中路', s: '輻射全隊前期碰撞力', risk: 0.6, attr: 'macro', successTxt: '及時趕到河道戰場扭轉乾坤，收下敵方人頭並控下河蟹。', failTxt: '遊走未取得果實，返回線上時發現被對手拉開了 15 個補刀差。' },
          { t: '瘋狂推線磨塔，試圖速拿防禦塔塔皮', s: '速推流給予對手塔前壓迫', risk: 0.65, attr: 'laning', successTxt: '對手被壓在塔下疲於清兵，你成功磨下兩層鍍層，經濟大賺！', failTxt: '推線過深且缺乏視野，被敵方中野聯動包夾擊殺在塔前。' }
        ]
      },
      {
        name: '階段 3 首次回城與首輪中立物件',
        choices: [
          { t: '集結隊友爭奪虛空巢蟲 (爭奪小兵 Buff)', s: '搶奪前中期推塔資源', risk: 0.65, attr: 'macro', successTxt: '控下 5 隻巢蟲！前期推塔速度大幅提升，為後續拆塔埋下伏筆。', failTxt: '爭奪時團戰失利被擊退，巢蟲全部被敵方笑納。' },
          { t: '全員下路集結，硬碰硬爭奪首條小龍', s: '前期龍魂累積與正面碰撞', risk: 0.6, attr: 'teamfight', successTxt: '團戰拉扯完美，控下首條小龍，並由你斬獲雙殺！', failTxt: '陣型散亂被敵方逐個擊破，丟失小龍，還送出了多個人頭。' },
          { t: '避開正面交鋒，進行資源交換', s: '互換資源，補足自身發育', risk: 0.8, attr: 'laning', successTxt: '果斷放掉小龍，你在上路單帶連吃三層塔皮，經濟基本持平。', failTxt: '對手拿龍後迅速包夾，我方在防守塔下依然被強開越塔。' },
          { t: '回城補滿裝備後，發起野區入侵強抓對方打野', s: '利用裝備領先入侵野區', risk: 0.55, attr: 'mechanics', successTxt: '在野區野怪處抓到敵方打野，你單槍匹馬將其斬殺並奪其野怪！', failTxt: '入侵野區被敵方視野洞察，反被敵方三包一擊殺，丟失發育節奏。' },
          { t: '提前在河道草叢插眼落位，進行反蹲埋伏', s: '視野反蹲，伏擊敵方隊伍', risk: 0.7, attr: 'macro', successTxt: '成功埋伏到前來做視野的敵方輔助，秒殺後形成多打少，順勢拿下小龍！', failTxt: '埋伏位置被敵方真眼看到，反被對手從後方繞後包抄，團戰大潰敗。' }
        ]
      },
      {
        name: '階段 4 塔皮鍍層與首塔擊破',
        choices: [
          { t: '四人集結強包下路，強行越塔拿下一塔', s: '速拆一塔，帶起全場節奏', risk: 0.6, attr: 'teamfight', successTxt: '四包二越塔完美配合！擊殺敵方雙人組並順利擊破首塔！', failTxt: '越塔時抗塔失誤，遭到敵方雙人組塔下反殺兩人，一塔未能拿下。' },
          { t: '呼叫打野釋放預示者，撞擊中路一塔', s: '利用預示者直接推平中一塔', risk: 0.75, attr: 'macro', successTxt: '成功釋放預示者一舉撞碎中路一塔，視野封鎖線大幅推前！', failTxt: '預示者召喚出來後被對手集火秒殺，未能撞出防禦塔，白白浪費資源。' },
          { t: '穩健待在線上發育，等待第一件核心大裝', s: '穩健發育，不給對手機會', risk: 0.85, attr: 'discipline', successTxt: '核心首件大裝順利合成，線上補刀領先，迎來強勢戰力點。', failTxt: '防禦塔被對方單帶點點掉半血，發育空間被敵方視野大幅壓縮。' },
          { t: '主動向隊友提議換線，換到邊線掠奪一塔', s: '轉線戰術避開主力交鋒', risk: 0.7, attr: 'laning', successTxt: '換線節奏流暢，趁敵方防守不及，單人速拆上路防禦塔！', failTxt: '換線時被敵方反蹲，邊線防禦塔沒推掉，反而送出了一塔。' },
          { t: '呼叫隊友反蹲，防範敵方的越塔攻勢', s: '防禦塔前防守反擊戰', risk: 0.8, attr: 'communication', successTxt: '完美預判敵方攻勢！隊友及時反蹲打出 1 換 3 漂亮防守反擊！', failTxt: '反蹲視野沒做好，隊友趕到時塔已經被拔，己方被迫在尷尬位置接團。' }
        ]
      },
      {
        name: '階段 5 中期營運與龍魂爭奪',
        choices: [
          { t: '執行 1-3-1 / 4-1 邊線分推牽制', s: '單帶拉扯給予對手邊線壓力', risk: 0.6, attr: 'macro', successTxt: '你的單帶通關敵方二塔，拉扯得對手首尾難顧，被迫分兵防守！', failTxt: '單帶走位過深，在沒有隊友視野掩護下被對方三人包抄抓單擊殺。' },
          { t: '聽牌龍爭奪：五人集集正面開團戰', s: '龍魂大決戰正面碰撞', risk: 0.55, attr: 'teamfight', successTxt: '團戰中你上演完美繞後輸出拉滿！隊伍拿下聽牌龍並團滅對手！', failTxt: '正面團戰被敵方前排頂住，敵方雙C無壓力輸出，團戰大潰敗丟失龍魂。' },
          { t: '瘋狂排空野區視野，執行草叢埋伏', s: '視野盲區蹲伏抓單', risk: 0.65, attr: 'communication', successTxt: '真眼草叢埋伏成功！瞬間融化敵方探路核心，順勢破掉對方二塔！', failTxt: '草叢埋伏反被敵方遠程技能探照發現，臉探草叢被反手開團。' },
          { t: '邊線抱團越塔，強殺敵方帶線選手', s: '多包一強殺撕裂敵方單帶點', risk: 0.7, attr: 'mechanics', successTxt: '越塔配合行雲流水，強殺對方單帶大核並拆掉二塔，打破單帶局勢！', failTxt: '越塔技能配合失誤被對方單帶大核塔下秀走位反殺一人，越塔失敗。' },
          { t: '放棄龍魂，交換邊線兵線發育空間', s: '戰略放棄換取核心C位發育', risk: 0.8, attr: 'mental', successTxt: '果斷讓掉小龍，你趁機在邊路發育補滿三件套，為大後期團戰做好準備。', failTxt: '龍魂給了對手極大增益，隊伍防守壓力陡增，地圖資源被全面蠶食。' }
        ]
      },
      {
        name: '階段 6 巴龍逼團與高地攻防',
        choices: [
          { t: '巴龍釣魚，引誘敵方正面接團打滅隊', s: '高難度巴龍逼團戰術', risk: 0.5, attr: 'teamfight', successTxt: '【巴龍滅隊！】完美停手開團將對手團滅，並順利收下巴龍，奠定勝局！', failTxt: '巴龍團戰拉扯失誤，巴龍被敵方打野神級重擊搶走，還被順勢反打團滅。' },
          { t: '強行開打巴龍，拼打野重擊手速', s: '生死巴龍競速', risk: 0.45, attr: 'mechanics', successTxt: '重擊穩穩收下巴龍！獲得大巴龍 Buff，隊伍吹起進攻高地的號角！', failTxt: '重擊失誤巴龍被搶，隊友在高難度局勢下被迫接團，慘遭滅隊。' },
          { t: '五人中路抱團，穩步蠶食高地防禦塔', s: '穩紮穩打兵線平推', risk: 0.75, attr: 'discipline', successTxt: '穩紮穩打磨破高地防禦塔與水晶，召喚出超級士兵，壓迫力十足！', failTxt: '推塔時過於心急被敵方繞後開團，防守陣型崩潰，未能攻克高地。' },
          { t: '利用大巴龍 Buff 執行 4-1 分推蠶食邊路', s: '巴龍 Buff 單帶拉扯', risk: 0.8, attr: 'macro', successTxt: '巴龍分推效果顯著，邊路高地防禦塔被磨破，對手分身乏術。', failTxt: '單帶隊友被敵方強行包夾秒殺，大巴龍 Buff 提前中斷，錯失推塔良機。' },
          { t: '利用野區視野優勢，在高地塔前發起強開', s: '強行衝塔開團撕裂防線', risk: 0.6, attr: 'mechanics', successTxt: '你神級開團控住敵方雙C，越塔打出 0 換 4 完美越塔團戰，直逼水晶！', failTxt: '越塔開團被敵方輔助金身/護盾技能完美化解，己方抗塔過深遭到團滅。' }
        ]
      },
      {
        name: '階段 7 終局遠古巨龍與主堡決戰',
        choices: [
          { t: '遠古巨龍世紀死鬥，全員正面拼到底！', s: '遠古巨龍終極團戰生死決戰', risk: 0.45, attr: 'teamfight', successTxt: '【拿下遠古龍！】斬殺 Buff 降臨，你大殺四方砍下三殺，平推主堡奪冠！', failTxt: '遠古龍團惜敗被團滅，眼睜睜看著對手平推掉我方主堡。' },
          { t: '雙傳送繞後偷拆主堡，水晶基地競速！', s: '背水一戰的極限基地拆家競速', risk: 0.4, attr: 'macro', successTxt: '【神級偷拆！】正面隊友用肉身阻擋敵方回城，你瘋狂點爆水晶完成史詩翻盤！', failTxt: '偷拆被敵方敏銳發覺並回城守住，你被擊殺後對手長驅直入一波推平。' },
          { t: '五人抱團穩健推進，逼迫對方在高地迎戰', s: '常規高地主堡平推營運', risk: 0.7, attr: 'discipline', successTxt: '步步為營，依靠兵線磨掉兩座雙子塔，平穩點爆水晶奪得勝利！', failTxt: '高地推進時失誤被敵方打出完美防守反擊，對手一波反推結束比賽。' },
          { t: '大膽在野區排眼抓單，造成多打少局勢', s: '野區終極埋伏抓單', risk: 0.55, attr: 'mechanics', successTxt: '在龍坑外抓死敵方落單輸出位！五打四形成絕對人數優勢，輕鬆推平基地！', failTxt: '抓單不成反被對手抱團反蹲，己方減員後防線全面崩潰，主堡失守。' },
          { t: '全員死守基地，等待敵方失誤越塔', s: '極限高地基地防守戰', risk: 0.8, attr: 'mental', successTxt: '高地防守密不透風！敵方越塔心急出錯被我們塔下反殺三人，順勢一波反推！', failTxt: '敵方攻勢太猛，配合遠古龍 Buff 直接碾碎了我們的基地防線。' }
        ]
      }
    ];

    const curP = phases[currentPhase];
    const prevWinRate = winRate;

    const winRateHTML = `
      <div style="margin-bottom: 12px; background:var(--panel2); padding:10px; border-radius:var(--r); border:1px solid rgba(255,255,255,0.05); font-family:inherit;">
        <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:bold; margin-bottom:4px;">
          <span style="color:var(--color-cyan);">我方即時勝率: ${winRate}%</span>
          <span style="color:var(--color-red);">敵方即時勝率: ${100 - winRate}%</span>
        </div>
        <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; background:#222;">
          <div style="width:${winRate}%; background:var(--color-cyan); transition: width 0.4s ease;"></div>
          <div style="width:${100 - winRate}%; background:var(--color-red); transition: width 0.4s ease;"></div>
        </div>
        <div style="font-size:10.5px; color:var(--text-dim); margin-top:4px; line-height:1.4;">
          📍 峽谷即時經濟差：<b>${goldDiff >= 0 ? '+' : ''}${goldDiff}</b> 金幣 | 累計數據：${kills}K / ${deaths}D / ${assists}A
        </div>
      </div>
    `;

    const titleHTML = `
      <div style="margin-bottom: 8px;">決策｜${curP.name}</div>
      ${winRateHTML}
    `;

    choose(titleHTML, curP.choices.map(c => {
      const attrVal = S.ab[c.attr] || 60;
      const masteryBonus = Math.min(0.08, masteryPts / 300000);
      const attrBonus = (attrVal - 60) * 0.003; 
      const goldBonus = Math.max(-0.15, Math.min(0.15, goldDiff * 0.00003));
      
      let successProb = c.risk + attrBonus + masteryBonus + goldBonus;
      successProb = Math.max(0.15, Math.min(0.85, successProb));
      const successPct = Math.round(successProb * 100);

      return {
        t: c.t,
        s: `🎯 預估成功率: <b>${successPct}%</b> | 屬性: ${ABL[c.attr]} (${attrVal}) | 熟練度: +${Math.round(masteryBonus*100)}%<br><small style="color:var(--text-dim);">${c.s}</small>`,
        f: () => {
          const succ = rng.next() < successProb;
          
          let prevWin = winRate;
          let winRateChange = 0;
          if (succ) {
            winRateChange = rng.range(7, 13);
            winRate = Math.min(99, winRate + winRateChange);
            goldDiff += rng.range(800, 1600);
            kills += 1;
            
            card('good', curP.name, `
              <b>【決策成功】</b> ${c.successTxt}<br>
              <div style="margin-top:5px; font-size:11px; color:var(--text-dim);">
                📈 我方勝率變動：<b class="hl">${prevWin}% ➔ ${winRate}% (+${winRateChange}%)</b>
              </div>
            `);
          } else {
            winRateChange = rng.range(7, 13);
            winRate = Math.max(1, winRate - winRateChange);
            goldDiff -= rng.range(800, 1600);
            deaths += 1;
            
            card('bad', curP.name, `
              <b>【決策失敗】</b> ${c.failTxt}<br>
              <div style="margin-top:5px; font-size:11px; color:var(--text-dim);">
                📉 我方勝率變動：<b class="hl">${prevWin}% ➔ ${winRate}% (-${winRateChange}%)</b>
              </div>
            `);
          }
          
          winRateHistory.push(winRate);
          currentPhase++;
          board(1);
          runNextPhase();
        }
      };
    }));
  }

  runNextPhase();
}

// ==================== 2. 英雄池特訓 ====================
function trainChampionMastery(slots = 3, onDone) {
  const act = $('act');
  act.style.display = 'block';

  let remainingSlots = slots;
  const hist = []; // [{ cId, addedPoints, addedSignature }]

  const roleChamps = CHAMPIONS.filter(c => c.primaryRole === S.pos || c.roles.includes(S.pos));
  const offChamps = CHAMPIONS.filter(c => c.primaryRole !== S.pos && !c.roles.includes(S.pos)).slice(0, 6);
  const list = [...roleChamps, ...offChamps];

  function renderTrainMenu() {
    board(1);
    act.innerHTML = `
      <div class="title">🎯 英雄自主特訓 (剩餘訓練次數: ${remainingSlots} 次)</div>
      <div style="font-size:12px;color:var(--dim);margin-bottom:8px;">
        新賽季開賽前特訓。每消耗 1 次訓練機會，可使指定英雄熟練度 <b>+35 點</b>：
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:6px;max-height:180px;overflow-y:auto;background:var(--panel2);padding:8px;border-radius:var(--r);margin-bottom:10px;">
        ${list.map(c => {
          const pts = S.masteries[c.id] || 0;
          const mi = getMasteryInfo(pts);
          return `
            <button class="btn btn-train-champ" data-id="${c.id}" style="padding:6px;font-size:11.5px;text-align:center;margin:0;" ${remainingSlots <= 0 ? 'disabled style="opacity:0.5;cursor:default;"' : ''}>
              <strong>${c.name}</strong><br>
              <small style="color:var(--accent);">${mi.name} (${pts}點)</small>
            </button>
          `;
        }).join('')}
      </div>
      <div class="row2" style="display:flex; gap:10px;">
        <button class="btn" id="btn-undo-train" style="text-align:center; flex:1; ${hist.length === 0 ? 'opacity:0.4; cursor:default;' : ''}" ${hist.length === 0 ? 'disabled' : ''}>
          ↩ 退回一步
        </button>
        <button class="btn main" id="btn-finish-train" style="text-align:center; flex:1;">
          ${remainingSlots <= 0 ? '完成特訓，開啟新賽季 ▸' : '跳過特訓，直接開賽 ▸'}
        </button>
      </div>
    `;

    // Click on champion button to train
    act.querySelectorAll('.btn-train-champ').forEach(btn => {
      btn.onclick = () => {
        if (remainingSlots <= 0) return;
        const cId = btn.getAttribute('data-id');
        const champ = getChampionById(cId);
        
        S.masteries[cId] = (S.masteries[cId] || 0) + 35;
        const newMi = getMasteryInfo(S.masteries[cId]);
        
        let addedSignature = false;
        if (newMi.level >= 5 && !S.signatureChamps.includes(cId)) {
          S.signatureChamps.push(cId);
          addedSignature = true;
          card('gold', '招牌英雄晉升！', `你的【${champ.name}】已達到 <b class="hl">${newMi.name}</b>！賽場上將觸發更多專屬高光決策！`);
        } else {
          card('good', '特訓完成', `自主特訓了【${champ.name}】，熟練度提升至 <b class="hl">${newMi.name} (${S.masteries[cId]}點)</b>！`);
        }
        
        hist.push({ cId, addedPoints: 35, addedSignature });
        remainingSlots--;
        
        renderTrainMenu();
      };
    });

    // Undo button
    const btnUndo = $('btn-undo-train');
    if (btnUndo && hist.length > 0) {
      btnUndo.onclick = () => {
        const last = hist.pop();
        S.masteries[last.cId] = Math.max(0, S.masteries[last.cId] - last.addedPoints);
        if (last.addedSignature) {
          S.signatureChamps = S.signatureChamps.filter(id => id !== last.cId);
        }
        remainingSlots++;
        board(1);
        renderTrainMenu();
      };
    }

    // Finish button
    const btnFinish = $('btn-finish-train');
    if (btnFinish) {
      btnFinish.onclick = () => {
        act.style.display = 'none';
        onDone();
      };
    }
  }

  renderTrainMenu();
}

// ==================== 遊戲主循環 (業餘 ➔ 職業 ➔ 轉會 ➔ 退役) ====================
function startCareer() {
  divider(`${S.year} · 16 歲 召喚峽谷天梯衝分`);
  board(0);
  tlPush('天梯起步');

  card('info', '天梯啟程', `16 歲的你以一手絕活在台服與韓服積分榜展現極限操作，決心追尋電競職業夢。新賽季開始，請分配你的初始特訓點數！`);

  // 初始擲骰特訓
  rollDice(5, '16歲 基礎天賦分配', () => {
    phaseAmateurYear();
  });
}

function getTacticModifier() {
  if (!S || !S.tactics) return 0;
  let mod = 0;
  
  if (S.tactics.banPickPreference === 'SIGNATURE') {
    let maxPts = 0;
    Object.values(S.masteries || {}).forEach(pts => {
      if (pts > maxPts) maxPts = pts;
    });
    mod += Math.min(5, Math.floor(maxPts / 5000));
  } else if (S.tactics.banPickPreference === 'OFFMETA') {
    mod -= 4;
  }
  
  if (S.tactics.style === 'AGGRESSIVE') {
    const playerOvr = ovr();
    if (playerOvr > 72) mod += 5;
    else mod -= 5;
  } else if (S.tactics.style === 'DEFENSIVE') {
    mod += 1;
  }
  
  return mod;
}

function phaseAmateurYear() {
  board(1);
  divider(`${S.year} · 業餘盃賽與新秀選拔`);

  const tourneyScore = ovr() + rng.range(-5, 8);
  if (tourneyScore >= 56) {
    S.money += 30000;
    S.popularity += 15;
    card('gold', '六都校園盃奪冠', `你在全國六都電競決賽中連續單殺對手，以全勝戰績率隊奪得冠軍獎金 3 萬元！現場星探紛紛向你遞出名片。`);
  } else {
    card('good', '網咖爭霸賽四強', `在民間甲組賽事中打入四強，積累了寶貴的線下 BO3 對抗經驗。`);
  }

  // 觸發寫實事件
  const ev = getRandomEvent(rng, 16);
  choose(`生涯抉擇：${ev.title}`, ev.choices.map(c => ({
    t: c.text,
    s: `風格：${c.type}`,
    f: () => {
      card('info', ev.title, c.effect.log);
      if (c.effect.mechanicsExp) addAb('mechanics', 2);
      if (c.effect.macroExp) addAb('macro', 2);
      board(1);

      phaseAmateurTryouts();
    }
  })));
}

function phaseAmateurTryouts() {
  board(2);
  divider(`${S.year} · LCP 冬季公開試訓會`);

  const pOvr = ovr();
  const offers = [];
  if (pOvr >= 62) {
    offers.push({ teamId: 'FSG', teamName: 'Flying Steel Gaming (飛鋼電競)', status: 'Starter', salary: 1200000, desc: 'LCP 豪門先發' });
    offers.push({ teamId: 'TSG', teamName: 'Talon Storm Gaming (暴風獵鷹)', status: 'Starter', salary: 1500000, desc: 'LCP 頂級先發' });
  } else if (pOvr >= 54) {
    offers.push({ teamId: 'CRG', teamName: 'Cross Realm Gaming (跨界幻影)', status: 'Academy', salary: 450000, desc: '二隊青訓主力' });
    offers.push({ teamId: 'FRK', teamName: 'Phoenix Frank (赤焰鳳凰)', status: 'Sub', salary: 500000, desc: '一隊輪換替補' });
  } else {
    offers.push({ teamId: 'TW_AMATEUR_ROOKIE', teamName: '星火青年電競培訓隊 (SEC)', status: 'Amateur', salary: 150000, desc: '業餘培訓合約' });
  }

  // Generate competitor OVR for each tryout offer
  offers.forEach(o => {
    const teamObj = getTeamById(o.teamId);
    const teamBaseRating = teamObj ? teamObj.baseRating : (o.status === 'Amateur' ? 52 : 65);
    o.competitorOvr = rng.range(teamBaseRating - 3, teamBaseRating + 2);
  });

  card('info', '試訓結果出爐', `各大俱樂部管理層與教練在實機測試後給予了極高評價，送來了正式簽約意向書！`);

  choose('請選擇你的首份簽約戰隊：', offers.map(o => {
    const myOvr = ovr();
    const canBeStarter = o.status === 'Starter' || myOvr >= o.competitorOvr;
    const statusTxt = canBeStarter ? '🟢 預計先發' : `🔴 預計二軍 (需追趕 ${o.competitorOvr - myOvr} OVR)`;

    return {
      t: `✍️ 簽約 ${o.teamName}`,
      main: true,
      s: `${o.desc} · 年薪 $${o.salary.toLocaleString()} 元<br><small style="color:var(--dim);">競爭對手 OVR: <b>${o.competitorOvr}</b> | ${statusTxt}</small>`,
      f: () => {
        S.teamId = o.teamId;
        S.team = o.teamName;
        S.salary = o.salary;
        S.money += Math.round(o.salary * 0.3);
        S.stage = o.status === 'Amateur' ? 'AMATEUR' : 'PRO';
        S.rosterStatus = (o.status === 'Starter' || canBeStarter) ? 'STARTER' : 'ACADEMY';
        S.benchCompetitorOvr = o.competitorOvr;
        S.tactics = { banPickPreference: 'META', style: 'BALANCED' };
        card('gold', '加盟正式簽約', `你正式簽約加盟 <b class="hl">${o.teamName}</b>！職位：${S.rosterStatus === 'STARTER' ? '<b class="hl">一軍先發選手</b>' : '<b class="warn">二軍培訓選手</b>'}`);
        tlPush(o.status === 'Starter' ? '登陸 LCP' : '加入二軍');

        choose('賽季結束', [{
          t: '進入下一年 ▸ 2027 (17歲 職業新賽季)',
          main: true,
          f: () => startNextProYear()
        }]);
      }
    };
  }));
}

// 職業年度循環
function startNextProYear() {
  S.year += 1;
  S.age += 1;
  board(0);
  divider(`${S.year} · ${S.age} 歲 職業新賽季`);

  // 25 歲老化
  if (S.age >= 25) {
    if (!S.traits.IRON_MAN && rng.next() < 0.5) {
      addAb('mechanics', -2);
      card('bad', '生理反應衰退', '年過 25，你感受到手速與極限反應略微下滑，操作 <b class="dn">-2</b>。');
    }
    if (rng.next() < 0.6) {
      addAb('macro', 3);
      addAb('mental', 3);
      card('good', '大將風範蛻變', '雖然反應不如年輕人，但你的地圖大局觀與心態愈發沉穩，觀念、心態 <b class="up">+3</b>。');
    }
  }

  // 季前動態 Meta
  const meta = generateSplitMeta(rng, S.year, 'SPLIT_1');
  const uniqueT0Champs = [...new Set(Object.values(meta.sTierChampions).flat())];
  card('info', `年度版本公布：${meta.patchTitle}`, `${meta.desc}<br>強勢 T0 英雄焦點：${uniqueT0Champs.map(id => getChampionById(id)?.name || id).slice(0, 4).join('、 ')}`);

  // 季前特訓
  rollDice(4, `${S.age}歲 季前特訓加點`, () => {
    trainChampionMastery(3, () => {
      runProSplit('SPLIT_1', () => runProSplit('SPLIT_2', () => runProSplit('SPLIT_3', () => phaseYearEndTransfer())));
    });
  });
}

function runProSplit(splitKey, onSplitDone) {
  board(1);
  S.seasonSimMode = 'MANUAL'; // Reset simulation preference to manual for the new split
  const splitInfo = SPLITS[splitKey];
  divider(`${S.year} · ${splitInfo.name}`);

  const meta = generateSplitMeta(rng, S.year, splitKey);
  const playerTeam = getTeamById(S.teamId) || TEAMS[0];
  
  // Re-roll bench competitor OVR for this split based on current team rating
  const teamBaseRating = playerTeam.baseRating || 70;
  S.benchCompetitorOvr = rng.range(teamBaseRating - 3, teamBaseRating + 2);

  const region = playerTeam.region || 'LCP';
  const regionTeams = TEAMS.filter(t => t.region === region);
  
  const standings = {};
  const academyStandings = {};
  regionTeams.forEach(t => { 
    standings[t.id] = { wins: 0, losses: 0 }; 
    academyStandings[t.id] = { wins: 0, losses: 0 }; 
  });

  const opponents = regionTeams.filter(t => t.id !== S.teamId);
  const schedule = opponents.map(opp => ({ oppTeamId: opp.id, isFinished: false, won: false }));
  const scheduleRng = new RNG(`${S.seed}_${S.year}_${splitKey}`);
  schedule.sort(() => scheduleRng.next() - 0.5);

  S.season = { standings, academyStandings, schedule, currentRound: 0, stage: 'REGULAR', midSplitEventTriggered: false };
  
  // Initialize current split stats
  S.currentSplitStats = { matchesPlayed: 0, matchesWon: 0, kills: 0, deaths: 0, assists: 0, pogCount: 0 };

  // Select season simulation mode at the start of the split!
  choose(`${splitInfo.name} · 賽事規劃決策`, [
    {
      t: '🎯 每場人工選擇 (逐輪手動推進)',
      s: '每輪手動選擇進入比賽、快速模擬本輪或設定策略',
      f: () => {
        S.seasonSimMode = 'MANUAL';
        playSeasonStep();
      }
    },
    {
      t: '⏩ 一鍵自動模擬整個常規賽 (僅例行賽)',
      s: '直接自動跑完所有例行賽對局，並在季後賽前暫停讓您接手',
      f: () => {
        S.seasonSimMode = 'REGULAR_ONLY';
        playSeasonStep();
      }
    },
    {
      t: '🏆 一鍵自動模擬整個賽季 (例行賽 + 季後賽)',
      s: '自動模擬例行賽與季後賽，若獲得 MSI/Worlds 國際賽資格將暫停詢問',
      f: () => {
        S.seasonSimMode = 'FULL_SEASON';
        playSeasonStep();
      }
    }
  ]);

  function playSeasonStep() {
    board(1);
    const season = S.season;
    
    // Note: S.benchCompetitorOvr is now re-rolled at the start of each split based on team strength, keeping it stable during the split.

    if (S.injuryRoundsLeft > 0) {
      S.injuryRoundsLeft--;
      if (S.injuryRoundsLeft <= 0) {
        card('good', '🤕 傷愈歸隊', `恭喜！你的手腕傷勢【${S.injuryType}】已完全康復，手腕健康度回升。`);
        S.injuryType = null;
        S.wristHealth = Math.min(100, S.wristHealth + 30);
      }
    }

    if (season.stage === 'REGULAR') {
      if (S.rosterStatus === 'STARTER') {
        if (ovr() < S.benchCompetitorOvr - 5 || S.fatigue > 85 || S.coachTrust < 30) {
          S.rosterStatus = 'SUB';
          card('bad', '💺 下放替補席', `教練宣布調整先發名單！因你近期綜合能力 (${ovr()}) 低於替補競爭對手 (${S.benchCompetitorOvr})、極度疲勞或教練信任不足，已被下放至一軍替補席。`);
        }
      } else if (S.rosterStatus === 'SUB') {
        if (ovr() < S.benchCompetitorOvr - 8) {
          S.rosterStatus = 'ACADEMY';
          card('bad', '📉 下放二軍培訓', `教練宣布調整名單！因你的綜合戰力 (${ovr()}) 遠低於一軍先發選手 (${S.benchCompetitorOvr})，被教練下放至二軍聯賽進行重新磨練。`);
        } else {
          const canRegainStarter = (!S.injuryRoundsLeft || S.injuryRoundsLeft <= 0) &&
            S.fatigue < 50 &&
            ((S.coachTrust > 65 && ovr() >= S.benchCompetitorOvr - 3) || (S.coachTrust > 45 && ovr() >= S.benchCompetitorOvr));
          if (canRegainStarter) {
            S.rosterStatus = 'STARTER';
            card('good', '🔥 奪回先發席位', `教練對你最近的調整狀態與溝通非常滿意！你重返一軍先發名單！`);
          }
        }
      } else if (S.rosterStatus === 'ACADEMY') {
        const canRegainStarter = (!S.injuryRoundsLeft || S.injuryRoundsLeft <= 0) &&
          S.fatigue < 50 &&
          ((S.coachTrust > 65 && ovr() >= S.benchCompetitorOvr - 3) || (S.coachTrust > 45 && ovr() >= S.benchCompetitorOvr));
        if (canRegainStarter) {
          S.rosterStatus = 'STARTER';
          card('gold', '🔥 晉升一軍先發！', `你在二軍聯賽的發揮極其耀眼，實力已獲得認可！主教練正式宣布將你提拔至一軍先發名單！`);
        }
      }
    }

    if ((!S.injuryRoundsLeft || S.injuryRoundsLeft <= 0) && S.wristHealth < 40 && rng.next() < 0.25) {
      const injuries = ['手腕腱鞘炎', '手掌肌腱拉傷', '腕隧道症候群'];
      S.injuryType = rng.choice(injuries);
      S.injuryRoundsLeft = rng.range(2, 4);
      S.rosterStatus = 'SUB';
      card('bad', '🚨 突發手腕傷病！', `你在高強度訓練中感到手腕一陣劇痛，被隊醫確診為【${S.injuryType}】！`);
      
      const optRehabCost = 5; 
      const canAffordRehab = S.salary >= optRehabCost;
      
      choose(`⚠️ 傷病爆發：該如何處置？ (養傷期：${S.injuryRoundsLeft} 輪)`, [
        {
          t: '🛌 遵從醫囑，老實告假靜養',
          s: '本輪暫不參賽，手腕健康度回升',
          f: () => {
            S.wristHealth = Math.min(100, S.wristHealth + 25);
            S.fatigue = Math.max(0, S.fatigue - 15);
            card('info', '遵醫囑休養', '你決定坐在替補席靜養。本輪比賽將完全由替補隊友出戰。');
            resolveSubRound();
          }
        },
        {
          t: '💉 打止痛針封閉，強行帶傷參賽',
          s: '重回先發。本輪起可親自出戰，但因劇痛 OVR 承受 -15 懲罰，且健康度暴扣！',
          f: () => {
            S.rosterStatus = 'STARTER';
            S.wristHealth = Math.max(0, S.wristHealth - 20);
            S.coachTrust = Math.max(0, S.coachTrust - 5);
            card('warn', '打封閉帶傷上場', '你強行對手腕注射封閉止痛！你重回先發，但強烈的痛楚會讓你的賽場發揮 (OVR) 大打折扣！');
            playSeasonStep();
          }
        },
        {
          t: `🏥 自費接受高級物理治療 ${canAffordRehab ? '' : '(薪水不足)'}`,
          s: `花費 50 萬薪水，縮短 2 輪養傷期，手腕健康度提升`,
          f: () => {
            if (!canAffordRehab) {
              card('bad', '預算不足', '您的生涯薪水不足以支付高端物理治療！');
              playSeasonStep();
              return;
            }
            S.salary -= optRehabCost;
            S.injuryRoundsLeft = Math.max(1, S.injuryRoundsLeft - 2);
            S.wristHealth = Math.min(100, S.wristHealth + 20);
            card('good', '接受高級物理治療', '你前往運動醫學中心進行高壓氧與雷射復健。手腕疼痛大大減輕！');
            playSeasonStep();
          }
        }
      ]);
      return;
    }

    // --- Automatic Simulation Modes Execution ---
    if (S.seasonSimMode === 'REGULAR_ONLY' && season.stage === 'REGULAR') {
      executeRegularSeasonSim();
      return;
    }
    if (S.seasonSimMode === 'FULL_SEASON') {
      if (season.stage === 'REGULAR') {
        executeRegularSeasonSim();
        return;
      }
      if (season.stage === 'PLAYOFFS_SEMI') {
        const opp = getPlayoffsOpponent('SEMI');
        const teamOvr = S.rosterStatus === 'STARTER' ? (ovr() + getTacticModifier()) : S.benchCompetitorOvr;
        const won = rng.next() < (teamOvr / 105);
        resolvePlayoffsSemi(won, false);
        return;
      }
      if (season.stage === 'PLAYOFFS_FINAL') {
        const opp = getPlayoffsOpponent('FINAL');
        const teamOvr = S.rosterStatus === 'STARTER' ? (ovr() + getTacticModifier()) : S.benchCompetitorOvr;
        const won = rng.next() < (teamOvr / 110);
        resolvePlayoffsFinal(won, false);
        return;
      }
    }

    if (season.stage === 'REGULAR') {
      if (season.currentRound === 3 && !season.midSplitEventTriggered) {
        season.midSplitEventTriggered = true;
        triggerMidSplitEvent();
        return;
      }
      
      if (season.currentRound < season.schedule.length) {
        const roundNum = season.currentRound + 1;
        const matchInfo = season.schedule[season.currentRound];
        const nextOpp = getTeamById(matchInfo.oppTeamId) || TEAMS[0];
        
        if (S.rosterStatus === 'STARTER') {
          choose(`${splitInfo.name} · 第 ${roundNum}/${season.schedule.length} 輪對決 (${nextOpp.name})`, [
            {
              t: '🎮 進入本場比賽 (進行 BP 選角與手動對決)',
              main: true,
              s: S.injuryRoundsLeft > 0 ? '⚠️ 注意：您目前帶傷上陣 (OVR -15)' : '手動選擇英雄，進入 7 階段選線與團戰策略決策',
              f: () => {
                interactiveBPDraft(nextOpp, meta, (won) => { resolveProMatchResult(won); });
              }
            },
            {
              t: '📊 查看當前狀態與先發競爭數據',
              s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
              f: () => { showPlayerCompetitorStats(); }
            },
            {
              t: '⚡ 快速模擬此輪',
              s: '系統依綜合實力與自動模擬設定直接計算本場勝負',
              f: () => {
                const playerOvr = ovr() + getTacticModifier();
                const won = rng.next() < (playerOvr / 100);
                resolveProMatchResult(won);
              }
            },
            {
              t: '⏩ 模擬剩餘常規賽 (僅例行賽)',
              s: '自動模擬完剩餘例行賽對局，並在季後賽前暫停讓您接手',
              f: () => {
                S.seasonSimMode = 'REGULAR_ONLY';
                executeRegularSeasonSim();
              }
            },
            {
              t: '🏆 模擬整個賽季 (例行賽 + 季後賽)',
              s: '自動模擬完剩餘例行賽與季後賽，若晉級國際賽將會暫停詢問',
              f: () => {
                S.seasonSimMode = 'FULL_SEASON';
                executeRegularSeasonSim();
              }
            },
            {
              t: '📊 查看當前聯賽積分榜',
              s: '查看當前賽區內各戰隊的勝敗排名',
              f: () => { showStandingsCard(); playSeasonStep(); }
            },
            {
              t: '⚙️ 設定自動模擬策略',
              s: '設定自動模擬時的 B/P 偏好與戰術風格',
              f: () => { showTacticsMenu(); }
            }
          ]);
        } else if (S.rosterStatus === 'ACADEMY') {
          const academyOpp = { ...nextOpp, name: `${nextOpp.shortName} Academy`, shortName: `${nextOpp.shortName} Acad` };
          choose(`二軍聯賽 · 第 ${roundNum}/${season.schedule.length} 輪 (${academyOpp.name})`, [
            {
              t: '🎮 進入二軍聯賽對決 (進行 BP 與手動對決)',
              main: true,
              s: S.injuryRoundsLeft > 0 ? '⚠️ 注意：您目前帶傷上陣 (OVR -15)' : '手動選擇英雄，進入 7 階段選線與團戰策略決策',
              f: () => {
                interactiveBPDraft(academyOpp, meta, (won) => { resolveAcademyMatchResult(won); });
              }
            },
            {
              t: '📊 查看當前狀態與先發競爭數據',
              s: '查看您的手腕健康、疲勞值、教練信任度以及一軍先發戰力',
              f: () => { showPlayerCompetitorStats(); }
            },
            {
              t: '⚡ 快速模擬此輪二軍賽事',
              s: '系統直接計算本場勝負，您作為二軍主力出戰',
              f: () => {
                const playerOvr = ovr() + getTacticModifier();
                const won = rng.next() < (playerOvr / 95);
                resolveAcademyMatchResult(won);
              }
            },
            {
              t: '⏩ 模擬剩餘常規賽 (僅例行賽)',
              s: '自動模擬完剩餘例行賽二軍對局，並在季後賽前暫停讓您接手',
              f: () => {
                S.seasonSimMode = 'REGULAR_ONLY';
                executeRegularSeasonSim();
              }
            },
            {
              t: '🏆 模擬整個賽季 (例行賽 + 季後賽)',
              s: '自動模擬完剩餘例行賽二軍與一軍季後賽',
              f: () => {
                S.seasonSimMode = 'FULL_SEASON';
                executeRegularSeasonSim();
              }
            },
            {
              t: '📊 查看當前聯賽積分榜',
              s: '查看當前賽區一軍各戰隊的勝敗排名',
              f: () => { showStandingsCard(); playSeasonStep(); }
            }
          ]);
        } else {
          choose(`💺 替補席備戰 · 第 ${roundNum}/${season.schedule.length} 輪 (${nextOpp.name})`, [
            {
              t: '⚡ 快速模擬此輪 (為隊友加油)',
              main: true,
              s: '因您目前在替補席，將由二隊替補選手代替您上場出戰',
              f: () => { resolveSubRound(); }
            },
            {
              t: '📊 查看當前狀態與先發競爭數據',
              s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
              f: () => { showPlayerCompetitorStats(); }
            },
            {
              t: '🏋️ 進行瘋狂自主加練',
              s: '在訓練室狂打 Rank。操作與觀念顯著提升，但大幅消耗疲勞與手腕健康',
              f: () => {
                addAb('mechanics', 2);
                addAb('macro', 2);
                S.fatigue = Math.min(100, S.fatigue + 20);
                S.wristHealth = Math.max(0, S.wristHealth - 8);
                card('good', '進行自主加練', '你瘋狂加練了 10 場 Solo！雖然感到筋疲力盡，但你的基本功與大局觀顯著提升，操作與觀念各 <b class="up">+2</b>！');
                resolveSubRound();
              }
            },
            {
              t: '🛌 徹底放鬆休息 (降低疲勞與養護手腕)',
              s: '老實躺平休息以調養身體，大幅降低疲勞並恢復手腕健康度',
              f: () => {
                S.fatigue = Math.max(0, S.fatigue - 30);
                S.wristHealth = Math.min(100, S.wristHealth + 15);
                S.coachTrust = Math.max(0, S.coachTrust - 5);
                card('good', '老實養精蓄銳', '你選擇休養調護身體。疲勞值 <b class="up">-30%</b>，手腕健康度 <b class="up">+15%</b>，雖然教練對你沒在加練微有微詞。');
                resolveSubRound();
              }
            },
            {
              t: '💬 主動與教練進行戰術溝通',
              s: '主動找教練討論比賽細節，提升教練信任度',
              f: () => {
                const trustGain = rng.range(8, 18);
                S.coachTrust = Math.min(100, S.coachTrust + trustGain);
                S.fatigue = Math.min(100, S.fatigue + 5);
                card('good', '與教練戰術溝通', `快拿著筆記本找主教練討論上一輪的戰術失誤。教練對你的敬業態度深感欣慰！信任度提升 ${trustGain} 點！`);
                resolveSubRound();
              }
            },
            {
              t: '⏩ 模擬剩餘常規賽 (僅例行賽)',
              s: '自動模擬完剩餘例行賽對局，並在季後賽前暫停讓您接手',
              f: () => {
                S.seasonSimMode = 'REGULAR_ONLY';
                executeRegularSeasonSim();
              }
            },
            {
              t: '🏆 模擬整個賽季 (例行賽 + 季後賽)',
              s: '自動模擬完剩餘例行賽與季後賽，若晉級國際賽將會暫停詢問',
              f: () => {
                S.seasonSimMode = 'FULL_SEASON';
                executeRegularSeasonSim();
              }
            },
            {
              t: '📊 查看當前聯賽積分榜',
              s: '查看當前賽區內各戰隊的勝敗排名',
              f: () => { showStandingsCard(); playSeasonStep(); }
            },
            {
              t: '⚙️ 設定自動模擬策略',
              s: '設定自動模擬時的 B/P 偏好與戰術風格',
              f: () => { showTacticsMenu(); }
            }
          ]);
        }
      } else { checkPlayoffsQualification(); }
    } else if (season.stage === 'PLAYOFFS_SEMI') {
      const opp = getPlayoffsOpponent('SEMI');
      if (!opp) { proceedToSplitSettlement(splitKey, splitInfo, false, onSplitDone); return; }
      
      if (S.rosterStatus === 'STARTER') {
        choose(`🏆 季後賽準決賽 BO5 (${opp.name})`, [
          {
            t: '🎮 進入決勝局對決 (決勝生死戰)',
            main: true,
            s: S.injuryRoundsLeft > 0 ? '⚠️ 注意：您目前帶傷上陣 (OVR -15)' : '手動選擇英雄，贏下這一局即可挺進總決賽！',
            f: () => {
              interactiveBPDraft(opp, meta, (won) => { resolvePlayoffsSemi(won, true); });
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '⚡ 快速模擬準決賽',
            s: '系統直接計算 BO5 對決勝負',
            f: () => {
              const teamOvr = ovr() + getTacticModifier();
              const won = rng.next() < (teamOvr / 105);
              resolvePlayoffsSemi(won, false);
            }
          }
        ]);
      } else if (S.rosterStatus === 'ACADEMY') {
        const academyOpp = { ...opp, name: `${opp.shortName} Academy`, shortName: `${opp.shortName} Acad` };
        choose(`🏆 二軍季後賽準決賽 BO5 (${academyOpp.name})`, [
          {
            t: '🎮 進入決勝局對決 (二軍準決賽)',
            main: true,
            s: S.injuryRoundsLeft > 0 ? '⚠️ 注意：您目前帶傷上陣 (OVR -15)' : '手動選擇英雄，贏下這一局即可挺進二軍總決賽！',
            f: () => {
              interactiveBPDraft(academyOpp, meta, (won) => { resolvePlayoffsSemi(won, true); });
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '⚡ 快速模擬準決賽',
            s: '系統直接計算 BO5 對決勝負，您作為二軍主力出戰',
            f: () => {
              const teamOvr = ovr() + getTacticModifier();
              const won = rng.next() < (teamOvr / 100);
              resolvePlayoffsSemi(won, false);
            }
          }
        ]);
      } else {
        choose(`💺 替補席備戰 · 季後賽準決賽 BO5 (${opp.name})`, [
          {
            t: '⚡ 快速模擬此輪 (為隊友加油)',
            main: true,
            s: '因您目前在替補席，將由二隊替補選手代替您上場出戰',
            f: () => {
              const won = rng.next() < (S.benchCompetitorOvr / 105);
              resolvePlayoffsSemi(won, false);
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            main: true,
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '🏋️ 進行瘋狂自主加練',
            s: '在訓練室狂打 Rank。操作與觀念顯著提升，但大幅消耗疲勞與手腕健康',
            f: () => {
              addAb('mechanics', 2);
              addAb('macro', 2);
              S.fatigue = Math.min(100, S.fatigue + 20);
              S.wristHealth = Math.max(0, S.wristHealth - 8);
              card('good', '進行自主加練', '你瘋狂加練了 10 場 Solo！雖然感到筋疲力盡，但你的基本功與大局觀顯著提升，操作與觀念各 <b class="up">+2</b>！');
              const won = rng.next() < (S.benchCompetitorOvr / 105);
              resolvePlayoffsSemi(won, false);
            }
          },
          {
            t: '🛌 徹底放鬆休息 (降低疲勞與養護手腕)',
            s: '老實躺平休息以調養身體，大幅降低疲勞並恢復手腕健康度',
            f: () => {
              S.fatigue = Math.max(0, S.fatigue - 30);
              S.wristHealth = Math.min(100, S.wristHealth + 15);
              S.coachTrust = Math.max(0, S.coachTrust - 5);
              card('gold', '老實養精蓄銳', '你選擇休養調度身體。疲勞值 <b class="up">-30%</b>，手腕健康度 <b class="up">+15%</b>，雖然教練對你沒在加練微有微詞。');
              const won = rng.next() < (S.benchCompetitorOvr / 105);
              resolvePlayoffsSemi(won, false);
            }
          },
          {
            t: '💬 主動與教練進行戰術溝通',
            s: '主動找教練討論比賽細節，提升教練信任度',
            f: () => {
              const trustGain = rng.range(8, 18);
              S.coachTrust = Math.min(100, S.coachTrust + trustGain);
              S.fatigue = Math.min(100, S.fatigue + 5);
              card('good', '與教練戰術溝通', `快拿著筆記本找主教練討論戰術。教練對你的敬業態度深感欣慰！信任度提升 ${trustGain} 點！`);
              const won = rng.next() < (S.benchCompetitorOvr / 105);
              resolvePlayoffsSemi(won, false);
            }
          }
        ]);
      }
      
    } else if (season.stage === 'PLAYOFFS_FINAL') {
      const opp = getPlayoffsOpponent('FINAL');
      if (!opp) { proceedToSplitSettlement(splitKey, splitInfo, true, onSplitDone); return; }
      
      if (S.rosterStatus === 'STARTER') {
        choose(`🏆 季後賽總決賽 BO5 (${opp.name})`, [
          {
            t: '🎮 進入總決賽對決 (總冠軍點生死戰)',
            main: true,
            s: S.injuryRoundsLeft > 0 ? '⚠️ 注意：您目前帶傷上陣 (OVR -15)' : '手動進行選角與戰術對決，捧起冠軍獎盃與 FMVP 榮譽！',
            f: () => {
              interactiveBPDraft(opp, meta, (won) => { resolvePlayoffsFinal(won, true); });
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '⚡ 快速模擬總決賽',
            s: '系統直接計算總冠軍歸屬',
            f: () => {
              const teamOvr = ovr() + getTacticModifier();
              const won = rng.next() < (teamOvr / 110);
              resolvePlayoffsFinal(won, false);
            }
          }
        ]);
      } else if (S.rosterStatus === 'ACADEMY') {
        const academyOpp = { ...opp, name: `${opp.shortName} Academy`, shortName: `${opp.shortName} Acad` };
        choose(`🏆 二軍季後賽總決賽 BO5 (${academyOpp.name})`, [
          {
            t: '🎮 進入總決賽對決 (二軍總冠軍點生死戰)',
            main: true,
            s: S.injuryRoundsLeft > 0 ? '⚠️ 注意：您目前帶傷上陣 (OVR -15)' : '手動進行選角與戰術對決，捧起二軍聯賽冠軍獎盃！',
            f: () => {
              interactiveBPDraft(academyOpp, meta, (won) => { resolvePlayoffsFinal(won, true); });
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '⚡ 快速模擬二軍總決賽',
            s: '系統直接計算二軍總冠軍歸屬',
            f: () => {
              const teamOvr = ovr() + getTacticModifier();
              const won = rng.next() < (teamOvr / 105);
              resolvePlayoffsFinal(won, false);
            }
          }
        ]);
      } else {
        choose(`💺 替補席備戰 · 季後賽總決賽 BO5 (${opp.name})`, [
          {
            t: '⚡ 快速模擬此輪 (為隊友加油)',
            main: true,
            s: '因您目前在替補席，將由二隊替補選手代替您上場出戰',
            f: () => {
              const won = rng.next() < (S.benchCompetitorOvr / 110);
              resolvePlayoffsFinal(won, false);
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            main: true,
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '🏋️ 進行瘋狂自主加練',
            s: '在訓練室狂打 Rank。操作與觀念顯著提升，但大幅消耗疲勞與手腕健康',
            f: () => {
              addAb('mechanics', 2);
              addAb('macro', 2);
              S.fatigue = Math.min(100, S.fatigue + 20);
              S.wristHealth = Math.max(0, S.wristHealth - 8);
              card('good', '進行自主加練', '你瘋狂加練了 10 場 Solo！雖然感到筋疲力盡，但你的基本功與大局觀顯著提升，操作與觀念各 <b class="up">+2</b>！');
              const won = rng.next() < (S.benchCompetitorOvr / 110);
              resolvePlayoffsFinal(won, false);
            }
          },
          {
            t: '🛌 徹底放鬆休息 (降低疲勞與養護手腕)',
            s: '老實躺平休息以調養身體，大幅降低疲勞並恢復手腕健康度',
            f: () => {
              S.fatigue = Math.max(0, S.fatigue - 30);
              S.wristHealth = Math.min(100, S.wristHealth + 15);
              S.coachTrust = Math.max(0, S.coachTrust - 5);
              card('gold', '老實養精蓄銳', '你選擇休養調度身體。疲勞值 <b class="up">-30%</b>，手腕健康度 <b class="up">+15%</b>，雖然教練對你沒在加練微有微詞。');
              const won = rng.next() < (S.benchCompetitorOvr / 110);
              resolvePlayoffsFinal(won, false);
            }
          },
          {
            t: '💬 主動與教練進行戰術溝通',
            s: '主動找教練討論比賽細節，提升教練信任度',
            f: () => {
              const trustGain = rng.range(8, 18);
              S.coachTrust = Math.min(100, S.coachTrust + trustGain);
              S.fatigue = Math.min(100, S.fatigue + 5);
              card('good', '與教練戰術溝通', `快拿著筆記本找主教練討論戰術。教練對你的敬業態度深感欣慰！信任度提升 ${trustGain} 點！`);
              const won = rng.next() < (S.benchCompetitorOvr / 110);
              resolvePlayoffsFinal(won, false);
            }
          }
        ]);
      }
      
    } else if (season.stage === 'INTERNATIONAL') {
      const intlOppId = region === 'LCK' ? 'BG' : 'AO';
      const intlOpp = getTeamById(intlOppId) || TEAMS[8];
      const tourneyInfo = INTERNATIONAL_TOURNAMENTS[splitInfo.qualifiesFor];
      const isPlayerStarter = S.rosterStatus === 'STARTER';
      
      if (isPlayerStarter) {
        choose(`🌐 ${tourneyInfo.name} 淘汰賽階段`, [
          {
            t: '🎮 親自出戰 (手動 BP & 決勝對局)',
            main: true,
            s: S.injuryRoundsLeft > 0 ? '⚠️ 注意：您目前帶傷上陣 (OVR -15)' : '與世界頂級賽區豪門對決，挑戰國際之巔！',
            f: () => {
              interactiveBPDraft(intlOpp, meta, (won) => { resolveInternationalMatch(won, tourneyInfo, true); });
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '⚡ 快速模擬此國際賽事',
            s: '系統依綜合實力計算世界賽果',
            f: () => {
              const teamOvr = ovr() + getTacticModifier();
              const won = rng.next() < (teamOvr / 115);
              resolveInternationalMatch(won, tourneyInfo, false);
            }
          }
        ]);
      } else {
        choose(`💺 替補席備戰 · 🌐 ${tourneyInfo.name} 淘汰賽`, [
          {
            t: '⚡ 快速模擬此輪 (為隊友加油)',
            main: true,
            s: '因您目前在替補席，將由二隊替補選手代替您上場出戰',
            f: () => {
              const won = rng.next() < (S.benchCompetitorOvr / 115);
              resolveInternationalMatch(won, tourneyInfo, false);
            }
          },
          {
            t: '📊 查看當前狀態與先發競爭數據',
            main: true,
            s: '查看您的手腕健康、疲勞值、教練信任度以及競爭對手能力',
            f: () => { showPlayerCompetitorStats(); }
          },
          {
            t: '🏋️ 進行瘋狂自主加練',
            s: '在訓練室狂打 Rank。操作與觀念顯著提升，但大幅消耗疲勞與手腕健康',
            f: () => {
              addAb('mechanics', 2);
              addAb('macro', 2);
              S.fatigue = Math.min(100, S.fatigue + 20);
              S.wristHealth = Math.max(0, S.wristHealth - 8);
              card('good', '進行自主加練', '你瘋狂加練了 10 場 Solo！雖然感到筋疲力盡，但你的基本功與大局觀顯著提升，操作與觀念各 <b class="up">+2</b>！');
              const won = rng.next() < (S.benchCompetitorOvr / 115);
              resolveInternationalMatch(won, tourneyInfo, false);
            }
          },
          {
            t: '🛌 徹底放鬆休息 (降低疲勞與養護手腕)',
            s: '老實躺平休息以調養身體，大幅降低疲勞並恢復手腕健康度',
            f: () => {
              S.fatigue = Math.max(0, S.fatigue - 30);
              S.wristHealth = Math.min(100, S.wristHealth + 15);
              S.coachTrust = Math.max(0, S.coachTrust - 5);
              card('gold', '老實養精蓄銳', '你選擇休養調度身體。疲勞值 <b class="up">-30%</b>，手腕健康度 <b class="up">+15%</b>，雖然教練對你沒在加練微有微詞。');
              const won = rng.next() < (S.benchCompetitorOvr / 115);
              resolveInternationalMatch(won, tourneyInfo, false);
            }
          },
          {
            t: '💬 主動與教練進行戰術溝通',
            s: '主動找教練討論比賽細節，提升教練信任度',
            f: () => {
              const trustGain = rng.range(8, 18);
              S.coachTrust = Math.min(100, S.coachTrust + trustGain);
              S.fatigue = Math.min(100, S.fatigue + 5);
              card('good', '與教練戰術溝通', `快拿著筆記本找主教練討論戰術。教練對你的敬業態度深感欣慰！信任度提升 ${trustGain} 點！`);
              const won = rng.next() < (S.benchCompetitorOvr / 115);
              resolveInternationalMatch(won, tourneyInfo, false);
            }
          }
        ]);
      }
    }
  }

  function resolveSubRound() {
    const season = S.season;
    const matchInfo = season.schedule[season.currentRound];
    const opp = getTeamById(matchInfo.oppTeamId);
    const won = rng.next() < (S.benchCompetitorOvr / 100);
    
    // Note: Since the player is a SUB, we do NOT increment personal matchesPlayed, matchesWon, and we do NOT call recordMatchStats().
    // We only update the team standings and schedule.
    if (won) {
      season.standings[S.teamId].wins++;
      season.standings[opp.id].losses++;
      matchInfo.won = true;
      card('good', `第 ${season.currentRound + 1} 輪 賽事戰報 (替補席)`, `先發隊友表現穩健，以 <b class="up">2:0 擊敗了 ${opp.name}</b>！`);
    } else {
      season.standings[S.teamId].losses++;
      season.standings[opp.id].wins++;
      matchInfo.won = false;
      card('bad', `第 ${season.currentRound + 1} 輪 賽事戰報 (替補席)`, `戰隊不幸失利，以 <b class="dn">1:2 負於 ${opp.name}</b>。`);
    }
    matchInfo.isFinished = true;

    // Simulate background Academy match
    if (season.academyStandings) {
      const wonAcademy = rng.next() < (55 / 95);
      if (wonAcademy) {
        season.academyStandings[S.teamId].wins++;
        season.academyStandings[opp.id].losses++;
      } else {
        season.academyStandings[S.teamId].losses++;
        season.academyStandings[opp.id].wins++;
      }
    }

    simulateOtherTeams(opp.id);
    season.currentRound++;
    choose('本輪結束', [{ t: '繼續推進賽程 ▸', main: true, f: () => playSeasonStep() }]);
  }

  function executeRegularSeasonSim() {
    card('info', '⏩ 正在模擬剩餘例行賽...', '全隊正在高強度備戰，AI 將為您完成剩餘的所有輪次對決。');
    const season = S.season;
    while (season.currentRound < season.schedule.length) {
      const curMatch = season.schedule[season.currentRound];
      const curOpp = getTeamById(curMatch.oppTeamId);
      
      // 1. Simulate First-team match
      const teamOvr = S.rosterStatus === 'STARTER' ? (ovr() + getTacticModifier()) : S.benchCompetitorOvr;
      const won = rng.next() < (teamOvr / 100);
      
      if (won) {
        season.standings[S.teamId].wins++;
        season.standings[curOpp.id].losses++;
        curMatch.won = true;
        if (S.rosterStatus === 'STARTER') {
          S.stats.matchesPlayed += 3;
          S.stats.matchesWon += 2;
          S.currentSplitStats.matchesPlayed += 3;
          S.currentSplitStats.matchesWon += 2;
        }
      } else {
        season.standings[S.teamId].losses++;
        season.standings[curOpp.id].wins++;
        curMatch.won = false;
        if (S.rosterStatus === 'STARTER') {
          S.stats.matchesPlayed += 3;
          S.stats.matchesWon += 1;
          S.currentSplitStats.matchesPlayed += 3;
          S.currentSplitStats.matchesWon += 1;
        }
      }
      curMatch.isFinished = true;
      
      if (S.rosterStatus === 'STARTER') {
        if (won) {
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
        } else {
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        }
      }

      // 2. Simulate Academy match
      const wonAcademy = (S.rosterStatus === 'ACADEMY') 
        ? (rng.next() < ((ovr() + getTacticModifier()) / 95))
        : (rng.next() < (55 / 95));

      if (wonAcademy) {
        if (season.academyStandings) {
          season.academyStandings[S.teamId].wins++;
          season.academyStandings[curOpp.id].losses++;
        }
        if (S.rosterStatus === 'ACADEMY') {
          S.stats.matchesPlayed += 3;
          S.stats.matchesWon += 2;
          S.currentSplitStats.matchesPlayed += 3;
          S.currentSplitStats.matchesWon += 2;
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
        }
      } else {
        if (season.academyStandings) {
          season.academyStandings[S.teamId].losses++;
          season.academyStandings[curOpp.id].wins++;
        }
        if (S.rosterStatus === 'ACADEMY') {
          S.stats.matchesPlayed += 3;
          S.stats.matchesWon += 1;
          S.currentSplitStats.matchesPlayed += 3;
          S.currentSplitStats.matchesWon += 1;
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        }
      }
      
      simulateOtherTeams(curOpp.id);
      season.currentRound++;
    }
    
    const isAcademy = S.rosterStatus === 'ACADEMY';
    const targetStandings = (isAcademy && season.academyStandings) ? season.academyStandings : season.standings;
    const finalWins = targetStandings[S.teamId].wins;
    const finalLosses = targetStandings[S.teamId].losses;
    const prefix = isAcademy ? '二軍' : '例行賽';
    
    card('good', '例行賽全部模擬完畢！', `${prefix}最終戰績為：<b class="hl">${finalWins} 勝 ${finalLosses} 敗</b>`);
    showStandingsCard();
    
    if (S.seasonSimMode === 'REGULAR_ONLY') {
      S.seasonSimMode = 'MANUAL';
    }
    
    checkPlayoffsQualification();
  }

  function showTacticsMenu() {
    board(1);
    const pref = S.tactics.banPickPreference;
    const style = S.tactics.style;
    choose('⚙️ 設定自動模擬選角與戰術策略', [
      { t: `[BP選角] 優先 Meta 角 ${pref === 'META' ? '🟢 ON' : '⚪'}`, s: '模擬時優先拿 T0/T1 版本強勢英雄（穩定發揮，中庸勝率）', f: () => { S.tactics.banPickPreference = 'META'; showTacticsMenu(); } },
      { t: `[BP選角] 優先招牌絕活 ${pref === 'SIGNATURE' ? '🟢 ON' : '⚪'}`, s: '優先選擇您的個人最高熟練度英雄（熟練度越高，模擬戰力額外加分最高 +5）', f: () => { S.tactics.banPickPreference = 'SIGNATURE'; showTacticsMenu(); } },
      { t: `[BP選角] 研發非主流黑科技 ${pref === 'OFFMETA' ? '🟢 ON' : '⚪'}`, s: '嘗試非主流奇招（模擬戰力 -4，但訓練負擔減輕）', f: () => { S.tactics.banPickPreference = 'OFFMETA'; showTacticsMenu(); } },
      { t: `[戰術風格] 均衡穩健營運 ${style === 'BALANCED' ? '🟢 ON' : '⚪'}`, s: '正常勝機，適合常規局勢', f: () => { S.tactics.style = 'BALANCED'; showTacticsMenu(); } },
      { t: `[戰術風格] 瘋狂前期打架 ${style === 'AGGRESSIVE' ? '🟢 ON' : '⚪'}`, s: '放大評分差距。當 OVR 高於對手時大幅加分，但低於對手時大幅扣分', f: () => { S.tactics.style = 'AGGRESSIVE'; showTacticsMenu(); } },
      { t: `[戰術風格] 鐵壁防守拖後期 ${style === 'DEFENSIVE' ? '🟢 ON' : '⚪'}`, s: '模擬戰力微幅 +1。防守拖後期，勝負機率更為穩定', f: () => { S.tactics.style = 'DEFENSIVE'; showTacticsMenu(); } },
      { t: '◀ 確定設定並返回賽程', main: true, f: () => { playSeasonStep(); } }
    ]);
  }

  function triggerMidSplitEvent() {
    let ev;
    if (S.rosterStatus === 'SUB') {
      // Filter out MATCH category events because benched players are not on the court
      const nonMatchEvents = EVENTS.filter(e => e.category !== 'MATCH' && (!e.minAge || S.age >= e.minAge));
      ev = nonMatchEvents.length > 0 ? rng.choice(nonMatchEvents) : EVENTS[0];
    } else {
      ev = getRandomEvent(rng, S.age);
    }
    choose(`賽事事件：${ev.title}`, ev.choices.map(c => ({
      t: c.text,
      s: `決策：${c.type}`,
      f: () => {
        card('info', ev.title, c.effect.log);
        if (c.effect.mechanicsExp) addAb('mechanics', 2);
        if (c.effect.macroExp) addAb('macro', 2);
        if (c.effect.fatigue !== undefined) S.fatigue = Math.max(0, Math.min(100, S.fatigue + c.effect.fatigue));
        if (c.effect.wristHealth !== undefined) S.wristHealth = Math.max(0, Math.min(100, S.wristHealth + c.effect.wristHealth));
        if (c.effect.coachTrust !== undefined) S.coachTrust = Math.max(0, Math.min(100, S.coachTrust + c.effect.coachTrust));
        if (c.effect.popularity !== undefined) S.popularity = Math.max(0, S.popularity + c.effect.popularity);
        board(1);
        choose('事件結束', [{ t: '繼續推進賽季 ▸', main: true, f: () => playSeasonStep() }]);
      }
    })));
  }

  function resolveAcademyMatchResult(won) {
    const season = S.season;
    const matchInfo = season.schedule[season.currentRound];
    const opp = getTeamById(matchInfo.oppTeamId);
    
    // 1. A-team match simulation (played by first-team starter competitor)
    const competitorWon = rng.next() < (S.benchCompetitorOvr / 100);
    if (competitorWon) {
      season.standings[S.teamId].wins++;
      season.standings[opp.id].losses++;
      matchInfo.won = true;
    } else {
      season.standings[S.teamId].losses++;
      season.standings[opp.id].wins++;
      matchInfo.won = false;
    }
    matchInfo.isFinished = true;

    // Record Academy Match result to standings
    if (season.academyStandings) {
      if (won) {
        season.academyStandings[S.teamId].wins++;
        season.academyStandings[opp.id].losses++;
      } else {
        season.academyStandings[S.teamId].losses++;
        season.academyStandings[opp.id].wins++;
      }
    }

    // 2. Personal Academy match result
    const wasManual = S.currentSplitStats.matchesPlayed > season.currentRound;
    if (wasManual) {
      S.stats.matchesPlayed += 2;
      S.stats.matchesWon += won ? 1 : 1;
      S.currentSplitStats.matchesPlayed += 2;
      S.currentSplitStats.matchesWon += won ? 1 : 1;
      recordMatchStats(true, false);
      recordMatchStats(false, false);
    } else {
      S.stats.matchesPlayed += 3;
      S.stats.matchesWon += won ? 2 : 1;
      S.currentSplitStats.matchesPlayed += 3;
      S.currentSplitStats.matchesWon += won ? 2 : 1;
      if (won) {
        recordMatchStats(true, false);
        recordMatchStats(true, false);
        recordMatchStats(false, false);
      } else {
        recordMatchStats(true, false);
        recordMatchStats(false, false);
        recordMatchStats(false, false);
      }
    }

    if (won) {
      card('good', `第 ${season.currentRound + 1} 輪 二軍聯賽戰報`, `你在二軍聯賽大秀四方，率隊以 <b class="up">2:0 / 2:1 擊敗了 ${opp.shortName} Academy</b>！`);
    } else {
      card('bad', `第 ${season.currentRound + 1} 輪 二軍聯賽戰報`, `二軍隊伍配合欠佳，以 <b class="dn">1:2 憾負 ${opp.shortName} Academy</b>。`);
    }

    simulateOtherTeams(opp.id);
    season.currentRound++;
    choose('本輪結束', [{ t: '繼續推進賽程 ▸', main: true, f: () => playSeasonStep() }]);
  }

  function resolveProMatchResult(won) {
    const season = S.season;
    const matchInfo = season.schedule[season.currentRound];
    const opp = getTeamById(matchInfo.oppTeamId);
    
    const wasManual = S.currentSplitStats.matchesPlayed > season.currentRound;
    
    if (wasManual) {
      S.stats.matchesPlayed += 2;
      S.stats.matchesWon += won ? 1 : 1;
      S.currentSplitStats.matchesPlayed += 2;
      S.currentSplitStats.matchesWon += won ? 1 : 1;
      recordMatchStats(true, false);
      recordMatchStats(false, false);
    } else {
      S.stats.matchesPlayed += 3;
      S.stats.matchesWon += won ? 2 : 1;
      S.currentSplitStats.matchesPlayed += 3;
      S.currentSplitStats.matchesWon += won ? 2 : 1;
      if (won) {
        recordMatchStats(true, false);
        recordMatchStats(true, false);
        recordMatchStats(false, false);
      } else {
        recordMatchStats(true, false);
        recordMatchStats(false, false);
        recordMatchStats(false, false);
      }
    }
    
    if (won) {
      season.standings[S.teamId].wins++;
      season.standings[opp.id].losses++;
      matchInfo.won = true;
      card('good', `第 ${season.currentRound + 1} 輪 常規賽戰報`, `你成功率領隊伍以 <b class="up">2:0 橫掃 ${opp.name}</b>！`);
    } else {
      season.standings[S.teamId].losses++;
      season.standings[opp.id].wins++;
      matchInfo.won = false;
      card('bad', `第 ${season.currentRound + 1} 輪 常規賽戰報`, `隊伍配合出現失誤，以 <b class="dn">1:2 憾負 ${opp.name}</b>。`);
    }
    matchInfo.isFinished = true;

    // Simulate background Academy match
    if (season.academyStandings) {
      const wonAcademy = rng.next() < (55 / 95);
      if (wonAcademy) {
        season.academyStandings[S.teamId].wins++;
        season.academyStandings[opp.id].losses++;
      } else {
        season.academyStandings[S.teamId].losses++;
        season.academyStandings[opp.id].wins++;
      }
    }

    simulateOtherTeams(opp.id);
    season.currentRound++;
    choose('本輪結束', [{ t: '繼續推進賽程 ▸', main: true, f: () => playSeasonStep() }]);
  }

  function simulateOtherTeams(excludeOppId) {
    const regionTeams = TEAMS.filter(t => t.region === region && t.id !== S.teamId && t.id !== excludeOppId);
    
    // 1. Simulate A-team regular matches
    const shuffled = [...regionTeams].sort(() => rng.next() - 0.5);
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const t1 = shuffled[i];
        const t2 = shuffled[i+1];
        const p1 = t1.baseRating || 72;
        const p2 = t2.baseRating || 72;
        const winProb = p1 / (p1 + p2);
        if (rng.next() < winProb) { S.season.standings[t1.id].wins++; S.season.standings[t2.id].losses++; }
        else { S.season.standings[t2.id].wins++; S.season.standings[t1.id].losses++; }
      }
    }

    // 2. Simulate Academy matches in parallel
    if (S.season.academyStandings) {
      const shuffledAca = [...regionTeams].sort(() => rng.next() - 0.5);
      for (let i = 0; i < shuffledAca.length; i += 2) {
        if (i + 1 < shuffledAca.length) {
          const t1 = shuffledAca[i];
          const t2 = shuffledAca[i+1];
          const p1 = t1.baseRating || 72;
          const p2 = t2.baseRating || 72;
          const winProb = p1 / (p1 + p2);
          if (rng.next() < winProb) { S.season.academyStandings[t1.id].wins++; S.season.academyStandings[t2.id].losses++; }
          else { S.season.academyStandings[t2.id].wins++; S.season.academyStandings[t1.id].losses++; }
        }
      }
    }
  }

  function showStandingsCard() {
    const isAcademy = S.rosterStatus === 'ACADEMY';
    const targetStandings = (isAcademy && S.season.academyStandings) ? S.season.academyStandings : S.season.standings;
    const titleText = isAcademy ? '📊 二軍聯賽積分榜' : '📊 LCP 聯賽積分榜';

    const list = Object.keys(targetStandings).map(id => {
      const teamObj = getTeamById(id);
      const name = isAcademy 
        ? `${teamObj ? teamObj.shortName : id} Acad` 
        : `${teamObj ? teamObj.shortName : id}`;
      return {
        id,
        name,
        wins: targetStandings[id].wins,
        losses: targetStandings[id].losses
      };
    });
    list.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    let tableRows = list.map((t, idx) => {
      const isPlayer = t.id === S.teamId;
      return `<tr style="${isPlayer ? 'color:var(--accent); font-weight:bold;' : ''}"><td style="text-align:left;padding:6px 4px;border-bottom:1px solid var(--edge);">#${idx+1}</td><td style="text-align:left;padding:6px 4px;border-bottom:1px solid var(--edge);">${t.name}${isPlayer ? ' (YOU)' : ''}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--edge);">${t.wins}</td><td style="text-align:right;padding:6px 4px;border-bottom:1px solid var(--edge);">${t.losses}</td></tr>`;
    }).join('');
    card('info', titleText, `
      <table class="st" style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead><tr style="color:var(--dim);border-bottom:1px solid var(--edge);"><th style="text-align:left;padding:4px;">排名</th><th style="text-align:left;padding:4px;">戰隊</th><th style="text-align:right;padding:4px 8px;">勝</th><th style="text-align:right;padding:4px;">負</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    `);
  }

  function showPlayerCompetitorStats() {
    board(1);
    const competitorOvr = S.benchCompetitorOvr || 65;
    
    const wristWarn = S.wristHealth < 40 ? '⚠️ <b style="color:#ff4a4a;">健康度過低，極易爆發手腕傷病！</b>' : '🟢 正常';
    const fatigueWarn = S.fatigue > 85 ? '⚠️ <b style="color:#ff4a4a;">極度疲勞，將強制下放替補席！</b>' : (S.fatigue >= 50 ? '🟡 偏高 (重回先發需降至 50% 以下)' : '🟢 良好');
    const trustWarn = S.coachTrust < 30 ? '⚠️ <b style="color:#ff4a4a;">信任危機，將下放替補或二軍！</b>' : (S.coachTrust <= 50 ? '🟡 偏低' : '🟢 信任');
    const competitorDiff = ovr() - competitorOvr;
    const ovrStatus = competitorDiff >= 0 ? `🟢 超越一軍先發 (+${competitorDiff} OVR)` : `🔴 落後一軍先發 (${competitorDiff} OVR)`;

    let statusText = '';
    if (S.rosterStatus === 'STARTER') {
      statusText = '<span style="color:#00f2fe;font-weight:bold;">一軍先發 starter</span>';
    } else if (S.rosterStatus === 'SUB') {
      statusText = '<span style="color:#ff9f43;font-weight:bold;">一軍替補 sub</span>';
    } else if (S.rosterStatus === 'ACADEMY') {
      statusText = '<span style="color:#718096;font-weight:bold;">二軍青訓 academy</span>';
    }

    let seatTip = '';
    if (S.rosterStatus === 'STARTER') {
      seatTip = '若 OVR 落後先發對手 5 點以上，將被下放替補。';
    } else if (S.rosterStatus === 'SUB') {
      seatTip = `重回先發需要 OVR 近逼對手且疲勞值低於 50%。若落後對手 8 點以上將被下放二軍。`;
    } else if (S.rosterStatus === 'ACADEMY') {
      seatTip = '在二軍聯賽磨練，若 OVR 追平一軍先發或信任度高且接近先發實力，即可晉升一軍！';
    }

    card('gold', '📊 選手當前狀態與先發競爭報告', `
      <div style="font-size:12.5px; line-height:1.6; text-align:left;">
        <h4 style="margin:4px 0; color:var(--accent);">👑 席位競爭 (目前狀態：${statusText})</h4>
        • 我的綜合戰力 (OVR)：<b class="hl">${ovr()}</b><br>
        • 一軍先發對手戰力：<b class="hl">${competitorOvr}</b> OVR<br>
        • 實力對比：<b>${ovrStatus}</b><br>
        • 晉升與席位提示：<b style="color:var(--gold);">${seatTip}</b><br>
        <br>
        <h4 style="margin:4px 0; color:var(--accent);">🩺 生理健康數據</h4>
        • 手腕健康度：<b>${S.wristHealth}%</b> (${wristWarn})<br>
        • 身體疲勞值：<b>${S.fatigue}%</b> (${fatigueWarn})<br>
        <br>
        <h4 style="margin:4px 0; color:var(--accent);">🤝 團隊與教練關係</h4>
        • 教練信任度：<b>${S.coachTrust} / 100</b> (${trustWarn})<br>
      </div>
    `);
    
    choose('查看完畢', [
      {
        t: '◀ 返回賽程選項',
        main: true,
        f: () => { playSeasonStep(); }
      }
    ]);
  }

  function checkPlayoffsQualification() {
    const season = S.season;
    const isAcademy = S.rosterStatus === 'ACADEMY';
    const targetStandings = (isAcademy && S.season.academyStandings) ? S.season.academyStandings : S.season.standings;
    
    const list = Object.keys(targetStandings).map(id => ({
      id,
      wins: targetStandings[id].wins,
      losses: targetStandings[id].losses
    }));
    list.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const rank = list.findIndex(t => t.id === S.teamId) + 1;
    
    if (isAcademy) {
      card('info', '二軍聯賽例行賽結束', `二軍例行賽最終排名：第 <b class="hl">#${rank} 名</b> (${targetStandings[S.teamId].wins} 勝 ${targetStandings[S.teamId].losses} 敗)`);
      if (rank <= 4) {
        card('good', '🎉 二軍晉級季後賽！', '恭喜！二隊成功殺入二軍季後賽四強！我們將在二軍準決賽中迎戰強敵。');
        season.stage = 'PLAYOFFS_SEMI';
        choose('二軍例行賽結算', [{ t: '開啟二軍季後賽準決賽 BO5 ▸', main: true, f: () => playSeasonStep() }]);
      } else {
        card('bad', '❌ 二軍無緣季後賽', '遺憾！二隊未能進入二軍季後賽四強，二軍賽季到此結束。');
        season.stage = 'ELIMINATED';
        choose('二軍例行賽結算', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, false, onSplitDone) }]);
      }
    } else {
      card('info', '例行賽全部結束', `例行賽最終排名：第 <b class="hl">#${rank} 名</b> (${season.standings[S.teamId].wins} 勝 ${season.standings[S.teamId].losses} 敗)`);
      if (rank <= 4) {
        card('good', '🎉 晉級季後賽！', '恭喜隊伍成功殺入季後賽四強席位！我們將在準決賽中迎戰強敵。');
        season.stage = 'PLAYOFFS_SEMI';
        choose('例行賽結算', [{ t: '開啟季後賽準決賽 BO5 ▸', main: true, f: () => playSeasonStep() }]);
      } else {
        card('bad', '❌ 止步例行賽', '遺憾！隊伍因積分不足未能進入季後賽四強，無緣本次季後賽與世界大賽舞台。');
        season.stage = 'ELIMINATED';
        choose('例行賽結算', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, false, onSplitDone) }]);
      }
    }
  }

  function getPlayoffsOpponent(round) {
    const season = S.season;
    const list = Object.keys(season.standings).map(id => ({ id, wins: season.standings[id].wins, losses: season.standings[id].losses }));
    list.sort((a, b) => b.wins - a.wins || a.losses - b.losses);
    const playerRank = list.findIndex(t => t.id === S.teamId) + 1;
    if (round === 'SEMI') {
      let oppRank = 4;
      if (playerRank === 4) oppRank = 1; else if (playerRank === 2) oppRank = 3; else if (playerRank === 3) oppRank = 2;
      return getTeamById(list[oppRank - 1].id);
    } else if (round === 'FINAL') {
      return getTeamById(list.find(t => t.id !== S.teamId).id);
    }
    return null;
  }

  function resolvePlayoffsSemi(won, wasManual) {
    const season = S.season;
    const isStarterOrAcademy = S.rosterStatus === 'STARTER' || S.rosterStatus === 'ACADEMY';
    const isAcademy = S.rosterStatus === 'ACADEMY';
    
    if (isStarterOrAcademy) {
      if (wasManual) {
        S.stats.matchesPlayed += 4;
        S.stats.matchesWon += won ? 2 : 2;
        S.currentSplitStats.matchesPlayed += 4;
        S.currentSplitStats.matchesWon += won ? 2 : 2;
        recordMatchStats(true, false);
        recordMatchStats(true, false);
        recordMatchStats(false, false);
        recordMatchStats(false, false);
      } else {
        S.stats.matchesPlayed += 5;
        S.stats.matchesWon += won ? 3 : 2;
        S.currentSplitStats.matchesPlayed += 5;
        S.currentSplitStats.matchesWon += won ? 3 : 2;
        if (won) {
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        } else {
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        }
      }
    }
    
    if (won) {
      if (isAcademy) {
        card('gold', '🏆 二軍挺進總決賽！', '二隊在二軍準決賽 BO5 大獲全勝！成功擊敗對手，晉級二軍總決賽！');
        season.stage = 'PLAYOFFS_FINAL';
        choose('準決賽結束', [{ t: '進入二軍總決賽 ▸', main: true, f: () => playSeasonStep() }]);
      } else {
        card('gold', '🏆 挺進總決賽！', '隊伍在準決賽 BO5 大獲全勝！成功擊敗對手，晉級 LCP 總決賽，我們距離冠軍只差一步之遙！');
        season.stage = 'PLAYOFFS_FINAL';
        choose('準決賽結束', [{ t: '進入 LCP 總決賽 ▸', main: true, f: () => playSeasonStep() }]);
      }
    } else {
      if (isAcademy) {
        card('bad', '二軍季後賽準決賽出局', '在準決賽鏖戰五局惜敗，獲得二軍季軍。');
      } else {
        card('bad', '季後賽準決賽出局', '在準決賽鏖戰五局惜敗，獲得本季季軍。');
      }
      season.stage = 'PLAYOFFS_LOST';
      choose('準決賽結束', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, false, onSplitDone) }]);
    }
  }

  function resolvePlayoffsFinal(won, wasManual) {
    const season = S.season;
    const isStarterOrAcademy = S.rosterStatus === 'STARTER' || S.rosterStatus === 'ACADEMY';
    const isAcademy = S.rosterStatus === 'ACADEMY';
    const isStarter = S.rosterStatus === 'STARTER';
    
    if (isStarterOrAcademy) {
      if (wasManual) {
        S.stats.matchesPlayed += 4;
        S.stats.matchesWon += won ? 2 : 2;
        S.currentSplitStats.matchesPlayed += 4;
        S.currentSplitStats.matchesWon += won ? 2 : 2;
        recordMatchStats(true, false);
        recordMatchStats(true, false);
        recordMatchStats(false, false);
        recordMatchStats(false, false);
      } else {
        S.stats.matchesPlayed += 5;
        S.stats.matchesWon += won ? 3 : 2;
        S.currentSplitStats.matchesPlayed += 5;
        S.currentSplitStats.matchesWon += won ? 3 : 2;
        if (won) {
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        } else {
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        }
      }
    }
    
    if (won) {
      S.stats.titlesWon += 1;
      if (isAcademy) {
        S.popularity += 15;
        card('gold', '🏆 榮獲二軍聯賽總冠軍！', '你率領二隊在總決賽打滿五局捧起二軍聯賽總冠軍銀盃！展現出卓越實力！');
        choose('決賽結束', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, true, onSplitDone) }]);
      } else {
        if (isStarter) {
          S.popularity += 25;
          card('gold', `🏆 榮獲 ${splitInfo.name} 賽區總冠軍！`, '你在總決賽決勝局上演天秀繞後秒殺雙C！帶領全隊捧起冠軍銀盃，榮膺季後賽 MVP (FMVP)！');
        } else {
          S.popularity += 10;
          card('gold', `🏆 榮獲 ${splitInfo.name} 賽區總冠軍！`, '你在替補席興奮地衝上舞台，見證隊友捧起冠軍銀盃！作為戰隊的一份子，你與大家共同分享奪冠的喜悅！');
        }
        if (splitInfo.qualifiesFor) {
          season.stage = 'INTERNATIONAL';
          choose('決賽結束', [{ t: `進軍 ${INTERNATIONAL_TOURNAMENTS[splitInfo.qualifiesFor].name} 國際賽 ▸`, main: true, f: () => playSeasonStep() }]);
        } else { choose('決賽結束', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, true, onSplitDone) }]); }
      }
    } else {
      if (isAcademy) {
        S.popularity += 5;
        card('good', '榮獲二軍總決賽亞軍！', '二隊在總決賽打滿五局惜敗，榮獲二軍亞軍席位。');
        choose('決賽結束', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, false, onSplitDone) }]);
      } else {
        if (isStarter) {
          S.popularity += 10;
          card('good', '榮獲 LCP 總決賽亞軍！', '在總決賽打滿五局憾負，獲得賽區亞軍席位。');
        } else {
          S.popularity += 5;
          card('good', '榮獲 LCP 總決賽亞軍！', '隊伍在總決賽鏖戰五局遺憾落敗，榮獲賽區亞軍。你在替補席安慰著失落的隊友。');
        }
        const qualifiesFor = splitInfo.qualifiesFor;
        const runnerUpQualifies = (qualifiesFor === 'MSI' || qualifiesFor === 'WORLDS');
        if (qualifiesFor && runnerUpQualifies) {
          season.stage = 'INTERNATIONAL';
          choose('決賽結束', [{ t: `以亞軍身分出征 ${INTERNATIONAL_TOURNAMENTS[qualifiesFor].name} ▸`, main: true, f: () => playSeasonStep() }]);
        } else { choose('決賽結束', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, false, onSplitDone) }]); }
      }
    }
  }

  function resolveInternationalMatch(won, tourneyInfo, wasManual) {
    const isStarter = S.rosterStatus === 'STARTER';
    
    if (isStarter) {
      if (wasManual) {
        S.stats.matchesPlayed += 4;
        S.stats.matchesWon += won ? 2 : 2;
        S.currentSplitStats.matchesPlayed += 4;
        S.currentSplitStats.matchesWon += won ? 2 : 2;
        recordMatchStats(true, false);
        recordMatchStats(true, false);
        recordMatchStats(false, false);
        recordMatchStats(false, false);
      } else {
        S.stats.matchesPlayed += 5;
        S.stats.matchesWon += won ? 3 : 2;
        S.currentSplitStats.matchesPlayed += 5;
        S.currentSplitStats.matchesWon += won ? 3 : 2;
        if (won) {
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        } else {
          recordMatchStats(true, false);
          recordMatchStats(true, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
          recordMatchStats(false, false);
        }
      }
    }
    
    if (won) {
      S.stats.intlTitles += 1;
      if (tourneyInfo.id === 'WORLDS') {
        S.stats.worldsTitles += 1;
        if (isStarter) {
          S.popularity += 50;
          card('gold', `🏆【世界之巔】${tourneyInfo.name} 總冠軍 & FMVP！`, '在全球數千萬玩家矚目下，你在總決賽世界之巔力挽狂瀾！率隊奪下召喚師水晶杯，榮膺世界總決賽 FMVP！名留青史！');
          unlockTrait('BIG_STAGE_HERO');
        } else {
          S.popularity += 15;
          card('gold', `🏆【世界之巔】${tourneyInfo.name} 總冠軍！`, '在全球數千萬玩家矚目下，隊伍力克強敵奪下召喚師水晶杯！你在替補席與隊友一同慶祝，登頂世界之巔！');
        }
      } else {
        if (isStarter) {
          S.popularity += 30;
          card('gold', `🏆 榮獲 ${tourneyInfo.name} 國際賽總冠軍！`, `擊敗世界頂級賽區各路豪強，你率隊登頂 ${tourneyInfo.name} 冠軍寶座！`);
        } else {
          S.popularity += 10;
          card('gold', `🏆 榮獲 ${tourneyInfo.name} 國際賽總冠軍！`, `擊敗世界頂級賽區各路豪強，隊伍成功登頂 ${tourneyInfo.name} 冠軍寶座！你在替補席分享了隊伍的最高榮譽！`);
        }
      }
      choose('世界賽結束', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, true, onSplitDone) }]);
    } else {
      if (isStarter) {
        card('info', `世界賽出局`, `在 ${tourneyInfo.name} 淘汰賽階段拼盡全力，遺憾止步四強。`);
      } else {
        card('info', `世界賽出局`, `隊伍在 ${tourneyInfo.name} 淘汰賽階段遺憾止步四強，無緣總決賽。`);
      }
      choose('世界賽結束', [{ t: '繼續推進 ▸', main: true, f: () => proceedToSplitSettlement(splitKey, splitInfo, false, onSplitDone) }]);
    }
  }

  function proceedToSplitSettlement(splitKey, splitInfo, wonChamp, onSplitDone) {
    S.seasonSimMode = 'MANUAL'; // Reset simulation preference to manual at the end of the split
    S.fatigue = Math.min(100, S.fatigue + 15);
    S.stress = Math.max(0, S.stress - 10);
    
    // Display Split stats card
    showSplitStatsCard(splitInfo.name);
    
    // Save current split stats to splitHistory
    S.splitHistory = S.splitHistory || [];
    S.splitHistory.push({
      year: S.year,
      splitKey: splitKey,
      splitName: splitInfo.name,
      ...S.currentSplitStats
    });
    
    if (wonChamp) tlPush(`${splitInfo.shortName} 冠軍 🏆`);
    else if (S.season.stage === 'PLAYOFFS_FINAL') tlPush(`${splitInfo.shortName} 亞軍`);
    else tlPush(`${splitInfo.shortName} 完畢`);

    processSplitSettlementEvaluation(splitKey, splitInfo, wonChamp, () => {
      choose(`${splitInfo.name} 完畢`, [{ t: '繼續推進賽程 ▸', main: true, f: onSplitDone }]);
    });
  }

  function showSplitStatsCard(splitName) {
    const st = S.currentSplitStats;
    if (!st) return;
    const winRate = st.matchesPlayed > 0 ? ((st.matchesWon / st.matchesPlayed) * 100).toFixed(0) : 0;
    const kda = st.deaths > 0 ? ((st.kills + st.assists) / st.deaths).toFixed(2) : (st.kills + st.assists).toFixed(2);
    
    const avgK = st.matchesPlayed > 0 ? (st.kills / st.matchesPlayed).toFixed(1) : '0.0';
    const avgD = st.matchesPlayed > 0 ? (st.deaths / st.matchesPlayed).toFixed(1) : '0.0';
    const avgA = st.matchesPlayed > 0 ? (st.assists / st.matchesPlayed).toFixed(1) : '0.0';

    if (st.matchesPlayed === 0) {
      card('gold', `📊 ${splitName} 個人數據結算`, `
        <b>選手狀態</b>：本賽季作為替補未上場出賽<br>
        <b>系列賽戰績</b>：無出賽數據
      `);
      return;
    }

    card('gold', `📊 ${splitName} 個人數據結算`, `
      <b>個人出賽局數</b>：${st.matchesPlayed} 局<br>
      <b>個人單局戰績</b>：${st.matchesWon} 勝 / ${st.matchesPlayed - st.matchesWon} 敗 (勝率 ${winRate}%)<br>
      <b>個人總 KDA數據</b>：${st.kills} 殺 / ${st.deaths} 死 / ${st.assists} 助攻 (KDA: <b class="hl">${kda}</b>)<br>
      <b>個人每場平均數據</b>：場均 <b class="hl">${avgK}</b> 殺 / <b class="hl">${avgD}</b> 死 / <b class="hl">${avgA}</b> 助攻<br>
      <b>單場 MVP (POG) 次數</b>：<b class="hl">${st.pogCount} 次</b>
    `);
  }

  playSeasonStep();
}

// ==================== 季末屬性扣減與點數加點面板 ====================
function processSplitSettlementEvaluation(splitKey, splitInfo, wonChamp, onDone) {
  const st = S.currentSplitStats;
  if (!st) {
    onDone();
    return;
  }
  
  if (st.matchesPlayed === 0) {
    card('good', '✨ 替補備戰', '本賽季你作為替補並未上場參賽，未產生賽場個人數據，基礎屬性保持穩定。');
    const pointsAwarded = 3; // subs get a baseline of 3 points since they didn't play
    const awardReasons = ['• 賽季替補備戰自主加練獎勵：+3 點'];
    
    card('gold', `🎯 賽季結算天賦點數獎勵 (共 +${pointsAwarded} 點)`, `
      恭喜！因你本賽季在替補席配合團隊加練，你獲得了 <b>${pointsAwarded}</b> 點自由分配屬性點數：<br><br>
      ${awardReasons.join('<br>')}
    `);
    
    choose('開始分配點數', [
      {
        t: '進入屬性分配面板 ▸',
        main: true,
        f: () => allocateSplitPoints(pointsAwarded, onDone)
      }
    ]);
    return;
  }
  
  let winRate = st.matchesPlayed > 0 ? (st.matchesWon / st.matchesPlayed) : 0;
  let kda = st.deaths > 0 ? ((st.kills + st.assists) / st.deaths) : (st.kills + st.assists);
  let avgDeaths = st.matchesPlayed > 0 ? (st.deaths / st.matchesPlayed) : 0;
  let avgAssists = st.matchesPlayed > 0 ? (st.assists / st.matchesPlayed) : 0;

  let penaltyTexts = [];
  
  // 1. Line phase penalty (High deaths)
  if (avgDeaths > 4.2) {
    const penalty = rng.range(2, 4);
    S.ab.mechanics = Math.max(20, S.ab.mechanics - penalty);
    penaltyTexts.push(`⚠️ <b>對線失衡</b>：本賽季你平均每場陣亡達 ${avgDeaths.toFixed(1)} 次，對線頻繁爆線被單殺，<b>操作扣減 ${penalty} 點</b>！`);
  }
  
  // 2. Mental/Stress penalty (Low winrate)
  if (winRate < 0.42) {
    const penalty = rng.range(3, 5);
    S.ab.mental = Math.max(20, S.ab.mental - penalty);
    penaltyTexts.push(`⚠️ <b>心態炸裂</b>：個人出賽勝率低迷 (勝率 ${(winRate*100).toFixed(0)}%)，連敗導致你心理防線崩潰，<b>心態扣減 ${penalty} 點</b>！`);
  }
  
  // 3. Team cohesion/Macro penalty (Low assists or offmeta)
  if (avgAssists < 4.0 || (S.tactics && S.tactics.banPickPreference === 'OFFMETA')) {
    const penalty = rng.range(2, 4);
    S.ab.macro = Math.max(20, S.ab.macro - penalty);
    S.ab.communication = Math.max(20, S.ab.communication - penalty);
    penaltyTexts.push(`⚠️ <b>團隊脫節</b>：本賽季平均助攻偏低 (${avgAssists.toFixed(1)} 次) 或常規賽頻繁使用黑科技，團隊配合生疏，<b>觀念與溝通各扣減 ${penalty} 點</b>！`);
  }
  
  if (penaltyTexts.length > 0) {
    card('bad', '📉 賽季表現不佳：能力值懲罰扣減', penaltyTexts.join('<br><br>'));
  } else {
    card('good', '✨ 穩定發揮', '本賽季你在各項賽事中表現良好，基礎屬性保持穩定，沒有受到懲罰扣減！');
  }

  // Calculate point awards
  let pointsAwarded = 5; // baseline
  let awardReasons = ['• 賽季參賽基礎獎勵：+5 點'];
  
  if (st.pogCount > 0) {
    const pogPts = st.pogCount * 2;
    pointsAwarded += pogPts;
    awardReasons.push(`• 獲得單場 MVP (POG) 共 ${st.pogCount} 次：+${pogPts} 點`);
  }
  
  if (kda >= 4.0) {
    pointsAwarded += 5;
    awardReasons.push(`• 賽季頂尖 KDA (${kda.toFixed(2)})：+5 點`);
  } else if (kda >= 3.0) {
    pointsAwarded += 3;
    awardReasons.push(`• 賽季優秀 KDA (${kda.toFixed(2)})：+3 點`);
  }
  
  if (wonChamp) {
    pointsAwarded += 15;
    awardReasons.push('• 捧起賽區總冠軍銀盃：+15 點');
  } else if (S.season.stage === 'PLAYOFFS_FINAL') {
    pointsAwarded += 8;
    awardReasons.push('• 獲得賽區亞軍席位：+8 點');
  }
  
  card('gold', `🎯 賽季結算天賦點數獎勵 (共 +${pointsAwarded} 點)`, `
    恭喜！根據本賽季的賽場評價與亮眼成就，你獲得了 <b>${pointsAwarded}</b> 點自由分配屬性點數：<br><br>
    ${awardReasons.join('<br>')}
  `);
  
  choose('開始分配點數', [
    {
      t: '進入屬性分配面板 ▸',
      main: true,
      f: () => allocateSplitPoints(pointsAwarded, onDone)
    }
  ]);
}

function allocateSplitPoints(pointsEarned, onDone) {
  if (pointsEarned <= 0) {
    onDone();
    return;
  }

  const act = $('act');
  act.style.display = 'block';

  // Store original state to allow reset/undo
  const origAb = { ...S.ab };
  const origCarry = JSON.parse(JSON.stringify(S.carry || {}));
  const origWrist = S.wristHealth;
  const totalPoints = pointsEarned;
  
  let currentPoints = pointsEarned;
  const hist = []; // [{ ab, carry, wristHealth, currentPoints }]

  function renderAlloc() {
    board(1);
    act.innerHTML = `
      <div class="title">🎯 季末天賦加點 (可用點數: ${currentPoints})</div>
      <div id="dice" style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; justify-content:center;">
        ${Array.from({ length: totalPoints }).map((_, i) => `
          <div class="die ${i < (totalPoints - currentPoints) ? 'used' : ''} ${i === (totalPoints - currentPoints) ? 'active' : ''}" style="width:24px; height:24px; line-height:24px; font-size:12px; font-weight:bold; margin:2px;">1</div>
        `).join('')}
      </div>
      <div class="pool">
        ${currentPoints > 0 
          ? `當前點數：<b class="hl">1 點</b>（點擊下方能力直接加點，剩餘 ${currentPoints} 點）` 
          : `<b class="hl">所有點數已分配完畢！</b>`}
      </div>
      <div id="alloc-rows">
        ${Object.keys(ABL).map(k => {
          const cur = S.ab[k];
          const pot = S.pot[k] || 75;
          const pct = Math.min(100, Math.round((cur / 99) * 100));
          const potPct = Math.min(100, Math.round((pot / 99) * 100));
          const cost = abCost(k);
          const cr = (S.carry && S.carry[k]) || 0;
          const cap = cur >= 99;
          return `
            <div class="abrow${cap ? ' capped' : ''}" data-key="${k}">
              <div class="nm">${ABL[k]}</div>
              <div class="bar">
                <i style="width:${pct}%;"></i>
                <em style="left:${potPct}%;"></em>
              </div>
              <div class="val">
                ${cur}<small style="opacity:0.5;">/${pot}</small>
                ${cost > 1 ? `<span style="display:block;opacity:0.5;font-size:10.5px;margin-top:-2px;">${cr}/${cost}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
        
        <!-- Wrist health row -->
        <div class="abrow${S.wristHealth >= 100 ? ' capped' : ''}" data-key="wrist">
          <div class="nm">手腕健康</div>
          <div class="bar">
            <i style="width:${S.wristHealth}%; background:#2ecc71;"></i>
            <em style="left:100%;"></em>
          </div>
          <div class="val">
            ${S.wristHealth}%<small style="opacity:0.5;">/100</small>
          </div>
        </div>
      </div>
      <div class="row2" style="margin-top:10px; display:flex; gap:10px;">
        <button class="btn warn" id="btn-reset-alloc" style="text-align:center; flex:1; ${currentPoints === totalPoints ? 'opacity:0.4; cursor:default;' : ''}" ${currentPoints === totalPoints ? 'disabled' : ''}>
          🔄 重置分配 (退回點數)
        </button>
        <button class="btn" id="btn-undo-alloc" style="text-align:center; flex:1; ${hist.length === 0 ? 'opacity:0.4; cursor:default;' : ''}" ${hist.length === 0 ? 'disabled' : ''}>
          ↩ 退回上一步
        </button>
      </div>
      <div class="row2" style="margin-top:10px;">
        ${currentPoints === 0 ? `
          <button class="btn main" id="btn-finish-alloc" style="text-align:center; width:100%;">
            確定完成分配 ▸ 繼續
          </button>
        ` : `
          <button class="btn" style="text-align:center; width:100%; opacity:0.4; cursor:default;" disabled>
            請先分配完剩餘的 ${currentPoints} 點數
          </button>
        `}
      </div>
    `;

    // Click on attribute row to add 1 point
    act.querySelectorAll('.abrow').forEach(row => {
      row.onclick = () => {
        if (currentPoints <= 0) return;
        const k = row.getAttribute('data-key');
        
        if (k === 'wrist') {
          if (S.wristHealth >= 100) return;
          
          hist.push({
            ab: JSON.parse(JSON.stringify(S.ab)),
            carry: JSON.parse(JSON.stringify(S.carry || {})),
            wristHealth: S.wristHealth,
            currentPoints: currentPoints
          });
          
          S.wristHealth = Math.min(100, S.wristHealth + 3);
          currentPoints--;
        } else {
          if (S.ab[k] >= 99) return;
          
          hist.push({
            ab: JSON.parse(JSON.stringify(S.ab)),
            carry: JSON.parse(JSON.stringify(S.carry || {})),
            wristHealth: S.wristHealth,
            currentPoints: currentPoints
          });
          
          addAb(k, 1);
          currentPoints--;
        }
        
        board(1);
        renderAlloc();
      };
    });

    // Reset button
    const btnReset = $('btn-reset-alloc');
    if (btnReset && currentPoints !== totalPoints) {
      btnReset.onclick = () => {
        Object.keys(origAb).forEach(k => {
          S.ab[k] = origAb[k];
        });
        S.carry = JSON.parse(JSON.stringify(origCarry));
        S.wristHealth = origWrist;
        currentPoints = totalPoints;
        hist.length = 0; // clear history
        board(1);
        renderAlloc();
      };
    }

    // Undo button
    const btnUndo = $('btn-undo-alloc');
    if (btnUndo && hist.length > 0) {
      btnUndo.onclick = () => {
        const last = hist.pop();
        S.ab = last.ab;
        S.carry = last.carry;
        S.wristHealth = last.wristHealth;
        currentPoints = last.currentPoints;
        board(1);
        renderAlloc();
      };
    }

    // Finish button
    const btnFinish = $('btn-finish-alloc');
    if (btnFinish) {
      btnFinish.onclick = () => {
        act.style.display = 'none';
        onDone();
      };
    }
  }

  renderAlloc();
}

// 4. 轉會市場與 LCK/LPL 旅外
function phaseYearEndTransfer() {
  board(2);
  divider(`${S.year} · 年度轉會市場窗口`);

  // Render Year-End Statistics Report
  const yearSplits = (S.splitHistory || []).filter(h => h.year === S.year);
  if (yearSplits.length > 0) {
    let splitsHtml = yearSplits.map(st => {
      if (st.matchesPlayed === 0) {
        return `
          <div style="margin-bottom:8px; padding:6px; background:rgba(255,255,255,0.05); border:1px solid var(--edge); border-radius:4px;">
            <strong>${st.splitName}</strong>：本賽季作為替補未上場出賽
          </div>
        `;
      }
      const winRate = st.matchesPlayed > 0 ? ((st.matchesWon / st.matchesPlayed) * 100).toFixed(0) : 0;
      const kda = st.deaths > 0 ? ((st.kills + st.assists) / st.deaths).toFixed(2) : (st.kills + st.assists).toFixed(2);
      const avgK = (st.kills / st.matchesPlayed).toFixed(1);
      const avgD = (st.deaths / st.matchesPlayed).toFixed(1);
      const avgA = (st.assists / st.matchesPlayed).toFixed(1);
      return `
        <div style="margin-bottom:8px; padding:6px; background:rgba(255,255,255,0.05); border:1px solid var(--edge); border-radius:4px;">
          <strong>${st.splitName}</strong>：出賽 ${st.matchesPlayed} 局 (${st.matchesWon} 勝 / ${st.matchesPlayed - st.matchesWon} 敗，勝率 ${winRate}%)<br>
          KDA: <b class="hl">${kda}</b> (場均: ${avgK} / ${avgD} / ${avgA}) | POG MVP: <b class="hl">${st.pogCount} 次</b>
        </div>
      `;
    }).join('');
    
    let yrPlayed = 0, yrWon = 0, yrK = 0, yrD = 0, yrA = 0, yrPog = 0;
    yearSplits.forEach(st => {
      yrPlayed += st.matchesPlayed;
      yrWon += st.matchesWon;
      yrK += st.kills;
      yrD += st.deaths;
      yrA += st.assists;
      yrPog += st.pogCount;
    });
    
    const yrWinRate = yrPlayed > 0 ? ((yrWon / yrPlayed) * 100).toFixed(0) : 0;
    const yrKda = yrD > 0 ? ((yrK + yrA) / yrD).toFixed(2) : (yrK + yrA).toFixed(2);
    const yrAvgK = yrPlayed > 0 ? (yrK / yrPlayed).toFixed(1) : '0.0';
    const yrAvgD = yrPlayed > 0 ? (yrD / yrPlayed).toFixed(1) : '0.0';
    const yrAvgA = yrPlayed > 0 ? (yrA / yrPlayed).toFixed(1) : '0.0';
    
    card('gold', `🏆 ${S.year} 年度生涯總結算報告`, `
      <div style="font-size:12.5px; line-height: 1.5;">
        <span style="color:var(--accent); font-weight:bold;">各賽季明細：</span>
        ${splitsHtml}
        <hr style="border:0; border-top:1px solid var(--edge); margin:8px 0;">
        <span style="color:var(--gold); font-weight:bold;">📈 ${S.year} 全年度總計：</span><br>
        • 總出賽局數：<b class="hl">${yrPlayed} 局</b> (戰績 ${yrWon} 勝 / ${yrPlayed - yrWon} 敗，勝率 ${yrWinRate}%)<br>
        • 總 KDA：${yrK} / ${yrD} / ${yrA} (KDA: <b class="hl">${yrKda}</b>)<br>
        • 生涯場均數據：場均 <b class="hl">${yrAvgK}</b> 殺 / <b class="hl">${yrAvgD}</b> 死 / <b class="hl">${yrAvgA}</b> 助攻<br>
        • 全年 MVP (POG) 次數：<b class="hl">${yrPog} 次</b>
      </div>
    `);
  }

  const pOvr = ovr();
  const offers = [];

  // 1. 原隊續約
  offers.push({
    teamName: S.team,
    teamId: S.teamId,
    salary: Math.round(S.salary * rng.range(105, 125) / 100),
    desc: '原戰隊核心頂薪續約',
    competitorOvr: S.benchCompetitorOvr || 65
  });

  // 2. 獲取所有專業隊伍 (排除原戰隊和業餘隊)
  const proTeams = TEAMS.filter(t => t.id !== S.teamId && t.region !== 'AMATEUR_TW');

  // 分流篩選適合的戰隊
  const lcpCandidates = [];
  const lckLplCandidates = [];

  proTeams.forEach(t => {
    // 基礎年薪算法：依照主角 OVR 以及戰隊強度加權
    const baseVal = Math.max(50, pOvr);
    let baseSalary = Math.round(Math.pow(baseVal / 50, 4.2) * 250000);
    
    // 依照戰隊強度微調薪資
    baseSalary = Math.round(baseSalary * (t.baseRating / 72));
    
    let salary = Math.round(baseSalary * rng.range(85, 115) / 100);
    const competitorOvr = rng.range(t.baseRating - 3, t.baseRating + 2);

    if (t.region === 'LCP') {
      // 只要 OVR 達到 50 以上，LCP 戰隊就可能拋出橄欖枝
      if (pOvr >= 50) {
        lcpCandidates.push({
          teamName: t.name,
          teamId: t.id,
          salary: salary,
          desc: `LCP 聯賽合約`,
          competitorOvr: competitorOvr
        });
      }
    } else if (t.region === 'LCK' || t.region === 'LPL') {
      // 旅外豪門：需要 OVR 70 以上，或得過世界冠軍
      if (pOvr >= 70 || S.stats.worldsTitles >= 1) {
        lckLplCandidates.push({
          teamName: `${t.region === 'LCK' ? '南韓 LCK' : '中國 LPL'} · ${t.name}`,
          teamId: t.id,
          salary: Math.round(salary * 2.2), // 旅外薪水翻倍！
          desc: `${t.region} 頂級旅外挑戰`,
          competitorOvr: competitorOvr
        });
      }
    }
  });

  // 從 LCP 候選中隨機挑選 3 個 (如果大於 3 個的話)
  const shuffledLcp = [...lcpCandidates].sort(() => rng.next() - 0.5);
  shuffledLcp.slice(0, 3).forEach(o => offers.push(o));

  // 從 LCK/LPL 候選中隨機挑選 2 個
  const shuffledForeign = [...lckLplCandidates].sort(() => rng.next() - 0.5);
  shuffledForeign.slice(0, 2).forEach(o => offers.push(o));

  // 如果 LCP 候選極少，保證至少隨機生成 2 家 LCP 合約
  if (offers.length < 3) {
    const backupTeams = TEAMS.filter(t => t.region === 'LCP' && t.id !== S.teamId).slice(0, 2);
    backupTeams.forEach(t => {
      const competitorOvr = rng.range(t.baseRating - 3, t.baseRating + 2);
      offers.push({
        teamName: t.name,
        teamId: t.id,
        salary: Math.round(Math.pow(Math.max(50, pOvr)/50, 4) * 200000 * (t.baseRating/72)),
        desc: 'LCP 聯賽培訓合約',
        competitorOvr: competitorOvr
      });
    });
  }

  card('info', '轉會期報價', `經紀人為你帶來了本年度各俱樂部的報價清單。`);

  const optList = offers.map(o => {
    const myOvr = ovr();
    const canBeStarter = myOvr >= o.competitorOvr;
    const statusTxt = canBeStarter ? '🟢 預計先發' : `🔴 預計二軍 (需追趕 ${o.competitorOvr - myOvr} OVR)`;

    return {
      t: `✍️ 簽約 ${o.teamName}`,
      main: true,
      s: `${o.desc} · 年薪 $${o.salary.toLocaleString()} 元<br><small style="color:var(--dim);">競爭對手 OVR: <b>${o.competitorOvr}</b> | ${statusTxt}</small>`,
      f: () => {
        S.team = o.teamName;
        S.teamId = o.teamId;
        S.salary = o.salary;
        S.money += Math.round(o.salary * 0.4);
        S.benchCompetitorOvr = o.competitorOvr;
        S.coachTrust = 60; // reset coach trust when joining new team
        S.rosterStatus = canBeStarter ? 'STARTER' : 'ACADEMY';
        card('gold', '轉會簽約確立', `你正式加盟 <b class="hl">${o.teamName}</b>！職位：${canBeStarter ? '<b class="hl">一軍先發選手</b>' : '<b class="warn">二軍培訓選手</b>'}`);
        tlPush(`加盟 ${o.teamName}`);

        choose('年度結算', [
          { t: '繼續下一年征程 ▸', main: true, f: () => startNextProYear() },
          { t: '宣布功成名就，光榮引退 🏆', warn: true, f: () => triggerRetirement() }
        ]);
      }
    };
  });

  if (S.age >= 20) {
    optList.push({
      t: '選擇在此時退役',
      warn: true,
      s: '結束職業電競選手生涯，結算名人堂歷史定位與下載結算圖',
      f: () => triggerRetirement()
    });
  }

  choose('請選擇你的轉會去向：', optList);
}

// ==================== 5. 傳奇退役典禮與 Canvas 圖片下載 ====================
function triggerRetirement() {
  S.done = true;
  divider(`${S.year} · 傳奇退役典禮 (Hall of Fame)`);
  board(2);

  const summary = RetirementManager.generateCareerSummary({
    name: S.name,
    inGameId: S.inGameId,
    role: S.pos,
    age: S.age,
    stats: S.ab,
    popularity: S.popularity,
    money: S.money,
    salary: S.salary,
    careerStats: S.stats,
    traits: Object.keys(S.traits).filter(k => S.traits[k]),
    team: S.team,
    seed: SEED,
    getOverallRating: () => ovr()
  });

  // 繪製 Canvas 結算圖
  const canvas = RetirementManager.renderCareerCardCanvas(summary);
  const dataUrl = canvas.toDataURL('image/png');

  card('gold', '🏆 名人堂生涯總結算', `
    <div style="font-size:26px;text-align:center;margin:10px 0;">${summary.tier.badge} <b style="color:var(--gold);">${summary.tier.name}</b></div>
    <div style="text-align:center;font-size:14px;color:var(--dim);margin-bottom:12px;">生涯傳奇總積分：<b style="color:var(--accent);font-size:18px;">${summary.score} 分</b></div>
    <table class="fin">
      <tr><th>項目</th><th>紀錄</th><th>項目</th><th>紀錄</th></tr>
      <tr><td>出賽場次</td><td>${summary.matchesPlayed} 場</td><td>生涯勝率</td><td>${summary.winRate}%</td></tr>
      <tr><td>賽區冠軍</td><td>${summary.titlesWon} 座</td><td>國際賽冠軍</td><td>${summary.intlTitles} 座</td></tr>
      <tr><td>世界冠軍</td><td>🏆 ${summary.worldsTitles} 座</td><td>總獎金身價</td><td>$${summary.totalMoney.toLocaleString()} 元</td></tr>
    </table>
    <div style="margin-top:14px;text-align:center;">
      <img src="${dataUrl}" style="max-width:100%;border-radius:var(--r);border:1px solid var(--edge);box-shadow:0 8px 24px rgba(0,0,0,0.5);" alt="LoLLife 生涯結算卡">
    </div>
  `);

  choose('生涯已畫下句點', [
    {
      t: '📥 下載生涯傳奇圖片 (PNG)',
      main: true,
      s: '下載高清結算卡片圖片至本機',
      f: () => {
        RetirementManager.downloadCanvas(canvas, `LoLLife_${S.inGameId}_Career.png`);
        triggerRetirementEndMenu(summary, canvas);
      }
    },
    {
      t: '📋 複製生涯文字總結',
      s: '複製文字紀錄至剪貼簿',
      f: () => {
        const text = `🏆 【LoLLife 選手生涯評價】\n選手：${S.inGameId} (${S.name}) · ${POS_NAMES[S.pos]}\n歷史定位：${summary.tier.badge} ${summary.tier.name} (傳奇分: ${summary.score})\n生涯戰績：${summary.matchesPlayed} 場 (勝率 ${summary.winRate}%)\n冠軍榮譽：賽區冠軍 ${summary.titlesWon} 座 | 國際賽 ${summary.intlTitles} 座 | 世界大賽 ${summary.worldsTitles} 座\n種子碼：${SEED}`;
        navigator.clipboard.writeText(text);
        alert('生涯傳奇文字已複製至剪貼簿！');
        triggerRetirementEndMenu(summary, canvas);
      }
    },
    {
      t: '🔄 開啟全新選手人生',
      f: () => { location.href = location.pathname; }
    }
  ]);
}

function triggerRetirementEndMenu(summary, canvas) {
  choose('生涯結算選單', [
    {
      t: '📥 再次下載結算圖片 (PNG)',
      main: true,
      f: () => {
        RetirementManager.downloadCanvas(canvas, `LoLLife_${S.inGameId}_Career.png`);
        triggerRetirementEndMenu(summary, canvas);
      }
    },
    {
      t: '🔄 開啟全新選手人生',
      f: () => { location.href = location.pathname; }
    }
  ]);
}

// ==================== 開場與事件綁定 ====================
function initApp() {
  $('seed-show').value = SEED;
  $('tl-seed').innerText = SEED;

  $('seed-re').onclick = (e) => {
    e.preventDefault();
    SEED = Math.random().toString(36).slice(2, 10);
    $('seed-show').value = SEED;
    $('tl-seed').innerText = SEED;
    rng = new RNG(SEED);
  };

  $('seed-show').onchange = () => {
    SEED = $('seed-show').value.trim() || 'LoL_2026';
    $('tl-seed').innerText = SEED;
    rng = new RNG(SEED);
  };

  // 5 個位置選擇
  $('seg-pos').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      $('seg-pos').querySelectorAll('button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
    };
  });

  // 主題切換
  $('seg-theme').querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const t = btn.getAttribute('data-t');
      document.body.dataset.theme = t;
      $('seg-theme').querySelectorAll('button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
    };
  });

  // 開始按鈕
  $('btn-start').onclick = () => {
    const rawName = $('in-name').value.trim();
    const rawId = $('in-id').value.trim();

    const defaultNames = ['陳明', '林宇', '張豪', '黃凱', '李廷', '王翔', '許博', '楊浩'];
    const defaultIds = ['Dreamer', 'Apex', 'Shadow', 'Nova', 'Flash', 'Blade', 'Viper', 'Echo'];

    const name = rawName || rng.choice(defaultNames);
    const inGameId = rawId || rng.choice(defaultIds);
    const posBtn = $('seg-pos').querySelector('button.on');
    const pos = posBtn ? posBtn.getAttribute('data-v') : 'MID';

    S = newPlayerState(name, inGameId, pos);
    $('start').style.display = 'none';
    startCareer();
  };

  // 選單按鈕
  $('btn-menu').onclick = () => {
    const modal = $('modal');
    $('modal-box').innerHTML = `
      <h3>選單設定</h3>
      <button class="btn" id="md-restart" style="text-align:center;">重新開始全新生涯</button>
      <button class="btn" id="md-copy-seed" style="text-align:center;">複製當前世界種子碼</button>
      <button class="btn" id="md-close" style="text-align:center;margin-top:10px;">關閉</button>
    `;
    modal.classList.add('show');

    $('md-restart').onclick = () => { location.href = location.pathname; };
    $('md-copy-seed').onclick = () => {
      navigator.clipboard.writeText(`${location.origin}${location.pathname}?seed=${SEED}`);
      alert('種子專屬分享網址已複製！');
    };
    $('md-close').onclick = () => modal.classList.remove('show');
  };

  // 賽程規劃說明按鈕
  $('btn-schedule-guide').onclick = () => {
    const modal = $('modal');
    $('modal-box').innerHTML = `
      <div style="text-align: left; line-height: 1.6; max-height: 400px; overflow-y: auto; padding-right: 5px;">
        <h3 style="text-align: center; color: var(--accent); margin-top: 0; margin-bottom: 15px;">📅 職業電競年度賽程說明</h3>
        
        <div style="margin-bottom: 12px; background: rgba(0, 242, 254, 0.05); border-radius: var(--r); border-left: 3px solid var(--accent); padding: 8px 12px;">
          <strong style="color: var(--accent);">🔄 年度週期概述</strong><br>
          <span style="font-size: 12px; color: var(--text);">職業聯賽一整年固定分為春季賽、夏季賽與秋季賽。每個賽季例行賽打完，前 4 名晉級季後賽，獲勝可獲得對應的國際賽事門票。年底為轉會期，隨後邁入下一年。</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>1. 季前準備與自主特訓</strong><br>
          <span style="font-size: 12px; color: var(--dim);">每年春季賽開啟前，系統會分發特訓加點，您可進行自主特訓，提升您喜愛的英雄熟練度。</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>2. 春季賽 (Spring Split)</strong><br>
          <span style="font-size: 12px; color: var(--dim);">• 例行賽：單循環賽事（LCP 共 7 輪 / LCK&LPL 為 5 輪）。<br>• 季後賽：例行賽前 4 名進行淘汰賽。<br>• 國際賽：<b>冠軍隊伍</b>將代表賽區出戰 <b>First Stand 國際大賽</b>。</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>3. 夏季賽 (Summer Split)</strong><br>
          <span style="font-size: 12px; color: var(--dim);">• 例行賽與季後賽形式相同。<br>• 國際賽：<b>冠軍與亞軍（前 2 名）</b>代表賽區出征 <b>MSI 季中邀請賽</b>。</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>4. 秋季賽 (Autumn Split)</strong><br>
          <span style="font-size: 12px; color: var(--dim);">• 例行賽與季後賽形式相同。<br>• 國際賽：<b>冠軍與亞軍（前 2 名）</b>代表賽區晉級 <b>世界大賽 (Worlds)</b>，爭奪全球總冠軍最高榮耀！</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong>5. 季末轉會窗口 (Off-season)</strong><br>
          <span style="font-size: 12px; color: var(--dim);">秋季賽國際賽結束後，進入轉會期。您可以選擇與原隊續約、尋求 LPL/LCK 頂級豪強合約，或在達成傳奇成就時選擇光榮退役。</span>
        </div>

        <button class="btn main" id="md-guide-close" style="text-align:center; margin-top:15px; width: 100%;">我知道了</button>
      </div>
    `;
    modal.classList.add('show');

    $('md-guide-close').onclick = () => modal.classList.remove('show');
  };
}

window.addEventListener('DOMContentLoaded', initApp);
