// ターンの進行と勝敗の判定。画面には触れない。
(function (root) {
  var SC = (root.SC = root.SC || {});

  // 種（seed）を決めると毎回同じ順番で同じ目が出る乱数。テストで結果を固定するために使う。
  function createSeededRng(seed) {
    var value = seed >>> 0;
    return function () {
      value = (value + 0x6d2b79f5) >>> 0;
      var t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var FACINGS = { up: true, down: true, left: true, right: true };

  // options：{ regulars: 出撃する正規部隊の記録 [{ id, name, type, exp }], noExperience: true（経験値を入れない。遊び直しのとき） }
  function createGame(stage, rng, options) {
    options = options || {};
    var terrain = stage.map.map(function (row) {
      return row.split('').map(function (symbol) { return SC.TERRAIN_SYMBOLS[symbol]; });
    });
    var blockOf = SC.Board.findBlocks(terrain);   // 2×2の建物（城・大聖堂）
    // 城門の体力（ステージ18から）。守る軍は stage.gateSide（書いていなければ敵）。守る軍は城門を攻めない
    var gates = {};
    var gateHp = stage.gateHp || SC.GATE.hp;   // ステージごとに城門の体力を変えられる
    terrain.forEach(function (row, y) { row.forEach(function (id, x) { if (id === 'gate') gates[x + ',' + y] = gateHp; }); });
    SC.Board.useState({ blockOf: blockOf });
    var units = stage.units.map(function (placement, index) {
      var at = SC.Board.canonical({ blockOf: blockOf }, placement.x, placement.y);   // 建物の中なら、建物の左上のマス
      return {
        id: 'u' + index,
        type: placement.type,
        side: placement.side,
        x: at.x,
        y: at.y,
        hp: SC.Combat.getMaxHp(placement.type),   // 部隊の体力の合計（兵士1人あたりの体力 × 人数）
        role: placement.role || null,   // CPUの役目（'guard'：守備兵。決まったマスから動かず、構えて待つ）
        braced: false,                  // 構え中（次の自分のターンが始まるまで）
        facing: placement.side === 'enemy' ? 'down' : 'up',   // 向き（騎士だけが使う。斜め前の攻撃と反撃が、この向きで決まる）
        commander: placement.commander || null,   // 指揮官（ステージ19から）：倒すと、その組（'north' など）の増援が止まる
        acted: false
      };
    });
    // 正規部隊（ステージ11から）：stage.regularSlots のマスに、選んだ順に置く
    var deployed = [];
    (options.regulars || []).forEach(function (member, index) {
      var slot = (stage.regularSlots || [])[index];
      if (!slot) return;
      units.push(SC.Regulars.createUnit(member, slot, 'u' + units.length));
      deployed.push(member.id);
    });
    return {
      stageId: stage.id,
      deployed: deployed,                 // 出撃した正規部隊の番号（勝ったときに記録へ書き戻す）
      experience: !!(stage.rules && stage.rules.experience) && !options.noExperience,   // 経験値が入るか
      fallenRegulars: {},                 // 全滅した正規部隊の、全滅したときのクラスと経験値
      width: terrain[0].length,
      height: terrain.length,
      terrain: terrain,
      units: units,
      commanderGroups: units.map(function (u) { return u.commander; }).filter(function (g, i, all) { return g && all.indexOf(g) === i; }),
      blockOf: blockOf,
      gates: gates,
      gateHp: gateHp,
      gateSide: stage.gateSide || 'enemy',
      turn: 1,
      side: 'player',
      winner: null,
      rules: stage.rules || {},   // そのステージの追加の決まり（zoneOfControl：なわばり、economy：町と軍資金）
      owners: SC.Economy.createOwners(stage, terrain),   // 城と町の持ち主（'x,y' → 'player' / 'enemy' / null）
      gold: { player: (stage.gold && stage.gold.player) || 0, enemy: (stage.gold && stage.gold.enemy) || 0 },
      nextUnitNumber: units.length,   // 雇った部隊の番号に使う
      fallenCount: { player: 0, enemy: 0 },   // 全滅した部隊の数
      turnEvents: [],                 // 直前のターンの始めに起きたこと（収入・補充・増援）。画面で見せるため
      reinforcements: JSON.parse(JSON.stringify(stage.reinforcements || [])),   // 敵の増援（何ターン目に、どこから、どの部隊）。来たものには arrived: true を付ける
      rng: rng || Math.random
    };
  }

  function getUnits(state, side) {
    return state.units.filter(function (unit) { return unit.side === side; });
  }

  function hasUnactedUnits(state, side) {
    return getUnits(state, side).some(function (unit) { return !unit.acted; });
  }

  function otherSide(side) { return side === 'player' ? 'enemy' : 'player'; }

  function removeFallenUnits(state) {
    var fallen = state.units.filter(function (unit) { return unit.hp <= 0; });
    var events = [];
    state.units = state.units.filter(function (unit) { return unit.hp > 0; });
    fallen.forEach(function (unit) {
      if (unit.regularId) {
        if (!state.fallenRegulars) state.fallenRegulars = {};
        state.fallenRegulars[unit.regularId] = { type: unit.type, exp: unit.exp || 0 };
      }
      if (!state.fallenCount) state.fallenCount = { player: 0, enemy: 0 };
      state.fallenCount[unit.side] += 1;   // 全滅した部隊の数（勝敗の画面に出す）
      if (SC.UNIT_TYPES[unit.type].isKing && !state.winner) state.winner = otherSide(unit.side);
      // 指揮官が倒れた：その組のほかの指揮官もいなければ、その組の増援は止まる
      if (unit.commander && !isGroupActive(state, unit.commander)) events.push({ type: 'commander', group: unit.commander, side: unit.side });
    });
    return events;
  }

  // 増援の組（'north' など）が、まだ来るか（その組の指揮官が1部隊でも残っていれば来る。指揮官のいない組は、いつも来る）
  function isGroupActive(state, group) {
    if (!group) return true;
    var hadCommander = (state.commanderGroups || []).indexOf(group) >= 0;
    if (!hadCommander) return true;
    return state.units.some(function (unit) { return unit.commander === group && unit.hp > 0; });
  }

  // 行動できるユニットか、そのマスへ動けるかを確かめる。だめなら理由の文を、よければ null を返す
  function checkMove(state, unit, destination) {
    if (state.winner) return '勝敗が決まっています';
    if (!unit) return 'ユニットがいません';
    if (unit.side !== state.side) return '相手の番です';
    if (unit.acted) return '行動済みです';
    var canReach = SC.Movement.getReachableTiles(state, unit).some(function (tile) {
      return tile.x === destination.x && tile.y === destination.y;
    });
    return canReach ? null : 'そのマスへは移動できません';
  }

  function moveUnit(unit, destination, events) {
    if (unit.x === destination.x && unit.y === destination.y) return;
    events.push({ type: 'move', unitId: unit.id, from: { x: unit.x, y: unit.y }, to: { x: destination.x, y: destination.y } });
    unit.x = destination.x;
    unit.y = destination.y;
  }

  // 1ユニットの行動（移動 → 攻撃または待機）をまとめて実行する。
  // targetId が null なら待機。ルール違反のときは何も変えずに ok:false を返す。
  // 向きを持つ部隊（騎士）は、攻撃するときは相手のほうを向き、待機するときは facing（上下左右）を向く（渡さなければ今の向きのまま）
  function act(state, unitId, destination, targetId, facing) {
    var unit = SC.Board.getUnitById(state, unitId);
    var error = checkMove(state, unit, destination);
    if (error) return { ok: false, error: error };

    var target = null;
    if (targetId !== null && targetId !== undefined) {
      target = SC.Board.getUnitById(state, targetId);
      if (!target || target.side === unit.side) return { ok: false, error: '攻撃できない相手です' };
      if (!SC.Movement.canAttackFrom(unit, destination, target)) {
        return { ok: false, error: '攻撃が届きません' };
      }
    }

    if (facing && !FACINGS[facing]) return { ok: false, error: '向きが正しくありません' };

    var events = [];
    moveUnit(unit, destination, events);
    if (SC.UNIT_TYPES[unit.type].diagonalFront) {
      var newFacing = target ? SC.Movement.facingToward(destination, target) : (facing || SC.Movement.getFacing(unit));
      if (newFacing !== SC.Movement.getFacing(unit)) events.push({ type: 'face', unitId: unit.id, facing: newFacing });
      unit.facing = newFacing;   // 攻撃の前に向く（反撃を受けるときも、この向きで守る）
    }
    if (target) {
      var strikes = SC.Combat.resolveAttack(state, unit, target);
      events = events.concat(strikes).concat(SC.Regulars.gainFromStrikes(state, strikes));   // 正規部隊の経験値とランクアップ
      events = events.concat(removeFallenUnits(state));   // 指揮官が倒れたら、増援が止まった知らせ
    }
    unit.acted = true;
    unit.justHired = false;
    if (unit.hp > 0) addCapture(state, unit, events);
    return { ok: true, events: events };
  }

  // 回復役の行動（移動 → 隣の味方に祈る）。ルール違反のときは何も変えずに ok:false を返す。
  function pray(state, unitId, destination, allyId) {
    var unit = SC.Board.getUnitById(state, unitId);
    var error = checkMove(state, unit, destination);
    if (error) return { ok: false, error: error };
    if (!SC.Prayer.canPray(unit)) return { ok: false, error: '祈れないユニットです' };
    var ally = SC.Board.getUnitById(state, allyId);
    if (!SC.Prayer.isPrayerTarget(state, unit, destination, ally)) return { ok: false, error: '祈りを届けられない相手です' };

    var forecast = SC.Prayer.getPrayerForecast(state, unit, destination, ally);
    var events = [];
    moveUnit(unit, destination, events);
    ally.hp = forecast.hpAfter;
    var prayerData = SC.UNIT_TYPES[unit.type].prayer;
    if (prayerData.defenseBuff) ally.blessing = prayerData.defenseBuff;   // ハイプリースト：次の自分の番が始まるまで守り+1
    events.push({
      type: 'pray',
      unitId: unit.id,
      targetId: ally.id,
      restored: forecast.restored,
      soldiersBefore: forecast.soldiersBefore,
      soldiersAfter: forecast.soldiersAfter,
      targetHp: ally.hp,
      blessing: prayerData.defenseBuff || 0
    });
    events = events.concat(SC.Regulars.gainFromPrayer(state, unit, forecast.restored));   // 回復役の正規部隊は祈りで育つ
    unit.acted = true;
    unit.justHired = false;
    return { ok: true, events: events };
  }

  // ---- 城門（ステージ18から） ----
  // 城門への攻撃：兵士1人ごとに「攻撃 − 城門の守り」（最低1）。大型は2倍。城門は反撃しない。体力が0になると壊れた城門になる
  function getGateDamage(unit) {
    var type = SC.UNIT_TYPES[unit.type];
    var perSoldier = Math.max(1, type.attack - SC.GATE.defense);
    return SC.Combat.getSoldierCount(unit) * perSoldier * (type.family === 'large' ? SC.GATE.largeMultiplier : 1);
  }

  // その部隊が、destination から攻撃できる城門の一覧（{ x, y, hp }）
  function getGateTargets(state, unit, destination) {
    if (!state.gates || unit.side === state.gateSide) return [];
    return Object.keys(state.gates).map(function (key) {
      var parts = key.split(',');
      return { x: Number(parts[0]), y: Number(parts[1]), hp: state.gates[key] };
    }).filter(function (gate) { return SC.Movement.canAttackFrom(unit, destination, gate); });
  }

  function attackGate(state, unitId, destination, gatePos) {
    var unit = SC.Board.getUnitById(state, unitId);
    var error = checkMove(state, unit, destination);
    if (error) return { ok: false, error: error };
    var key = gatePos.x + ',' + gatePos.y;
    if (!state.gates || state.gates[key] === undefined) return { ok: false, error: '城門がありません' };
    if (!getGateTargets(state, unit, destination).some(function (g) { return g.x === gatePos.x && g.y === gatePos.y; })) return { ok: false, error: '城門に届きません' };
    var events = [];
    moveUnit(unit, destination, events);
    var damage = Math.min(state.gates[key], getGateDamage(unit));
    state.gates[key] -= damage;
    var broken = state.gates[key] <= 0;
    if (broken) {
      delete state.gates[key];
      state.terrain[gatePos.y][gatePos.x] = 'gateBroken';
    }
    events.push({ type: 'gate', unitId: unit.id, x: gatePos.x, y: gatePos.y, damage: damage, hpAfter: broken ? 0 : state.gates[key], broken: broken });
    unit.acted = true;
    unit.justHired = false;
    return { ok: true, events: events };
  }

  // 構え：移動せず、攻撃のかわりに構える。次の自分のターンが始まるまで、隣から攻められたら先に攻撃する
  function brace(state, unitId) {
    var unit = SC.Board.getUnitById(state, unitId);
    var error = checkMove(state, unit, unit || { x: -1, y: -1 });
    if (error) return { ok: false, error: error };
    if (!SC.UNIT_TYPES[unit.type].canBrace) return { ok: false, error: '構えられないユニットです' };
    if (unit.moved) return { ok: false, error: '動いたあとは構えられません' };
    unit.braced = true;
    unit.acted = true;
    var events = [{ type: 'brace', unitId: unit.id }];
    addCapture(state, unit, events);
    return { ok: true, events: events };
  }

  // 召喚できるマス：魔法使いの上下左右（建物の中なら建物のまわり）の、空いていて、呼ぶ部隊が立てるマス。2×2の建物の中には呼べない
  function getSummonTiles(state, unit, typeId) {
    var moveType = SC.UNIT_TYPES[typeId].moveType;
    return SC.Board.neighbors(state, unit.x, unit.y).filter(function (tile) {
      return !SC.Board.getBlock(state, tile.x, tile.y) && !SC.Board.getUnitAt(state, tile.x, tile.y) &&
        SC.Movement.getMoveCost(state.terrain[tile.y][tile.x], moveType) !== null;
    });
  }

  // 呼ぶものごとの、最大人数と成功率（％）
  function getSummonOdds(casterTypeId, typeId) {
    var summon = SC.UNIT_TYPES[casterTypeId].summon;
    var own = (summon.byType || {})[typeId] || {};
    return {
      maxSoldiers: own.maxSoldiers !== undefined ? own.maxSoldiers : summon.maxSoldiers,
      chancePercent: own.chancePercent !== undefined ? own.chancePercent : summon.chancePercent
    };
  }

  // 召喚できるか。だめなら理由の文を、よければ null
  function checkSummon(state, unit, typeId, tile) {
    var error = checkMove(state, unit, unit || { x: -1, y: -1 });
    if (error) return error;
    var summon = SC.UNIT_TYPES[unit.type].summon;
    if (!summon || summon.types.indexOf(typeId) < 0) return '召喚できないユニットです';
    if (unit.moved) return '動いたあとは召喚できません';
    var limit = state.rules && state.rules.maxUnits;
    if (limit && getUnits(state, unit.side).length >= limit) return '部隊は' + limit + 'つまでです';
    var tiles = getSummonTiles(state, unit, typeId);
    if (tiles.length === 0) return '隣に空いたマスがありません';
    if (tile && !tiles.some(function (t) { return t.x === tile.x && t.y === tile.y; })) return 'そのマスには呼べません';
    return null;
  }

  // 召喚：動く前の魔法使いが、隣のマスに部隊を呼ぶ。人数は、部隊の人数分を1人ずつ成功率で試して、成功した数（最大 maxSoldiers）。
  // 呼んだ部隊は、そのターンから動ける（2026-10-18 ユーザー決定）。魔法使いの行動は終わる。正規部隊なら、成功すると経験値
  function summonUnit(state, unitId, typeId, tile) {
    var unit = SC.Board.getUnitById(state, unitId);
    var error = checkSummon(state, unit, typeId, tile);
    if (error) return { ok: false, error: error };
    var odds = getSummonOdds(unit.type, typeId);
    var type = SC.UNIT_TYPES[typeId];
    // 1人ずつ順番に試す。最大の人数に届いたら、そこでやめる（残りを試しても結果は同じ）。
    // rolls：1人ずつの成否（召喚の場面で、魔法陣を1つずつ光らせるのに使う）
    var rolls = [];
    var soldiers = 0;
    for (var i = 0; i < type.size && soldiers < odds.maxSoldiers; i++) {
      var success = state.rng() * 100 < odds.chancePercent;
      rolls.push(success);
      if (success) soldiers += 1;
    }
    var events = [];
    unit.acted = true;
    unit.justHired = false;
    if (soldiers === 0) {
      events.push({ type: 'summon', unitId: unit.id, x: tile.x, y: tile.y, soldiers: 0, unitType: typeId, rolls: rolls, side: unit.side, casterType: unit.type });
      return { ok: true, events: events };
    }
    state.nextUnitNumber = (state.nextUnitNumber || state.units.length) + 1;
    var summoned = {
      id: 'u' + (state.nextUnitNumber - 1), type: typeId, side: unit.side, x: tile.x, y: tile.y,
      hp: soldiers * type.soldierHp, role: null, braced: false, acted: false, summoned: true,
      facing: unit.side === 'enemy' ? 'down' : 'up'
    };
    state.units.push(summoned);
    events.push({ type: 'summon', unitId: unit.id, summonedId: summoned.id, x: tile.x, y: tile.y, soldiers: soldiers, unitType: typeId, rolls: rolls, side: unit.side, casterType: unit.type });
    if (state.experience && SC.Regulars.canGainExperience(unit)) {
      // 召喚1回の成功で SC.EXPERIENCE.perSummon 点（人数ぶんにすると、毎ターン呼ぶだけで1ステージ25点ほどたまり、育ちすぎた）
      unit.exp = (unit.exp || 0) + SC.EXPERIENCE.perSummon;
      events.push({ type: 'exp', unitId: unit.id, amount: SC.EXPERIENCE.perSummon, exp: unit.exp });
      if (SC.Regulars.canRankUp(unit.regularId, unit.type, unit.exp)) events.push(SC.Regulars.rankUpUnit(unit));
    }
    return { ok: true, events: events };
  }

  // 町の上で行動を終えたら占領する（町と軍資金のあるステージだけ）
  function addCapture(state, unit, events) {
    var capture = SC.Economy.captureIfPossible(state, unit);
    if (capture) events.push(capture);
  }

  // CPUや自動対戦の行動（{ unitId, x, y, targetId, kind }）を実行する。kind が 'pray' なら祈り、'brace' なら構え、それ以外は攻撃か待機
  function perform(state, action) {
    SC.Board.useState(state);
    var anchor = SC.Board.canonical(state, action.x, action.y);   // 建物のどのマスを選んでも、建物の左上のマス
    action = Object.assign({}, action, { x: anchor.x, y: anchor.y });
    var destination = { x: action.x, y: action.y };
    if (action.kind === 'brace') return brace(state, action.unitId);
    if (action.kind === 'hire') return SC.Economy.hire(state, action.unitId, action.unitType, { x: action.x, y: action.y });
    if (action.kind === 'pray') return pray(state, action.unitId, destination, action.targetId);
    if (action.kind === 'gate') return attackGate(state, action.unitId, destination, { x: action.gateX, y: action.gateY });
    if (action.kind === 'summon') return summonUnit(state, action.unitId, action.unitType, destination);
    return act(state, action.unitId, destination, action.targetId, action.facing);
  }

  // 守りの戦い：決まったターンの敵の番が終わるまで、自軍の王が生き残れば勝ち
  function getSurviveTurns(state) { return (state.rules && state.rules.surviveTurns) || 0; }

  // (x, y) から近い順に、部隊を置けるマス（マップの中で、通れて、誰もいない）を探す
  function findFreeTile(state, x, y, moveTypeId) {
    var best = null;
    for (var ty = 0; ty < state.height; ty++) {
      for (var tx = 0; tx < state.width; tx++) {
        if (SC.Board.getUnitAt(state, tx, ty)) continue;
        var spot = SC.Board.canonical(state, tx, ty);
        if (spot.x !== tx || spot.y !== ty) continue;   // 建物は左上のマスだけ
        if (SC.Movement.getMoveCost(state.terrain[ty][tx], moveTypeId) === null) continue;
        var d = Math.abs(tx - x) + Math.abs(ty - y);
        if (!best || d < best.d) best = { x: tx, y: ty, d: d };
      }
    }
    return best;
  }

  // 増援：そのターンのその軍の番の始めに、決まったマス（ふさがっていれば近くの空いたマス）に部隊が現れる
  function addReinforcements(state, side) {
    var events = [];
    (state.reinforcements || []).forEach(function (wave) {
      if (wave.arrived || wave.turn !== state.turn || (wave.side || 'enemy') !== side) return;
      wave.arrived = true;
      if (!isGroupActive(state, wave.group)) return;   // 指揮官が倒れた組の増援は来ない
      var unitIds = [];
      wave.units.forEach(function (placement) {
        var tile = findFreeTile(state, placement.x, placement.y, SC.UNIT_TYPES[placement.type].moveType);
        if (!tile) return;
        state.nextUnitNumber = (state.nextUnitNumber || state.units.length) + 1;
        var unit = {
          id: 'u' + (state.nextUnitNumber - 1), type: placement.type, side: side, x: tile.x, y: tile.y,
          hp: SC.Combat.getMaxHp(placement.type), role: placement.role || null, braced: false, acted: false,
          facing: side === 'enemy' ? 'down' : 'up'
        };
        state.units.push(unit);
        unitIds.push(unit.id);
      });
      if (unitIds.length > 0) events.push({ type: 'reinforce', side: side, from: wave.from || '', unitIds: unitIds });
    });
    return events;
  }

  // まだ来ていない、次の増援（無ければ null）
  // group を渡すと、その組の次の増援。指揮官が倒れて止まった組は数えない
  function getNextReinforcement(state, group) {
    var waves = (state.reinforcements || []).filter(function (wave) {
      return !wave.arrived && isGroupActive(state, wave.group) && (group === undefined || wave.group === group);
    });
    waves.sort(function (a, b) { return a.turn - b.turn; });
    return waves[0] || null;
  }

  // 沼・藪のダメージ（ターンの始めに、その上にいる部隊が受ける）。受けなければ 0
  function getHazardDamage(state, unit, x, y) {
    var terrain = SC.TERRAIN[state.terrain[y][x]];
    if (!terrain.hazardPercent) return 0;
    var moveType = SC.MOVE_TYPES[SC.UNIT_TYPES[unit.type].moveType] || {};
    if (moveType.ignoresHazard) return 0;
    if ((terrain.hazardSpares || []).indexOf(SC.UNIT_TYPES[unit.type].family) >= 0) return 0;   // 墓地の瘴気は、不死には効かない
    return Math.ceil(SC.Combat.getMaxHp(unit.type) * terrain.hazardPercent / 100);
  }

  // ターンの始めの沼・藪のダメージ。全滅はしない（最後の1人の体力1は残る）
  function applyHazards(state, side) {
    var events = [];
    getUnits(state, side).forEach(function (unit) {
      var damage = Math.min(getHazardDamage(state, unit, unit.x, unit.y), unit.hp - 1);
      if (damage <= 0) return;
      unit.hp -= damage;
      events.push({ type: 'hazard', unitId: unit.id, damage: damage, targetHp: unit.hp, terrainId: state.terrain[unit.y][unit.x] });
    });
    return events;
  }

  function endTurn(state) {
    if (state.winner) return;
    state.side = otherSide(state.side);
    if (state.side === 'player') state.turn += 1;
    if (state.side === 'player' && getSurviveTurns(state) && state.turn > getSurviveTurns(state)) {
      state.winner = 'player';   // 守りきった
      state.survived = true;
      return;
    }
    state.units.forEach(function (unit) {
      unit.acted = false;
      unit.moved = false;
      unit.justHired = false;
      if (unit.side === state.side) unit.braced = false;   // 自分のターンが始まったら、構えは解ける
      if (unit.side === state.side) unit.blessing = 0;     // ハイプリーストの守り+1も、自分の番が始まったら解ける
    });
    state.turnEvents = addReinforcements(state, state.side).concat(applyHazards(state, state.side), SC.Economy.startTurn(state, state.side));   // 増援、沼・藪のダメージ、収入と補充
  }

  SC.Game = {
    createSeededRng: createSeededRng,
    createGame: createGame,
    getUnits: getUnits,
    hasUnactedUnits: hasUnactedUnits,
    otherSide: otherSide,
    act: act,
    pray: pray,
    brace: brace,
    perform: perform,
    endTurn: endTurn,
    getSurviveTurns: getSurviveTurns,
    getSummonTiles: getSummonTiles,
    checkSummon: checkSummon,
    getSummonOdds: getSummonOdds,
    summonUnit: summonUnit,
    getNextReinforcement: getNextReinforcement,
    getHazardDamage: getHazardDamage,
    getGateDamage: getGateDamage,
    isGroupActive: isGroupActive,
    getGateTargets: getGateTargets,
    attackGate: attackGate
  };
})(typeof window !== 'undefined' ? window : globalThis);
