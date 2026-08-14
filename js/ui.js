/**
 * LoLLife - UI 渲染與視圖管理模組 (UI Renderer)
 * 負責所有 DOM 元素的動態渲染、頁籤切換、數值更新與彈窗互動
 */

import { STAT_KEYS, STAT_LABELS } from './player.js';
import { CHAMPIONS, getChampionById, getMasteryInfo } from '../data/champions.js';
import { getTeamById } from '../data/teams.js';
import { getTraitById } from '../data/traits.js';
import { RetirementManager } from './retirement.js';

export class UIRenderer {
  constructor(app) {
    this.app = app;
  }

  /**
   * 顯示指定頁籤視圖
   */
  switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const targetSec = document.getElementById(tabId);
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (targetSec) targetSec.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    this.renderAll();
  }

  /**
   * 刷新整體介面
   */
  renderAll() {
    const state = this.app.state;
    if (!state.player) return;

    this.renderHUD();
    this.renderDashboard();
    this.renderMatches();
    this.renderChampions();
    this.renderTransfers();
    this.renderCareer();
  }

  /**
   * 渲染頂部 HUD
   */
  renderHUD() {
    const player = this.app.state.player;
    if (!player) return;

    document.getElementById('hudHeader').style.display = 'block';
    document.getElementById('tabNavBar').style.display = 'block';

    const ovr = player.getOverallRating();
    document.getElementById('hudOvrBadge').innerText = ovr;
    document.getElementById('hudPlayerId').innerText = `${player.inGameId} (${player.name})`;
    document.getElementById('hudRoleAge').innerText = `${player.role} · ${player.age}歲 (${player.currentYear}年)`;

    const team = getTeamById(player.currentTeamId);
    document.getElementById('hudTeam').innerText = team ? `${team.shortName} (${team.region})` : '自由球員 (無戰隊)';
    document.getElementById('hudMoney').innerText = `$${player.money.toLocaleString()} / 年薪 $${(player.salary || 0).toLocaleString()}`;

    // 22 歲以上解鎖手動退休按鈕
    const btnRetire = document.getElementById('btnTriggerRetire');
    if (player.age >= 20) {
      btnRetire.style.display = 'inline-flex';
    } else {
      btnRetire.style.display = 'none';
    }
  }

  /**
   * 渲染選手總覽視圖 (8維能力、健康、特質)
   */
  renderDashboard() {
    const player = this.app.state.player;
    if (!player) return;

    // 1. 身心健康
    const updateVital = (txtId, barId, val) => {
      const txtEl = document.getElementById(txtId);
      const barEl = document.getElementById(barId);
      if (txtEl && barEl) {
        txtEl.innerText = `${val}%`;
        barEl.style.width = `${Math.max(0, Math.min(100, val))}%`;
        barEl.className = 'vital-fill ' + (val >= 70 ? 'vital-good' : val >= 40 ? 'vital-warn' : 'vital-danger');
      }
    };

    updateVital('txtWristHealth', 'barWristHealth', player.wristHealth);
    updateVital('txtBackHealth', 'barBackHealth', player.backHealth);
    updateVital('txtSleepHealth', 'barSleepHealth', player.sleepHealth);

    // 疲勞與壓力愈低愈好
    const updateInvertedVital = (txtId, barId, val) => {
      const txtEl = document.getElementById(txtId);
      const barEl = document.getElementById(barId);
      if (txtEl && barEl) {
        txtEl.innerText = `${val}%`;
        barEl.style.width = `${Math.max(0, Math.min(100, val))}%`;
        barEl.className = 'vital-fill ' + (val <= 30 ? 'vital-good' : val <= 60 ? 'vital-warn' : 'vital-danger');
      }
    };
    updateInvertedVital('txtFatigue', 'barFatigue', player.fatigue);
    updateInvertedVital('txtStress', 'barStress', player.stress);

    // 2. 特質清單
    const containerTraits = document.getElementById('containerTraits');
    if (containerTraits) {
      if (player.traits && player.traits.length > 0) {
        containerTraits.innerHTML = player.traits.map(tId => {
          const t = getTraitById(tId);
          if (!t) return '';
          return `
            <div class="card" style="padding: 0.5rem 0.75rem; font-size: 0.8rem; background: rgba(0,242,254,0.06); border-color: rgba(0,242,254,0.25);">
              <strong>${t.icon} ${t.name}</strong>
              <p style="color: var(--text-muted); font-size: 0.7rem; margin-top: 0.2rem;">${t.desc}</p>
            </div>
          `;
        }).join('');
      } else {
        containerTraits.innerHTML = '<span style="color: var(--text-dim); font-size: 0.85rem;">暫無特質，透過長期比賽行為與成就解鎖</span>';
      }
    }

    // 3. 8 維能力條
    const containerBars = document.getElementById('containerStatBars');
    if (containerBars) {
      containerBars.innerHTML = STAT_KEYS.map(key => {
        const val = player.stats[key] || 20;
        const pot = player.potentials[key] || 75;
        const pct = Math.min(100, Math.round((val / 99) * 100));
        const potPct = Math.min(100, Math.round((pot / 99) * 100));

        return `
          <div class="stat-row">
            <div class="stat-info">
              <span class="stat-name">${STAT_LABELS[key]}</span>
              <span>
                <strong class="stat-num">${val}</strong>
                <span class="stat-potential">(上限 ${pot})</span>
              </span>
            </div>
            <div class="stat-bar-container">
              <div class="stat-bar-fill" style="width: ${pct}%;"></div>
              <div class="stat-bar-potential-marker" style="left: ${potPct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 4. 最近日誌
    const logBox = document.getElementById('containerRecentLogs');
    if (logBox) {
      logBox.innerHTML = this.app.state.logs.slice(0, 8).map(l => `<div class="match-log-entry">${l}</div>`).join('');
    }
  }

  /**
   * 渲染賽程與對局視圖
   */
  renderMatches() {
    const state = this.app.state;
    const isAmateur = state.gamePhase === 'AMATEUR';

    const panelAmateur = document.getElementById('panelAmateurCareer');
    const panelPro = document.getElementById('panelProSeason');

    if (isAmateur) {
      panelAmateur.style.display = 'block';
      panelPro.style.display = 'none';

      const stepIndex = state.career.amateurStageIndex;
      document.getElementById('txtAmateurStep').innerText = `第 ${stepIndex + 1} / 4 階段`;
      const stageInfo = state.career.amateurStageIndex < 4 ? state.career.advanceAmateurStage : null;
    } else {
      panelAmateur.style.display = 'none';
      panelPro.style.display = 'block';

      const season = state.season;
      if (!season.meta) season.startSplit('SPLIT_1');

      document.getElementById('txtSplitTitle').innerText = season.currentSplitKey;
      document.getElementById('txtPatchTitle').innerText = season.meta.patchTitle;
      document.getElementById('txtMetaDesc').innerText = season.meta.desc;

      // S-Tier 標籤
      const containerS = document.getElementById('containerSTierPicks');
      if (containerS && season.meta.sTierChampions) {
        const sChamps = Object.values(season.meta.sTierChampions).flat();
        containerS.innerHTML = sChamps.map(cId => {
          const c = getChampionById(cId);
          return `<span class="brand-badge" style="color: var(--color-cyan);">${c ? c.name : cId}</span>`;
        }).join('');
      }

      // 積分榜
      const containerStandings = document.getElementById('containerStandingsTable');
      if (containerStandings) {
        const sorted = season.getSortedStandings();
        containerStandings.innerHTML = `
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="color: var(--text-muted); border-bottom: 1px solid var(--border-color);">
                <th style="padding: 0.35rem;">排名</th>
                <th style="padding: 0.35rem;">戰隊</th>
                <th style="padding: 0.35rem;">勝場</th>
                <th style="padding: 0.35rem;">敗場</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((t, idx) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); ${t.teamId === state.player.currentTeamId ? 'color: var(--color-cyan); font-weight: 800;' : ''}">
                  <td style="padding: 0.35rem;">#${idx + 1}</td>
                  <td style="padding: 0.35rem;">${t.name}</td>
                  <td style="padding: 0.35rem;">${t.wins}</td>
                  <td style="padding: 0.35rem;">${t.losses}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      // 下一場資訊
      if (season.currentMatchIndex < season.regularSeasonSchedule.length) {
        const nextM = season.regularSeasonSchedule[season.currentMatchIndex];
        document.getElementById('txtNextOpponent').innerText = `下一場對手：${nextM.oppName}`;
        document.getElementById('txtMatchProgress').innerText = `常規賽 第 ${season.currentMatchIndex + 1} / ${season.regularSeasonSchedule.length} 場`;
      } else {
        document.getElementById('txtNextOpponent').innerText = `常規賽已完結`;
        document.getElementById('txtMatchProgress').innerText = `準備進入季後賽 BO5 階段`;
      }
    }
  }

  /**
   * 渲染英雄池網格
   */
  renderChampions(roleFilter = 'ALL') {
    const state = this.app.state;
    const pool = state.championPool;
    const container = document.getElementById('containerChampionsGrid');
    if (!container) return;

    let list = CHAMPIONS;
    if (roleFilter !== 'ALL') {
      list = CHAMPIONS.filter(c => c.primaryRole === roleFilter || c.roles.includes(roleFilter));
    }

    container.innerHTML = list.map(c => {
      const mastery = pool.getMastery(c.id);
      const isSignature = pool.signatureChampions.includes(c.id);

      return `
        <div class="champ-card ${isSignature ? 'signature' : ''}" data-champ-id="${c.id}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="champ-name">${c.name}</div>
            <span class="brand-badge">${c.primaryRole}</span>
          </div>
          <div class="champ-title">${c.title}</div>
          <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
            <span class="mastery-badge">${mastery.name} (${pool.masteries[c.id] || 0}點)</span>
            <button class="btn btn-secondary btn-train-champ" data-champ-id="${c.id}" style="padding: 2px 6px; font-size: 0.7rem;">+特訓</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 渲染轉會與合約視圖
   */
  renderTransfers() {
    const player = this.app.state.player;
    if (!player) return;

    const curContractBox = document.getElementById('containerCurrentContract');
    if (curContractBox) {
      const team = getTeamById(player.currentTeamId);
      curContractBox.innerHTML = `
        <p><strong>效力戰隊：</strong> ${team ? team.name : '暫無合約 (自由人)'}</p>
        <p><strong>合約定位：</strong> ${player.contractStatus} · 剩餘 ${player.contractYears} 年</p>
        <p><strong>年薪待遇：</strong> $${player.salary.toLocaleString()} 元 / 年</p>
        <p><strong>預估市場身價：</strong> $${this.app.contractMgr.calculateMarketValue(player).toLocaleString()} 元</p>
      `;
    }
  }

  /**
   * 渲染生涯歷史與榮譽
   */
  renderCareer() {
    const player = this.app.state.player;
    if (!player) return;

    const honorBox = document.getElementById('containerCareerHonors');
    if (honorBox) {
      const summary = RetirementManager.generateCareerSummary(player);
      honorBox.innerHTML = `
        <p><strong>傳奇評分：</strong> <span style="color: var(--color-gold); font-weight: 800; font-size: 1.2rem;">${summary.score} 分</span></p>
        <p><strong>歷史定位：</strong> <span class="badge-lcp">${summary.tier.badge} ${summary.tier.name}</span></p>
        <p><strong>總出賽場次：</strong> ${summary.matchesPlayed} 場 (勝率 ${summary.winRate}%)</p>
        <p><strong>年度冠軍獎盃：</strong> ${summary.titlesWon} 座</p>
        <p><strong>國際賽 / MSI 冠軍：</strong> ${summary.internationalTitles} 座</p>
        <p><strong>世界大賽 (Worlds) 冠軍：</strong> 🏆 ${summary.worldsTitles} 座</p>
        <p><strong>單場 POG 次數：</strong> ${summary.pogCount} 次</p>
        <p><strong>生涯招牌英雄：</strong> ${summary.mostUsedChamp}</p>
      `;
    }

    const historyBox = document.getElementById('containerFullHistoryLogs');
    if (historyBox) {
      historyBox.innerHTML = this.app.state.logs.map(l => `<div class="match-log-entry">${l}</div>`).join('');
    }
  }

  /**
   * 彈出簡短 Toast 提示
   */
  showToast(message) {
    let toast = document.getElementById('globalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalToast';
      toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        background: linear-gradient(135deg, #121926, #0e131f);
        border: 1px solid var(--color-cyan); color: #fff;
        padding: 0.75rem 1.25rem; border-radius: var(--radius-md);
        box-shadow: var(--shadow-glow); font-weight: 700; font-size: 0.9rem;
        transition: opacity 0.3s ease; opacity: 0; pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2600);
  }
}
