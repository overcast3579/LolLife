/**
 * LoLLife - 退休評級與生涯分享卡 (Retirement & Hall of Fame Canvas Card)
 * 綜合巔峰實力、生涯年數、冠軍獎項、世界大賽戰績評定傳奇階級，並使用 Canvas 生成高清電競風格結算圖
 */

export const HOF_TIERS = [
  { level: 7, name: '歷史最佳候選人 (GOAT Candidate)', minScore: 1200, color: '#f5a623', badge: '👑', title: '電競神話 · 召喚峽谷唯一的真神' },
  { level: 6, name: '世界級傳奇選手 (World-Class Legend)', minScore: 850, color: '#e5b869', badge: '⭐', title: '世界傳奇 · 名揚各大賽區的超級巨星' },
  { level: 5, name: '賽區標誌性圖騰 (Regional Legend)', minScore: 600, color: '#00f2fe', badge: '🏆', title: '賽區圖騰 · 一人一城的靈魂象徵' },
  { level: 4, name: '賽區全明星 (Regional All-Star)', minScore: 400, color: '#4facfe', badge: '🎖️', title: '明星選手 · 賽區頂級聯賽的先發支柱' },
  { level: 3, name: '穩定先發老將 (Solid Veteran)', minScore: 250, color: '#52c41a', badge: '🛡️', title: '先發老將 · 征戰多年的可靠戰力' },
  { level: 2, name: '短期職業過客 (Short-Lived Pro)', minScore: 120, color: '#a0aec0', badge: '⚡', title: '職業過客 · 在職業舞台留下足跡的勇者' },
  { level: 1, name: '高端天梯路人 (High-Elo Amateur)', minScore: 0, color: '#718096', badge: '🎮', title: '天梯強者 · 令人敬佩的民間高分路人' },
];

const POS_NAMES = {
  TOP: '上路 (TOP)',
  JUG: '打野 (JUG)',
  MID: '中路 (MID)',
  ADC: '下路 (ADC)',
  SUP: '輔助 (SUP)',
};

export class RetirementManager {
  /**
   * 計算生涯傳奇得分 (Legend Score)
   */
  static calculateLegendScore(player) {
    const stats = player.careerStats;
    let score = 0;

    score += stats.matchesPlayed * 2;
    score += stats.matchesWon * 6;
    score += (stats.pogCount || 0) * 15;
    score += (stats.titlesWon || 0) * 90;
    score += (stats.intlTitles || 0) * 160;
    score += (stats.worldsTitles || 0) * 450;
    score += (player.getOverallRating() - 50) * 12;
    score += Math.round((player.popularity || 0) * 2.5);

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
   * 生成生涯總結報告
   */
  static generateCareerSummary(player) {
    const score = this.calculateLegendScore(player);
    const tier = this.getHofTier(score);
    const played = player.careerStats.matchesPlayed || 0;
    const won = player.careerStats.matchesWon || 0;
    const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

    // 尋找招牌英雄
    const champsUsed = player.careerStats.champsUsed || {};
    let mostUsedChamp = '全能選手';
    let maxCount = 0;
    for (let champId in champsUsed) {
      if (champsUsed[champId] > maxCount) {
        maxCount = champsUsed[champId];
        mostUsedChamp = `${champId} (${maxCount} 場)`;
      }
    }

    const intlWon = player.careerStats.intlTitles || player.careerStats.internationalTitles || 0;
    return {
      name: player.name,
      inGameId: player.inGameId,
      role: player.role,
      roleName: POS_NAMES[player.role] || player.role,
      startAge: 16,
      retireAge: player.age,
      careerYears: player.age - 16,
      score,
      tier,
      winRate,
      matchesPlayed: played,
      matchesWon: won,
      titlesWon: player.careerStats.titlesWon || 0,
      intlTitles: intlWon,
      internationalTitles: intlWon,
      worldsTitles: player.careerStats.worldsTitles || 0,
      pogCount: player.careerStats.pogCount || 0,
      popularity: player.popularity || 0,
      totalMoney: player.money || 0,
      salary: player.salary || 0,
      mostUsedChamp,
      teamsServed: (player.careerStats.teamHistory || []).join('、 ') || player.team || '台灣業餘',
      traits: player.traits || [],
      seed: player.seed || '',
    };
  }

  /**
   * 使用 HTML5 Canvas 繪製高解析度電競風格結算圖片 (800 x 1050 px)
   */
  static renderCareerCardCanvas(summary) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');

    // 1. 深邃電競漸層背景
    const bgGrad = ctx.createLinearGradient(0, 0, 800, 1050);
    bgGrad.addColorStop(0, '#06090e');
    bgGrad.addColorStop(0.5, '#0b1320');
    bgGrad.addColorStop(1, '#05070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 1050);

    // 2. 邊框與霓虹發光線條
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 760, 1010);

    ctx.strokeStyle = 'rgba(245, 166, 35, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, 744, 994);

    // 3. 頂部電競品牌標誌
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 24px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText('LoLLife', 50, 75);

    ctx.fillStyle = '#7f95ad';
    ctx.font = '14px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText('ESPORTS HALL OF FAME · 職業選手名人堂結算證書', 150, 74);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(50, 95, 700, 2);

    // 4. 選手姓名與定位
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText(summary.inGameId, 50, 160);

    ctx.fillStyle = '#7f95ad';
    ctx.font = '500 20px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText(`(${summary.name}) · ${summary.roleName} · 征戰 ${summary.careerYears} 年 (16 ~ ${summary.retireAge} 歲)`, 50, 195);

    // 5. 名人堂階級勳章與頭銜橫幅
    const bannerGrad = ctx.createLinearGradient(50, 220, 750, 310);
    bannerGrad.addColorStop(0, 'rgba(245, 166, 35, 0.15)');
    bannerGrad.addColorStop(1, 'rgba(0, 242, 254, 0.08)');
    ctx.fillStyle = bannerGrad;
    ctx.fillRect(50, 220, 700, 100);
    ctx.strokeStyle = summary.tier.color || '#f5a623';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, 220, 700, 100);

