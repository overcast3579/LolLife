/**
 * LoLLife - 選手核心模型 (Player Model)
 * 實作 8 維能力 (20-80)、隱藏潛力、位置專屬評分、健康衰退與成長模型
 */

export const STAT_KEYS = [
  'mechanics',     // 操作 (反應、連招、極限微操)
  'laning',        // 對線 (補刀、換血、兵線壓制)
  'macro',         // 觀念 (地圖判斷、轉線節奏、物件決策)
  'teamfight',     // 團戰 (站位、輸出、保排、目標選擇)
  'championPool',  // 英雄池 (廣度與 BP 抗性)
  'mental',        // 心態 (逆風抗壓、決勝局穩定度)
  'communication', // 溝通 (指揮、配合、隊內關係)
  'discipline',    // 紀律 (作息自制、訓練效率、健康管理)
];

export const STAT_LABELS = {
  mechanics: '操作',
  laning: '對線',
  macro: '觀念',
  teamfight: '團戰',
  championPool: '英雄池',
  mental: '心態',
  communication: '溝通',
  discipline: '紀律',
};

export const ROLE_WEIGHTS = {
  TOP: { mechanics: 0.20, laning: 0.25, macro: 0.15, teamfight: 0.15, championPool: 0.10, mental: 0.05, communication: 0.05, discipline: 0.05 },
  JUG: { mechanics: 0.15, laning: 0.05, macro: 0.30, teamfight: 0.15, championPool: 0.10, mental: 0.10, communication: 0.10, discipline: 0.05 },
  MID: { mechanics: 0.25, laning: 0.20, macro: 0.15, teamfight: 0.15, championPool: 0.10, mental: 0.05, communication: 0.05, discipline: 0.05 },
  ADC: { mechanics: 0.25, laning: 0.20, macro: 0.10, teamfight: 0.25, championPool: 0.05, mental: 0.10, communication: 0.02, discipline: 0.03 },
  SUP: { mechanics: 0.10, laning: 0.10, macro: 0.25, teamfight: 0.20, championPool: 0.05, mental: 0.10, communication: 0.15, discipline: 0.05 },
};

export class Player {
  constructor(data = {}) {
    this.name = data.name || '召喚師';
    this.inGameId = data.inGameId || 'Rookie';
    this.role = data.role || 'MID';
    this.age = data.age || 16;
    this.birthYear = data.birthYear || 2010;
    this.currentYear = data.currentYear || 2026;
    
    // 8 項核心數值 (20 ~ 80)
    this.stats = {
      mechanics: data.stats?.mechanics || 50,
      laning: data.stats?.laning || 50,
      macro: data.stats?.macro || 45,
      teamfight: data.stats?.teamfight || 48,
      championPool: data.stats?.championPool || 45,
      mental: data.stats?.mental || 50,
      communication: data.stats?.communication || 45,
      discipline: data.stats?.discipline || 55,
    };

    // 8 項隱藏潛力 (55 ~ 85)
    this.potentials = {
      mechanics: data.potentials?.mechanics || 75,
      laning: data.potentials?.laning || 75,
      macro: data.potentials?.macro || 75,
      teamfight: data.potentials?.teamfight || 75,
      championPool: data.potentials?.championPool || 70,
      mental: data.potentials?.mental || 75,
      communication: data.potentials?.communication || 75,
      discipline: data.potentials?.discipline || 75,
    };

    // 成長進度槽 (累積點數升級)
    this.statExp = data.statExp || {
      mechanics: 0, laning: 0, macro: 0, teamfight: 0, championPool: 0, mental: 0, communication: 0, discipline: 0,
    };

    // 身心健康狀態 (0 ~ 100)
    this.wristHealth = data.wristHealth ?? 100; // 手腕健康
    this.backHealth = data.backHealth ?? 100;   // 腰背健康
    this.sleepHealth = data.sleepHealth ?? 95;  // 睡眠品質
    this.fatigue = data.fatigue ?? 10;          // 疲勞 (愈高愈差)
    this.stress = data.stress ?? 15;            // 心理壓力 (愈高愈差)
    this.form = data.form ?? 70;                // 臨場狀態 (0~100)

    // 職涯關係與資產
    this.coachTrust = data.coachTrust ?? 60;    // 教練信任
    this.teamAffinity = data.teamAffinity ?? 60;// 隊友默契
    this.popularity = data.popularity ?? 10;    // 粉絲人氣
    this.marketValue = data.marketValue ?? 300000; // 年薪身價 (TWD)
    this.money = data.money ?? 20000;           // 累積存款 (TWD)
    this.currentTeamId = data.currentTeamId || null; // 所屬戰隊
    this.contractStatus = data.contractStatus || 'FreeAgent'; // FreeAgent, Amateur, Academy, Sub, Starter, Star, Franchise
    this.contractYears = data.contractYears ?? 0;
    this.salary = data.salary ?? 0;

    // 特質清單 (Traits IDs)
    this.traits = data.traits || [];

    // 生涯總計數據
    this.careerStats = data.careerStats || {
      matchesPlayed: 0,
      matchesWon: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      pogCount: 0,
      mvpCount: 0,
      titlesWon: 0,
      internationalTitles: 0,
      worldsTitles: 0,
      championsUsed: {},
      teamHistory: [],
    };
  }

