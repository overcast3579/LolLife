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

// ==================== 核心輔助計算 ====================
function ovr() {
  if (!S) return 50;
  const w = ROLE_WEIGHTS[S.pos] || ROLE_WEIGHTS.MID;
  let sum = 0;
  Object.keys(S.ab).forEach(k => sum += (S.ab[k] || 20) * (w[k] || 0.125));
  let factor = 1.0;
  if (S.fatigue > 70) factor -= 0.08;
  if (S.wristHealth < 50) factor -= 0.08;
  return Math.round(sum * factor);
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

function addAb(k, v) {
  if (!S || !(k in S.ab)) return 0;
  const o = S.ab[k];
  if (v < 0) { S.ab[k] = Math.max(20, Math.min(80, o + v)); return S.ab[k] - o; }
  let cur = o, bud = v + (S.carry[k] || 0);
  const pk = S.pot[k] || 75;
  while (bud > 0 && cur < 80) {
    let cost = cur >= 70 ? 4 : cur >= 60 ? 2 : 1;
    if (cur >= pk) cost *= 3;
    if (bud >= cost) { bud -= cost; cur++; } else break;
  }
  S.carry[k] = cur >= 80 ? 0 : bud;
  S.ab[k] = cur;
  return cur - o;
}

function abCost(k) {
  if (!S) return 1;
  const cur = S.ab[k], pk = S.pot[k] || 75;
  let c = cur >= 70 ? 4 : cur >= 60 ? 2 : 1;
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
  renderTraits();
  $('board').style.display = 'block';

  $('bd-name').innerHTML = `${S.inGameId}<small>${S.name}·${POS_NAMES[S.pos]}·${playerType()}</small>`;
  const teamObj = getTeamById(S.teamId);
  $('bd-team').innerText = teamObj ? `${teamObj.shortName} (${teamObj.region})` : S.team;

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
    <button class="btn${o.main ? ' main' : ''}${o.warn ? ' warn' : ''}" data-idx="${i}">
      ${o.t}
      ${o.s ? `<small>${o.s}</small>` : ''}
    </button>
  `).join('');

  act.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
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
          const pct = Math.min(100, Math.round((cur / 80) * 100));
          const potPct = Math.min(100, Math.round((pot / 80) * 100));
          const cost = abCost(k);
          const cr = (S.carry && S.carry[k]) || 0;
          const cap = cur >= 80;
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
        if (S.ab[k] >= 80) return;

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

  let currentPhase = 1;
  let goldDiff = 0;
  let kills = 0, deaths = 0, assists = 0;

  function runNextPhase() {
    if (currentPhase > 7 || Math.abs(goldDiff) >= 8000) {
      // 比賽結束結算
      const won = goldDiff >= 0;
      S.stats.matchesPlayed += 1;
      if (won) S.stats.matchesWon += 1;

      kills += rng.range(2, 6);
      deaths += rng.range(1, 3);
      assists += rng.range(4, 9);
      S.stats.kills += kills;
      S.stats.deaths += deaths;
      S.stats.assists += assists;

      const isPog = won && (kills >= 6 || assists >= 10 || ovr() >= 68);
      if (isPog) S.stats.pogCount += 1;

      card(won ? 'gold' : 'bad', won ? '🏆 VICTORY 勝利！' : '💀 DEFEAT 戰敗', `
        面對 <b class="hl">${oppTeam.name}</b>，全隊以 <b class="${won ? 'up' : 'dn'}">${won ? '2:0 拿下系列賽' : '1:2 遺憾告負'}</b>！<br>
        個人本局數據：<b class="hl">${kills} 殺 / ${deaths} 死 / ${assists} 助攻</b>${isPog ? ' · 榮獲單場 MVP (POG)！🔥' : ''}
      `);

      onMatchDone(won);
      return;
    }

    const phases = [
      null,
      {
        name: '階段 1 (0:00~1:30) 一級團與野區布防',
        choices: [
          { t: '五人集結入侵對方野區 (一級團)', s: '高風險高報酬', risk: 0.5, successTxt: '【一級團大勝】你的精準進場逼出敵方雙閃並斬獲一血！', failTxt: '遭敵方防守埋伏，交出閃現仍送出一血。' },
          { t: '五點防守，做好常規眼位', s: '穩健開局', risk: 0.8, successTxt: '防守視野滴水不漏，野區平穩開局。', failTxt: '視野被敵方排掉，打野路線暴露。' },
        ]
      },
      {
        name: '階段 2 (1:30~5:00) 首輪對線與打野動向',
        choices: [
          { t: '搶二/搶三主動發難換血單殺', s: '極限操作對決', risk: 0.55, successTxt: '【極限單殺！】你抓準走位破綻單殺對手，引爆全場！', failTxt: '換血過於激進，遭敵方打野反蹲擊殺。' },
          { t: '控線發育，呼叫打野越塔 Gank', s: '節奏營運', risk: 0.75, successTxt: '兵線完美進塔，打野配合越塔拿下人頭！', failTxt: '兵線被控住，補刀略微落後。' },
        ]
      },
      {
        name: '階段 3 (5:00~10:00) 首次回城與首輪中立物件',
        choices: [
          { t: '集結隊友爭奪虛空巢蟲 / 首條小龍', s: '正面團戰碰撞', risk: 0.6, successTxt: '團戰大獲全勝，順利控下首條中立資源與領先！', failTxt: '陣型被割裂，丟失小龍。' },
          { t: '果斷交換資源 (換塔皮 / 換線推塔)', s: '避戰轉線', risk: 0.8, successTxt: '避開正面鋒芒，吃下三層鍍層經濟補償！', failTxt: '地圖節奏被對手牽著走。' },
        ]
      },
      {
        name: '階段 4 (10:00~15:00) 塔皮鍍層與首塔擊破',
        choices: [
          { t: '四人集結強開下路越塔首塔', s: '四包二戰術', risk: 0.65, successTxt: '四包二完美配合，擊破一塔建立前期優勢！', failTxt: '越塔抗塔失誤，被換掉兩人。' },
          { t: '穩健發育，等待第一件核心裝備', s: '發育拖後期', risk: 0.8, successTxt: '核心裝備順利出爐，迎來第一波強勢期。', failTxt: '防禦塔血量被消耗嚴重。' },
        ]
      },
      {
        name: '階段 5 (15:00~22:00) 中期營運與龍魂爭奪',
        choices: [
          { t: '執行 1-3-1 / 4-1 邊線單帶牽制', s: '單帶施壓', risk: 0.6, successTxt: '邊線通關二塔，拉扯得對手首尾不能相顧！', failTxt: '邊線帶太深被三人包抄抓單。' },
          { t: '五人抱團野區排眼埋伏抓單', s: '陣地戰抓單', risk: 0.65, successTxt: '真眼埋伏秒殺敵方核心，順勢推上高地！', failTxt: '臉探草叢被反開團滅。' },
        ]
      },
      {
        name: '階段 6 (22:00~30:00) 巴龍逼團與高地攻防',
        choices: [
          { t: '巴龍釣魚，引誘敵方正面接團打滅隊', s: '巴龍決戰', risk: 0.55, successTxt: '【巴龍滅隊！】完美開戰團滅對手並拿下巴龍，勝券在握！', failTxt: '巴龍被敵方打野神級盲視野搶走！' },
          { t: '帶兵線磨高地防禦塔', s: '耐心蠶食', risk: 0.75, successTxt: '穩紮穩打磨破高地水晶，逼出超級士兵！', failTxt: '被對手頑強清線守住。' },
        ]
      },
      {
        name: '階段 7 (30:00+) 終局遠古巨龍與主堡決戰',
        choices: [
          { t: '遠古巨龍世紀死鬥，全員正面拼到底！', s: '終極生死戰', risk: 0.5, successTxt: '【拿下遠古龍一波結束！】斬殺 Buff 橫掃戰場，直點主堡！', failTxt: '遠古龍團惜敗，無力回天。' },
          { t: '雙傳送偷拆主堡，孤注一擲基地競速！', s: '背水一戰', risk: 0.45, successTxt: '【神級偷拆！】正面拖住，單人點爆水晶完成史詩翻盤！', failTxt: '偷拆被回城守住，反遭一波。' },
        ]
      },
    ];

    const curP = phases[currentPhase];
    choose(`決策｜${curP.name}`, curP.choices.map(c => ({
      t: c.t,
      s: c.s,
      f: () => {
        const pScore = ovr() / 100;
        const succ = rng.next() < (c.risk * (0.6 + pScore * 0.5));
        if (succ) {
          goldDiff += 1500;
          kills += 1;
          card('good', curP.name, c.successTxt);
        } else {
          goldDiff -= 1500;
          deaths += 1;
          card('bad', curP.name, c.failTxt);
        }
        currentPhase++;
        board(1);
        runNextPhase();
      }
    })));
  }

  runNextPhase();
}

// ==================== 2. 英雄池特訓 ====================
function trainChampionMastery(onDone) {
  const act = $('act');
  act.style.display = 'block';

  const roleChamps = CHAMPIONS.filter(c => c.primaryRole === S.pos || c.roles.includes(S.pos));
  const offChamps = CHAMPIONS.filter(c => c.primaryRole !== S.pos && !c.roles.includes(S.pos)).slice(0, 6);
  const list = [...roleChamps, ...offChamps];

  act.innerHTML = `
    <div class="title">🎯 英雄自主特訓 (提升熟練度與招牌)</div>
    <div style="font-size:12px;color:var(--dim);margin-bottom:8px;">選擇一位英雄進行深度特訓 (+35 點熟練度)：</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:6px;max-height:180px;overflow-y:auto;background:var(--panel2);padding:8px;border-radius:var(--r);margin-bottom:10px;">
      ${list.map(c => {
        const pts = S.masteries[c.id] || 0;
        const mi = getMasteryInfo(pts);
        return `
          <button class="btn btn-train-champ" data-id="${c.id}" style="padding:6px;font-size:11.5px;text-align:center;margin:0;">
            <strong>${c.name}</strong><br>
            <small style="color:var(--accent);">${mi.name} (${pts}點)</small>
          </button>
        `;
      }).join('')}
    </div>
    <button class="btn" id="btn-cancel-train" style="text-align:center;">返回 ▸</button>
  `;

  act.querySelectorAll('.btn-train-champ').forEach(btn => {
    btn.onclick = () => {
      const cId = btn.getAttribute('data-id');
      const champ = getChampionById(cId);
      S.masteries[cId] = (S.masteries[cId] || 0) + 35;
      const newMi = getMasteryInfo(S.masteries[cId]);
      if (newMi.level >= 5 && !S.signatureChamps.includes(cId)) {
        S.signatureChamps.push(cId);
        card('gold', '招牌英雄晉升！', `你的【${champ.name}】已達到 <b class="hl">${newMi.name}</b>！賽場上將觸發更多專屬高光決策！`);
      } else {
        card('good', '特訓完成', `自主特訓了【${champ.name}】，熟練度提升至 <b class="hl">${newMi.name} (${S.masteries[cId]}點)</b>！`);
      }
      act.style.display = 'none';
      onDone();
    };
  });

  $('btn-cancel-train').onclick = () => {
    act.style.display = 'none';
    onDone();
  };
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

  card('info', '試訓結果出爐', `各大俱樂部管理層與教練在實機測試後給予了極高評價，送來了正式簽約意向書！`);

  choose('請選擇你的首份簽約戰隊：', offers.map(o => ({
    t: `✍️ 簽約 ${o.teamName}`,
    main: true,
    s: `${o.desc} · 年薪 $${o.salary.toLocaleString()} 元`,
    f: () => {
      S.teamId = o.teamId;
      S.team = o.teamName;
      S.salary = o.salary;
      S.money += Math.round(o.salary * 0.3);
      S.stage = o.status === 'Amateur' ? 'AMATEUR' : 'PRO';
      card('gold', '加盟正式簽約', `你正式簽約加盟 <b class="hl">${o.teamName}</b>！開啟職業電競新篇章！`);
      tlPush(o.status === 'Starter' ? '登陸 LCP' : '加入青訓');

      choose('賽季結束', [{
        t: '進入下一年 ▸ 2027 (17歲 職業新賽季)',
        main: true,
        f: () => startNextProYear()
      }]);
    }
  })));
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
  card('info', `年度版本公布：${meta.patchTitle}`, `${meta.desc}<br>強勢 T0 英雄焦點：${Object.values(meta.sTierChampions).flat().map(id => getChampionById(id)?.name || id).slice(0, 4).join('、 ')}`);

  // 季前特訓
  rollDice(4, `${S.age}歲 季前特訓加點`, () => {
    choose('季前準備就緒', [
      { t: '🎯 進行英雄自主特訓', s: '提升專精英雄熟練度', f: () => trainChampionMastery(() => runProSplit('SPLIT_1', meta, () => runProSplit('SPLIT_2', meta, () => runProSplit('SPLIT_3', meta, () => phaseYearEndTransfer())))) },
      { t: '⚔️ 直接開啟 Split 1 例行賽', main: true, f: () => runProSplit('SPLIT_1', meta, () => runProSplit('SPLIT_2', meta, () => runProSplit('SPLIT_3', meta, () => phaseYearEndTransfer()))) }
    ]);
  });
}

function runProSplit(splitKey, meta, onSplitDone) {
  board(1);
  const splitInfo = SPLITS[splitKey];
  divider(`${S.year} · ${splitInfo.name}`);

  const pOvr = ovr();
  const oppTeams = TEAMS.filter(t => t.id !== S.teamId && (t.region === 'LCP' || t.region === S.region));
  const nextOpp = rng.choice(oppTeams) || TEAMS[0];

  choose(`${splitInfo.name} · 系列賽對決 (${nextOpp.name})`, [
    {
      t: '🎮 親自出戰 (進入 BP 選角 & 7 階段戰術決策)',
      main: true,
      s: '手動選擇英雄、黑科技戰術與關鍵時刻大招決策',
      f: () => {
        interactiveBPDraft(nextOpp, meta, (won) => {
          proceedSplitPostMatch(splitKey, splitInfo, won, onSplitDone);
        });
      }
    },
    {
      t: '⚡ 快速模擬本系列賽',
      s: '系統依綜合戰力直接計算勝負',
      f: () => {
        const won = rng.next() < (pOvr / 100);
        S.stats.matchesPlayed += 7;
        S.stats.matchesWon += won ? 5 : 2;
        card(won ? 'good' : 'bad', `${splitInfo.name} 常規賽戰報`, `系列賽以 <b class="${won ? 'up' : 'dn'}">${won ? '2:0 獲勝' : '1:2 惜敗'}</b> 結束。`);
        proceedSplitPostMatch(splitKey, splitInfo, won, onSplitDone);
      }
    }
  ]);
}

function proceedSplitPostMatch(splitKey, splitInfo, won, onSplitDone) {
  // 賽季事件
  const ev = getRandomEvent(rng, S.age);
  choose(`賽事事件：${ev.title}`, ev.choices.map(c => ({
    t: c.text,
    s: `決策：${c.type}`,
    f: () => {
      card('info', ev.title, c.effect.log);
      board(1);

      // 季後賽 BO5
      const pOvr = ovr();
      const winPlayoffs = won && (rng.next() < (pOvr / 105));
      if (winPlayoffs) {
        S.stats.titlesWon += 1;
        S.popularity += 20;
        card('gold', `🏆 榮獲 ${splitInfo.name} 賽區總冠軍！`, `你在 BO5 總決賽決勝局上演神級開戰，率隊奪得冠軍獎盃與季後賽 MVP！`);
        tlPush(`LCP 冠軍 (${splitInfo.shortName})`);
      } else {
        card('info', `${splitInfo.name} 季後賽結算`, `在半決賽鏖戰五局惜敗，獲得季軍。`);
      }

      // 國際賽 (First Stand / MSI / Worlds)
      if (splitInfo.qualifiesFor) {
        const tourney = INTERNATIONAL_TOURNAMENTS[splitInfo.qualifiesFor];
        const worldRoll = rng.range(1, 100);
        if (worldRoll >= 72 && pOvr >= 68) {
          S.stats.intlTitles += 1;
          if (tourney.id === 'WORLDS') {
            S.stats.worldsTitles += 1;
            S.popularity += 50;
            card('gold', `🏆【世界之巔】${tourney.name} 總冠軍 & FMVP！`, `在全球數千萬觀眾矚目下，你在總決賽斬落 LCK 豪門，捧起召喚師獎盃！名留青史！`);
            tlPush('世界大賽冠軍 🏆');
            unlockTrait('BIG_STAGE_HERO');
          } else {
            card('gold', `🏆 榮獲 ${tourney.name} 國際賽冠軍！`, `擊敗各大賽區強隊，登頂國際舞台！`);
          }
        }
      }

      choose(`${splitInfo.name} 完畢`, [{
        t: '繼續推進賽程 ▸',
        main: true,
        f: onSplitDone
      }]);
    }
  })));
}

// 4. 轉會市場與 LCK/LPL 旅外
function phaseYearEndTransfer() {
  board(2);
  divider(`${S.year} · 年度轉會市場窗口`);

  const pOvr = ovr();
  const offers = [];

  // 原隊續約
  offers.push({
    teamName: S.team,
    teamId: S.teamId,
    salary: Math.round(S.salary * rng.range(105, 125) / 100),
    desc: '原戰隊核心頂薪續約'
  });

  // 國內豪門
  if (pOvr >= 66) {
    offers.push({ teamName: 'Flying Steel Gaming (飛鋼電競)', teamId: 'FSG', salary: 3200000, desc: 'LCP 頂薪邀請' });
  }

  // 旅外 LCK / LPL
  if (pOvr >= 72 || S.stats.worldsTitles >= 1) {
    offers.push({ teamName: 'Apex One (南韓 LCK 豪門 AO)', teamId: 'AO', salary: 16000000, desc: 'LCK 天價旅外挑戰' });
    offers.push({ teamName: 'Byte Gaming (中國 LPL 頂級隊 BG)', teamId: 'BG', salary: 19000000, desc: 'LPL 頂級全華班' });
  }

  card('info', '轉會期報價', `經紀人為你帶來了本年度各俱樂部的報價清單。`);

  const optList = offers.map(o => ({
    t: `✍️ 簽約 ${o.teamName}`,
    main: true,
    s: `${o.desc} · 年薪 $${o.salary.toLocaleString()} 元`,
    f: () => {
      S.team = o.teamName;
      S.teamId = o.teamId;
      S.salary = o.salary;
      S.money += Math.round(o.salary * 0.4);
      card('gold', '轉會簽約確立', `你正式加盟 <b class="hl">${o.teamName}</b>！`);
      tlPush(`加盟 ${o.teamName}`);

      choose('年度結算', [
        { t: '繼續下一年征程 ▸', main: true, f: () => startNextProYear() },
        { t: '宣布功成名就，光榮引退 🏆', warn: true, f: () => triggerRetirement() }
      ]);
    }
  }));

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
}

window.addEventListener('DOMContentLoaded', initApp);
