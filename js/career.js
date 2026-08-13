/**
 * LoLLife - 業餘與起步生涯流程 (Career Phase 1: Taiwan Amateur)
 * 涵蓋 16-17 歲天梯衝分、校園盃、網咖爭霸賽與戰隊試訓機制
 */

import { TEAMS } from '../data/teams.js';

export const AMATEUR_STAGES = [
  {
    step: 1,
    id: 'SOLO_QUEUE_STAGE',
    name: '台服/韓服天梯衝刺',
    desc: '在排位賽磨練基本功，爭取打上韓服菁英前 50 名以吸引星探眼光。',
  },
  {
    step: 2,
    id: 'CAMPUS_CUP_STAGE',
    name: '全國六都校園電競菁英盃',
    desc: '代表學校出戰 BO3 淘汰賽，體驗現場觀眾與線下賽舞台張力。',
  },
  {
    step: 3,
    id: 'NETCAFE_CHAMPIONSHIP_STAGE',
    name: '全台甲組網咖爭霸賽',
    desc: '面對退役老將與民間絕活路人王的硬碰硬對抗。',
  },
  {
    step: 4,
    id: 'PRO_TRYOUTS_STAGE',
    name: '職業戰隊基地實機試訓',
    desc: '受邀前往職業戰隊基地進行 5v5 團練實戰測驗，決定是否能取得職業合約！',
  },
];

export class CareerManager {
  constructor(state) {
    this.state = state;
    this.amateurStageIndex = 0;
  }

  /**
   * 執行當前業餘階段活動
   */
  advanceAmateurStage(choiceType = 'NORMAL') {
    const stage = AMATEUR_STAGES[this.amateurStageIndex];
    const player = this.state.player;
    const rng = this.state.rng;

    let resultLog = '';
    let success = false;

    if (stage.id === 'SOLO_QUEUE_STAGE') {
      const ladderScore = player.stats.mechanics * 0.4 + player.stats.laning * 0.4 + player.stats.discipline * 0.2;
      const rankRoll = rng.gaussian(ladderScore, 5);

      if (rankRoll >= 60) {
        success = true;
        player.popularity += 8;
        player.addStatExp('mechanics', 15);
        player.addStatExp('laning', 12);
        resultLog = `【天梯登頂】你以 68% 超高勝率殺入韓服千分前 30 名！知名主播在實況中盛讚你的操作，多位 LCP 星探將你列入重點觀察名單！`;
      } else {
        player.addStatExp('mechanics', 8);
        player.addStatExp('laning', 8);
        resultLog = `你在韓服大師分段苦戰，雖然未能打進頂級前列，但扎實累積了高強度對線經驗。`;
      }
    } else if (stage.id === 'CAMPUS_CUP_STAGE') {
      const tourneyScore = player.getOverallRating() + rng.range(-6, 8);
      if (tourneyScore >= 58) {
        success = true;
        player.popularity += 12;
        player.money += 15000;
        player.addStatExp('teamfight', 14);
        player.addStatExp('mental', 10);
        resultLog = `【六都奪冠】你在全國六都決賽連斬 MVP，帶領隊友奪得冠軍獎金 15,000 元！線下賽大心臟特質初露鋒芒！`;
      } else {
        player.addStatExp('teamfight', 6);
        player.addStatExp('mental', 6);
        resultLog = `在校園盃四強賽惜敗於老牌強隊，收穫了寶貴的線下賽 BO3 經驗。`;
      }
    } else if (stage.id === 'NETCAFE_CHAMPIONSHIP_STAGE') {
      const netcafeScore = player.getOverallRating() + rng.range(-8, 10);
      if (netcafeScore >= 62) {
        success = true;
        player.popularity += 15;
        player.money += 30000;
        player.addStatExp('macro', 12);
        player.addStatExp('communication', 10);
        resultLog = `【網咖稱霸】你在甲組決賽中憑藉精妙指揮逆轉翻盤奪冠，獎金 30,000 元入袋！獲封「民間最強新星」稱號！`;
      } else {
        player.addStatExp('macro', 8);
        resultLog = `網咖爭霸賽獲得亞軍，在與民間老將的交手中更加理解了地圖物件交換的重要性。`;
      }
    } else if (stage.id === 'PRO_TRYOUTS_STAGE') {
      // 試訓結算，生成戰隊 Offer
      return this.evaluateTryouts();
    }

    this.amateurStageIndex += 1;
    return {
      stage,
      success,
      resultLog,
      isEndOfYear: this.amateurStageIndex >= AMATEUR_STAGES.length,
    };
  }

  /**
   * 試訓測評並生成合約報價
   */
  evaluateTryouts() {
    const player = this.state.player;
    const rng = this.state.rng;
    const ovr = player.getOverallRating();

    const offers = [];

    // LCP 職業戰隊報價門檻
    const lcpTeams = TEAMS.filter(t => t.region === 'LCP');

    if (ovr >= 64) {
      // 優秀新秀：獲得 LCP 正式一隊先發或主力輪換合約
      const team = rng.choice(lcpTeams);
      offers.push({
        teamId: team.id,
        teamName: team.name,
        role: player.role,
        status: 'Starter',
        salary: rng.range(800000, 1500000),
        years: rng.range(1, 2),
        desc: '【LCP 正式選手合約】主教練高度肯定你的即戰力，承諾保障先發出賽席位！',
      });
    }

    if (ovr >= 55) {
      // 潛力新秀：獲得 LCP 二隊/青訓/替補合約
      const team = rng.choice(lcpTeams.filter(t => !offers.some(o => o.teamId === t.id))) || lcpTeams[0];
      offers.push({
        teamId: team.id,
        teamName: team.name,
        role: player.role,
        status: 'Academy',
        salary: rng.range(350000, 600000),
        years: 1,
        desc: '【LCP 青訓/二隊培訓合約】進入基地進行職業化封閉訓練，隨時有機會提拔上一隊。',
      });
    }

    // 始終提供至少一份業餘或青訓合約保底
    if (offers.length === 0) {
      offers.push({
        teamId: 'TW_AMATEUR_ROOKIE',
        teamName: '超競青年培訓隊 (SEC)',
        role: player.role,
        status: 'Amateur',
        salary: 120000,
        years: 1,
        desc: '【業餘培訓合約】繼續在業餘體系磨練一年，提升基礎實力後再次挑戰職業試訓。',
      });
    }

    return {
      stage: AMATEUR_STAGES[3],
      isTryoutResult: true,
      offers,
      resultLog: `【試訓會結束】各大戰隊教練與管理層對你的試訓表現進行了綜合評定，共收到 ${offers.length} 份正式簽約邀請！`,
    };
  }
}
