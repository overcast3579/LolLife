/**
 * LoLLife - 退休評級與生涯分享卡 (Retirement & Hall of Fame)
 * 綜合巔峰實力、生涯年數、冠軍獎項、世界大賽戰績評定傳奇階級
 */

export const HOF_TIERS = [
  { level: 7, name: '歷史最佳候選人 (GOAT Candidate)', minScore: 1200, color: '#f5a623', badge: '👑' },
  { level: 6, name: '世界級傳奇選手 (World-Class Legend)', minScore: 850, color: '#e5b869', badge: '⭐' },
  { level: 5, name: '賽區標誌性圖騰 (Regional Legend)', minScore: 600, color: '#00f2fe', badge: '🏆' },
  { level: 4, name: '賽區全明星 (Regional All-Star)', minScore: 400, color: '#4facfe', badge: '🎖️' },
  { level: 3, name: '穩定先發老將 (Solid Veteran)', minScore: 250, color: '#52c41a', badge: '🛡️' },
  { level: 2, name: '短期職業過客 (Short-Lived Pro)', minScore: 120, color: '#a0aec0', badge: '⚡' },
  { level: 1, name: '高端天梯路人 (High-Elo Amateur)', minScore: 0, color: '#718096', badge: '🎮' },
];

export class RetirementManager {
  /**
   * 計算生涯傳奇得分 (Legend Score)
   */
  static calculateLegendScore(player) {
    const stats = player.careerStats;
    let score = 0;

    // 1. 生涯長度與勝場
    score += stats.matchesPlayed * 2;
    score += stats.matchesWon * 5;

    // 2. 個人榮譽 (POG / MVP)
    score += stats.pogCount * 15;
    score += stats.mvpCount * 40;

    // 3. 冠軍獎盃加成
    score += stats.titlesWon * 80;               // 賽區 Split 冠軍
    score += stats.internationalTitles * 150;     // First Stand / MSI 冠軍
    score += stats.worldsTitles * 400;            // 世界大賽冠軍 (Worlds)

    // 4. 巔峰能力加權
    score += (player.getOverallRating() - 50) * 10;

    // 5. 粉絲人氣與身價
    score += Math.round(player.popularity * 2.5);

    return Math.max(0, Math.round(score));
  }

  /**
   * 取得傳奇評級階級
   */
  static getHofTier(score) {
    for (let tier of HOF_TIERS) {
      if (score >= tier.minScore) return tier;
    }
    return HOF_TIERS[HOF_TIERS.length - 1];
  }

  /**
   * 生成生涯重大時間軸與成就摘要
   */
  static generateCareerSummary(player) {
    const score = this.calculateLegendScore(player);
    const tier = this.getHofTier(score);
    const winRate = player.careerStats.matchesPlayed > 0
      ? Math.round((player.careerStats.matchesWon / player.careerStats.matchesPlayed) * 100)
      : 0;

    // 尋找生涯最愛用英雄
    const champsUsed = player.careerStats.championsUsed;
    let mostUsedChamp = '無';
    let maxCount = 0;
    for (let champId in champsUsed) {
      if (champsUsed[champId] > maxCount) {
        maxCount = champsUsed[champId];
        mostUsedChamp = `${champId} (${maxCount} 場)`;
      }
    }

    return {
      name: player.name,
      inGameId: player.inGameId,
      role: player.role,
      startAge: 16,
      retireAge: player.age,
      careerYears: player.age - 16,
      score,
      tier,
      winRate,
      matchesPlayed: player.careerStats.matchesPlayed,
      matchesWon: player.careerStats.matchesWon,
      titlesWon: player.careerStats.titlesWon,
      internationalTitles: player.careerStats.internationalTitles,
      worldsTitles: player.careerStats.worldsTitles,
      pogCount: player.careerStats.pogCount,
      popularity: player.popularity,
      totalMoney: player.money,
      mostUsedChamp,
      teamsServed: player.careerStats.teamHistory.join(', ') || '無紀錄',
      traits: player.traits,
    };
  }
}
