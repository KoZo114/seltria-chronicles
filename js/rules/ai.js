// CPUの考え方。プレイヤーと同じルール（SC.Game.act）だけを使い、画面に見えている情報だけで判断する。
//  1. 攻撃できる組み合わせの中で、いちばん得なものを選ぶ（倒せる敵、敵の王を優先）
//  2. 攻撃できないユニットは、いちばん近い敵に近づく（弓兵は2マスの距離を保つ）
//  3. 自分の王の近くまで来た敵は、優先して迎え撃つ
//  4. 王は城から動かず、隣に来た敵だけを攻撃する。
//     ただし両軍とも王（と回復役）だけになったら、決着をつけるために城を出る
//  7. 町と軍資金のあるステージでは、王が城にいてお金があれば、ターンの始めに雇う（歩兵を多めに）。
//     攻撃できない歩兵は、敵より近くに自軍のものでない町があれば、その町を取りに行く
//  6. 守備兵（ステージのデータで role: 'guard' の部隊）は、決まったマスから動かない。得な攻撃が無ければ構えて待つ。
//     ただし、攻めに出る味方（王・回復役・守備兵のほか）がいなくなったら、守備兵も攻めに出る（決着がつかなくなるのを防ぐ）
//  5. 回復役（僧侶）は、兵士の減った味方に祈ることを優先する。自分からは攻めず（倒しきれる相手だけ攻撃する。戦える味方が残っていなければ攻撃にも加わる）、
//     味方のすぐ後ろについていく。敵のすぐ近くには立たないようにする
(function (root) {
  var SC = (root.SC = root.SC || {});
  var KING_GUARD_DISTANCE = 3;

  function isKing(unit) { return SC.UNIT_TYPES[unit.type].isKing; }

  function findKing(state, side) {
    return SC.Game.getUnits(state, side).filter(isKing)[0] || null;
  }

  function threatensKing(state, enemy, side) {
    var king = findKing(state, side);
    return !!king && !isKing(enemy) && SC.Board.distance(enemy, king) <= KING_GUARD_DISTANCE;
  }

  // 沼・藪の上で止まると、次のターンの始めにダメージを受けるので、その分を減点する（兵士何人分か × 0.8）
  function hazardPenalty(state, unit, destination) {
    var damage = SC.Game.getHazardDamage(state, unit, destination.x, destination.y);
    return damage > 0 ? (damage / SC.UNIT_TYPES[unit.type].soldierHp) * 0.8 + 0.3 : 0;
  }

  // 攻撃の得点。「倒せる兵士の人数」をもとに、倒しきれる相手・敵の王・自分の王に近づいた敵を高くする
  function scoreAttack(state, unit, destination, target) {
    var forecast = SC.Combat.getForecast(state, unit, destination, target);
    var targetIsKing = isKing(target);
    var dealt = forecast.damage / SC.UNIT_TYPES[target.type].soldierHp;
    var score = dealt;
    if (targetIsKing) score += dealt * 0.5;
    if (threatensKing(state, target, unit.side)) score += 1.5;
    if (forecast.canKill) {
      score += targetIsKing ? 1000 : 15;
    } else if (forecast.counter) {
      score -= (forecast.counter.damage / SC.UNIT_TYPES[unit.type].soldierHp) * 0.5;
      if (forecast.counter.wipesOut) score -= 10;
    }
    score += SC.Board.getTerrain(state, destination.x, destination.y).defense * 0.25 - hazardPenalty(state, unit, destination);
    return score;
  }

  function getDestinations(state, unit) {
    // 両軍とも、王と回復役しか残っていないなら、決着をつけるために王も城を出る
    var onlyKingsRemain = state.units.every(function (other) { return isKing(other) || isHealer(other); });
    if ((isKing(unit) || isHoldingGuard(state, unit)) && !onlyKingsRemain) return [{ x: unit.x, y: unit.y, cost: 0 }];
    return SC.Movement.getReachableTiles(state, unit);
  }

  function isHealer(unit) { return SC.Prayer.canPray(unit); }

  // 持ち場を守っている守備兵か（攻めに出る味方がまだいるあいだだけ、持ち場を守る）
  function isHoldingGuard(state, unit) {
    if (unit.role !== 'guard') return false;
    return SC.Game.getUnits(state, unit.side).some(function (ally) {
      return !isKing(ally) && !isHealer(ally) && ally.role !== 'guard';
    });
  }

  // 王と回復役のほかに、戦える味方が残っているか（いなければ、回復役も攻撃に加わる）
  function hasFighters(state, side) {
    return SC.Game.getUnits(state, side).some(function (unit) { return !isKing(unit) && !isHealer(unit); });
  }

  function nearestDistance(position, units) {
    return units.reduce(function (min, unit) { return Math.min(min, SC.Board.distance(position, unit)); }, Infinity);
  }

  function findBestAttack(state, units, enemies) {
    var best = null;
    units.forEach(function (unit) {
      getDestinations(state, unit).forEach(function (destination) {
        enemies.forEach(function (target) {
          if (!SC.Movement.isInAttackRange(unit.type, destination, target)) return;
          if (isHealer(unit) && hasFighters(state, unit.side) && !SC.Combat.getForecast(state, unit, destination, target).canKill) return;
          var score = scoreAttack(state, unit, destination, target) - destination.cost * 0.01;
          if (!best || score > best.score) {
            best = { unitId: unit.id, x: destination.x, y: destination.y, targetId: target.id, score: score };
          }
        });
      });
    });
    return best && best.score > 0 ? best : null;
  }

  // 祈りの得点：戻せる人数を重く見る。敵のすぐ近く（2マス以内）に立つ祈りは少し下げる
  function findBestPrayer(state, units, enemies) {
    var best = null;
    units.filter(isHealer).forEach(function (unit) {
      getDestinations(state, unit).forEach(function (destination) {
        SC.Prayer.getPrayerTargets(state, unit, destination).forEach(function (ally) {
          var forecast = SC.Prayer.getPrayerForecast(state, unit, destination, ally);
          if (forecast.restored <= 0) return;
          var score = forecast.restored * 2 - destination.cost * 0.01;
          if (nearestDistance(destination, enemies) <= 2) score -= 1.5;
          if (!best || score > best.score) {
            best = { unitId: unit.id, x: destination.x, y: destination.y, targetId: ally.id, kind: 'pray', score: score };
          }
        });
      });
    });
    return best;
  }

  // 回復役の移動：味方（王以外）のすぐ後ろにつく。兵士の減った味方の隣を優先し、敵の近くは避ける
  function findHealerMove(state, unit, enemies) {
    var allies = SC.Game.getUnits(state, unit.side).filter(function (ally) { return ally.id !== unit.id && !isKing(ally); });
    if (allies.length === 0) return { unitId: unit.id, x: unit.x, y: unit.y, targetId: null, score: 0 };
    var best = null;
    getDestinations(state, unit).forEach(function (destination) {
      var score = -nearestDistance(destination, allies);
      allies.forEach(function (ally) {
        var missing = SC.UNIT_TYPES[ally.type].size - SC.Combat.getSoldierCount(ally);
        if (SC.Board.distance(destination, ally) === 1) score += 0.5 + missing * 0.3;
      });
      var enemyDistance = nearestDistance(destination, enemies);
      if (enemyDistance <= 2) score -= (3 - enemyDistance) * 2;
      score += SC.Board.getTerrain(state, destination.x, destination.y).defense * 0.3 - destination.cost * 0.01 - hazardPenalty(state, unit, destination);
      if (!best || score > best.score) best = { unitId: unit.id, x: destination.x, y: destination.y, targetId: null, score: score };
    });
    return best;
  }

  // 地形をよけて歩いたときの道のり（ほかの部隊は気にしない）。target からの道のりを、マスごとに数えた表を返す。
  // 湖の向こうの相手に、湖をよけずに近づこうとして止まってしまうのを防ぐため
  function measureWalkingDistances(state, target, moveTypeId) {
    var distances = {};
    var open = [{ x: target.x, y: target.y, cost: 0 }];
    distances[target.x + ',' + target.y] = 0;
    while (open.length > 0) {
      open.sort(function (p, q) { return p.cost - q.cost; });
      var current = open.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = current.x + d[0], ny = current.y + d[1];
        if (!SC.Board.inBounds(state, nx, ny)) return;
        var step = SC.Movement.getMoveCost(state.terrain[ny][nx], moveTypeId);
        if (step === null) return;
        var key = nx + ',' + ny;
        if (distances[key] === undefined || current.cost + step < distances[key]) {
          distances[key] = current.cost + step;
          open.push({ x: nx, y: ny, cost: current.cost + step });
        }
      });
    }
    return distances;
  }

  // 雇う部隊を選ぶ：歩兵を中心に、弓兵は歩兵の半分まで、僧侶は1部隊まで、騎士（雇えるステージだけ）は歩兵の半分まで。お金が足りなければ雇わない
  function chooseHireType(state, side) {
    var own = SC.Game.getUnits(state, side);
    var count = function (typeId) { return own.filter(function (u) { return u.type === typeId; }).length; };
    var canHire = function (typeId) { return SC.Economy.getHireTypes(state).indexOf(typeId) >= 0; };
    var wanted;
    if (canHire('cavalry') && count('cavalry') * 2 < count('infantry')) wanted = 'cavalry';
    else if (count('archer') * 2 < count('infantry')) wanted = 'archer';
    else if (count('cleric') === 0 && own.length >= 4) wanted = 'cleric';
    else wanted = 'infantry';
    if (!canHire(wanted)) wanted = 'infantry';
    if (state.gold[side] >= SC.UNIT_TYPES[wanted].cost) return wanted;
    return state.gold[side] >= SC.UNIT_TYPES.infantry.cost ? 'infantry' : null;
  }

  // 雇う：王が自軍の城にいて、お金があれば雇う。出るマスは、ふつうに近づくときと同じ考え方で選ぶ（町か敵に向かう）
  function findHire(state, units, enemies) {
    if (!SC.Economy.isEnabled(state)) return null;
    var king = units.filter(isKing)[0];
    if (!king || !SC.Economy.isKingInOwnCastle(state, king)) return null;
    var typeId = chooseHireType(state, king.side);
    if (!typeId || SC.Economy.checkHire(state, king, typeId, null)) return null;
    var tiles = SC.Economy.getHireDestinations(state, king, typeId);
    var newcomer = { id: '(雇う部隊)', type: typeId, side: king.side, x: king.x, y: king.y, hp: SC.Combat.getMaxHp(typeId) };
    var move = findApproachMove(state, newcomer, enemies, tiles);
    var tile = move || tiles[0];
    return { unitId: king.id, x: tile.x, y: tile.y, targetId: null, kind: 'hire', unitType: typeId, score: 0 };
  }

  // 占領しに行く町（と砦）：自軍のものでない町・砦のうち、歩いていちばん近いもの。王は占領に出さない（城に残す）
  function findTownToCapture(state, unit, fromUnit) {
    if (!SC.Economy.isEnabled(state) || !SC.UNIT_TYPES[unit.type].capturesTowns) return null;
    var best = null;
    Object.keys(state.owners).forEach(function (k) {
      var parts = k.split(','), x = Number(parts[0]), y = Number(parts[1]);
      var terrainId = state.terrain[y][x];
      var kind = SC.terrainKind(terrainId);
      if ((kind !== 'town' && kind !== 'fort') || state.owners[k] === unit.side) return;
      var d = fromUnit[k];
      if (d === undefined) return;
      if (!best || d < best.d) best = { x: x, y: y, d: d };
    });
    return best;
  }

  // destinations を渡すと、その中から選ぶ（雇う部隊が城から出るマスを選ぶときに使う）
  function findApproachMove(state, unit, enemies, destinations) {
    var moveTypeId = SC.UNIT_TYPES[unit.type].moveType;
    var fromUnit = measureWalkingDistances(state, unit, moveTypeId);
    var walk = function (enemy) {
      var d = fromUnit[enemy.x + ',' + enemy.y];
      return d === undefined ? 999 : d;
    };
    var town = findTownToCapture(state, unit, fromUnit);
    var nearest = null;
    var intruders = enemies.filter(function (enemy) { return threatensKing(state, enemy, unit.side); });
    (intruders.length > 0 ? intruders : enemies).forEach(function (enemy) {
      var d = walk(enemy);
      if (!nearest || d < nearest.d || (d === nearest.d && enemy.hp < nearest.enemy.hp)) nearest = { enemy: enemy, d: d };
    });
    // 敵より近くに取れる町があれば、町を目指す（町の上に乗るので、目指す距離は0）
    var aimAtTown = town && town.d < nearest.d && !threatensKing(state, nearest.enemy, unit.side);
    var goal = aimAtTown ? town : nearest.enemy;
    var toEnemy = measureWalkingDistances(state, goal, moveTypeId);
    var preferredDistance = aimAtTown ? 0 : SC.UNIT_TYPES[unit.type].rangeMax;
    var best = null;
    (destinations || getDestinations(state, unit)).forEach(function (destination) {
      var walked = toEnemy[destination.x + ',' + destination.y];
      var gap = Math.abs((walked === undefined ? 999 : walked) - preferredDistance);
      var score = -gap + SC.Board.getTerrain(state, destination.x, destination.y).defense * 0.3 - destination.cost * 0.01 - hazardPenalty(state, unit, destination);
      if (!best || score > best.score) best = { unitId: unit.id, x: destination.x, y: destination.y, targetId: null, score: score };
    });
    return best;
  }

  // 呼ぶものが選べるときは、出てくる体力の見込み（最大人数 × 1人の体力 × 成功率）が大きいほう（ウィザードならゴーレム）
  function chooseSummonType(state, unit) {
    var best = null;
    SC.UNIT_TYPES[unit.type].summon.types.forEach(function (typeId) {
      if (SC.Game.checkSummon(state, unit, typeId, null)) return;
      var odds = SC.Game.getSummonOdds(unit.type, typeId);
      var value = Math.min(odds.maxSoldiers, SC.UNIT_TYPES[typeId].size) * SC.UNIT_TYPES[typeId].soldierHp * odds.chancePercent;
      if (!best || value > best.value) best = { typeId: typeId, value: value };
    });
    return best ? best.typeId : null;
  }

  // 召喚：召喚できる部隊が、隣の空いたマスのうち、いちばん近い敵に近いマスへ呼ぶ
  function findSummon(state, units, enemies) {
    var best = null;
    units.forEach(function (unit) {
      if (!SC.UNIT_TYPES[unit.type].summon) return;
      var typeId = chooseSummonType(state, unit);
      if (!typeId) return;
      SC.Game.getSummonTiles(state, unit, typeId).forEach(function (tile) {
        var d = nearestDistance(tile, enemies);
        if (!best || d < best.d) best = { d: d, action: { unitId: unit.id, x: tile.x, y: tile.y, targetId: null, kind: 'summon', unitType: typeId } };
      });
    });
    return best ? best.action : null;
  }

  // 向きを持つ部隊（騎士）が待機するときは、いちばん近い敵のほうを向く（背中を取られにくくするため）
  function addFacing(state, action, enemies) {
    if (!action || action.targetId || action.kind) return action;
    var unit = SC.Board.getUnitById(state, action.unitId);
    if (!unit || !SC.UNIT_TYPES[unit.type].diagonalFront || enemies.length === 0) return action;
    var destination = { x: action.x, y: action.y };
    var nearest = enemies.reduce(function (best, enemy) {
      return !best || SC.Board.distance(destination, enemy) < SC.Board.distance(destination, best) ? enemy : best;
    }, null);
    var dx = nearest.x - destination.x, dy = nearest.y - destination.y;
    action.facing = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : (dx < 0 ? 'left' : 'right');
    return action;
  }

  // 次に行う1ユニット分の行動を返す。全員が行動済みなら null。
  function chooseAction(state, side) {
    SC.Board.useState(state);
    var action = chooseActionWithoutFacing(state, side);
    return addFacing(state, action, SC.Game.getUnits(state, SC.Game.otherSide(side)));
  }

  function chooseActionWithoutFacing(state, side) {
    var units = SC.Game.getUnits(state, side).filter(function (unit) { return !unit.acted; });
    var enemies = SC.Game.getUnits(state, SC.Game.otherSide(side));
    if (units.length === 0 || enemies.length === 0) return null;
    var hireAction = findHire(state, units, enemies);
    if (hireAction) return hireAction;
    var attack = findBestAttack(state, units, enemies);
    var prayer = findBestPrayer(state, units, enemies);
    if (attack || prayer) return !prayer || (attack && attack.score >= prayer.score) ? attack : prayer;
    // 魔法使いは、得な攻撃が無ければ、動く前に召喚する（敵にいちばん近い隣のマスへ）
    var summon = findSummon(state, units, enemies);
    if (summon) return summon;
    // 守備兵は、攻撃しないなら構える
    var guard = units.filter(function (unit) { return isHoldingGuard(state, unit) && SC.UNIT_TYPES[unit.type].canBrace; })[0];
    if (guard) return { unitId: guard.id, x: guard.x, y: guard.y, targetId: null, kind: 'brace' };
    // 回復役は、ほかの味方が動いたあとに動く（味方の新しい位置に合わせてついていくため）
    var mover = units.filter(function (unit) { return !isHealer(unit); })[0];
    return mover ? findApproachMove(state, mover, enemies) : findHealerMove(state, units[0], enemies);
  }

  SC.AI = { chooseAction: chooseAction, scoreAttack: scoreAttack, findBestPrayer: findBestPrayer, findHealerMove: findHealerMove, chooseSummonType: chooseSummonType, hazardPenalty: hazardPenalty };
})(typeof window !== 'undefined' ? window : globalThis);
