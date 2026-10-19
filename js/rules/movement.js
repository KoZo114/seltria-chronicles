// マス目の基本操作と、移動できる範囲の計算。画面には触れない。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function tileKey(x, y) { return x + ',' + y; }

  function inBounds(state, x, y) {
    return x >= 0 && y >= 0 && x < state.width && y < state.height;
  }

  function getUnitAt(state, x, y) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].x === x && state.units[i].y === y) return state.units[i];
    }
    return null;
  }

  function getUnitById(state, unitId) {
    for (var i = 0; i < state.units.length; i++) {
      if (state.units[i].id === unitId) return state.units[i];
    }
    return null;
  }

  function getTerrain(state, x, y) { return SC.TERRAIN[state.terrain[y][x]]; }

  function distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

  // そのマスに入るのにかかる移動コスト。通れないときは null を返す
  function getMoveCost(terrainId, moveTypeId) {
    var terrain = SC.TERRAIN[terrainId];
    var moveType = SC.MOVE_TYPES[moveTypeId] || SC.MOVE_TYPES.ground;
    if (terrain.impassable && !moveType.canEnterImpassable) return null;
    if (moveType.flatCost !== undefined) return moveType.flatCost;
    var override = moveType.costOverrides && moveType.costOverrides[terrainId];
    return override !== undefined ? override : terrain.moveCost;
  }

  // なわばり：敵の部隊の上下左右の隣のマス。そのステージで「なわばり」の決まりが無ければ、いつも false
  function isInEnemyZone(state, side, x, y) {
    if (!state.rules || !state.rules.zoneOfControl) return false;
    for (var i = 0; i < DIRECTIONS.length; i++) {
      var neighbor = getUnitAt(state, x + DIRECTIONS[i][0], y + DIRECTIONS[i][1]);
      if (neighbor && neighbor.side !== side) return true;
    }
    return false;
  }

  // 止まれるマスの一覧を返す（今いるマスを含む）。味方は通り抜けられ、敵は通れない。
  // なわばりの決まりがあるステージでは、敵のなわばりに入ったマスで移動が終わる（その先へは進めない）。
  // そのマスには zone: true を付ける（画面で印を付けるため）
  function getReachableTiles(state, unit) {
    if (unit.moved) return [{ x: unit.x, y: unit.y, cost: 0 }];   // このターンの移動を使い切った部隊（雇ったばかりの部隊）
    var unitType = SC.UNIT_TYPES[unit.type];
    var bestCost = {};
    var open = [{ x: unit.x, y: unit.y, cost: 0 }];
    bestCost[tileKey(unit.x, unit.y)] = 0;

    while (open.length > 0) {
      open.sort(function (a, b) { return a.cost - b.cost; });
      var current = open.shift();
      if (current.cost > bestCost[tileKey(current.x, current.y)]) continue;
      var isStart = current.x === unit.x && current.y === unit.y;
      if (!isStart && isInEnemyZone(state, unit.side, current.x, current.y)) continue;   // なわばりに入ったら、ここで止まる
      for (var i = 0; i < DIRECTIONS.length; i++) {
        var nx = current.x + DIRECTIONS[i][0];
        var ny = current.y + DIRECTIONS[i][1];
        if (!inBounds(state, nx, ny)) continue;
        var stepCost = getMoveCost(state.terrain[ny][nx], unitType.moveType);
        if (stepCost === null) continue;
        var occupant = getUnitAt(state, nx, ny);
        if (occupant && occupant.side !== unit.side) continue;
        var totalCost = current.cost + stepCost;
        if (totalCost > unitType.move) continue;
        var key = tileKey(nx, ny);
        if (bestCost[key] === undefined || totalCost < bestCost[key]) {
          bestCost[key] = totalCost;
          open.push({ x: nx, y: ny, cost: totalCost });
        }
      }
    }

    var tiles = [];
    Object.keys(bestCost).forEach(function (key) {
      var parts = key.split(',');
      var x = Number(parts[0]);
      var y = Number(parts[1]);
      var occupant = getUnitAt(state, x, y);
      if (!occupant || occupant.id === unit.id) {
        var tile = { x: x, y: y, cost: bestCost[key] };
        if (occupant === null && isInEnemyZone(state, unit.side, x, y)) tile.zone = true;
        tiles.push(tile);
      }
    });
    return tiles;
  }

  // 向き（騎士など、斜め前も攻撃できる部隊だけが使う）。上下左右のどれか
  var FACING_VECTORS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // 部隊の向き。まだ向きを持っていなければ、自軍は上、敵軍は下を向いている
  function getFacing(unit) {
    return unit.facing || (unit.side === 'enemy' ? 'down' : 'up');
  }

  // from から target を見たときに向く方向。上下左右の相手ならその方向、斜めの相手なら相手のいる側の上か下
  function facingToward(from, target) {
    var dx = target.x - from.x, dy = target.y - from.y;
    if (dy !== 0) return dy < 0 ? 'up' : 'down';
    return dx < 0 ? 'left' : 'right';
  }

  // 攻撃が届くか。距離（上下左右に数えたマス数）が射程の中なら届く。
  // 斜め前も攻撃できる部隊（diagonalFront）は、すぐ斜めの相手にも届く。ドラゴン（allDirections）は、斜め4つすべてに届く。
  // facing を渡すと、その向きの斜め前だけに届く（守るときの反撃）。渡さなければ、どの斜めにも届く（攻めるときは相手のほうを向けるため）
  function isInAttackRange(unitTypeId, fromPos, targetPos, facing) {
    var unitType = SC.UNIT_TYPES[unitTypeId];
    var d = distance(fromPos, targetPos);
    if (d >= unitType.rangeMin && d <= unitType.rangeMax) return true;
    if (!unitType.diagonalFront && !unitType.allDirections) return false;
    var dx = targetPos.x - fromPos.x, dy = targetPos.y - fromPos.y;
    if (Math.abs(dx) !== 1 || Math.abs(dy) !== 1) return false;
    if (unitType.allDirections) return true;   // ドラゴン：斜め4つにも、向きに関係なく届く
    if (!facing) return true;
    var vector = FACING_VECTORS[facing];
    return dx * vector[0] + dy * vector[1] > 0;   // 向いている側の斜めだけ
  }

  // 守る側が、attackerPos から攻めてきた相手に反撃できるか（守る側の向きで決まる）
  function canCounter(defender, attackerPos) {
    return isInAttackRange(defender.type, defender, attackerPos, getFacing(defender));
  }

  // fromPos から攻撃が届くマスの一覧（facing を渡さなければ、向きを選べるものとして数える）
  function getAttackTiles(state, unitTypeId, fromPos, facing) {
    var unitType = SC.UNIT_TYPES[unitTypeId];
    var tiles = [];
    for (var dy = -unitType.rangeMax; dy <= unitType.rangeMax; dy++) {
      for (var dx = -unitType.rangeMax; dx <= unitType.rangeMax; dx++) {
        var pos = { x: fromPos.x + dx, y: fromPos.y + dy };
        if (inBounds(state, pos.x, pos.y) && isInAttackRange(unitTypeId, fromPos, pos, facing)) tiles.push(pos);
      }
    }
    return tiles;
  }

  SC.Board = {
    tileKey: tileKey,
    inBounds: inBounds,
    getUnitAt: getUnitAt,
    getUnitById: getUnitById,
    getTerrain: getTerrain,
    distance: distance
  };
  SC.Movement = {
    getMoveCost: getMoveCost,
    isInEnemyZone: isInEnemyZone,
    getReachableTiles: getReachableTiles,
    isInAttackRange: isInAttackRange,
    canCounter: canCounter,
    getFacing: getFacing,
    facingToward: facingToward,
    getAttackTiles: getAttackTiles
  };
})(typeof window !== 'undefined' ? window : globalThis);
