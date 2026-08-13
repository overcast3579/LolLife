/**
 * LoLLife - 戰隊與賽區資料庫
 * 全部採用原創虛構戰隊名稱（100% Fictional Esports Teams），選手名單亦為演算法生成
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
  // LCP 亞太賽區 (虛構戰隊)
  {
    id: 'FSG',
    name: 'Flying Steel Gaming (飛鋼電競)',
    shortName: 'FSG',
    region: 'LCP',
    baseRating: 78,
    tier: 'S',
    budget: 88,
    tagline: '賽區頂級豪門，鋼鐵之翼、戰術紀律嚴謹。',
  },
  {
    id: 'TSG',
    name: 'Talon Storm Gaming (暴風獵鷹)',
    shortName: 'TSG',
    region: 'LCP',
    baseRating: 78,
    tier: 'S',
    budget: 90,
    tagline: '常年稱霸賽區的傳統強權，國際賽常客。',
  },
  {
    id: 'VEX',
    name: 'Viper Esports (疾影毒蛇)',
    shortName: 'VEX',
    region: 'LCP',
    baseRating: 76,
    tier: 'A',
    budget: 72,
    tagline: '打法狂暴、節奏迅捷如毒蛇出洞的進攻型勁旅。',
  },
  {
    id: 'SHK',
    name: 'SoftHawks Gaming (軟鷹電競)',
    shortName: 'SHK',
    region: 'LCP',
    baseRating: 75,
    tier: 'A',
    budget: 78,
    tagline: '營運紮實、執行力極高的精密團隊。',
  },
  {
    id: 'VKG',
    name: 'Viking Knights (維京騎士)',
    shortName: 'VKG',
    region: 'LCP',
    baseRating: 73,
    tier: 'B',
    budget: 65,
    tagline: '作風剛猛，邊線單帶能力與打架能力極強。',
  },
  {
    id: 'DFX',
    name: 'Deep Focus X (焦點電競)',
    shortName: 'DFX',
    region: 'LCP',
    baseRating: 73,
    tier: 'B',
    budget: 70,
    tagline: '老牌戰隊，善於陣地戰與大後期防守反擊。',
  },
  {
    id: 'CRG',
    name: 'Cross Realm Gaming (跨界幻影)',
    shortName: 'CRG',
    region: 'LCP',
    baseRating: 72,
    tier: 'B',
    budget: 60,
    tagline: '新興青年軍，敢打敢拼、潛力無限。',
  },
  {
    id: 'FRK',
    name: 'Phoenix Frank (赤焰鳳凰)',
    shortName: 'FRK',
    region: 'LCP',
    baseRating: 71,
    tier: 'C',
    budget: 58,
    tagline: '擅長中後期團戰營運的實力黑馬。',
  },

  // LCK 賽區 (虛構戰隊)
  {
    id: 'AO',
    name: 'Apex One (巔峰之王)',
    shortName: 'AO',
    region: 'LCK',
    baseRating: 88,
    tier: 'S+',
    budget: 100,
    tagline: '世界電競的最高殿堂與傳奇四冠神話豪門。',
  },
  {
    id: 'GX',
    name: 'Gen-X Esports (世代極限)',
    shortName: 'GX',
    region: 'LCK',
    baseRating: 87,
    tier: 'S+',
    budget: 98,
    tagline: '極致營運與無懈可擊的地圖資源控制機器。',
  },
  {
    id: 'HZ',
    name: 'Horizon Life (天際之光)',
    shortName: 'HZ',
    region: 'LCK',
    baseRating: 86,
    tier: 'S',
    budget: 95,
    tagline: '重金打造的銀河戰艦，全線壓制力極強。',
  },
  {
    id: 'DZ',
    name: 'Dplus Zenith (天頂電競)',
    shortName: 'DZ',
    region: 'LCK',
    baseRating: 84,
    tier: 'A',
    budget: 88,
    tagline: '以極致中野聯動與窒息進攻節奏聞名的強權。',
  },
  {
    id: 'TR',
    name: 'Telecom Roar (通訊狂獅)',
    shortName: 'TR',
    region: 'LCK',
    baseRating: 82,
    tier: 'A',
    budget: 82,
    tagline: '傳奇老牌勁旅，隨時能爆發驚人上限。',
  },
  {
    id: 'FX',
    name: 'Brave FearX (無畏戰狐)',
    shortName: 'FX',
    region: 'LCK',
    baseRating: 79,
    tier: 'B',
    budget: 72,
    tagline: '熱血新星戰隊，打法激進無畏。',
  },

  // LPL 賽區 (虛構戰隊)
  {
    id: 'BG',
    name: 'Byte Gaming (字節戰隊)',
    shortName: 'BG',
    region: 'LPL',
    baseRating: 88,
    tier: 'S+',
    budget: 100,
    tagline: '頂級全華班陣容，前期打架節奏快如閃電。',
  },
  {
    id: 'TP',
    name: 'Top Prime (頂峰精銳)',
    shortName: 'TP',
    region: 'LPL',
    baseRating: 86,
    tier: 'S',
    budget: 95,
    tagline: '個人操作能力極限拉滿的頂尖明星強隊。',
  },
  {
    id: 'JD',
    name: 'Jade Dragon (極光玉龍)',
    shortName: 'JD',
    region: 'LPL',
    baseRating: 85,
    tier: 'S',
    budget: 95,
    tagline: '以精準野區控制與後期團戰摧毀力著稱的豪門。',
  },
  {
    id: 'WB',
    name: 'Wave Breaker (破浪電競)',
    shortName: 'WB',
    region: 'LPL',
    baseRating: 83,
    tier: 'A',
    budget: 88,
    tagline: '戰術千變萬化、大賽韌性十足的黑馬。',
  },
  {
    id: 'LN',
    name: 'Lunar Nexus (月影核心)',
    shortName: 'LN',
    region: 'LPL',
    baseRating: 82,
    tier: 'A',
    budget: 84,
    tagline: '紮實營運配合爆發型雙 C 的老牌戰隊。',
  },
  {
    id: 'IG_F',
    name: 'Iron Glory (鋼鐵榮耀)',
    shortName: 'IG',
    region: 'LPL',
    baseRating: 80,
    tier: 'B',
    budget: 75,
    tagline: '崇尚極致進攻與極限換血的傳統豪強。',
  },

  // 台灣業餘/校園盃賽隊伍 (虛構)
  {
    id: 'TW_CAMPUS_1',
    name: '光芒科技大學 (GLU)',
    shortName: 'GLU',
    region: 'AMATEUR_TW',
    baseRating: 58,
    tier: 'Amateur-A',
    budget: 20,
    tagline: '大專電競校園盃常勝軍。',
  },
  {
    id: 'TW_CAMPUS_2',
    name: '遠揚科技大學 (YUE)',
    shortName: 'YUE',
    region: 'AMATEUR_TW',
    baseRating: 56,
    tier: 'Amateur-A',
    budget: 18,
    tagline: '校園聯賽強權，多次打入全國總決賽。',
  },
  {
    id: 'TW_NETCAFE_1',
    name: '戰魂網咖精英隊 (ZH)',
    shortName: 'ZH',
    region: 'AMATEUR_TW',
    baseRating: 54,
    tier: 'Amateur-B',
    budget: 15,
    tagline: '網咖盃常年制霸的民間路人王合組隊伍。',
  },
  {
    id: 'TW_AMATEUR_ROOKIE',
    name: '星火青年電競培訓隊 (SEC)',
    shortName: 'SEC',
    region: 'AMATEUR_TW',
    baseRating: 60,
    tier: 'Amateur-S',
    budget: 25,
    tagline: '培育台港澳新秀的青訓訓練營。',
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