  /**
   * 計算選手在指定位置的綜合實力 (OVR)
   */
  getOverallRating(role = this.role) {
    const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.MID;
    let sum = 0;
    for (let key of STAT_KEYS) {
      sum += (this.stats[key] || 20) * weights[key];
    }

    // 身心狀態修正係數
    let healthFactor = 1.0;
    if (this.fatigue > 70) healthFactor -= 0.08;
    if (this.stress > 70) healthFactor -= 0.06;
    if (this.wristHealth < 50) healthFactor -= 0.10;
    if (this.sleepHealth < 50) healthFactor -= 0.05;

    return Math.round(sum * healthFactor);
  }

  /**
   * 獲得指定能力經驗值，並處理升級
   */
  addStatExp(statKey, expAmount) {
    if (!this.stats[statKey]) return;
    const currentVal = this.stats[statKey];
    const potential = this.potentials[statKey] || 75;

    // 隨年齡與潛力微調經驗獲取效率
    let ageMultiplier = 1.0;
    if (this.age <= 19) ageMultiplier = 1.35;
    else if (this.age <= 23) ageMultiplier = 1.0;
    else ageMultiplier = Math.max(0.4, 1.0 - (this.age - 23) * 0.15);

    // 超出潛力時升級所需經驗加倍
    let potentialPenalty = currentVal >= potential ? 0.4 : 1.0;

    const gainedExp = expAmount * ageMultiplier * potentialPenalty;
    this.statExp[statKey] += gainedExp;

    // 升級門檻公式：依當前數值遞增 (如 50分需 20點, 70分需 50點)
    let neededExp = Math.round(currentVal * 0.7);
    while (this.statExp[statKey] >= neededExp && this.stats[statKey] < 80) {
      this.statExp[statKey] -= neededExp;
      this.stats[statKey] += 1;
      neededExp = Math.round(this.stats[statKey] * 0.7);
    }
  }

  /**
   * 年度年齡增長與自然老化衰退
   */
  processYearAging(rng) {
    this.age += 1;
    this.currentYear += 1;

    // 25 歲以上開始自然生理衰退 (操作、健康)
    if (this.age >= 25) {
      const disciplineBonus = (this.stats.discipline - 50) * 0.02; // 高紀律延後衰退
      const decayChance = Math.max(0.1, 0.6 - disciplineBonus);

      if (rng.next() < decayChance) {
        this.stats.mechanics = Math.max(20, this.stats.mechanics - rng.range(1, 2));
      }
      if (rng.next() < decayChance) {
        this.wristHealth = Math.max(20, this.wristHealth - rng.range(2, 5));
        this.backHealth = Math.max(20, this.backHealth - rng.range(2, 5));
      }

      // 但心態、觀念、溝通依然有機會隨閱歷提升
      if (rng.next() < 0.5) {
        this.addStatExp('macro', 15);
        this.addStatExp('communication', 15);
        this.addStatExp('mental', 15);
      }
    }

    // 恢復部分疲勞與壓力
    this.fatigue = Math.max(0, this.fatigue - 30);
    this.stress = Math.max(0, this.stress - 25);
  }

