/**
 * LoLLife - 職業年度三 Split 賽季引擎 (Season Engine)
 * 涵蓋季前訓練、常規賽積分榜、季後賽 BO5、國際賽事 (First Stand, MSI, Worlds) 與年度結算
 */

import { SPLITS, INTERNATIONAL_TOURNAMENTS } from '../data/leagues.js';
import { TEAMS, getTeamById } from '../data/teams.js';
import { generateSplitMeta } from '../data/meta.js';
import { MatchEngine } from './match.js';

export class SeasonEngine {
  constructor(state) {
    this.state = state;
    this.currentSplitKey = 'SPLIT_1'; // SPLIT_1, SPLIT_2, SPLIT_3
    this.splitIndex = 1;
    this.meta = null;
    
    // 常規賽積分榜 { [teamId]: { wins: 0, losses: 0, points: 0 } }
    this.standings = {};
    this.regularSeasonSchedule = [];
    this.currentMatchIndex = 0;
    
    // 賽季狀態: 'PRE_SEASON', 'REGULAR_SEASON', 'PLAYOFFS', 'INTERNATIONAL', 'SETTLEMENT'
    this.stage = 'PRE_SEASON';
    this.playoffsBracket = null;
    this.internationalTourney = null;
  }

  /**
   * 初始化一個新 Split
   */
  startSplit(splitKey = 'SPLIT_1') {
    this.currentSplitKey = splitKey;
    this.splitIndex = parseInt(splitKey.slice(-1), 10);
    this.stage = 'PRE_SEASON';
    this.currentMatchIndex = 0;

    // 1. 生成本 Split 動態版本 Meta
    this.meta = generateSplitMeta(this.state.rng, this.state.player.currentYear, splitKey);

    // 2. 初始化賽區隊伍常規賽賽程與積分榜
    const playerTeam = getTeamById(this.state.player.currentTeamId) || TEAMS[0];
    const regionTeams = TEAMS.filter(t => t.region === playerTeam.region);

    this.standings = {};
    regionTeams.forEach(t => {
      this.standings[t.id] = { teamId: t.id, name: t.shortName, wins: 0, losses: 0, points: 0 };
    });

    // 生成單循環常規賽程 (面對除自己外的所有賽區隊伍)
    const opponentTeams = regionTeams.filter(t => t.id !== playerTeam.id);
    this.regularSeasonSchedule = opponentTeams.map(opp => ({
      oppTeamId: opp.id,
      oppName: opp.name,
      isFinished: false,
      result: null,
    }));

    return {
      split: SPLITS[splitKey],
      meta: this.meta,
      schedule: this.regularSeasonSchedule,
      standings: this.getSortedStandings(),
    };
  }

  /**
   * 取得排序後的積分榜
   */
  getSortedStandings() {
    const list = Object.values(this.standings);
    list.sort((a, b) => (b.wins - a.wins) || (b.points - a.points));
    return list;
  }

  /**
   * 推進一場常規賽 (若 autoSimulate = true 則全自動，否則返回 MatchEngine 供手動 BP)
   */
  advanceRegularMatch(autoSimulate = false) {
    if (this.currentMatchIndex >= this.regularSeasonSchedule.length) {
      this.stage = 'PLAYOFFS';
      this._initPlayoffs();
      return { isEndOfRegular: true };
    }

    const matchInfo = this.regularSeasonSchedule[this.currentMatchIndex];
    const playerTeam = getTeamById(this.state.player.currentTeamId) || TEAMS[0];
    const oppTeam = getTeamById(matchInfo.oppTeamId);

    const engine = new MatchEngine({
      blueTeam: { id: playerTeam.id, name: playerTeam.name, baseRating: playerTeam.baseRating, isPlayerTeam: true },
      redTeam: { id: oppTeam.id, name: oppTeam.name, baseRating: oppTeam.baseRating, isPlayerTeam: false },
      player: this.state.player,
      championPool: this.state.championPool,
      meta: this.meta,
      rng: this.state.rng,
    });

    if (autoSimulate) {
      const matchResult = engine.simulateFullGame();
      this._recordRegularMatchResult(matchInfo, playerTeam.id, oppTeam.id, matchResult);
      this.currentMatchIndex += 1;

      // 同步模擬賽區其他 AI 隊伍之間的對戰
      this._simulateOtherMatches(playerTeam.id);

      const isEndOfRegular = this.currentMatchIndex >= this.regularSeasonSchedule.length;
      if (isEndOfRegular) {
        this.stage = 'PLAYOFFS';
        this._initPlayoffs();
      }

      return {
        matchResult,
        isEndOfRegular,
        standings: this.getSortedStandings(),
      };
    }

    return { engine, matchInfo };
  }

