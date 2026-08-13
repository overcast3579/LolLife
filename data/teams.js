/**
 * LoLLife - 戰隊與賽區資料庫
 * 使用真實賽區、官方聯賽名稱與真實戰隊名
 * 選手名單均為演算法虛構生成
 */

export const REGIONS = {
  LCP: {
    id: 'LCP',
    name: '亞太職業聯賽 (LCP)',
    fullName: 'League of Legends Championship Pacific',
    color: '#00f2fe',
    prestige: 78,
    isHome: true,
  },
  LCK: {
    id: 'LCK',
    name: '南韓冠軍聯賽 (LCK)',
    fullName: 'League of Legends Champions Korea',
    color: '#e5b869',
    prestige: 94,
    isHome: false,
    languageNeed: '韓文',
  },
  LPL: {
    id: 'LPL',
    name: '中國職業聯賽 (LPL)',
    fullName: 'League of Legends Pro League',
    color: '#ff4d4f',
    prestige: 92,
    isHome: false,
    languageNeed: '中文',
  },
  AMATEUR_TW: {
    id: 'AMATEUR_TW',
    name: '台港澳業餘/校園聯賽',
    fullName: 'Taiwan Amateur & Campus Circuit',
    color: '#a0aec0',
    prestige: 40,
    isHome: true,
  },
};

export const TEAMS = [
  // LCP 戰隊 (真實戰隊名)
  {
    id: 'CFO',
    name: 'CTBC Flying Oyster (中信飛蠔)',
    shortName: 'CFO',
    region: 'LCP',
    baseRating: 77,
    tier: 'S',
    budget: 85,
    tagline: '台灣電競老牌豪門，組織完備、戰術嚴謹。',
  },
  {
    id: 'PSG',
    name: 'PSG Talon',
    shortName: 'PSG',
    region: 'LCP',
    baseRating: 78,
    tier: 'S',
    budget: 90,
    tagline: '常年稱霸賽區的傳統勁旅，國際賽常客。',
  },
  {
    id: 'GAM',
    name: 'GAM Esports',
    shortName: 'GAM',
    region: 'LCP',
    baseRating: 76,
    tier: 'A',
    budget: 70,
    tagline: '越南賽區黃金戰隊，打法狂暴、碰撞極多。',
  },
  {
    id: 'SHG',
    name: 'Fukuoka SoftBank HAWKS gaming',
    shortName: 'SHG',
    region: 'LCP',
    baseRating: 75,
    tier: 'A',
    budget: 78,
    tagline: '日本賽區新興霸主，營運紮實、執行力極高。',
  },
  {
    id: 'VKE',
    name: 'Vikings Esports',
    shortName: 'VKE',
    region: 'LCP',
    baseRating: 73,
    tier: 'B',
    budget: 65,
    tagline: '越南實力勁旅，邊線單帶能力與爆發力強。',
  },
  {
    id: 'DFM',
    name: 'DetonatioN FocusMe',
    shortName: 'DFM',
    region: 'LCP',
    baseRating: 73,
    tier: 'B',
    budget: 72,
    tagline: '日本老牌傳奇戰隊，陣地戰經驗豐富。',
  },
  {
    id: 'DCG',
    name: 'Deep Cross Gaming',
    shortName: 'DCG',
    region: 'LCP',
    baseRating: 72,
    tier: 'B',
    budget: 60,
    tagline: '台港澳青年軍，敢打敢拼、潛力無限。',
  },
  {
    id: 'FAK',
    name: 'Frank Esports',
    shortName: 'FAK',
    region: 'LCP',
    baseRating: 71,
    tier: 'C',
    budget: 58,
    tagline: '香港老牌隊伍，擅長後期團戰營運。',
  },

  // LCK 旅外目標戰隊
  {
    id: 'T1',
    name: 'T1',
    shortName: 'T1',
    region: 'LCK',
    baseRating: 88,
    tier: 'S+',
    budget: 100,
    tagline: '世界電競的最高殿堂與四冠傳奇豪門。',
  },
  {
    id: 'GEN',
    name: 'Gen.G',
    shortName: 'GEN',
    region: 'LCK',
    baseRating: 87,
    tier: 'S+',
    budget: 98,
    tagline: '極致營運與無懈可擊的團戰機器。',
  },
  {
    id: 'HLE',
    name: 'Hanwha Life Esports',
    shortName: 'HLE',
    region: 'LCK',
    baseRating: 86,
    tier: 'S',
    budget: 95,
    tagline: '重金打造的銀河戰艦，對線壓制力極強。',
  },
  {
    id: 'DK',
    name: 'Dplus KIA',
    shortName: 'DK',
    region: 'LCK',
    baseRating: 84,
    tier: 'A',
    budget: 88,
    tagline: '以極致中野聯動與窒息節奏聞名的強權。',
  },
  {
    id: 'KT',
    name: 'KT Rolster',
    shortName: 'KT',
    region: 'LCK',
    baseRating: 82,
    tier: 'A',
    budget: 82,
    tagline: '過山車般的傳奇老牌勁旅，隨時爆發上限。',
  },
  {
    id: 'FOX',
    name: 'BNK FearX',
    shortName: 'FOX',
    region: 'LCK',
    baseRating: 79,
    tier: 'B',
    budget: 72,
    tagline: '熱血新星戰隊，打法激進無畏。',
  },

  // LPL 旅外目標戰隊
  {
    id: 'BLG',
    name: 'Bilibili Gaming',
    shortName: 'BLG',
    region: 'LPL',
    baseRating: 88,
    tier: 'S+',
    budget: 100,
    tagline: '全華班頂級陣容，前期節奏快如閃電。',
  },
  {
    id: 'TES',
    name: 'Top Esports',
    shortName: 'TES',
    region: 'LPL',
    baseRating: 86,
    tier: 'S',
    budget: 95,
    tagline: '個人能力極限拉滿的頂尖明星強隊。',
  },
  {
    id: 'JDG',
    name: 'JD Gaming',
    shortName: 'JDG',
    region: 'LPL',
    baseRating: 85,
    tier: 'S',
    budget: 95,
    tagline: '以精準資源控制與後期團戰著稱的豪門。',
  },
  {
    id: 'WBG',
    name: 'Weibo Gaming',
    shortName: 'WBG',
    region: 'LPL',
    baseRating: 83,
    tier: 'A',
    budget: 88,
    tagline: '戰術千變萬化、大賽韌性十足的黑馬。',
  },
  {
    id: 'LNG',
    name: 'LNG Esports',
    shortName: 'LNG',
    region: 'LPL',
    baseRating: 82,
    tier: 'A',
    budget: 84,
    tagline: '紮實營運配合爆發型雙 C 的實力戰隊。',
  },
  {
    id: 'IG',
    name: 'Invictus Gaming',
    shortName: 'IG',
    region: 'LPL',
    baseRating: 80,
    tier: 'B',
    budget: 75,
    tagline: '崇尚極致進攻與極限換血的傳統豪強。',
  },

  // 台灣業餘/校園盃賽隊伍
  {
    id: 'TW_CAMPUS_1',
    name: '弘光科技大學 (HKUF)',
    shortName: 'HKUF',
    region: 'AMATEUR_TW',
    baseRating: 58,
    tier: 'Amateur-A',
    budget: 20,
    tagline: '台灣大專電競校園盃常勝軍。',
  },
  {
    id: 'TW_CAMPUS_2',
    name: '遠東科技大學 (FEU)',
    shortName: 'FEU',
    region: 'AMATEUR_TW',
    baseRating: 56,
    tier: 'Amateur-A',
    budget: 18,
    tagline: '校園聯賽強權，多次打入全國總決賽。',
  },
  {
    id: 'TW_NETCAFE_1',
    name: '戰國網咖重裝戰隊',
    shortName: 'ZG',
    region: 'AMATEUR_TW',
    baseRating: 54,
    tier: 'Amateur-B',
    budget: 15,
    tagline: '網咖盃常年制霸的民間路人王合組隊伍。',
  },
  {
    id: 'TW_AMATEUR_ROOKIE',
    name: '超競青年培訓隊 (SEC)',
    shortName: 'SEC',
    region: 'AMATEUR_TW',
    baseRating: 60,
    tier: 'Amateur-S',
    budget: 25,
    tagline: '專門培育台港澳新秀的青訓訓練營。',
  },
];