    ctx.font = '46px sans-serif';
    ctx.fillText(summary.tier.badge, 75, 285);

    ctx.fillStyle = summary.tier.color || '#f5a623';
    ctx.font = 'bold 28px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText(summary.tier.name, 140, 262);

    ctx.fillStyle = '#e8f0f8';
    ctx.font = '16px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText(summary.tier.title, 140, 296);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(`${summary.score}`, 720, 270);
    ctx.fillStyle = '#7f95ad';
    ctx.font = '12px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText('傳奇總分', 720, 292);

    // 6. 核心戰績數據 4 格網格 (350 ~ 580)
    ctx.textAlign = 'left';
    const gridItems = [
      { label: '總出賽場次', val: `${summary.matchesPlayed} 場`, sub: `生涯勝率 ${summary.winRate}%` },
      { label: '賽區聯賽冠軍', val: `${summary.titlesWon} 座`, sub: 'LCP Split 總冠軍' },
      { label: '國際賽冠軍', val: `${summary.intlTitles} 座`, sub: 'First Stand / MSI' },
      { label: '世界大賽冠軍', val: `🏆 ${summary.worldsTitles} 座`, sub: '召喚師最高榮耀' },
      { label: '單場 POG 次數', val: `${summary.pogCount} 次`, sub: '賽事 MVP 榮譽' },
      { label: '生涯總薪資與資產', val: `$${(summary.totalMoney || 0).toLocaleString()}`, sub: `最高年薪 $${(summary.salary || 0).toLocaleString()}` },
    ];

    gridItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 50 + col * 360;
      const y = 350 + row * 85;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(x, y, 340, 72);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(x, y, 340, 72);

      ctx.fillStyle = '#7f95ad';
      ctx.font = '13px -apple-system, "Noto Sans TC", sans-serif';
      ctx.fillText(item.label, x + 16, y + 26);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(item.val, x + 16, y + 54);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#00f2fe';
      ctx.font = '12px -apple-system, "Noto Sans TC", sans-serif';
      ctx.fillText(item.sub, x + 324, y + 42);
      ctx.textAlign = 'left';
    });

    // 7. 效力戰隊與生涯招牌英雄 (630 ~ 780)
    const infoY = 630;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(50, infoY, 700, 160);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
    ctx.strokeRect(50, infoY, 700, 160);

    ctx.fillStyle = '#f5a623';
    ctx.font = 'bold 16px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText('🏛️ 效力戰隊歷程', 70, infoY + 35);
    ctx.fillStyle = '#e8f0f8';
    ctx.font = '15px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText(summary.teamsServed, 70, infoY + 62);

    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 16px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText('🗡️ 生涯招牌英雄', 70, infoY + 105);
    ctx.fillStyle = '#e8f0f8';
    ctx.font = '15px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText(summary.mostUsedChamp, 70, infoY + 132);

    // 8. 特質勳章標籤列 (815 ~ 930)
    ctx.fillStyle = '#7f95ad';
    ctx.font = 'bold 14px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText('✨ 生涯解鎖特質', 50, 825);

    const traitsList = summary.traits.length > 0 ? summary.traits.join(' · ') : '純粹專注的召喚師';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(50, 840, 700, 50);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(50, 840, 700, 50);

    ctx.fillStyle = '#f5a623';
    ctx.font = '14px -apple-system, "Noto Sans TC", sans-serif';
    ctx.fillText(traitsList, 70, 871);

    // 9. 底部浮水印與種子碼
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(50, 920, 700, 1);

    ctx.fillStyle = '#7f95ad';
    ctx.font = '13px monospace';
    ctx.fillText(`世界種子碼 SEED: ${summary.seed || 'LoLLife'}`, 50, 960);
    ctx.fillText('LoLLife · 英雄聯盟職業選手人生模擬器 · 相同種子＋相同選擇＝相同人生', 50, 985);

    return canvas;
  }

  /**
   * 下載 Canvas 為 PNG 圖片檔案
   */
  static downloadCanvas(canvas, filename = 'LoLLife_Career_Summary.png') {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
