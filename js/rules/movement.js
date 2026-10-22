// マス目の基本操作と、移動できる範囲の計算。画面には触れない。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function tileKey(x, y) { return x + ',' + y; }

  // ---- 2マス×2マスの建物（2026-10-20）----
  // マップで、城や大聖堂（terrain の bigBlock）を2×2に並べて書くと、その4マスで「建物1つ」になる。
  // 中にいられるのは1部隊。部隊の位置は、建物の左上のマス（anchor）で持つ。4マスのどれも、その部隊のマスとして数える。
  // 距離は「建物の4マスのうち、いちばん近いマス」から数える（建物のまわり8マスが、建物のとなりになる）。
  // 1マスの城（今までのマップ）は、今までどおり。
  function findBlocks(terrain) {
    var blockOf = {};
    for (var y = 0; y + 1 < terrain.length; y++) {
      for (var x = 0; x + 1 < terrain[y].length; x++) {
        var id = terrain[y][x];
        if (!SC.TERRAIN[id] || !SC.TERRAIN[id].bigBlock || blockOf[tileKey(x, y)]) continue;
        if (terrain[y][x + 1] !== id || terrain[y + 1][x] !== id || terrain[y + 1][x + 1] !== id) continue;
        var block = { x: x, y: y, w: 2, h: 2, terrainId: id };
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(function (d) { blockOf[tileKey(x + d[0], y + d[1])] = block; });
      }
    }
    return blockOf;
  }

  // 距離の計算などで使う「今の盤面の建物」。盤面を使う関数の入り口で useState(state) を呼んで切りかえる
  var activeBlocks = null;
  function useState(state) {
    var blocks = state && state.blockOf;
    activeBlocks = blocks && Object.keys(blocks).length > 0 ? blocks : null;   // 建物の無いマップでは、今までどおりの速い計算
  }

  function getBlock(state, x, y) {
    var blocks = state ? state.blockOf : activeBlocks;
    if (!blocks) return null;
    return (blocks && blocks[tileKey(x, y)]) || null;
  }

  // そのマスの「部隊が立つマス」（建物なら左上のマス、ほかはそのまま）
  function canonical(state, x, y) {
    var block = getBlock(state, x, y);
    return block ? { x: block.x, y: block.y } : { x: x, y: y };
  }

  // そのマスが占めるマスの一覧（建物なら4マス）
  function footprint(pos, state) {
    var block = getBlock(state, pos.x, pos.y);
    if (!block) return [{ x: pos.x, y: pos.y }];
    return [{ x: block.x, y: block.y }, { x: block.x + 1, y: block.y }, { x: block.x, y: block.y + 1 }, { x: block.x + 1, y: block.y + 1 }];
  }

  // 上下左右のとなりのマス（建物なら、建物のまわり8マス）。建物のマスは、左上のマスにまとめて返す
  function neighbors(state, x, y) {
    if (!getBlock(state, x, y) && !(state.blockOf && Object.keys(state.blockOf).length)) {
      return DIRECTIONS.map(function (d) { return { x: x + d[0], y: y + d[1] }; }).filter(function (t) { return inBounds(state, t.x, t.y); });
    }
    var seen = {};
    var result = [];
    var own = footprint({ x: x, y: y }, state);
    var ownKeys = {};
    own.forEach(function (t) { ownKeys[tileKey(t.x, t.y)] = true; });
    own.forEach(function (t) {
      DIRECTIONS.forEach(function (d) {
        var nx = t.x + d[0], ny = t.y + d[1];
        if (!inBounds(state, nx, ny) || ownKeys[tileKey(nx, ny)]) return;
        var c = canonical(state, nx, ny);
        var k = tileKey(c.x, c.y);
        if (seen[k]) return;
        seen[k] = true;
        result.push(c);
      });
    });
    return result;
  }

  function inBounds(state, x, y) {
    return x >= 0 && y >= 0 && x < state.width && y < state.height;
  }

  function getUnitAt(state, x, y) {
    var block = getBlock(state, x, y);
    if (block) { x = block.x; y = block.y; }   // 建物の4マスのどれでも、中にいる部隊
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

  // 上下左右に数えたマス数。建物は、4マスのうちいちばん近いマスから数える
  function distance(a, b) {
    if (!activeBlocks) return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    var best = Infinity;
    footprint(a).forEach(function (p) {
      footprint(b).forEach(function (q) { best = Math.min(best, Math.abs(p.x - q.x) + Math.abs(p.y - q.y)); });
    });
    return best;
  }

  // 斜めのとなり（建物は4マスのどれかの斜め）。あれば、その向き（dx, dy）を返す
  function diagonalStep(a, b) {
    var found = null;
    footprint(a).forEach(function (p) {
      footprint(b).forEach(function (q) {
        if (!found && Math.abs(q.x - p.x) === 1 && Math.abs(q.y - p.y) === 1) found = { dx: q.x - p.x, dy: q.y - p.y };
      });
    });
    return found;
  }

  // そのマスに入るのにかかる移動コスト。通れないときは null を返す
  function getMoveCost(terrainId, moveTypeId) {
    var terrain = SC.TERRAIN[terrainId];
    var moveType = SC.MOVE_TYPES[moveTypeId] || SC.MOVE_TYPES.ground;
    if (terrain.blocksAll) return null;   // 閉じた城門は、空の部隊も通れない
    if (terrain.impassable && !moveType.canEnterImpassable) return null;
    if (moveType.flatCost !== undefined) return moveType.flatCost;
    var override = moveType.costOverrides && moveType.costOverrides[terrainId];
    return override !== undefined ? override : terrain.moveCost;
  }

  // なわばり：敵の部隊の上下左右の隣のマス。そのステージで「なわばり」の決まりが無ければ、いつも false
  function isInEnemyZone(state, side, x, y) {
    if (!state.rules || !state.rules.zoneOfControl) return false;
    var around = neighbors(state, x, y);
    for (var i = 0; i < around.length; i++) {
      var neighbor = getUnitAt(state, around[i].x, around[i].y);
      if (neighbor && neighbor.side !== side) return true;
    }
    return false;
  }

  // 止まれるマスの一覧を返す（今いるマスを含む）。味方は通り抜けられ、敵は通れない。
  // なわばりの決まりがあるステージでは、敵のなわばりに入ったマスで移動が終わる（その先へは進めない）。
  // そのマスには zone: true を付ける（画面で印を付けるため）
  function getReachableTiles(state, unit) {
    useState(state);
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
      var around = neighbors(state, current.x, current.y);
      for (var i = 0; i < around.length; i++) {
        var nx = around[i].x;
        var ny = around[i].y;
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
    var step = diagonalStep(fromPos, targetPos);
    if (!step || d < 2) return false;
    var dx = step.dx, dy = step.dy;
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
    useState(state);
    var unitType = SC.UNIT_TYPES[unitTypeId];
    var tiles = [];
    var reach = unitType.rangeMax + 1;   // 建物から攻めるときは、建物の大きさの分だけ広く調べる
    for (var dy = -reach; dy <= reach + 1; dy++) {
      for (var dx = -reach; dx <= reach + 1; dx++) {
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
    distance: distance,
    findBlocks: findBlocks,
    useState: useState,
    getBlock: getBlock,
    canonical: canonical,
    footprint: footprint,
    neighbors: neighbors
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
