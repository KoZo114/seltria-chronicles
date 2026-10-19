// 正規部隊の記録、経験値、ランクアップ。画面には触れない。
// 記録（roster）は保存データに持つ：[{ id, name, type, exp }]。戦いの中の部隊は regularId で記録とつながる。
(function (root) {
  var SC = (root.SC = root.SC || {});

  // 記録に、そのステージまでに加わる隊長がいなければ足す（はじめは、はじめのクラス・経験値0）。記録を返す
  function ensureRoster(roster, stageId) {
    roster = roster || [];
    SC.REGULARS.forEach(function (regular) {
      if (regular.joinStage > stageId) return;
      if (roster.some(function (member) { return member.id === regular.id; })) return;
      roster.push({ id: regular.id, name: regular.name, type: regular.path[0], exp: 0 });
    });
    return roster;
  }

  // そのステージで出撃できる隊長（加わっていて、クラスがゲームにあるもの）
  function getAvailable(roster, stageId) {
    var joined = {};
    SC.REGULARS.forEach(function (regular) { if (regular.joinStage <= stageId) joined[regular.id] = true; });
    return (roster || []).filter(function (member) { return joined[member.id] && SC.UNIT_TYPES[member.type]; });
  }

  // 隊長の育つ道で、今のクラスの次の段（無ければ null）：{ next, exp }
  function getNextRank(regularId, typeId) {
    var regular = SC.REGULARS.filter(function (r) { return r.id === regularId; })[0];
    if (!regular) return null;
    var index = regular.path.indexOf(typeId);
    if (index < 0 || index >= regular.path.length - 1) return null;
    return { next: regular.path[index + 1], exp: regular.pathExp[index] };
  }

  // 満タンまでの経験値（もう上がらなければ null）
  function getThreshold(regularId, typeId) {
    var rank = getNextRank(regularId, typeId);
    return rank ? rank.exp : null;
  }

  // 今ランクアップできるか（満タンで、次のクラスがゲームにある）
  function canRankUp(regularId, typeId, exp) {
    var rank = getNextRank(regularId, typeId);
    return !!rank && exp >= rank.exp && !!SC.UNIT_TYPES[rank.next];
  }

  // 倒した兵士から、もらえる経験値
  function getExperience(defenderTypeId, lost, killed) {
    var per = SC.UNIT_TYPES[defenderTypeId].size <= 3 ? SC.EXPERIENCE.perHeavySoldier : SC.EXPERIENCE.perSoldier;
    return lost * per + (killed ? SC.EXPERIENCE.wipeBonus : 0);
  }

  // ランクアップ：クラスを1つ上げる。人数はそのまま（けがは治る）。満タンの分の経験値を使う
  function rankUp(unit) {
    var rank = getNextRank(unit.regularId, unit.type);
    var soldiers = SC.Combat.getSoldierCount(unit);
    var from = unit.type;
    unit.type = rank.next;
    unit.hp = Math.min(SC.Combat.getMaxHp(unit.type), soldiers * SC.UNIT_TYPES[unit.type].soldierHp);
    unit.exp -= rank.exp;
    return { type: 'rankUp', unitId: unit.id, regularId: unit.regularId, name: unit.name, from: from, to: unit.type };
  }

  // 攻撃の出来事（strike）から、正規部隊に経験値を入れ、満タンならランクアップする。起きたこと（exp・rankUp）を返す。
  // 経験値が入るのは state.experience のときだけ（クリアしたステージの遊び直しでは入らない）
  function gainFromStrikes(state, strikes) {
    if (!state.experience) return [];
    var events = [];
    strikes.forEach(function (strike) {
      if (strike.type !== 'strike' || strike.lost <= 0 && !strike.killed) return;
      var attacker = SC.Board.getUnitById(state, strike.attackerId);
      var defender = SC.Board.getUnitById(state, strike.defenderId);
      if (!attacker || !attacker.regularId || !defender) return;
      var gained = getExperience(defender.type, strike.lost, strike.killed);
      attacker.exp = (attacker.exp || 0) + gained;
      events.push({ type: 'exp', unitId: attacker.id, amount: gained, exp: attacker.exp });
    });
    // ランクアップは、戦いが終わって生き残っていればする
    state.units.forEach(function (unit) {
      if (unit.regularId && unit.hp > 0 && canRankUp(unit.regularId, unit.type, unit.exp || 0)) events.push(rankUp(unit));
    });
    return events;
  }

  // 祈り：回復役の正規部隊は、戻した兵士1人につき perPrayedSoldier 点（回復役は敵をほとんど倒さないので、祈りで育つようにする）
  function gainFromPrayer(state, unit, restored) {
    if (!state.experience || !unit.regularId || restored <= 0) return [];
    var gained = restored * SC.EXPERIENCE.perPrayedSoldier;
    unit.exp = (unit.exp || 0) + gained;
    var events = [{ type: 'exp', unitId: unit.id, amount: gained, exp: unit.exp }];
    if (canRankUp(unit.regularId, unit.type, unit.exp)) events.push(rankUp(unit));
    return events;
  }

  // 正規部隊を戦いに出すときの部隊（stage.regularSlots のマスに置く）
  function createUnit(member, slot, id) {
    return {
      id: id, type: member.type, side: 'player', x: slot.x, y: slot.y,
      hp: SC.Combat.getMaxHp(member.type), role: null, braced: false, acted: false, facing: 'up',
      regularId: member.id, name: member.name, exp: member.exp || 0
    };
  }

  // 勝ったときに、戦いの結果を記録に書き戻す。全滅した正規部隊は撤退して、経験値が半分になる
  function writeBack(roster, state) {
    (state.deployed || []).forEach(function (regularId) {
      var member = roster.filter(function (m) { return m.id === regularId; })[0];
      if (!member) return;
      var unit = state.units.filter(function (u) { return u.regularId === regularId; })[0];
      if (unit) {
        member.type = unit.type;
        member.exp = unit.exp || 0;
        return;
      }
      var fallen = (state.fallenRegulars || {})[regularId];
      if (fallen) {
        member.type = fallen.type;
        member.exp = Math.floor((fallen.exp || 0) / 2);
      }
    });
    return roster;
  }

  SC.Regulars = {
    ensureRoster: ensureRoster,
    getAvailable: getAvailable,
    getNextRank: getNextRank,
    getThreshold: getThreshold,
    canRankUp: canRankUp,
    getExperience: getExperience,
    gainFromStrikes: gainFromStrikes,
    gainFromPrayer: gainFromPrayer,
    rankUpUnit: rankUp,
    createUnit: createUnit,
    writeBack: writeBack
  };
})(typeof window !== 'undefined' ? window : globalThis);