  /**
   * 套用事件或決策效果
   */
  applyEffect(effect) {
    if (!effect) return;

    if (effect.mechanicsExp) this.addStatExp('mechanics', effect.mechanicsExp);
    if (effect.laningExp) this.addStatExp('laning', effect.laningExp);
    if (effect.macroExp) this.addStatExp('macro', effect.macroExp);
    if (effect.teamfightExp) this.addStatExp('teamfight', effect.teamfightExp);
    if (effect.championPoolExp) this.addStatExp('championPool', effect.championPoolExp);
    if (effect.mentalExp) this.addStatExp('mental', effect.mentalExp);
    if (effect.communicationExp) this.addStatExp('communication', effect.communicationExp);
    if (effect.disciplineExp) this.addStatExp('discipline', effect.disciplineExp);

    if (effect.fatigue !== undefined) this.fatigue = Math.max(0, Math.min(100, this.fatigue + effect.fatigue));
    if (effect.stress !== undefined) this.stress = Math.max(0, Math.min(100, this.stress + effect.stress));
    if (effect.wristHealth !== undefined) this.wristHealth = Math.max(0, Math.min(100, this.wristHealth + effect.wristHealth));
    if (effect.backHealth !== undefined) this.backHealth = Math.max(0, Math.min(100, this.backHealth + effect.backHealth));
    if (effect.sleepHealth !== undefined) this.sleepHealth = Math.max(0, Math.min(100, this.sleepHealth + effect.sleepHealth));

    if (effect.coachTrust !== undefined) this.coachTrust = Math.max(0, Math.min(100, this.coachTrust + effect.coachTrust));
    if (effect.teamAffinity !== undefined) this.teamAffinity = Math.max(0, Math.min(100, this.teamAffinity + effect.teamAffinity));
    if (effect.popularity !== undefined) this.popularity = Math.max(0, this.popularity + effect.popularity);
    if (effect.money !== undefined) this.money = Math.max(0, this.money + effect.money);
  }

  /**
   * 記錄一場比賽個人成績
   */
  recordMatch(won, kills, deaths, assists, championId, isPog = false) {
    this.careerStats.matchesPlayed += 1;
    if (won) this.careerStats.matchesWon += 1;
    this.careerStats.kills += kills;
    this.careerStats.deaths += deaths;
    this.careerStats.assists += assists;
    if (isPog) this.careerStats.pogCount += 1;

    this.careerStats.championsUsed[championId] = (this.careerStats.championsUsed[championId] || 0) + 1;
  }

  serialize() {
    return JSON.parse(JSON.stringify(this));
  }
}

/**
 * 依世界種子生成 16 歲新選手初始狀態
 */
export function createNewPlayer(rng, options = {}) {
  const role = options.role || 'MID';
  const name = options.name || '小明';
  const inGameId = options.inGameId || 'Dreamer';

  // 基礎能力 40~62，依位置微調特長
  const baseStats = {
    mechanics: rng.range(45, 62),
    laning: rng.range(44, 60),
    macro: rng.range(38, 52),
    teamfight: rng.range(42, 58),
    championPool: rng.range(40, 55),
    mental: rng.range(42, 58),
    communication: rng.range(40, 54),
    discipline: rng.range(45, 65),
  };

  // 賦予特定位置天賦加成
  if (role === 'MID' || role === 'ADC') {
    baseStats.mechanics += rng.range(3, 7);
    baseStats.laning += rng.range(2, 6);
  } else if (role === 'JUG' || role === 'SUP') {
    baseStats.macro += rng.range(4, 8);
    baseStats.communication += rng.range(3, 7);
  } else if (role === 'TOP') {
    baseStats.laning += rng.range(4, 8);
    baseStats.mechanics += rng.range(2, 5);
  }

  // 抽取隱藏潛力 (65 ~ 85)
  const potentials = {};
  STAT_KEYS.forEach(k => {
    potentials[k] = Math.min(85, baseStats[k] + rng.range(12, 26));
  });

  return new Player({
    name,
    inGameId,
    role,
    age: 16,
    birthYear: 2010,
    currentYear: 2026,
    stats: baseStats,
    potentials,
  });
}
