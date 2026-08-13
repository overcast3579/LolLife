/**
 * LoLLife - 合約談判與轉會市場 (Contracts & Transfer Window)
 * 涵蓋戰隊報價、年薪身價評估、先發保障、LCK/LPL 旅外條款
 */

import { TEAMS, REGIONS, getTeamById } from '../data/teams.js';

export class ContractManager {
  constructor(state) {
    this.state = state;
  }

  /**
   * 計算選手當前合理市場身價 (Market Value)
   */
  calculateMarketValue(player) {
    const ovr = player.getOverallRating();
    const popularity = player.popularity || 0;
    const internationalTitles = player.careerStats.internationalTitles || 0;
    const worldsTitles = player.careerStats.worldsTitles || 0;

    // 基礎身價公式 (TWD)
    let base = Math.max(300000, Math.pow(ovr / 50, 4) * 500000);
    // 人氣加成
    base += popularity * 15000;
    // 世界冠軍大幅翻倍
    if (worldsTitles > 0) base *= (1 + worldsTitles * 0.8);
    else if (internationalTitles > 0) base *= (1 + internationalTitles * 0.4);

    return Math.round(base);
  }

  /**
   * 年度轉會期生成多家戰隊合約報價 (含 LCP、LCK、LPL)
   */
  generateTransferOffers(player, rng) {
    const ovr = player.getOverallRating();
    const marketVal = this.calculateMarketValue(player);
    const offers = [];

    // 1. 原戰隊續約報價 (若有戰隊)
    if (player.currentTeamId) {
      const currentTeam = getTeamById(player.currentTeamId);
      if (currentTeam) {
        offers.push({
          teamId: currentTeam.id,
          teamName: currentTeam.name,
          region: currentTeam.region,
          role: player.role,
          status: ovr >= 70 ? 'Franchise' : 'Starter',
          salary: Math.round(marketVal * rng.range(90, 115) / 100),
          years: rng.range(1, 3),
          isRenewal: true,
          desc: `【原隊頂薪續約】${currentTeam.shortName} 願以核心地位與你續約，共同爭奪年度榮譽！`,
        });
      }
    }

    // 2. LCP 其他戰隊報價
    const lcpTeams = TEAMS.filter(t => t.region === 'LCP' && t.id !== player.currentTeamId);
    const numLcpOffers = rng.range(1, 3);
    const selectedLcp = [...lcpTeams].sort(() => rng.next() - 0.5).slice(0, numLcpOffers);

    selectedLcp.forEach(team => {
      offers.push({
        teamId: team.id,
        teamName: team.name,
        region: 'LCP',
        role: player.role,
        status: ovr >= 68 ? 'Starter' : 'Rotation',
        salary: Math.round(marketVal * rng.range(85, 120) / 100),
        years: rng.range(1, 2),
        isRenewal: false,
        desc: `【LCP 轉會邀請】${team.shortName} 看好你的打法風格，期待你加盟擔任核心主力。`,
      });
    });

    // 3. 旅外報價 (LCK / LPL) - 門檻 OVR >= 74 或 具備國際賽亮眼表現
    if (ovr >= 74 || player.careerStats.internationalTitles > 0) {
      const overseasRegion = rng.choice(['LCK', 'LPL']);
      const overseasTeams = TEAMS.filter(t => t.region === overseasRegion);
      const team = rng.choice(overseasTeams);

      const isLck = overseasRegion === 'LCK';
      const salaryMult = isLck ? rng.range(160, 240) : rng.range(200, 300); // LPL / LCK 高薪
      const status = ovr >= 78 ? 'Starter' : 'Sub';

      offers.push({
        teamId: team.id,
        teamName: team.name,
        region: overseasRegion,
        role: player.role,
        status,
        salary: Math.round(marketVal * salaryMult / 100),
        years: rng.range(1, 2),
        isOverseas: true,
        desc: `【${overseasRegion} 豪門旅外合約】${team.name} 提出天價高薪合約！需要克服語言溝通與頂級聯賽的嚴酷競爭。`,
      });
    }

    return offers;
  }

  /**
   * 玩家簽署合約
   */
  signContract(player, offer) {
    player.currentTeamId = offer.teamId;
    player.contractStatus = offer.status;
    player.contractYears = offer.years;
    player.salary = offer.salary;
    player.money += Math.round(offer.salary * 0.3); // 簽約金與首期薪資

    // 若旅外，增加溝通考驗或壓力
    if (offer.isOverseas) {
      player.stress += 15;
      player.popularity += 20;
    }

    // 記錄生涯隊伍
    const team = getTeamById(offer.teamId);
    if (team && !player.careerStats.teamHistory.includes(team.name)) {
      player.careerStats.teamHistory.push(team.name);
    }

    return {
      success: true,
      log: `你正式簽約加盟 ${offer.teamName}！合約期 ${offer.years} 年，年薪 ${offer.salary.toLocaleString()} 元 (${offer.status})。`,
    };
  }
}
