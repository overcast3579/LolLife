/**
 * LoLLife - 種子亂數生成引擎 (Mulberry32)
 * 確保相同種子與相同決策序列 100% 產生完全一致的模擬結果
 */

export class RNG {
  constructor(seed) {
    this.initialSeed = seed;
    this.state = this._hashSeed(seed);
  }

  _hashSeed(seed) {
    if (typeof seed === 'number') {
      return (seed | 0) || 123456789;
    }
    const str = String(seed || 'LoLLife_2026');
    let hash = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }

  /**
   * 生成 0 <= x < 1 的偽隨機浮點數
   */
  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * 生成 min <= x <= max 的整數 (包含兩端)
   */
  range(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * 生成常態分佈數值 (Box-Muller 轉換)
   */
  gaussian(mean = 0, stdDev = 1) {
    const u1 = Math.max(1e-7, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  /**
   * 從陣列中隨機挑選一個元素
   */
  choice(array) {
    if (!array || array.length === 0) return null;
    return array[this.range(0, array.length - 1)];
  }

  /**
   * 依權重隨機挑選
   * items: [{ item: any, weight: number }]
   */
  weightedChoice(items) {
    if (!items || items.length === 0) return null;
    const totalWeight = items.reduce((sum, i) => sum + (i.weight || 1), 0);
    let rand = this.next() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      if (rand < items[i].weight) {
        return items[i].item;
      }
      rand -= items[i].weight;
    }
    return items[items.length - 1].item;
  }

  /**
   * 序列化當前狀態
   */
  serialize() {
    return {
      initialSeed: this.initialSeed,
      state: this.state,
    };
  }

  /**
   * 還原狀態
   */
  deserialize(saved) {
    if (saved) {
      this.initialSeed = saved.initialSeed;
      this.state = saved.state;
    }
  }
}
