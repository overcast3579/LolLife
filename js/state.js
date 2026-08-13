/**
 * LoLLife - 全域遊戲狀態管理 (Game State & Persistence)
 * 支援本機 LocalStorage 儲存、讀取、重置以及 Base64/JSON 匯出與匯入
 */

import { RNG } from './rng.js';
import { Player, createNewPlayer } from './player.js';
import { ChampionPoolManager } from './champions.js';
import { CareerManager } from './career.js';
import { SeasonEngine } from './season.js';
import { EventsEngine } from './eventsEngine.js';

export const SAVE_KEY = 'LoLLife_SaveData_v1';

export class GameState {
  constructor(seed = null) {
    this.seed = seed || `SEED_${Date.now()}`;
    this.rng = new RNG(this.seed);
    this.player = null;
    this.championPool = new ChampionPoolManager();
    this.career = null;
    this.season = null;
    this.events = null;

    // 遊戲流程狀態:
    // 'CREATION' -> 'AMATEUR' -> 'PRO_SEASON' -> 'TRANSFER' -> 'RETIRED'
    this.gamePhase = 'CREATION';
    this.logs = [];
  }

  /**
   * 建立新生涯
   */
  startNewCareer(options = {}) {
    this.seed = options.seed || `LoL_${Date.now()}`;
    this.rng = new RNG(this.seed);
    
    this.player = createNewPlayer(this.rng, options);
    this.championPool = new ChampionPoolManager();
    this.championPool.initPlayerPool(this.rng, this.player.role);

    this.career = new CareerManager(this);
    this.season = new SeasonEngine(this);
    this.events = new EventsEngine(this);

    this.gamePhase = 'AMATEUR';
    this.logs = [`【生涯啟程】${this.player.name} (${this.player.inGameId}) 以 16 歲之齡在召喚峽谷展露鋒芒，立志成為職業電競傳奇！`];

    this.saveToStorage();
    return this;
  }

  /**
   * 新增遊戲紀錄日誌
   */
  addLog(msg) {
    this.logs.unshift(`[${this.player?.currentYear || 2026}年 ${this.player?.age || 16}歲] ${msg}`);
    if (this.logs.length > 100) this.logs.pop();
  }

  /**
   * 序列化為 JSON
   */
  toJSON() {
    return {
      seed: this.seed,
      rngState: this.rng.serialize(),
      player: this.player?.serialize(),
      championPool: this.championPool?.serialize(),
      gamePhase: this.gamePhase,
      logs: this.logs,
      amateurStageIndex: this.career?.amateurStageIndex || 0,
      seasonState: this.season ? {
        currentSplitKey: this.season.currentSplitKey,
        stage: this.season.stage,
        standings: this.season.standings,
        currentMatchIndex: this.season.currentMatchIndex,
      } : null,
    };
  }

  /**
   * 從物件還原遊戲狀態
   */
  fromJSON(data) {
    if (!data) return false;
    this.seed = data.seed;
    this.rng = new RNG(this.seed);
    if (data.rngState) this.rng.deserialize(data.rngState);

    this.player = new Player(data.player);
    this.championPool = new ChampionPoolManager(data.championPool);

    this.career = new CareerManager(this);
    if (data.amateurStageIndex !== undefined) {
      this.career.amateurStageIndex = data.amateurStageIndex;
    }

    this.season = new SeasonEngine(this);
    if (data.seasonState) {
      this.season.currentSplitKey = data.seasonState.currentSplitKey || 'SPLIT_1';
      this.season.stage = data.seasonState.stage || 'PRE_SEASON';
      this.season.standings = data.seasonState.standings || {};
      this.season.currentMatchIndex = data.seasonState.currentMatchIndex || 0;
    }

    this.events = new EventsEngine(this);
    this.gamePhase = data.gamePhase || 'AMATEUR';
    this.logs = data.logs || [];

    return true;
  }

  /**
   * 儲存至瀏覽器 LocalStorage
   */
  saveToStorage() {
    try {
      const dataStr = JSON.stringify(this.toJSON());
      localStorage.setItem(SAVE_KEY, dataStr);
      return true;
    } catch (e) {
      console.error('儲存進度失敗:', e);
      return false;
    }
  }

  /**
   * 從 LocalStorage 載入進度
   */
  loadFromStorage() {
    try {
      const dataStr = localStorage.getItem(SAVE_KEY);
      if (!dataStr) return false;
      const data = JSON.parse(dataStr);
      return this.fromJSON(data);
    } catch (e) {
      console.error('載入進度失敗:', e);
      return false;
    }
  }

  /**
   * 匯出存檔字串 (Base64)
   */
  exportSaveString() {
    const json = JSON.stringify(this.toJSON());
    return btoa(unescape(encodeURIComponent(json)));
  }

  /**
   * 匯入存檔字串
   */
  importSaveString(saveString) {
    try {
      const json = decodeURIComponent(escape(atob(saveString.trim())));
      const data = JSON.parse(json);
      const ok = this.fromJSON(data);
      if (ok) this.saveToStorage();
      return ok;
    } catch (e) {
      console.error('匯入存檔失敗:', e);
      return false;
    }
  }

  /**
   * 清除存檔
   */
  clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}
