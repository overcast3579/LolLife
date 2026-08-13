/**
 * LoLLife - 特質系統資料庫 (Traits)
 * 包含正向、負向與雙面特質，由生涯長期行為、成就或事件解鎖
 */

export const TRAITS = [
  // ==================== 正向特質 (POSITIVE) ====================
  {
    id: 'LADDER_MONSTER',
    name: '天梯怪物',
    type: 'POSITIVE',
    icon: '⚡',
    desc: '在排位賽有著近乎殘酷的統治力，對線單殺率與技術成長速度極快。',
    effects: { mechanicsBonus: 4, laningBonus: 4, trainingBonus: 0.15 },
  },
  {
    id: 'BIG_STAGE_HERO',
    name: '大賽型選手',
    type: 'POSITIVE',
    icon: '👑',
    desc: '舞台越大發揮越神勇，在世界大賽與 BO5 決勝局全能力爆發。',
    effects: { clutchBonus: 6, mentalBonus: 5, worldsBonus: 5 },
  },
  {
    id: 'CHAMPION_OCEAN',
    name: '英雄海',
    type: 'POSITIVE',
    icon: '🌊',
    desc: '英雄池深不見底，對手的 BP 封鎖對你形同虛設。',
    effects: { championPoolBonus: 6, bpImmunity: 0.2 },
  },
  {
    id: 'SIGNATURE_SPECIALIST',
    name: '絕活哥',
    type: 'POSITIVE',
    icon: '🗡️',
    desc: '招牌英雄的熟練度超越常理，使用招牌時具有無視部分劣勢的威脅。',
    effects: { signatureBonus: 8, outplayRate: 0.15 },
  },
  {
    id: 'SHOTCALLER_GENIUS',
    name: '天生指揮官',
    type: 'POSITIVE',
    icon: '🧠',
    desc: '具有洞悉戰場的大局觀，能讓全隊的戰術執行與轉線效率提升一個檔次。',
    effects: { macroBonus: 6, communicationBonus: 6, teamSynergy: 0.1 },
  },
  {
    id: 'IRON_MAN',
    name: '鐵人意志',
    type: 'POSITIVE',
    icon: '🛡️',
    desc: '身體與心態耐受力極強，極少受到手腕腰背傷勢困擾，衰退速度極慢。',
    effects: { injuryResistance: 0.5, fatigueDecay: 0.3, agingDelay: 2 },
  },
  {
    id: 'COMEBACK_KING',
    name: '逆風翻盤王',
    type: 'POSITIVE',
    icon: '🔥',
    desc: '在落後 5000 經濟時仍能保持絕對冷靜，頻頻抓住致命破綻一波翻盤。',
    effects: { comebackBonus: 7, mentalBonus: 4 },
  },
  {
    id: 'META_IMMUNE',
    name: '版本免疫',
    type: 'POSITIVE',
    icon: '⚖️',
    desc: '無論遊戲版本如何劇烈震盪，總能迅速找到最適應的比賽節奏。',
    effects: { metaAdaptBonus: 5, championPoolBonus: 3 },
  },
  {
    id: 'FRANCHISE_CORNERSTONE',
    name: '建隊基石',
    type: 'POSITIVE',
    icon: '🏛️',
    desc: '戰隊圍繞你組建陣容時具有最高的凝聚力，大幅吸引高水準隊友加盟。',
    effects: { coachTrustBonus: 10, teamAffinityBonus: 10, marketValueMult: 1.2 },
  },
  {
    id: 'ONE_CLUB_LEGEND',
    name: '一人一城',
    type: 'POSITIVE',
    icon: '🏰',
    desc: '長期效力同一支戰隊，成為該俱樂部的靈魂圖騰，本土粉絲狂熱支持。',
    effects: { popularityBonus: 15, stabilityBonus: 6 },
  },

  // ==================== 負向或雙面特質 (NEGATIVE / DUAL) ====================
  {
    id: 'SCRIM_GOD',
    name: '練習賽之神',
    type: 'DUAL',
    icon: '🎭',
    desc: '訓練賽神擋殺神，但正式比賽面對聚光燈時容易出現不同程度的緊繃。',
    effects: { scrimBonus: 8, stagePenalty: -4 },
  },
  {
    id: 'STAGE_CHOKER',
    name: '舞台軟手',
    type: 'NEGATIVE',
    icon: '🥶',
    desc: '在大賽決勝局時心理負擔過重，容易出現判斷遲疑或閃現撞牆。',
    effects: { clutchPenalty: -6, mentalPenalty: -4 },
  },
  {
    id: 'CHAMPION_PUDDLE',
    name: '英雄勺',
    type: 'NEGATIVE',
    icon: '🥄',
    desc: '擅長英雄數量極少，一旦被對手針對封鎖，戰力將斷崖式下跌。',
    effects: { championPoolPenalty: -6, bpVulnerability: 0.3 },
  },
  {
    id: 'VOLATILE_TEMPER',
    name: '易燃易爆',
    type: 'DUAL',
    icon: '💥',
    desc: '求勝心極強、打法極具侵略性，但劣勢時容易情緒急躁並與隊友發生衝突。',
    effects: { aggressionBonus: 5, teamSynergyPenalty: -5, tiltRisk: 0.2 },
  },
  {
    id: 'LOCKER_ROOM_BOMB',
    name: '更衣室炸彈',
    type: 'NEGATIVE',
    icon: '💣',
    desc: '輸掉比賽後容易將責任歸咎於隊友與教練，嚴重損害團隊氣氛與默契。',
    effects: { teamAffinityPenalty: -10, coachTrustPenalty: -6 },
  },
  {
    id: 'GLASS_WRIST',
    name: '玻璃手腕',
    type: 'NEGATIVE',
    icon: '🩹',
    desc: '手腕容易在高強度連續作戰中發炎受傷，需要更頻繁的休息與復健。',
    effects: { injuryRateMult: 1.6, fatigueRateMult: 1.25 },
  },
  {
    id: 'META_VICTIM',
    name: '版本棄子',
    type: 'NEGATIVE',
    icon: '📉',
    desc: '當版本偏離自身核心英雄池時，適應緩慢且表現波動劇烈。',
    effects: { metaMismatchPenalty: -6 },
  },
  {
    id: 'CONTRACT_YEAR_BUFF',
    name: '合約年戰神',
    type: 'DUAL',
    icon: '💼',
    desc: '在合約最後一年為了爭取大合約會爆發超常戰力，但續約後容易鬆懈。',
    effects: { contractYearBonus: 7, postContractLax: -3 },
  },
  {
    id: 'STREAMER_MINDSET',
    name: '實況主心態',
    type: 'DUAL',
    icon: '📹',
    desc: '熱愛秀操作與追求節目效果，人氣爆棚但在關鍵時刻可能打出多餘操作。',
    effects: { popularityMult: 1.35, disciplinePenalty: -4, highlightRate: 0.2 },
  },
];

export function getTraitById(id) {
  return TRAITS.find(t => t.id === id) || null;
}
