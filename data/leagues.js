/**
 * LoLLife - 賽事與年度賽程資料庫
 * 涵蓋職業聯賽三 Split、國際賽事 (First Stand, MSI, Worlds) 與業餘巡迴賽
 */

export const SPLITS = {
  SPLIT_1: {
    id: 'SPLIT_1',
    name: '春季賽 (Spring Split)',
    shortName: '春季賽',
    desc: '全新賽季揭幕戰，適應年度大改版 Meta，角逐 First Stand 國際資格。',
    qualifiesFor: 'FIRST_STAND',
    regularSeasonMatches: 7, // 快速賽程場次
  },
  SPLIT_2: {
    id: 'SPLIT_2',
    name: '夏季賽 (Summer Split)',
    shortName: '夏季賽',
    desc: '仲夏爭霸，磨合完成的主力陣容正面交鋒，角逐 MSI 季中邀請賽門票。',
    qualifiesFor: 'MSI',
    regularSeasonMatches: 7,
  },
  SPLIT_3: {
    id: 'SPLIT_3',
    name: '秋季賽 (Autumn Split)',
    shortName: '秋季賽',
    desc: '年度終極決戰，爭奪 LCP 年度總冠軍與世界大賽 (Worlds) 出戰席位。',
    qualifiesFor: 'WORLDS',
    regularSeasonMatches: 7,
  },
};

export const INTERNATIONAL_TOURNAMENTS = {
  FIRST_STAND: {
    id: 'FIRST_STAND',
    name: 'First Stand 季前國際賽',
    shortName: 'First Stand',
    prestige: 80,
    desc: '年初各大賽區頂尖戰隊的首次國際大考驗，採無畏徵召模式。',
    teamsPerRegion: {
      LCP: 1,
      LCK: 1,
      LPL: 1,
    },
  },
  MSI: {
    id: 'MSI',
    name: 'MSI 季中邀請賽',
    shortName: 'MSI',
    prestige: 90,
    desc: '季中最強對決，考驗賽區頂級戰力與版本適應。',
    teamsPerRegion: {
      LCP: 2,
      LCK: 2,
      LPL: 2,
    },
  },
  WORLDS: {
    id: 'WORLDS',
    name: '英雄聯盟世界大賽 (Worlds)',
    shortName: 'Worlds',
    prestige: 100,
    desc: '全球最高殿堂，召喚師獎盃與傳奇 FMVP 的誕生之地。',
    teamsPerRegion: {
      LCP: 3,
      LCK: 4,
      LPL: 4,
    },
  },
};

export const AMATEUR_CIRCUIT = [
  {
    id: 'TW_SOLOQ_RUSH',
    name: '台服/韓服天梯衝分期',
    month: '1月-3月',
    desc: '在頂級天梯展現極限操作，吸引職業戰隊青訓星探注意。',
  },
  {
    id: 'TW_CAMPUS_CUP',
    name: '全國六都校園電競菁英盃',
    month: '4月-6月',
    desc: '代表學校或民間戰隊參賽，檢驗線下賽與 BO3 實戰抗壓能力。',
  },
  {
    id: 'TW_NETCAFE_CHAMPIONSHIP',
    name: '全台甲組網咖爭霸賽',
    month: '7月-9月',
    desc: '民間路人王齊聚的高強度淘汰賽，常有職業隊伍二線選手臥底。',
  },
  {
    id: 'TW_LCP_PROMOTION_TRYOUT',
    name: 'LCP 戰隊冬季公開試訓會',
    month: '10月-12月',
    desc: '職業俱樂部基地實機試訓，爭取正式選手或青訓二隊合約。',
  },
];
