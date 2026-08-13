/**
 * LoLLife - 動態版本 Meta 生成系統
 * 每個 Split 生成獨特版本趨勢：節奏、資源重心、強勢英雄類型與 T0 英雄
 */

import { CHAMPIONS } from './champions.js';

export const TEMPOS = [
  { id: 'EARLY_TEMPO', name: '前期快節奏前壓', desc: '強調打野三級 Gank、虛空巢蟲與前期對線擊殺。', buffedTags: ['gank', 'lane_dominant', 'dive', 'tempo'] },
  { id: 'LATE_SCALING', name: '後期大核發育', desc: '強調防禦塔保護、穩健農兵與 35 分鐘六神裝團戰。', buffedTags: ['scaling', 'hypercarry', 'teamfight', 'dps'] },
  { id: 'OBJECTIVE_MACRO', name: '中立物件轉線營運', desc: '圍繞小龍、預示者與巴龍做視野壓制與地圖資源交換。', buffedTags: ['vision_control', 'zone_control', 'engage', 'poke'] },
  { id: 'SPLITPUSH_CHAOS', name: '邊線單帶牽制', desc: '單帶英雄主導比賽節奏，考驗 131 / 41 營運與多線防守。', buffedTags: ['splitpush', 'duel', 'mobility'] },
];

export const RESOURCE_FOCUSES = [
  { id: 'TOP_SIDE', name: '上半區重心 (上野連動)', desc: '上路與先鋒巢蟲為核心爭奪點。' },
  { id: 'BOT_SIDE', name: '下半區重心 (下路四包二)', desc: '小龍與雙人組發育為首要勝利方程式。' },
  { id: 'MID_JUNGLE', name: '中野主導 (中路遊走)', desc: '中野聯動控制整張地圖視野與游擊戰。' },
];

export function generateSplitMeta(rng, year, splitId) {
  const tempo = rng.choice(TEMPOS);
  const resourceFocus = rng.choice(RESOURCE_FOCUSES);
  
  // 挑選本季 T0/S 級英雄 (各位置 2-3 名)
  const roles = ['TOP', 'JUG', 'MID', 'ADC', 'SUP'];
  const sTierChampions = {};
  
  roles.forEach(role => {
    const roleChamps = CHAMPIONS.filter(c => c.primaryRole === role || c.roles.includes(role));
    // 依版本契合標籤加權挑選
    const scoredChamps = roleChamps.map(c => {
      let score = rng.range(10, 50);
      tempo.buffedTags.forEach(tag => {
        if (c.tags.includes(tag)) score += 30;
      });
      return { id: c.id, name: c.name, score };
    });
    scoredChamps.sort((a, b) => b.score - a.score);
    sTierChampions[role] = scoredChamps.slice(0, 3).map(c => c.id);
  });

  const patchVersion = `${year - 2008}.${splitId.slice(-1) * 4}.${rng.range(1, 4)}`;
  const patchTitle = `版本 ${patchVersion} - ${tempo.name} (${resourceFocus.name})`;

  return {
    year,
    splitId,
    patchVersion,
    patchTitle,
    tempo,
    resourceFocus,
    sTierChampions,
    buffedTags: tempo.buffedTags,
    desc: `當前版本焦點：${tempo.desc} 本賽季重心為${resourceFocus.desc}`,
  };
}

export function calculateChampionMetaBonus(meta, champion) {
  if (!meta || !champion) return 0;
  let bonus = 0;
  
  // 檢查是否為 S Tier
  for (let role in meta.sTierChampions) {
    if (meta.sTierChampions[role].includes(champion.id)) {
      bonus += 10;
      break;
    }
  }

  // 檢查標籤吻合度
  if (champion.tags && meta.buffedTags) {
    champion.tags.forEach(tag => {
      if (meta.buffedTags.includes(tag)) bonus += 4;
    });
  }

  return Math.min(20, bonus);
}
