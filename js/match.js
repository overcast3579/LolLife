/**
 * LoLLife - BP 選角與 7 階段事件式賽事模擬引擎
 * 完整實作 BP 流程、自由選角 (含非主流)、7 階段動態決策與位置專屬賽後數據評估
 */

import { CHAMPIONS, getChampionById } from '../data/champions.js';
import { calculateChampionMetaBonus } from '../data/meta.js';

export const MATCH_PHASES = [
  { id: 'PHASE_1', name: '階段 1：一級團與野區布防 (0:00~1:30)', time: '0:00 - 1:30' },
  { id: 'PHASE_2', name: '階段 2：首輪對線與打野動向 (1:30~5:00)', time: '1:30 - 5:00' },
  { id: 'PHASE_3', name: '階段 3：首次回城與首輪物件 (5:00~10:00)', time: '5:00 - 10:00' },
  { id: 'PHASE_4', name: '階段 4：塔皮鍍層與換線轉線 (10:00~15:00)', time: '10:00 - 15:00' },
  { id: 'PHASE_5', name: '階段 5：中期營運與龍魂爭奪 (15:00~22:00)', time: '15:00 - 22:00' },
  { id: 'PHASE_6', name: '階段 6：巴龍逼團與高地攻防 (22:00~30:00)', time: '22:00 - 30:00' },
  { id: 'PHASE_7', name: '階段 7：終局遠古巨龍與主堡決戰 (30:00+)', time: '30:00+' },
];

export class MatchEngine {
  constructor(options = {}) {
    this.blueTeam = options.blueTeam; // { id, name, roster, isPlayerTeam }
    this.redTeam = options.redTeam;
    this.player = options.player;
    this.championPool = options.championPool;
    this.meta = options.meta;
    this.rng = options.rng;
    this.isPlayoffs = options.isPlayoffs || false;

    // 比賽狀態
    this.isFinished = false;
    this.winner = null;
    this.currentPhaseIndex = 0;
    
    // 即時局勢 (藍隊視角)
    this.gameState = {
      goldDiff: 0, // 藍隊領先為正
      blueKills: 0,
      redKills: 0,
      dragons: { blue: 0, red: 0 },
      barons: { blue: 0, red: 0 },
      turrets: { blue: 0, red: 0 },
      playerFlashBurned: false,
      enemyFlashBurned: false,
      playerAdvantage: 0, // 玩家個人對線/經濟優勢
      logs: [],
    };

    // BP 結果
    this.draft = {
      blueBans: [],
      redBans: [],
      bluePicks: {}, // { TOP: champId, JUG: champId, ... }
      redPicks: {},
      playerPickedChampion: null,
    };

    // 玩家本局數據
    this.playerMatchStats = {
      kills: 0,
      deaths: 0,
      assists: 0,
      cs: 0,
      damageShare: 0,
      kp: 0,
      visionScore: 0,
      isPog: false,
    };
  }

  /**
   * 執行 AI BP (玩家未選時保留玩家選角槽)
   */
  executeDraft(playerChosenChampId = null) {
    const roles = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];
    const banned = new Set();
    const picked = new Set();

    // 1. 雙方 Ban 英雄 (各 3-5 隻)
    for (let i = 0; i < 3; i++) {
      const b1 = this.rng.choice(CHAMPIONS.filter(c => !banned.has(c.id)));
      if (b1) { banned.add(b1.id); this.draft.blueBans.push(b1.id); }
      const b2 = this.rng.choice(CHAMPIONS.filter(c => !banned.has(c.id)));
      if (b2) { banned.add(b2.id); this.draft.redBans.push(b2.id); }
    }

    // 2. 玩家選角
    const playerRole = this.player.role;
    let chosenId = playerChosenChampId;
    if (!chosenId) {
      // 預設 AI 代選 (若全自動)
      const available = CHAMPIONS.filter(c => !banned.has(c.id) && (c.primaryRole === playerRole || c.roles.includes(playerRole)));
      chosenId = (available.length > 0 ? this.rng.choice(available).id : CHAMPIONS[0].id);
    }
    this.draft.playerPickedChampion = chosenId;
    picked.add(chosenId);

