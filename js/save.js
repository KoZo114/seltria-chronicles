// クリア状況の保存と読み込み。保存データが無い・壊れている・保存できない場合でも止まらない。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var SAVE_KEY = 'seltria-chronicles-save-v1';

  function createEmptySave() {
    return { version: 1, stages: {}, seenTips: {}, settings: { battleScene: true, sound: true }, battle: null, roster: [] };
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function getDefaultStorage() {
    try { return root.localStorage || null; } catch (error) { return null; }
  }

  function load(storage) {
    storage = storage === undefined ? getDefaultStorage() : storage;
    var save = createEmptySave();
    try {
      var parsed = JSON.parse(storage.getItem(SAVE_KEY));
      if (!isPlainObject(parsed) || parsed.version !== 1) return save;
      if (isPlainObject(parsed.stages)) {
        Object.keys(parsed.stages).forEach(function (stageId) {
          var record = parsed.stages[stageId];
          if (!isPlainObject(record) || record.cleared !== true) return;
          var bestTurns = Number.isInteger(record.bestTurns) && record.bestTurns > 0 ? record.bestTurns : null;
          save.stages[stageId] = { cleared: true, bestTurns: bestTurns };
        });
      }
      if (isPlainObject(parsed.seenTips)) {
        Object.keys(parsed.seenTips).forEach(function (tipId) {
          if (parsed.seenTips[tipId] === true) save.seenTips[tipId] = true;
        });
      }
      if (isPlainObject(parsed.settings)) {
        Object.keys(save.settings).forEach(function (name) {
          if (typeof parsed.settings[name] === 'boolean') save.settings[name] = parsed.settings[name];
        });
      }
      if (isValidBattle(parsed.battle)) save.battle = parsed.battle;
      // 正規部隊の記録（ステージ11から）：形がおかしいものは捨てる
      if (Array.isArray(parsed.roster)) {
        save.roster = parsed.roster.filter(function (member) {
          return isPlainObject(member) && typeof member.id === 'string' && typeof member.name === 'string' &&
            typeof member.type === 'string' && Number.isFinite(member.exp) && member.exp >= 0;
        }).map(function (member) { return { id: member.id, name: member.name, type: member.type, exp: Math.floor(member.exp) }; });
      }
    } catch (error) {
      return createEmptySave();
    }
    return save;
  }

  function store(save, storage) {
    storage = storage === undefined ? getDefaultStorage() : storage;
    try {
      storage.setItem(SAVE_KEY, JSON.stringify(save));
      return true;
    } catch (error) {
      return false;
    }
  }

  // クリアを記録する。最少ターンは、これまでより少ないときだけ更新する。
  function recordClear(save, stageId, turns) {
    var previous = save.stages[stageId];
    var bestTurns = previous && previous.bestTurns ? Math.min(previous.bestTurns, turns) : turns;
    save.stages[stageId] = { cleared: true, bestTurns: bestTurns };
    return save;
  }

  // 遊べるステージか。ステージ1はいつでも、それ以降は一つ前のステージをクリアすると遊べる
  function isStageUnlocked(save, stageId) {
    if (stageId <= 1) return true;
    var previous = save.stages[stageId - 1];
    return !!(previous && previous.cleared);
  }

  // ---- 途中保存（遊びかけの戦い） ----
  // 保存するのは、自軍の番で、勝敗が決まっていない戦いだけ。形がおかしい保存は使わない（無いものとして扱う）
  function isValidBattle(battle) {
    if (!isPlainObject(battle) || !Number.isInteger(battle.stageId) || !isPlainObject(battle.state)) return false;
    var state = battle.state;
    return Array.isArray(state.units) && Array.isArray(state.terrain) && Number.isInteger(state.turn) &&
      state.side === 'player' && !state.winner && state.units.every(function (unit) {
        return isPlainObject(unit) && typeof unit.id === 'string' && typeof unit.type === 'string' && typeof unit.hp === 'number';
      });
  }

  // 戦いの状態を、保存できる形（関数を含まない写し）にして記録する
  function saveBattle(save, stageId, state) {
    if (state.side !== 'player' || state.winner) return;
    save.battle = { stageId: stageId, turn: state.turn, state: JSON.parse(JSON.stringify(state)) };
  }

  function clearBattle(save) { save.battle = null; }

  // 保存した戦いを、遊べる状態に戻す。乱数は新しく用意する。戻せないときは null
  function restoreBattle(save, stages) {
    if (!isValidBattle(save.battle) || !stages[save.battle.stageId]) return null;
    var state = JSON.parse(JSON.stringify(save.battle.state));
    state.rng = Math.random;
    return { stageId: save.battle.stageId, state: state };
  }

  SC.Save = {
    SAVE_KEY: SAVE_KEY, createEmptySave: createEmptySave, load: load, store: store, recordClear: recordClear, isStageUnlocked: isStageUnlocked,
    saveBattle: saveBattle, clearBattle: clearBattle, restoreBattle: restoreBattle
  };
})(typeof window !== 'undefined' ? window : globalThis);
