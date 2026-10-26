/* ---------- 休閒四款的發幣規則（伺服器用，測試直接引入） ----------
   方塊爆破／倒水分類共用一套：
   每天第一次結束時依成績發幣，之後可以繼續玩，但不再發。成績由前端回報
  （跟原本的 2048、打地鼠一樣），伺服器只檢查合理範圍、確保一天只領一次。
   每款 8–30 🦴，跟被取代的舊遊戲（每款 8–35）同一個量級。
   門檻是第一版估的，大家玩過之後要依實際分數分布再調。 */
export const ARCADE = {
  blast: { name: "方塊爆破", unit: "分", max: 200000, tiers: [[1500, 30], [900, 24], [500, 18], [200, 12], [0, 8]] },
  water: { name: "倒水分類", unit: "關", max: 500, tiers: [[8, 30], [6, 24], [4, 18], [2, 12], [0, 8]] },
};

export function validArcadeScore(id, score) {
  const g = ARCADE[id];
  return !!g && Number.isInteger(score) && score >= 0 && score <= g.max;
}

export function arcadeCoins(id, score) {
  const g = ARCADE[id];
  if (!g) return 0;
  for (const [min, coins] of g.tiers) if (score >= min) return coins;
  return 0;
}

/* 一次結算：回傳要發的幣與新的當日紀錄。prev 是 games.arcade[id]。 */
export function settleArcade(id, score, prev, today) {
  const already = !!(prev && prev.date === today);
  const coins = already ? 0 : arcadeCoins(id, score);
  const rec = {
    date: today,
    best: Math.max(score, already ? (prev.best || 0) : 0),
    coins: already ? (prev.coins || 0) : coins,
  };
  return { coins, already, rec };
}
