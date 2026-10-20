// 領地と軍資金（G）：町の占領、収入、補充、雇う。画面には触れない。
// そのステージで rules.economy が無ければ、どれも何もしない（ステージ1〜4は今までどおり）。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function isEnabled(state) { return !!(state.rules && state.rules.economy); }
  function key(x, y) { return x + ',' + y; }

  // 拠点（城と町）の持ち主の表を作る。城は、最初にそこに立っている王の軍のもの。町はステージのデータで決める（書かれていなければ中立）
  function createOwners(stage, terrain) {
    var owners = {};
    var blocks = { blockOf: SC.Board.findBlocks(terrain) };   // 2×2の建物は、左上のマスだけで持ち主を持つ
    terrain.forEach(function (row, y) {
      row.forEach(function (terrainId, x) {
        if (!isBase(terrainId)) return;
        var anchor = SC.Board.canonical(blocks, x, y);
        if (anchor.x !== x || anchor.y !== y) return;
        var king = stage.units.filter(function (u) {
          var at = SC.Board.canonical(blocks, u.x, u.y);
          return SC.UNIT_TYPES[u.type].isKing && at.x === x && at.y === y;
        })[0];
        owners[key(x, y)] = king ? king.side : null;
      });
    });
    (stage.towns || []).forEach(function (town) { var at = SC.Board.canonical(blocks, town.x, town.y); owners[key(at.x, at.y)] = town.owner || null; });
    return owners;
  }

  function getOwner(state, x, y) {
    var owner = state.owners && state.owners[key(x, y)];
    return owner === undefined ? null : owner;
  }

  // 拠点（持ち主のある地形）か
  function isBase(terrainId) { var kind = SC.terrainKind(terrainId); return kind === 'castle' || kind === 'town' || kind === 'fort'; }

  // 王がいれば雇える拠点か（城と砦）
  function isHireBase(terrainId) { var kind = SC.terrainKind(terrainId); return kind === 'castle' || kind === 'fort'; }

  // そのマスが、その軍の城か町か砦か
  function isOwnBase(state, side, x, y) {
    return getOwner(state, x, y) === side && isBase(state.terrain[y][x]);
  }

  // 1ターンの収入：持っている城と町の数で決まる
  function getIncome(state, side) {
    if (!isEnabled(state)) return 0;
    // 収入が入る軍を決めているステージ（守りの戦いでは敵は雇わず、増援で増える）
    if (state.rules.incomeSides && state.rules.incomeSides.indexOf(side) < 0) return 0;
    var income = 0;
    Object.keys(state.owners).forEach(function (k) {
      if (state.owners[k] !== side) return;
      var parts = k.split(',');
      var terrainId = SC.terrainKind(state.terrain[Number(parts[1])][Number(parts[0])]);
      income += terrainId === 'castle' ? SC.ECONOMY.castleIncome : terrainId === 'fort' ? SC.ECONOMY.fortIncome : SC.ECONOMY.townIncome;
    });
    // 収入の割合を軍ごとに変えるステージ（stages.js の rules.incomeScale。例：{ enemy: 0.5 } なら敵の収入は半分。10G単位に切り捨て）
    var scale = state.rules.incomeScale && state.rules.incomeScale[side];
    if (scale !== undefined) income = Math.floor(income * scale / 10) * 10;
    return income;
  }

  // その部隊が、その地形を占領できるか。町は歩兵だけ、砦は歩兵と王（2026-10-18 ユーザー決定）
  function canCapture(unit, terrainId) {
    var type = SC.UNIT_TYPES[unit.type];
    terrainId = SC.terrainKind(terrainId);
    if (terrainId === 'town') return !!type.capturesTowns;
    if (terrainId === 'fort') return !!type.capturesTowns || !!type.isKing;
    return false;
  }

  // 町と砦の占領：占領できる部隊が、その上で行動を終えたら、自分のものにする。起きたことを返す（無ければ null）
  function captureIfPossible(state, unit) {
    if (!isEnabled(state)) return null;
    var terrainId = state.terrain[unit.y][unit.x];
    if (!canCapture(unit, terrainId) || getOwner(state, unit.x, unit.y) === unit.side) return null;
    var previous = getOwner(state, unit.x, unit.y);
    state.owners[key(unit.x, unit.y)] = unit.side;
    return { type: 'capture', unitId: unit.id, x: unit.x, y: unit.y, side: unit.side, previous: previous };
  }

  // 自分のターンの始め：収入が入り、そのあと自分の城と町の上にいる部隊に兵士が戻る（1人ごとにGを払う。足りなければ払える分だけ）
  function startTurn(state, side) {
    if (!isEnabled(state)) return [];
    var events = [];
    var income = getIncome(state, side);
    state.gold[side] += income;
    events.push({ type: 'income', side: side, amount: income, gold: state.gold[side] });
    SC.Game.getUnits(state, side).forEach(function (unit) {
      if (!isOwnBase(state, side, unit.x, unit.y)) return;
      var type = SC.UNIT_TYPES[unit.type];
      if (type.noRestore) return;   // 不死（スケルトン）は補充で戻らない
      var missing = type.size - SC.Combat.getSoldierCount(unit);
      var limit = SC.ECONOMY.resupplyPerTurn[type.size] || 0;
      var affordable = Math.floor(state.gold[side] / SC.ECONOMY.resupplyCostPerSoldier);
      var amount = Math.min(missing, limit, affordable);
      if (amount <= 0) return;
      var before = SC.Combat.getSoldierCount(unit);
      unit.hp = Math.min(SC.Combat.getMaxHp(unit.type), unit.hp + amount * type.soldierHp);
      var restored = SC.Combat.getSoldierCount(unit) - before;
      state.gold[side] -= restored * SC.ECONOMY.resupplyCostPerSoldier;
      events.push({ type: 'resupply', unitId: unit.id, restored: restored, targetHp: unit.hp, cost: restored * SC.ECONOMY.resupplyCostPerSoldier });
    });
    return events;
  }

  // 王が自軍の城か砦にいるか（雇える場所にいるか）
  function isKingInOwnCastle(state, king) {
    return isEnabled(state) && SC.UNIT_TYPES[king.type].isKing &&
      isHireBase(state.terrain[king.y][king.x]) && getOwner(state, king.x, king.y) === king.side;
  }

  // 雇った部隊が出られるマス：城を出発点にして、その部隊の移動力で行けるマス（城そのものは王がいるので除く）。
  // 雇った部隊は、城から出てくる形で、このマスのどれかへ動く
  function getHireDestinations(state, king, typeId) {
    if (!isKingInOwnCastle(state, king)) return [];
    return getExitTiles(state, { x: king.x, y: king.y }, typeId || 'infantry', king.side, null);
  }

  // 城（castle）から出て行けるマス。unitId を渡すと、その部隊が今いるマスも選べる（雇ったあとに出るマスを選び直すとき）
  function getExitTiles(state, castle, typeId, side, unitId) {
    var newcomer = { id: unitId || '(雇う部隊)', type: typeId, side: side, x: castle.x, y: castle.y };
    return SC.Movement.getReachableTiles(state, newcomer).filter(function (tile) {
      if (tile.x === castle.x && tile.y === castle.y) return false;   // 城からは必ず出る
      var occupant = SC.Board.getUnitAt(state, tile.x, tile.y);
      return !occupant || occupant.id === unitId;
    });
  }

  // 雇えるか。だめなら理由の文を、よければ null を返す
  var DEFAULT_HIRE_TYPES = ['infantry', 'archer', 'cleric'];

  // そのステージで雇える部隊の種類（stages.js の rules.hireTypes。書いていなければ歩兵・弓兵・僧侶）
  function getHireTypes(state) {
    return (state.rules && state.rules.hireTypes) || DEFAULT_HIRE_TYPES;
  }

  function checkHire(state, king, typeId, tile) {
    if (!isEnabled(state)) return 'このステージでは雇えません';
    if (!king || !SC.UNIT_TYPES[king.type].isKing) return '雇えるのは王だけです';
    if (king.side !== state.side) return '相手の番です';
    if (king.acted) return '行動を終えた王は雇えません';
    var type = SC.UNIT_TYPES[typeId];
    if (!type || type.cost === undefined || getHireTypes(state).indexOf(typeId) < 0) return '雇えない部隊です';
    if (state.gold[king.side] < type.cost) return 'お金が足りません';
    var limit = state.rules.maxUnits;
    if (limit && SC.Game.getUnits(state, king.side).length >= limit) return '部隊は' + limit + 'つまでです';
    var tiles = getHireDestinations(state, king, typeId);
    if (tiles.length === 0) return '王が自軍の城にいて、城から出られるときだけ雇えます';
    if (tile && !tiles.some(function (t) { return t.x === tile.x && t.y === tile.y; })) return 'そのマスには出せません';
    return null;
  }

  // 雇う：お金を払い、城から新しい部隊を出す。部隊は城を出発点に、移動力のぶんだけ動いたマスに現れる（そのターンの移動は使い切った扱い）。
  // そのあと、攻撃・祈り・待機はできる。雇っても王の行動は終わらない
  function hire(state, kingId, typeId, tile) {
    var king = SC.Board.getUnitById(state, kingId);
    var error = checkHire(state, king, typeId, tile);
    if (error) return { ok: false, error: error };
    state.gold[king.side] -= SC.UNIT_TYPES[typeId].cost;
    state.nextUnitNumber = (state.nextUnitNumber || state.units.length) + 1;
    var unit = {
      id: 'u' + (state.nextUnitNumber - 1), type: typeId, side: king.side, x: tile.x, y: tile.y,
      hp: SC.Combat.getMaxHp(typeId), role: null, braced: false, acted: false, moved: true,
      facing: king.side === 'enemy' ? 'down' : 'up',
      justHired: true,   // 雇ったばかりで、まだ行動を決めていない（このあいだは、城から出るマスを選び直せる）
      hiredFrom: { x: king.x, y: king.y }   // 出てきた城
    };
    state.units.push(unit);
    return { ok: true, events: [{ type: 'hire', unitId: unit.id, kingId: king.id, unitType: typeId, from: { x: king.x, y: king.y }, x: tile.x, y: tile.y, gold: state.gold[king.side] }] };
  }

  // 雇った部隊が城から出るマスを選び直す：雇ったばかりで、まだ行動を決めていない部隊だけ。
  // 雇うことそのものは取り消せない（お金は戻らない。2026-10-15 ユーザー決定）
  function getRelocateTiles(state, unit) {
    if (!unit || !unit.justHired || unit.acted || !unit.hiredFrom) return [];
    return getExitTiles(state, unit.hiredFrom, unit.type, unit.side, unit.id);
  }

  function relocateHire(state, unitId, tile) {
    var unit = SC.Board.getUnitById(state, unitId);
    if (!unit || unit.side !== state.side) return { ok: false, error: '選び直せません' };
    var allowed = getRelocateTiles(state, unit).some(function (t) { return t.x === tile.x && t.y === tile.y; });
    if (!allowed) return { ok: false, error: 'そのマスには出られません' };
    var from = { x: unit.x, y: unit.y };
    unit.x = tile.x;
    unit.y = tile.y;
    return { ok: true, events: [{ type: 'move', unitId: unit.id, from: from, to: { x: tile.x, y: tile.y } }] };
  }

  SC.Economy = {
    canCapture: canCapture,
    isBase: isBase,
    isHireBase: isHireBase,
    getHireTypes: getHireTypes,
    getRelocateTiles: getRelocateTiles,
    relocateHire: relocateHire,
    isEnabled: isEnabled,
    createOwners: createOwners,
    getOwner: getOwner,
    isOwnBase: isOwnBase,
    getIncome: getIncome,
    captureIfPossible: captureIfPossible,
    startTurn: startTurn,
    isKingInOwnCastle: isKingInOwnCastle,
    getHireDestinations: getHireDestinations,
    checkHire: checkHire,
    hire: hire
  };
})(typeof window !== 'undefined' ? window : globalThis);
