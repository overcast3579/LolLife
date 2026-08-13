/**
 * LoLLife - 英雄池與英雄熟練度管理
 * 支援全英雄任意選角、非主流適性分析與教練建議
 */

import { CHAMPIONS, getChampionById, getMasteryInfo } from '../data/champions.js';
import { calculateChampionMetaBonus } from '../data/meta.js';

export class ChampionPoolManager {
  constructor(initialData = {}) {
    // 儲存格式: { [championId]: masteryPoints (number) }
    this.masteries = initialData.masteries || {};
    this.signatureChampions = initialData.signatureChampions || [];
    this.offMetaMastered = initialData.offMetaMastered || []; // 已解鎖專屬適性的非主流套路
  }

  /**
   * 初始化新選手的英雄池 (1~3個招牌, 4~8個熟練)
   */
  initPlayerPool(rng, playerRole) {
    const roleChampions = CHAMPIONS.filter(c => c.primaryRole === playerRole || c.roles.includes(playerRole));
    
    // 抽取 1~2 個初始招牌英雄 (120~150 熟練點)
    const numSignatures = rng.range(1, 2);
    const shuffled = [...roleChampions].sort(() => rng.next() - 0.5);
    
    for (let i = 0; i < numSignatures && i < shuffled.length; i++) {
      const champ = shuffled[i];
      this.masteries[champ.id] = rng.range(125, 160);
      this.signatureChampions.push(champ.id);
    }

    // 抽取 4~6 個初始熟練英雄 (75~100 熟練點)
    const numProficient = rng.range(4, 6);
    for (let i = numSignatures; i < numSignatures + numProficient && i < shuffled.length; i++) {
      const champ = shuffled[i];
      this.masteries[champ.id] = rng.range(75, 105);
    }

    // 隨機少數其他位置英雄為練習中 (20~35 點)
    const otherChamps = CHAMPIONS.filter(c => !this.masteries[c.id]);
    for (let i = 0; i < 5; i++) {
      const champ = rng.choice(otherChamps);
      if (champ) {
        this.masteries[champ.id] = rng.range(20, 35);
      }
    }
  }

  /**
   * 取得指定英雄熟練度等級與資訊
   */
  getMastery(championId) {
    const points = this.masteries[championId] || 0;
    return getMasteryInfo(points);
  }

  /**
   * 增加英雄熟練度點數
   */
  addMasteryPoints(championId, points) {
    this.masteries[championId] = (this.masteries[championId] || 0) + points;
    // 檢查是否晉升為賽區/世界級招牌
    if (this.masteries[championId] >= 180 && !this.signatureChampions.includes(championId)) {
      this.signatureChampions.push(championId);
    }
  }

  /**
   * 評估任意英雄在指定位置的適性與風險 (支援非主流選角)
   */
  evaluatePick(championId, targetRole, currentMeta = null) {
    const champ = getChampionById(championId);
    if (!champ) return null;

    const mastery = this.getMastery(championId);
    const metaBonus = calculateChampionMetaBonus(currentMeta, champ);
    
    const isStandardRole = champ.primaryRole === targetRole || champ.roles.includes(targetRole);
    const isOffMeta = !isStandardRole;

    // 計算非主流懲罰或特殊優勢
    let roleFitScore = 100;
    let coachAdvice = '常規戰術選角，發揮穩定。';
    let riskTags = [];
    let advantageTags = [];

    if (isOffMeta) {
      roleFitScore = 65;
      coachAdvice = `【非主流警告】教練皺起眉頭：「${champ.name} 打 ${targetRole} 缺乏常規體系支撐，容易遭到對手針對，確定要鎖定嗎？」`;
      
      if (champ.tags.includes('poke')) advantageTags.push('長手消耗與線權壓制');
      if (champ.tags.includes('global') || champ.tags.includes('global_heal')) advantageTags.push('全圖戰略技能支援');
      if (champ.tags.includes('enchanter')) advantageTags.push('後期極致保排與團隊續航');

      riskTags.push('缺乏傳統位置前排/控制', '極度考驗對線基本功與視野', '若遭 Gank 容錯率較低');

      // 若該非主流已經被玩家練至世界級招牌，適性顯著提高
      if (mastery.level >= 6 || this.offMetaMastered.includes(`${championId}_${targetRole}`)) {
        roleFitScore = 90;
        coachAdvice = `【絕活黑科技】教練點了點頭：「你的 ${champ.name} 是賽區名產，放手去打吧！」`;
      }
    } else {
      if (mastery.level <= 1) {
        coachAdvice = `【熟練度過低】教練提醒：「你幾乎沒在正式賽場用過 ${champ.name}，小心失誤。」`;
      } else if (mastery.level >= 5) {
        coachAdvice = `【招牌自信角】教練全力支持：「鎖下 ${champ.name}，打出你的招牌水準！」`;
      }
    }

    // 綜合計算選角總係數
    const totalMultiplier = (mastery.mult * (roleFitScore / 100)) + (metaBonus / 100);

    return {
      champion: champ,
      mastery,
      metaBonus,
      isOffMeta,
      roleFitScore,
      totalMultiplier,
      coachAdvice,
      advantageTags,
      riskTags,
    };
  }

  serialize() {
    return {
      masteries: this.masteries,
      signatureChampions: this.signatureChampions,
      offMetaMastered: this.offMetaMastered,
    };
  }
}