// 隨機選手 ID 生成資料庫 (均為虛構)
export const FICTIONAL_PREFIXES = ['Shadow', 'Apex', 'Nova', 'Frost', 'Echo', 'Viper', 'Ghost', 'Zenith', 'Blade', 'Pulse', 'Aero', 'Dawn', 'Storm', 'Blaze', 'Quantum', 'Solar', 'Lunar', 'Iron', 'Sky', 'Void'];
export const FICTIONAL_SUFFIXES = ['King', 'God', 'Pro', 'Boy', 'Star', 'Fox', 'Hawk', 'Wolf', 'Rider', 'Fang', 'Heart', 'Soul', 'Spark', 'Flash', 'Strike', 'Lord', 'Gamer', 'Master', 'Zero', 'One'];

export function generateFictionalTeammate(rng, role, region, baseRating = 70) {
  const prefix = rng.choice(FICTIONAL_PREFIXES);
  const suffix = rng.choice(FICTIONAL_SUFFIXES);
  const id = `${prefix}${suffix}`;
  const age = rng.range(17, 26);
  
  // 實力生成浮動
  const ratingSpread = rng.gaussian(baseRating, 4);
  const overall = Math.min(85, Math.max(45, Math.round(ratingSpread)));
  
  return {
    id,
    role,
    age,
    region,
    overall,
    mechanics: Math.min(80, Math.max(30, overall + rng.range(-4, 4))),
    macro: Math.min(80, Math.max(30, overall + rng.range(-4, 4))),
    teamfight: Math.min(80, Math.max(30, overall + rng.range(-4, 4))),
    mental: Math.min(80, Math.max(30, overall + rng.range(-5, 5))),
    communication: Math.min(80, Math.max(30, overall + rng.range(-5, 5))),
    affinity: rng.range(40, 70), // 與主角默契
    status: 'Starter', // Starter, Sub, Academy
    contractYears: rng.range(1, 3),
  };
}

export function generateTeamRoster(rng, team) {
  const roles = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];
  const roster = {};
  roles.forEach(role => {
    roster[role] = generateFictionalTeammate(rng, role, team.region, team.baseRating);
  });
  return roster;
}

export function getTeamById(id) {
  return TEAMS.find(t => t.id === id) || null;
}
