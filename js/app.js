/**
 * LoLLife - 遊戲核心控制器 (App Controller)
 * 參照 YakyoLife 的極致流暢設計模式：記分板、卡片流、擲骰加點、BP選角、賽事決策與生涯年表
 */

import { RNG } from './rng.js';
import { CHAMPIONS, getChampionById } from '../data/champions.js';
import { TEAMS, getTeamById, REGIONS } from '../data/teams.js';
import { SPLITS, INTERNATIONAL_TOURNAMENTS } from '../data/leagues.js';
import { EVENTS, getRandomEvent } from '../data/events.js';
import { TRAITS, getTraitById } from '../data/traits.js';
import { generateSplitMeta } from '../data/meta.js';
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
  TOP: '上路',
  JUG: '打野',
  MID: '中路',
  ADC: '下路',
  SUP: '輔助',
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
    mechanics: rng.range(42, 58),
    laning: rng.range(40, 56),
    macro: rng.range(38, 52),
    teamfight: rng.range(40, 55),
    championPool: rng.range(40, 54),
    mental: rng.range(42, 56),
    communication: rng.range(40, 54),
    discipline: rng.range(45, 62),
  };

  if (pos === 'MID' || pos === 'ADC') { ab.mechanics += 6; ab.laning += 4; }
  else if (pos === 'JUG' || pos === 'SUP') { ab.macro += 6; ab.communication += 5; }
  else if (pos === 'TOP') { ab.laning += 6; ab.mechanics += 4; }

  // 潛力上限 (62~82)
  const pot = {};
  Object.keys(ab).forEach(k => {
    pot[k] = Math.min(85, ab[k] + rng.range(14, 28));
  });

  return {
    name,
    inGameId,
    pos,
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
    masteries: {}, // { [champId]: points }
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

// ==================== 骰子與加點系統 ====================
function rollDice(count = 4, label = '季前特訓加點', onComplete) {
  const act = $('act');
  act.style.display = 'block';
  let values = [];
  for (let i = 0; i < count; i++) values.push(rng.range(1, 6));
  let pool = values.reduce((a, b) => a + b, 0);

  const renderAlloc = () => {
    act.innerHTML = `
      <div class="title">${label}</div>
      <div id="dice">
        ${values.map(v => `<div class="die">${v}</div>`).join('')}
      </div>
      <div class="pool">剩餘可用點數：<b>${pool}</b> 點</div>
      <div id="alloc-rows">
        ${Object.keys(ABL).map(k => {
          const cur = S.ab[k];
          const pot = S.pot[k] || 75;
          const pct = Math.min(100, Math.round((cur / 80) * 100));
          const potPct = Math.min(100, Math.round((pot / 80) * 100));
          const cost = cur >= 70 ? 4 : cur >= 60 ? 2 : 1;
          return `
            <div class="abrow" data-key="${k}">
              <div class="nm">${ABL[k]}</div>
              <div class="bar">
                <i style="width:${pct}%;"></i>
                <em style="left:${potPct}%;"></em>
              </div>
              <div class="val">${cur} <b>(+${cost})</b></div>
            </div>
          `;
        }).join('')}
      </div>
      <button class="btn main" id="btn-finish-alloc" style="margin-top:10px;text-align:center;">完成分配 ▸ 繼續</button>
    `;

    act.querySelectorAll('.abrow').forEach(row => {
      row.onclick = () => {
        const k = row.getAttribute('data-key');
        const cur = S.ab[k];
        const cost = cur >= 70 ? 4 : cur >= 60 ? 2 : 1;
        if (pool >= cost && cur < 80) {
          pool -= cost;
          addAb(k, 1);
          board(0);
          renderAlloc();
        }
      };
    });

    $('btn-finish-alloc').onclick = () => {
      act.style.display = 'none';
      if (onComplete) onComplete();
    };
  };

  renderAlloc();
}

// ==================== 特質側欄渲染 ====================
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

// ==================== 遊戲核心流程循環 ====================
function startCareer() {
  divider(`${S.year} · 16 歲 召喚峽谷天梯衝分`);
  board(0);
  tlPush('天梯起步');

  card('info', '天梯啟程', `16 歲的你以一手絕活在台服與韓服大殺四方，天賦與反應驚豔眾人。新賽季開始，請分配你的初始特訓點數！`);

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

      // 進入試訓會
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
    offers.push({ teamId: 'CFO', teamName: 'CTBC Flying Oyster (中信飛蠔)', status: 'Starter', salary: 1200000, desc: 'LCP 正式先發' });
    offers.push({ teamId: 'PSG', teamName: 'PSG Talon', status: 'Starter', salary: 1500000, desc: 'LCP 豪門先發' });
  } else if (pOvr >= 54) {
    offers.push({ teamId: 'DCG', teamName: 'Deep Cross Gaming', status: 'Academy', salary: 450000, desc: '二隊青訓主力' });
    offers.push({ teamId: 'FAK', teamName: 'Frank Esports', status: 'Sub', salary: 500000, desc: '一隊輪換替補' });
  } else {
    offers.push({ teamId: 'TW_AMATEUR_ROOKIE', teamName: '超競青年培訓隊', status: 'Amateur', salary: 150000, desc: '業餘培訓合約' });
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

// ==================== 職業賽季年度循環 ====================
function startNextProYear() {
  S.year += 1;
  S.age += 1;
  board(0);
  divider(`${S.year} · ${S.age} 歲 職業新賽季`);

  // 25 歲老化
  if (S.age >= 25) {
    if (rng.next() < 0.5) {
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

  // 季前擲骰加點
  rollDice(4, `${S.age}歲 季前特訓加點`, () => {
    runProSplit('SPLIT_1', meta, () => {
      runProSplit('SPLIT_2', meta, () => {
        runProSplit('SPLIT_3', meta, () => {
          phaseYearEndTransfer();
        });
      });
    });
  });
}

function runProSplit(splitKey, meta, onSplitDone) {
  board(1);
  const splitInfo = SPLITS[splitKey];
  divider(`${S.year} · ${splitInfo.name}`);

  // 模擬常規賽成績
  const pOvr = ovr();
  const wins = Math.min(7, Math.max(1, Math.round(pOvr / 12 + rng.range(-1, 2))));
  const losses = 7 - wins;
  S.stats.matchesPlayed += 7;
  S.stats.matchesWon += wins;

  const kills = rng.range(18, 38);
  const deaths = rng.range(8, 20);
  const assists = rng.range(25, 55);
  S.stats.kills += kills;
  S.stats.deaths += deaths;
  S.stats.assists += assists;

  card('good', `${splitInfo.name} 常規賽戰報`, `常規賽戰績：<b class="hl">${wins} 勝 ${losses} 敗</b>。<br>個人數據：${kills} 殺 / ${deaths} 死 / ${assists} 助攻。`);

  // 賽季事件
  const ev = getRandomEvent(rng, S.age);
  choose(`賽事事件：${ev.title}`, ev.choices.map(c => ({
    t: c.text,
    s: `決策：${c.type}`,
    f: () => {
      card('info', ev.title, c.effect.log);
      board(1);

      // 季後賽 BO5
      const qualified = wins >= 4;
      if (qualified) {
        const winPlayoffs = rng.next() < (pOvr / 105);
        if (winPlayoffs) {
          S.stats.titlesWon += 1;
          S.popularity += 20;
          card('gold', `🏆 榮獲 ${splitInfo.name} 賽區總冠軍！`, `你在 BO5 總決賽決勝局上演神級開戰，率隊奪得冠軍獎盃與季後賽 MVP！`);
          tlPush(`LCP 冠軍 (${splitInfo.shortName})`);
        } else {
          card('info', `${splitInfo.name} 季後賽四強`, `在半決賽鏖戰五局惜敗，獲得季軍。`);
        }

        // 國際賽 (First Stand / MSI / Worlds)
        if (splitInfo.qualifiesFor) {
          const tourney = INTERNATIONAL_TOURNAMENTS[splitInfo.qualifiesFor];
          const worldRoll = rng.range(1, 100);
          if (worldRoll >= 75 && pOvr >= 70) {
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
      }

      choose(`${splitInfo.name} 完畢`, [{
        t: '繼續推進賽程 ▸',
        main: true,
        f: onSplitDone
      }]);
    }
  })));
}

// ==================== 轉會期與引退 ====================
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
    desc: '原戰隊核心續約'
  });

  // 國內豪門
  if (pOvr >= 68) {
    offers.push({ teamName: 'CTBC Flying Oyster (中信飛蠔)', teamId: 'CFO', salary: 2800000, desc: 'LCP 頂薪邀請' });
  }

  // 旅外 LCK / LPL
  if (pOvr >= 74 || S.stats.worldsTitles >= 1) {
    offers.push({ teamName: 'T1 (南韓 LCK 豪門)', teamId: 'T1', salary: 15000000, desc: 'LCK 天價旅外' });
    offers.push({ teamName: 'Bilibili Gaming (中國 LPL 頂級隊)', teamId: 'BLG', salary: 18000000, desc: 'LPL 頂級合約' });
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
      s: '結束職業電競選手生涯，結算名人堂歷史定位',
      f: () => triggerRetirement()
    });
  }

  choose('請選擇你的轉會去向：', optList);
}

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
    careerStats: S.stats,
    traits: Object.keys(S.traits).filter(k => S.traits[k]),
    getOverallRating: () => ovr()
  });

  card('gold', '🏆 名人堂生涯總結算', `
    <div style="font-size:26px;text-align:center;margin:10px 0;">${summary.tier.badge} <b style="color:var(--gold);">${summary.tier.name}</b></div>
    <div style="text-align:center;font-size:14px;color:var(--dim);margin-bottom:12px;">生涯傳奇總積分：<b style="color:var(--accent);font-size:18px;">${summary.score} 分</b></div>
    <table class="fin">
      <tr><th>項目</th><th>紀錄</th><th>項目</th><th>紀錄</th></tr>
      <tr><td>出賽場次</td><td>${summary.matchesPlayed} 場</td><td>生涯勝率</td><td>${summary.winRate}%</td></tr>
      <tr><td>賽區冠軍</td><td>${summary.titlesWon} 座</td><td>國際賽冠軍</td><td>${summary.internationalTitles} 座</td></tr>
      <tr><td>世界冠軍</td><td>🏆 ${summary.worldsTitles} 座</td><td>總獎金身價</td><td>$${summary.totalMoney.toLocaleString()} 元</td></tr>
    </table>
  `);

  choose('生涯已畫下句點', [
    {
      t: '📋 複製生涯傳奇分享卡',
      main: true,
      f: () => {
        const text = `🏆 【LoLLife 選手生涯評價】\n選手：${S.inGameId} (${S.name}) · ${POS_NAMES[S.pos]}\n歷史定位：${summary.tier.badge} ${summary.tier.name} (傳奇分: ${summary.score})\n生涯戰績：${summary.matchesPlayed} 場 (勝率 ${summary.winRate}%)\n冠軍榮譽：賽區冠軍 ${summary.titlesWon} 座 | 國際賽 ${summary.internationalTitles} 座 | 世界大賽 ${summary.worldsTitles} 座\n種子碼：${SEED}`;
        navigator.clipboard.writeText(text);
        alert('生涯傳奇文字卡已複製至剪貼簿！可直接分享給好友！');
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
    const name = $('in-name').value.trim() || '陳明';
    const inGameId = $('in-id').value.trim() || 'Dreamer';
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
