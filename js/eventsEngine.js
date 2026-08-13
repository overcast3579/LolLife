/**
 * LoLLife - 事件觸發與決策判定引擎 (Events Engine)
 * 負責事件調度、決策回饋、屬性套用與特質自動解鎖判定
 */

import { EVENTS, getRandomEvent } from '../data/events.js';
import { getTraitById } from '../data/traits.js';

export class EventsEngine {
  constructor(state) {
    this.state = state;
  }

  /**
   * 觸發一個符合當前選手狀態與年齡的事件
   */
  triggerRandomEvent(category = null) {
    const player = this.state.player;
    const rng = this.state.rng;
    const event = getRandomEvent(rng, player.age, category);
    return event;
  }

  /**
   * 執行事件選擇並套用效果
   */
  resolveChoice(event, choiceIndex) {
    const choice = event.choices[choiceIndex];
    if (!choice) return null;

    const player = this.state.player;
    player.applyEffect(choice.effect);

    // 檢查特質解鎖
    const unlockedTraits = this._checkTraitUnlocks();

    return {
      event,
      choice,
      log: choice.effect.log || '你的選擇已產生影響。',
      unlockedTraits,
    };
  }

  /**
   * 依據生涯數據與數值檢查特質解鎖
   */
  _checkTraitUnlocks() {
    const player = this.state.player;
    const currentTraits = new Set(player.traits);
    const newlyUnlocked = [];

    // 1. 天梯怪物 (操作 >= 72 且 對線 >= 72)
    if (!currentTraits.has('LADDER_MONSTER') && player.stats.mechanics >= 72 && player.stats.laning >= 72) {
      player.traits.push('LADDER_MONSTER');
      newlyUnlocked.push(getTraitById('LADDER_MONSTER'));
    }

    // 2. 大賽型選手 (世界大賽冠軍 >= 1 或 國際賽奪冠 >= 2)
    if (!currentTraits.has('BIG_STAGE_HERO') && (player.careerStats.worldsTitles >= 1 || player.careerStats.internationalTitles >= 2)) {
      player.traits.push('BIG_STAGE_HERO');
      newlyUnlocked.push(getTraitById('BIG_STAGE_HERO'));
    }

    // 3. 英雄海 (英雄池能力 >= 72)
    if (!currentTraits.has('CHAMPION_OCEAN') && player.stats.championPool >= 72) {
      player.traits.push('CHAMPION_OCEAN');
      newlyUnlocked.push(getTraitById('CHAMPION_OCEAN'));
    }

    // 4. 鐵人意志 (年齡 >= 23 且 紀律 >= 70 且 手腕健康 >= 80)
    if (!currentTraits.has('IRON_MAN') && player.age >= 23 && player.stats.discipline >= 70 && player.wristHealth >= 80) {
      player.traits.push('IRON_MAN');
      newlyUnlocked.push(getTraitById('IRON_MAN'));
    }

    // 5. 實況主心態 (人氣 >= 80)
    if (!currentTraits.has('STREAMER_MINDSET') && player.popularity >= 80) {
      player.traits.push('STREAMER_MINDSET');
      newlyUnlocked.push(getTraitById('STREAMER_MINDSET'));
    }

    // 6. 玻璃手腕 (手腕健康 <= 35)
    if (!currentTraits.has('GLASS_WRIST') && player.wristHealth <= 35) {
      player.traits.push('GLASS_WRIST');
      newlyUnlocked.push(getTraitById('GLASS_WRIST'));
    }

    return newlyUnlocked;
  }
}