  /**
   * 完成手動比賽後的記錄結算
   */
  finishManualRegularMatch(matchResult) {
    const matchInfo = this.regularSeasonSchedule[this.currentMatchIndex];
    const playerTeam = getTeamById(this.state.player.currentTeamId) || TEAMS[0];
    const oppTeam = getTeamById(matchInfo.oppTeamId);

    this._recordRegularMatchResult(matchInfo, playerTeam.id, oppTeam.id, matchResult);
    this.currentMatchIndex += 1;
    this._simulateOtherMatches(playerTeam.id);

    const isEndOfRegular = this.currentMatchIndex >= this.regularSeasonSchedule.length;
    if (isEndOfRegular) {
      this.stage = 'PLAYOFFS';
      this._initPlayoffs();
    }

    return {
      isEndOfRegular,
      standings: this.getSortedStandings(),
    };
  }

  _recordRegularMatchResult(matchInfo, myTeamId, oppTeamId, result) {
    matchInfo.isFinished = true;
    matchInfo.result = result;

    if (result.isWinner) {
      this.standings[myTeamId].wins += 1;
      this.standings[myTeamId].points += 1;
      this.standings[oppTeamId].losses += 1;
      this.standings[oppTeamId].points -= 1;
    } else {
      this.standings[myTeamId].losses += 1;
      this.standings[myTeamId].points -= 1;
      this.standings[oppTeamId].wins += 1;
      this.standings[oppTeamId].points += 1;
    }
  }

  _simulateOtherMatches(playerTeamId) {
    const teams = Object.keys(this.standings).filter(id => id !== playerTeamId);
    for (let i = 0; i < teams.length; i += 2) {
      if (i + 1 < teams.length) {
        const t1 = teams[i];
        const t2 = teams[i + 1];
        if (this.state.rng.next() < 0.5) {
          this.standings[t1].wins += 1;
          this.standings[t2].losses += 1;
        } else {
          this.standings[t2].wins += 1;
          this.standings[t1].losses += 1;
        }
      }
    }
  }

  /**
   * 初始化季後賽 (前 4 名晉級四強 BO5)
   */
  _initPlayoffs() {
    const sorted = this.getSortedStandings();
    const top4 = sorted.slice(0, 4);
    const playerTeamId = this.state.player.currentTeamId;
    const playerQualified = top4.some(t => t.teamId === playerTeamId);

    this.playoffsBracket = {
      top4,
      playerQualified,
      semiFinalPlayed: false,
      finalPlayed: false,
      champion: null,
      playerRank: playerQualified ? null : '未進季後賽',
    };
  }

