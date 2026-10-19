// 回復役（僧侶）の「祈り」の計算。画面には触れない。
// 祈ると、上下左右に隣り合う味方の部隊の、倒れた兵士を戦線に戻す。運の要素はない。
(function (root) {
  var SC = (root.SC = root.SC || {});

  function getPrayer(typeId) { return SC.UNIT_TYPES[typeId].prayer || null; }

  function canPray(unit) { return !!getPrayer(unit.type); }

  // 戻せる人数。position は祈るときに立っているマス。いまの位置から動いていれば「移動してから祈る」
  // ally（祈る相手）が3人隊なら、heavyAmount 人（動いても同じ）
  function getPrayerAmount(cleric, position, ally) {
    var prayer = getPrayer(cleric.type);
    if (!prayer) return 0;
    if (ally && SC.UNIT_TYPES[ally.type].size < 6) return prayer.heavyAmount || 0;
    var moved = position.x !== cleric.x || position.y !== cleric.y;
    return Math.ceil(SC.Combat.getSoldierCount(cleric) / (moved ? prayer.movedDivisor : prayer.stillDivisor));
  }

  // 祈りを受けられる味方か：隣にいる・自分ではない・回復できる規模・倒れた兵士がいる
  function isPrayerTarget(state, cleric, position, ally) {
    var prayer = getPrayer(cleric.type);
    if (!prayer || !ally || ally.id === cleric.id || ally.side !== cleric.side) return false;
    var allyType = SC.UNIT_TYPES[ally.type];
    if (prayer.targetSizes.indexOf(allyType.size) === -1) return false;
    if (allyType.noRestore || allyType.isKing) return false;   // 召喚で出た部隊（スケルトン・ゴーレム）と王は、祈りで戻らない
    if (SC.Combat.getSoldierCount(ally) >= allyType.size) return false;
    return SC.Board.distance(position, ally) === 1;
  }

  function getPrayerTargets(state, cleric, position) {
    return SC.Game.getUnits(state, cleric.side).filter(function (ally) {
      return isPrayerTarget(state, cleric, position, ally);
    });
  }

  // 祈ったときの見込み（状態は変えない）。回復する体力 ＝ 戻す人数 × 相手の1人あたりの体力（最大まで）
  function getPrayerForecast(state, cleric, position, ally) {
    var amount = getPrayerAmount(cleric, position, ally);
    var hpAfter = Math.min(SC.Combat.getMaxHp(ally.type), ally.hp + amount * SC.UNIT_TYPES[ally.type].soldierHp);
    var soldiersBefore = SC.Combat.getSoldierCount(ally);
    var soldiersAfter = SC.Combat.countSoldiers(ally.type, hpAfter);
    return {
      amount: amount,
      moved: position.x !== cleric.x || position.y !== cleric.y,
      hpAfter: hpAfter,
      soldiersBefore: soldiersBefore,
      soldiersAfter: soldiersAfter,
      restored: soldiersAfter - soldiersBefore
    };
  }

  SC.Prayer = {
    canPray: canPray,
    getPrayerAmount: getPrayerAmount,
    isPrayerTarget: isPrayerTarget,
    getPrayerTargets: getPrayerTargets,
    getPrayerForecast: getPrayerForecast
  };
})(typeof window !== 'undefined' ? window : globalThis);