    // 3. 填補其餘 9 位選手選角
    const isPlayerBlue = this.blueTeam.isPlayerTeam;
    roles.forEach(role => {
      // 藍隊選角
      if (isPlayerBlue && role === playerRole) {
        this.draft.bluePicks[role] = chosenId;
      } else {
        const pool = CHAMPIONS.filter(c => !banned.has(c.id) && !picked.has(c.id) && (c.primaryRole === role || c.roles.includes(role)));
        const pick = pool.length > 0 ? this.rng.choice(pool) : CHAMPIONS.find(c => !picked.has(c.id));
        if (pick) {
          this.draft.bluePicks[role] = pick.id;
          picked.add(pick.id);
        }
      }

      // 紅隊選角
      if (!isPlayerBlue && role === playerRole) {
        this.draft.redPicks[role] = chosenId;
      } else {
        const pool = CHAMPIONS.filter(c => !banned.has(c.id) && !picked.has(c.id) && (c.primaryRole === role || c.roles.includes(role)));
        const pick = pool.length > 0 ? this.rng.choice(pool) : CHAMPIONS.find(c => !picked.has(c.id));
        if (pick) {
          this.draft.redPicks[role] = pick.id;
          picked.add(pick.id);
        }
      }
    });

    return this.draft;
  }

  /**
   * 取得當前階段提供給玩家的互動決策選項
   */
  getCurrentPhaseOptions() {
    if (this.currentPhaseIndex >= MATCH_PHASES.length || this.isFinished) return null;
    const phase = MATCH_PHASES[this.currentPhaseIndex];
    const role = this.player.role;
    const champ = getChampionById(this.draft.playerPickedChampion);

    const phaseOptions = {
      PHASE_1: [
        {
          id: 'P1_INVADE',
          title: '五人集合入侵野區 (一級團)',
          desc: '利用陣容強勢期強抓敵方野區入口與視野。',
          risk: 'HIGH',
          reqStat: 'mechanics',
        },
        {
          id: 'P1_DEFEND',
          title: '五點防守，穩健做防守眼位',
          desc: '站住所有入口，保護野區安全開局。',
          risk: 'LOW',
          reqStat: 'discipline',
        },
        {
          id: 'P1_BUSH_AMBUSH',
          title: '單人在線上草叢提前埋伏換血',
          desc: '一等打出兵線換血壓制，搶奪前兩級主動權。',
          risk: 'MEDIUM',
          reqStat: 'laning',
        },
      ],
      PHASE_2: [
        {
          id: 'P2_LV2_ALLIN',
          title: '搶升 2/3 級發難，尋找極限單殺機會',
          desc: '卡經驗搶先升級，技能全交發起猛攻。',
          risk: 'HIGH',
          reqStat: 'mechanics',
        },
        {
          id: 'P2_FREEZE_WAVE',
          title: '控線發育，呼叫打野前來 Gank',
          desc: '將兵線卡在塔前安全位置，壓制對手走位。',
          risk: 'LOW',
          reqStat: 'laning',
        },
        {
          id: 'P2_ROAM_HELP',
          title: '快速推線，支援打野爭奪河道蟹與野區',
          desc: '犧牲少量兵線，建立野區聯動優勢。',
          risk: 'MEDIUM',
          reqStat: 'macro',
        },
      ],
      PHASE_3: [
        {
          id: 'P3_CONTEST_OBJECTIVE',
          title: '指揮全員爭奪虛空巢蟲 / 第一條小龍',
          desc: '集結隊友展開第一波大規模 4v4 / 5v5 碰撞。',
          risk: 'HIGH',
          reqStat: 'teamfight',
        },
        {
          id: 'P3_TRADE_RESOURCE',
          title: '果斷交換資源 (以龍換塔皮/換巢蟲)',
          desc: '避開正面交鋒，藉由運轉取得經濟補償。',
          risk: 'LOW',
          reqStat: 'macro',
        },
      ],
      PHASE_4: [
        {
          id: 'P4_DIVE_TURRET',
          title: '四人集結越塔擊殺並奪取首塔',
          desc: '利用兵線進塔優勢，執行精準越塔強殺。',
          risk: 'HIGH',
          reqStat: 'communication',
        },
        {
          id: 'P4_DEFENSIVE_FARM',
          title: '上下路平穩換線，安全吃完鍍層發育',
          desc: '維持健康狀態，將比賽推進至裝備成型期。',
          risk: 'LOW',
          reqStat: 'discipline',
        },
      ],
      PHASE_5: [
        {
          id: 'P5_SPLITPUSH_131',
          title: '執行 1-3-1 邊線單帶牽制',
          desc: '邊線持續施壓二塔，拉扯敵方防守陣型。',
          risk: 'MEDIUM',
          reqStat: 'macro',
        },
        {
          id: 'P5_AMBUSH_PICKOFF',
          title: '野區排眼埋伏，抓落單 C 位',
          desc: '用真眼封鎖視野，尋求秒殺敵方落單成員。',
          risk: 'HIGH',
          reqStat: 'macro',
        },
      ],
      PHASE_6: [
        {
          id: 'P6_BAIT_BARON',
          title: '巴龍釣魚，引誘敵方前來開團打滅隊',
          desc: '假打龍真開團，正面摧毀敵方陣型。',
          risk: 'HIGH',
          reqStat: 'teamfight',
        },
        {
          id: 'P6_RUSH_BARON',
          title: '極限 Rush 巴龍，考驗重擊拼懲戒',
          desc: '全隊合力瞬間秒殺巴龍，爭分奪秒。',
          risk: 'HIGH',
          reqStat: 'mental',
        },
      ],
      PHASE_7: [
        {
          id: 'P7_ELDER_DRAGON_FIGHT',
          title: '遠古巨龍世紀決戰，全員死鬥',
          desc: '拿下遠古龍者得天下，生死一線！',
          risk: 'HIGH',
          reqStat: 'teamfight',
        },
        {
          id: 'P7_TELEPORT_BASE_RACE',
          title: '雙傳送偷拆主堡，孤注一擲基地競速！',
          desc: '正面四人拖住，單人直搗黃龍偷點水晶！',
          risk: 'EXTREME',
          reqStat: 'mental',
        },
      ],
    };

    return {
      phase,
      options: phaseOptions[phase.id] || [],
    };
  }

  /**
   * 執行單一階段決策
   */
  resolvePhase(optionId = null) {
    if (this.isFinished) return null;
    const phase = MATCH_PHASES[this.currentPhaseIndex];
    const isPlayerBlue = this.blueTeam.isPlayerTeam;

    // 計算選手與隊伍基礎戰力
    const playerOvr = this.player.getOverallRating();
    const evalPick = this.championPool.evaluatePick(this.draft.playerPickedChampion, this.player.role, this.meta);
    const pickMult = evalPick ? evalPick.totalMultiplier : 1.0;
    const playerEffectivePower = playerOvr * pickMult;

    // 隊友與戰隊基礎評分
    const myTeamBase = (isPlayerBlue ? this.blueTeam.baseRating : this.redTeam.baseRating) || 72;
    const enemyTeamBase = (isPlayerBlue ? this.redTeam.baseRating : this.blueTeam.baseRating) || 72;

    const teamPowerDiff = (myTeamBase + (playerEffectivePower - 60) * 0.3) - enemyTeamBase;
    const roll = this.rng.gaussian(teamPowerDiff, 8);

    let phaseLog = '';
    let success = roll > 0;

    // 處理具體選項判定
    if (optionId === 'P1_INVADE') {
      if (success) {
        this.gameState.goldDiff += (isPlayerBlue ? 400 : -400);
        if (isPlayerBlue) this.gameState.blueKills += 1; else this.gameState.redKills += 1;
        this.playerMatchStats.kills += (this.rng.next() < 0.6 ? 1 : 0);
        this.playerMatchStats.assists += 1;
        phaseLog = `【一級團大勝】你的精準開戰逼出敵方雙閃並斬獲一血！前期節奏大好！`;
      } else {
        this.gameState.goldDiff -= (isPlayerBlue ? 400 : -400);
        if (isPlayerBlue) this.gameState.redKills += 1; else this.gameState.blueKills += 1;
        this.gameState.playerFlashBurned = true;
        this.playerMatchStats.deaths += 1;
        phaseLog = `【入侵遭埋伏】敵方早有防備，在一級草叢打出反包夾，你交出閃現仍難逃一死。`;
      }
    } else if (optionId === 'P2_LV2_ALLIN') {
      if (success) {
        this.gameState.playerAdvantage += 300;
        this.playerMatchStats.kills += 1;
        phaseLog = `【線上單殺！】你精準抓到對手補刀破綻，連招極限單殺對手！全場沸騰！`;
      } else {
        this.gameState.playerAdvantage -= 300;
        this.playerMatchStats.deaths += 1;
        phaseLog = `換血過於激進，遭敵方打野及時趕到收下一血。`;
      }
    } else if (optionId === 'P3_CONTEST_OBJECTIVE') {
      if (success) {
        if (isPlayerBlue) this.gameState.dragons.blue += 1; else this.gameState.dragons.red += 1;
        this.gameState.goldDiff += (isPlayerBlue ? 600 : -600);
        phaseLog = `【首條小龍拿下】團戰大獲全勝，你們順利控下首條中立資源與經濟領先！`;
      } else {
        if (isPlayerBlue) this.gameState.dragons.red += 1; else this.gameState.dragons.blue += 1;
        phaseLog = `爭奪小龍時陣型被割裂，對方打野搶下小龍並擊殺己方前排。`;
      }
    } else if (optionId === 'P6_BAIT_BARON' || optionId === 'P6_RUSH_BARON') {
      if (success) {
        if (isPlayerBlue) this.gameState.barons.blue += 1; else this.gameState.barons.red += 1;
        this.gameState.goldDiff += (isPlayerBlue ? 2500 : -2500);
        phaseLog = `【巴龍到手！】全隊帶著巴龍 Buff 勢如破竹，直逼敵方高地水晶！`;
      } else {
        if (isPlayerBlue) this.gameState.barons.red += 1; else this.gameState.barons.blue += 1;
        phaseLog = `巴龍被敵方打野神級盲視野搶走！局面瞬間陷入危機！`;
      }
    } else if (optionId === 'P7_ELDER_DRAGON_FIGHT' || optionId === 'P7_TELEPORT_BASE_RACE') {
      if (success) {
        phaseLog = `【神級決策一波結束！】你在大後期上演救世主級發揮，摧毀敵方主堡水晶！`;
        this.winner = (isPlayerBlue ? this.blueTeam.id : this.redTeam.id);
        this.isFinished = true;
      } else {
        phaseLog = `極限決戰中被對手團滅，主堡水晶失守……`;
        this.winner = (isPlayerBlue ? this.redTeam.id : this.blueTeam.id);
        this.isFinished = true;
      }
    } else {
      // 常規推進戰報
      if (success) {
        this.gameState.goldDiff += (isPlayerBlue ? 500 : -500);
        phaseLog = `【${phase.name}】你在本階段發揮穩健，隊伍逐步擴大場上優勢。`;
      } else {
        this.gameState.goldDiff -= (isPlayerBlue ? 500 : -500);
        phaseLog = `【${phase.name}】受到對手嚴密針對，隊伍在轉線期丟失了部分野區視野。`;
      }
    }

    this.gameState.logs.push(phaseLog);

    // 檢查是否有提早結束局勢 (經濟領先超過 8000 或到了第 6-7 階段)
    const myAdvantage = isPlayerBlue ? this.gameState.goldDiff : -this.gameState.goldDiff;
    if (this.currentPhaseIndex >= 4 && myAdvantage >= 8000) {
      this.winner = (isPlayerBlue ? this.blueTeam.id : this.redTeam.id);
      this.isFinished = true;
      this.gameState.logs.push(`【碾壓平推】巨大的經濟優勢讓對手無力防守，恭喜拿下勝利！`);
    } else if (this.currentPhaseIndex >= 4 && myAdvantage <= -8000) {
      this.winner = (isPlayerBlue ? this.redTeam.id : this.blueTeam.id);
      this.isFinished = true;
      this.gameState.logs.push(`【遺憾告負】劣勢過大，主堡在對手的猛烈攻勢下化為灰燼。`);
    }

    this.currentPhaseIndex += 1;
    if (this.currentPhaseIndex >= MATCH_PHASES.length && !this.isFinished) {
      // 大後期結算
      this.winner = (myAdvantage >= 0 ? (isPlayerBlue ? this.blueTeam.id : this.redTeam.id) : (isPlayerBlue ? this.redTeam.id : this.blueTeam.id));
      this.isFinished = true;
    }

    if (this.isFinished) {
      this._finalizeStats();
    }

    return {
      phase,
      success,
      phaseLog,
      gameState: this.gameState,
      isFinished: this.isFinished,
      winner: this.winner,
    };
  }

  /**
   * 全自動快速模擬整場比賽
   */
  simulateFullGame() {
    this.executeDraft();
    while (!this.isFinished && this.currentPhaseIndex < MATCH_PHASES.length) {
      const opts = this.getCurrentPhaseOptions();
      const chosenOpt = (opts && opts.options.length > 0) ? this.rng.choice(opts.options).id : null;
      this.resolvePhase(chosenOpt);
    }
    return this.getMatchResult();
  }

  /**
   * 結算本局選手專屬數據 (KDA, CS, 傷害佔比, POG)
   */
  _finalizeStats() {
    const isPlayerBlue = this.blueTeam.isPlayerTeam;
    const won = this.winner === (isPlayerBlue ? this.blueTeam.id : this.redTeam.id);
    const role = this.player.role;

    // 依位置生成符合邏輯的數據
    if (role === 'ADC' || role === 'MID') {
      this.playerMatchStats.kills = Math.max(1, this.playerMatchStats.kills + this.rng.range(3, 8));
      this.playerMatchStats.deaths = this.rng.range(1, 4);
      this.playerMatchStats.assists = this.rng.range(4, 9);
      this.playerMatchStats.cs = this.rng.range(240, 360);
      this.playerMatchStats.damageShare = this.rng.range(28, 38);
    } else if (role === 'TOP') {
      this.playerMatchStats.kills = Math.max(1, this.playerMatchStats.kills + this.rng.range(2, 6));
      this.playerMatchStats.deaths = this.rng.range(1, 4);
      this.playerMatchStats.assists = this.rng.range(3, 8);
      this.playerMatchStats.cs = this.rng.range(220, 310);
      this.playerMatchStats.damageShare = this.rng.range(20, 28);
    } else if (role === 'JUG') {
      this.playerMatchStats.kills = this.rng.range(2, 6);
      this.playerMatchStats.deaths = this.rng.range(1, 4);
      this.playerMatchStats.assists = this.rng.range(6, 12);
      this.playerMatchStats.cs = this.rng.range(170, 230);
      this.playerMatchStats.damageShare = this.rng.range(16, 24);
    } else if (role === 'SUP') {
      this.playerMatchStats.kills = this.rng.range(0, 2);
      this.playerMatchStats.deaths = this.rng.range(1, 5);
      this.playerMatchStats.assists = this.rng.range(10, 18);
      this.playerMatchStats.cs = this.rng.range(30, 60);
      this.playerMatchStats.damageShare = this.rng.range(6, 14);
      this.playerMatchStats.visionScore = this.rng.range(70, 110);
    }

    // POG 評定 (勝場且發揮極佳時有高機率)
    if (won && (this.player.getOverallRating() >= 65 || this.playerMatchStats.kills >= 6 || this.playerMatchStats.assists >= 14)) {
      this.playerMatchStats.isPog = this.rng.next() < 0.65;
    }

    // 紀錄進 player 核心
    this.player.recordMatch(
      won,
      this.playerMatchStats.kills,
      this.playerMatchStats.deaths,
      this.playerMatchStats.assists,
      this.draft.playerPickedChampion,
      this.playerMatchStats.isPog
    );

    // 增加英雄熟練點數
    this.championPool.addMasteryPoints(this.draft.playerPickedChampion, won ? 12 : 5);
  }

  getMatchResult() {
    const isPlayerBlue = this.blueTeam.isPlayerTeam;
    const isWinner = this.winner === (isPlayerBlue ? this.blueTeam.id : this.redTeam.id);

    return {
      winnerId: this.winner,
      isWinner,
      blueTeam: this.blueTeam,
      redTeam: this.redTeam,
      draft: this.draft,
      gameState: this.gameState,
      playerStats: this.playerMatchStats,
      logs: this.gameState.logs,
    };
  }
}