  /**
   * 模擬季後賽 (BO5)
   */
  simulatePlayoffs() {
    if (!this.playoffsBracket) return null;
    const { top4, playerQualified } = this.playoffsBracket;
    const player = this.state.player;
    const rng = this.state.rng;

    let championTeamId = null;

    if (playerQualified) {
      // 玩家參與季後賽判定
      const playerWinSemi = rng.next() < (player.getOverallRating() / 110);
      if (playerWinSemi) {
        const playerWinFinal = rng.next() < (player.getOverallRating() / 115);
        if (playerWinFinal) {
          championTeamId = player.currentTeamId;
          this.playoffsBracket.playerRank = '冠軍 (Champion)';
          player.careerStats.titlesWon += 1;
          player.popularity += 25;
          player.money += 100000;
        } else {
          championTeamId = top4.find(t => t.teamId !== player.currentTeamId).teamId;
          this.playoffsBracket.playerRank = '亞軍 (Runner-Up)';
          player.popularity += 15;
          player.money += 50000;
        }
      } else {
        championTeamId = top4.find(t => t.teamId !== player.currentTeamId).teamId;
        this.playoffsBracket.playerRank = '四強 (Semi-Finalist)';
        player.popularity += 8;
      }
    } else {
      championTeamId = top4[0].teamId;
      this.playoffsBracket.playerRank = '常規賽止步';
    }

    this.playoffsBracket.champion = championTeamId;
    this.stage = 'INTERNATIONAL';

    return {
      playoffsResult: this.playoffsBracket,
      champion: getTeamById(championTeamId),
    };
  }

  /**
   * 國際賽判定與模擬 (First Stand, MSI, Worlds)
   */
  simulateInternational() {
    const split = SPLITS[this.currentSplitKey];
    const tourneyInfo = INTERNATIONAL_TOURNAMENTS[split.qualifiesFor];
    const player = this.state.player;
    const rng = this.state.rng;

    // 檢查玩家是否取得出賽資格 (冠軍或亞軍)
    const rank = this.playoffsBracket?.playerRank || '';
    const qualified = rank.includes('冠軍') || rank.includes('亞軍');

    let internationalLog = '';
    let wonInternational = false;

    if (qualified) {
      const worldRating = player.getOverallRating();
      const runRoll = rng.range(1, 100);

      if (runRoll > 85 && worldRating >= 75) {
        wonInternational = true;
        player.careerStats.internationalTitles += 1;
        if (tourneyInfo.id === 'WORLDS') {
          player.careerStats.worldsTitles += 1;
          player.popularity += 60;
          player.money += 500000;
          internationalLog = `【🏆 登頂世界之巔！】你在 ${tourneyInfo.name} 總決賽上演極限發揮，率隊以 3:2 斬落 LCK 豪門！榮獲召喚師獎盃與 FMVP！`;
        } else {
          player.popularity += 35;
          player.money += 200000;
          internationalLog = `【🏆 國際賽奪冠！】你在 ${tourneyInfo.name} 橫掃群雄奪得冠軍！為賽區贏得最高榮耀！`;
        }
      } else if (runRoll > 50) {
        player.popularity += 15;
        internationalLog = `【${tourneyInfo.shortName} 四強】在半決賽與頂級強隊鏖戰五局惜敗，收穫寶貴的世界賽經驗。`;
      } else {
        internationalLog = `【${tourneyInfo.shortName} 小組賽】面對世界各賽區強隊，遺憾未能突圍小組賽。`;
      }
    } else {
      internationalLog = `未能取得本次 ${tourneyInfo.name} 出戰資格，在基地進行觀賽復盤與自主特訓。`;
    }

    this.stage = 'SETTLEMENT';
    return {
      tournament: tourneyInfo,
      qualified,
      wonInternational,
      internationalLog,
    };
  }

  /**
   * 賽季結算
   */
  settleSplit() {
    const player = this.state.player;
    // 增加疲勞與身價重算
    player.fatigue = Math.min(100, player.fatigue + 15);
    player.stress = Math.max(0, player.stress - 10);
    
    // 合約年減一 (每年第三個 Split 結算時)
    if (this.currentSplitKey === 'SPLIT_3') {
      if (player.contractYears > 0) {
        player.contractYears -= 1;
      }
    }

    return {
      split: SPLITS[this.currentSplitKey],
      isYearEnd: this.currentSplitKey === 'SPLIT_3',
    };
  }
}
