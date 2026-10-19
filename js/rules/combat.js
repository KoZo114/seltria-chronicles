// 部隊どうしの戦闘の計算（ダメージ、ミス、反撃、攻撃前の見込み）。画面には触れない。
// 部隊の体力（unit.hp）は「兵士1人あたりの体力 × 人数」の合計で持つ。
// ダメージは先頭の兵士から受けるので、残りの人数は「体力 ÷ 1人あたりの体力」の切り上げになる
// （倒れきらなかった分は「けが」として残り、けが人も1人と数える）。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var OUTLOOK_MARGIN = 0.15;   // 見込みの「有利」「不利」を分ける差

  function getMaxHp(typeId) {
    var type = SC.UNIT_TYPES[typeId];
    return type.size * type.soldierHp;
  }

  function countSoldiers(typeId, hp) {
    return Math.max(0, Math.ceil(hp / SC.UNIT_TYPES[typeId].soldierHp));
  }

  function getSoldierCount(unit) { return countSoldiers(unit.type, unit.hp); }

  // 守る側が地形の守りを受けるか（飛ぶ部隊・地形無視の部隊は受けない）
  function getsTerrainDefense(defender) {
    var moveType = SC.MOVE_TYPES[SC.UNIT_TYPES[defender.type].moveType];
    return !(moveType && moveType.ignoresTerrainDefense);
  }

  // 相性と身のこなしを使うステージか（ステージ8から。stages.js の rules.affinity）
  function usesAffinity(state) { return !!(state.rules && state.rules.affinity); }

  function getFamily(typeId) { return SC.FAMILIES[SC.UNIT_TYPES[typeId].family] || null; }

  // 攻める側が、守る側を得意としているか（相性のあるステージだけ）
  function hasAffinity(state, attackerTypeId, defenderTypeId) {
    if (!usesAffinity(state)) return false;
    var family = getFamily(attackerTypeId);
    return !!family && family.strongAgainst.indexOf(SC.UNIT_TYPES[defenderTypeId].family) >= 0;
  }

  // 兵士1人ごとのミスの確率。相性のあるステージでは、攻撃される側の身のこなしで変わる
  function getMissPercent(state, defender) {
    if (!usesAffinity(state)) return SC.COMBAT.missPercent;
    var family = getFamily(defender.type);
    var agility = family && SC.AGILITY[family.agility];
    return agility ? agility.missPercent : SC.COMBAT.missPercent;
  }

  // 兵士1人の打撃の内訳（攻撃前の見込みの表に出す）。
  //  attack：攻撃する側の1人の攻撃力（相性があれば、相性の分を足した値）
  //  affinity：相性で足した値（無ければ0）
  //  defense：守る側の防御の合計（部隊の防御力 ＋ 地形の守り。相性を入れるときもここに足す）
  //  hit：1人の打撃のダメージ（攻撃 − 防御、最低1）
  //  castlePercent：城にいる王の、合計ダメージを減らす割合（無ければ0）
  function getHitBreakdown(state, attacker, defender, defenderPos) {
    var terrain = SC.Board.getTerrain(state, defenderPos.x, defenderPos.y);
    var defenderType = SC.UNIT_TYPES[defender.type];
    var terrainId = state.terrain[defenderPos.y][defenderPos.x];
    var terrainDefense = getsTerrainDefense(defender) ? terrain.defense + ((defenderType.terrainDefenseBonus || {})[terrainId] || 0) : 0;
    var affinity = hasAffinity(state, attacker.type, defender.type) ? SC.COMBAT.affinityBonus : 0;
    // その部隊だけの得意（エルフは飛行にさらに+1）。相性のあるステージだけ、相性の分にまとめて出す
    var extra = usesAffinity(state) ? ((SC.UNIT_TYPES[attacker.type].bonusAgainst || {})[defenderType.family] || 0) : 0;
    affinity += extra;
    var attack = SC.UNIT_TYPES[attacker.type].attack + affinity;
    var defense = SC.UNIT_TYPES[defender.type].defense + terrainDefense;
    // 空からの攻撃に弱い部隊（ジェネラル）は、飛行の系統から攻められると防御が下がる
    if (defenderType.defenseVsFlying && SC.UNIT_TYPES[attacker.type].family === 'flying') defense = Math.max(0, defense - defenderType.defenseVsFlying);
    return {
      attack: attack,
      affinity: affinity,
      defense: defense,
      hit: Math.max(1, attack - defense),
      castlePercent: SC.UNIT_TYPES[defender.type].isKing ? terrain.kingDamageReductionPercent : 0
    };
  }

  // 兵士1人の打撃のダメージ
  function calculateHitDamage(state, attacker, defender, defenderPos) {
    return getHitBreakdown(state, attacker, defender, defenderPos).hit;
  }

  // hits 人の打撃が当たったときの合計ダメージ。城にいる王は合計から減らす。端数は最後に1回だけ四捨五入する。
  function calculateDamage(state, attacker, defender, defenderPos, hits) {
    if (hits <= 0) return 0;
    var terrain = SC.Board.getTerrain(state, defenderPos.x, defenderPos.y);
    var reductionPercent = SC.UNIT_TYPES[defender.type].isKing ? terrain.kingDamageReductionPercent : 0;
    var total = hits * calculateHitDamage(state, attacker, defender, defenderPos);
    return Math.max(1, Math.round((total * (100 - reductionPercent)) / 100));
  }

  // 1回の一斉攻撃の結果を計算する（状態は変えない）。defenderHp は攻撃を受ける前の体力
  function calculateVolley(state, attacker, defender, defenderPos, defenderHp, hits) {
    var damage = calculateDamage(state, attacker, defender, defenderPos, hits);
    var hpAfter = Math.max(0, defenderHp - damage);
    var soldiersBefore = countSoldiers(defender.type, defenderHp);
    var soldiersAfter = countSoldiers(defender.type, hpAfter);
    return {
      damage: damage,
      defenderHp: hpAfter,
      soldiersBefore: soldiersBefore,
      soldiersAfter: soldiersAfter,
      lost: soldiersBefore - soldiersAfter,
      killed: hpAfter === 0
    };
  }

  // 攻撃と反撃の1往復を、ミスの人数を決めて計算する（状態は変えない）
  // 構えている部隊が、隣から攻められたか（そのときは、構えている側が先に攻撃する）
  function strikesFirst(defender, attackerPos) {
    return !!defender.braced && SC.Board.distance(defender, attackerPos) === 1 &&
      SC.Movement.canCounter(defender, attackerPos);
  }

  // 攻撃と反撃の1往復を、ミスの人数を決めて計算する（状態は変えない）。
  // 相手が構えていれば、相手の攻撃（counter）が先で、そのあと攻撃する側の生き残りが攻撃する
  function calculateExchange(state, attacker, attackerPos, defender, attackMisses) {
    var attackerSoldiers = getSoldierCount(attacker);
    var attack, counter = null;
    if (strikesFirst(defender, attackerPos)) {
      counter = calculateVolley(state, defender, attacker, attackerPos, attacker.hp, getSoldierCount(defender));
      attack = calculateVolley(state, attacker, defender, defender, defender.hp, Math.max(0, counter.soldiersAfter - attackMisses));
      return { attack: attack, counter: counter, defenderFirst: true };
    }
    attack = calculateVolley(state, attacker, defender, defender, defender.hp, attackerSoldiers - attackMisses);
    if (!attack.killed && SC.Movement.canCounter(defender, attackerPos)) {   // 守る側の攻撃の形（騎士は向き）で届くときだけ反撃する
      counter = calculateVolley(state, defender, attacker, attackerPos, attacker.hp, attack.soldiersAfter);
    }
    return { attack: attack, counter: counter, defenderFirst: false };
  }

  // 有利・互角・不利の見込み
  function judgeOutlook(attacker, defender, exchange) {
    if (exchange.defenderFirst && exchange.counter.killed) return 'disadvantage';
    if (exchange.attack.killed) return 'advantage';
    if (exchange.counter && exchange.counter.killed) return 'disadvantage';
    var dealt = Math.min(1, exchange.attack.damage / defender.hp);
    var taken = exchange.counter ? Math.min(1, exchange.counter.damage / attacker.hp) : 0;
    if (dealt - taken >= OUTLOOK_MARGIN) return 'advantage';
    if (dealt - taken <= -OUTLOOK_MARGIN) return 'disadvantage';
    return 'even';
  }

  // 攻撃前の見込み（全員が当たった場合）。attackerPos は「移動後に立つ予定のマス」。
  //  damage・targetSoldiersBefore→targetSoldiersAfter・kills：与えるダメージと、相手の人数の変化
  //  canKill：相手を全滅させられるか
  //  counter：反撃の見込み（届かない・相手が全滅するときは null）
  //  outlook：'advantage'（有利）／'even'（互角）／'disadvantage'（不利）
  //  oneMiss：1人ミスすると人数の結果が変わる場合の結果（変わらなければ null）
  function getForecast(state, attacker, attackerPos, defender) {
    var soldiers = getSoldierCount(attacker);
    var exchange = calculateExchange(state, attacker, attackerPos, defender, 0);

    function summarizeCounter(counter) {
      if (!counter) return null;
      return {
        damage: counter.damage,
        soldiersBefore: counter.soldiersBefore,
        soldiersAfter: counter.soldiersAfter,
        losses: counter.lost,
        wipesOut: counter.killed
      };
    }

    var oneMiss = null;
    if (soldiers >= 1) {
      var missed = calculateExchange(state, attacker, attackerPos, defender, 1);
      var missedLosses = missed.counter ? missed.counter.lost : 0;
      var losses = exchange.counter ? exchange.counter.lost : 0;
      if (missed.attack.lost !== exchange.attack.lost || missedLosses !== losses) {
        oneMiss = {
          kills: missed.attack.lost,
          targetSoldiersAfter: missed.attack.soldiersAfter,
          canKill: missed.attack.killed,
          counter: summarizeCounter(missed.counter)
        };
      }
    }

    var counterInRange = SC.Movement.canCounter(defender, attackerPos);
    return {
      soldiers: soldiers,
      defenderStrikesFirst: exchange.defenderFirst,   // 相手が構えていて、相手が先に攻撃する
      breakdown: getHitBreakdown(state, attacker, defender, defender),
      counterBreakdown: counterInRange ? getHitBreakdown(state, defender, attacker, attackerPos) : null,
      damage: exchange.attack.damage,
      targetSoldiersBefore: exchange.attack.soldiersBefore,
      targetSoldiersAfter: exchange.attack.soldiersAfter,
      kills: exchange.attack.lost,
      canKill: exchange.attack.killed,
      counter: summarizeCounter(exchange.counter),
      outlook: judgeOutlook(attacker, defender, exchange),
      oneMiss: oneMiss,
      missPercent: getMissPercent(state, defender)
    };
  }

  // 生き残った兵士全員が1回ずつ攻撃する。兵士ごとにミスの判定をする
  function strike(state, attacker, defender, isCounter) {
    var soldiers = getSoldierCount(attacker);
    var missPercent = getMissPercent(state, defender);
    var missIndexes = [];   // 外した兵士の番号（0 が1人目）
    for (var i = 0; i < soldiers; i++) {
      if (state.rng() * 100 < missPercent) missIndexes.push(i);
    }
    var misses = missIndexes.length;
    var volley = calculateVolley(state, attacker, defender, defender, defender.hp, soldiers - misses);
    defender.hp = volley.defenderHp;
    return {
      type: 'strike',
      attackerId: attacker.id,
      defenderId: defender.id,
      soldiers: soldiers,
      hits: soldiers - misses,
      misses: misses,
      missIndexes: missIndexes,
      result: misses === soldiers ? 'miss' : 'hit',   // 'miss' は全員が外したとき
      damage: volley.damage,
      defenderHp: volley.defenderHp,
      defenderSoldiers: volley.soldiersAfter,
      lost: volley.lost,
      killed: volley.killed,
      isCounter: isCounter
    };
  }

  // 攻撃と反撃を実行し、起きたことの一覧を返す。全滅した部隊の取り除きは呼び出し側で行う。
  // 相手が構えていて隣から攻めたときは、相手が先に攻撃し（isBraced）、そのあと生き残りで攻撃する
  function resolveAttack(state, attacker, defender) {
    if (strikesFirst(defender, attacker)) {
      var braced = strike(state, defender, attacker, false);
      braced.isBraced = true;
      var events = [braced];
      if (attacker.hp > 0) events.push(strike(state, attacker, defender, false));
      return events;
    }
    var normal = [strike(state, attacker, defender, false)];
    if (defender.hp > 0 && SC.Movement.canCounter(defender, attacker)) {
      normal.push(strike(state, defender, attacker, true));
    }
    return normal;
  }

  SC.Combat = {
    getMaxHp: getMaxHp,
    countSoldiers: countSoldiers,
    getSoldierCount: getSoldierCount,
    getHitBreakdown: getHitBreakdown,
    calculateHitDamage: calculateHitDamage,
    calculateDamage: calculateDamage,
    getForecast: getForecast,
    hasAffinity: hasAffinity,
    getMissPercent: getMissPercent,
    resolveAttack: resolveAttack
  };
})(typeof window !== 'undefined' ? window : globalThis);
