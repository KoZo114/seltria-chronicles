// クリア状況の保存と読み込み。保存データが無い・壊れている・保存できない場合でも止まらない。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var SAVE_KEY = 'seltria-chronicles-save-v1';

  function createEmptySave() {
    return { version: 1, stages: {}, seenTips: {}, settings: { battleScene: true, sound: true }, battle: null, roster: [], rosterVersion: (SC.ROSTER_VERSION || 1), rosterBefore: {} };
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
          if (record.expEarned === true) save.stages[stageId].expEarned = true;   // そのステージで、正規部隊がもう経験値をもらった
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
      // 育ち方を変えたあとの古い記録（版が違う）は、正規部隊だけ作り直す。遊びかけの戦いも、正規部隊がいれば消す
      var rosterIsCurrent = parsed.rosterVersion === (SC.ROSTER_VERSION || 1);
      if (!rosterIsCurrent && Array.isArray(parsed.roster) && parsed.roster.length > 0) {
        save.rosterWasReset = true;
        if (save.battle && save.battle.state && (save.battle.state.deployed || []).length > 0) save.battle = null;
      }
      if (rosterIsCurrent && Array.isArray(parsed.roster)) save.roster = cleanRoster(parsed.roster);
      // ステージを始める前の正規部隊の記録（「ここからやり直す」で戻るため。2026-10-25）
      if (rosterIsCurrent && isPlainObject(parsed.rosterBefore)) {
        Object.keys(parsed.rosterBefore).forEach(function (stageId) {
          if (Array.isArray(parsed.rosterBefore[stageId])) save.rosterBefore[stageId] = cleanRoster(parsed.rosterBefore[stageId]);
        });
      }
    } catch (error) {
      return createEmptySave();
    }
    return save;
  }

  function cleanRoster(roster) {
    return roster.filter(function (member) {
      return isPlainObject(member) && typeof member.id === 'string' && typeof member.name === 'string' &&
        typeof member.type === 'string' && Number.isFinite(member.exp) && member.exp >= 0;
    }).map(function (member) { return { id: member.id, name: member.name, type: member.type, exp: Math.floor(member.exp) }; });
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
    if (previous && previous.expEarned) save.stages[stageId].expEarned = true;
    return save;
  }

  // 正規部隊が経験値をもらえるステージか。もらえるのは、そのステージで1回だけ（勝って記録に書き戻したら、もらったことにする）。
  // 2026-10-19：育ち方を見直したので、「クリアしたか」ではなく「もう経験値をもらったか」で決めるように変えた（前にクリアしたステージでも、もう一度もらえる）
  function canEarnExperience(save, stageId) {
    var record = save.stages[stageId];
    return !(record && record.expEarned);
  }

  function markExperienceEarned(save, stageId) {
    if (save.stages[stageId]) save.stages[stageId].expEarned = true;
  }

  // ---- やり直し（2026-10-25 ユーザーの希望） ----
  // 正規部隊のいるステージを、経験値がもらえる状態で始めるときに、始める前の正規部隊を覚えておく
  function rememberRosterBefore(save, stageId) {
    if (!canEarnExperience(save, stageId)) return;
    save.rosterBefore = save.rosterBefore || {};
    save.rosterBefore[stageId] = cleanRoster(save.roster || []);
  }

  // 正規部隊のいるステージの番号（小さい順）
  function getRegularStageIds(stages) {
    return Object.keys(stages).map(Number).filter(function (id) { return !!stages[id].regularSlots; }).sort(function (a, b) { return a - b; });
  }

  // 「ここからやり直す」ができるか：経験値をもらい済みで、始める前の正規部隊を覚えている（最初のステージは、いつでも最初の隊長たちに戻れる）
  function canRewindTo(save, stageId, stages) {
    var ids = getRegularStageIds(stages);
    if (ids.indexOf(stageId) < 0 || canEarnExperience(save, stageId)) return false;
    return stageId === ids[0] || !!(save.rosterBefore && save.rosterBefore[stageId]);
  }

  // そのステージを始める前の正規部隊に戻し、そのステージと後のステージで、経験値をもう一度もらえるようにする。クリアの記録は残す
  function rewindTo(save, stageId, stages) {
    if (!canRewindTo(save, stageId, stages)) return false;
    var ids = getRegularStageIds(stages);
    save.roster = stageId === ids[0] ? [] : cleanRoster(save.rosterBefore[stageId]);
    ids.forEach(function (id) {
      if (id < stageId) return;
      if (save.stages[id]) delete save.stages[id].expEarned;
      if (save.rosterBefore && id > stageId) delete save.rosterBefore[id];
    });
    save.battle = null;   // 遊びかけの戦いは、隊長たちが変わるので消す
    return true;
  }

  // 記録を全部消して、はじめから（音と戦闘シーンの設定だけ残す）
  function resetAll(save) {
    var fresh = createEmptySave();
    fresh.settings = { battleScene: save.settings.battleScene, sound: save.settings.sound };
    return fresh;
  }

  // 遊べるステージか。ステージ1はいつでも、それ以降は一つ前のステージをクリアすると遊べる
  // 遊べるステージ（2026-10-21 ユーザーの希望）：
  //  ・はじめから遊べるのは 1・2・3・11
  //  ・ステージ1〜10は5つずつ。はじめの3つは好きな順で遊べ、3つともクリアすると4つ目、4つ目をクリアすると5つ目
  //    （6・7・8は、ステージ5をクリアすると遊べる）
  //  ・ステージ11からは、1つ前をクリアすると遊べる（ステージ1〜10をクリアしていなくても、11から遊べる）
  var FREE_STAGES = [1, 2, 3, 11];
  var FREE_BLOCK_END = 10;   // 5つずつの区切りで遊ぶのは、ステージ10まで

  function isCleared(save, stageId) { var record = save.stages[stageId]; return !!(record && record.cleared); }

  function isStageUnlocked(save, stageId) {
    if (FREE_STAGES.indexOf(stageId) >= 0) return true;
    if (stageId > FREE_BLOCK_END) return isCleared(save, stageId - 1);
    var first = stageId - ((stageId - 1) % 5);   // その区切りの1つ目（1 か 6）
    var offset = stageId - first;
    if (offset <= 2) return isCleared(save, first - 1);   // 6・7・8：ステージ5をクリアすると
    if (offset === 3) return isCleared(save, first) && isCleared(save, first + 1) && isCleared(save, first + 2);
    return isCleared(save, first + 3);
  }

  // まだ遊べないステージの、解放のしかた（ステージを選ぶ画面に出す）
  function getUnlockHint(stageId) {
    if (stageId > FREE_BLOCK_END) return '前の戦場で勝利すると解放';
    var first = stageId - ((stageId - 1) % 5);
    var offset = stageId - first;
    if (offset <= 2) return 'ステージ' + (first - 1) + 'で勝利すると解放';
    if (offset === 3) return 'ステージ' + first + '〜' + (first + 2) + 'を全て制覇で解放';
    return 'ステージ' + (first + 3) + 'で勝利すると解放';
  }

  // 勝ったあとの「次のステージへ」で進むステージ（無ければ null）。
  // ステージ1〜10は、同じ区切りの中で、遊べてまだクリアしていないステージを先に（1→2→3→4→5）。無ければ次の番号
  function getNextStage(save, stageId, stageIds) {
    if (stageId <= FREE_BLOCK_END) {
      var first = stageId - ((stageId - 1) % 5);
      for (var id = first; id < first + 5; id++) {
        if (id !== stageId && stageIds.indexOf(id) >= 0 && isStageUnlocked(save, id) && !isCleared(save, id)) return id;
      }
    }
    var next = stageId + 1;
    return stageIds.indexOf(next) >= 0 && isStageUnlocked(save, next) ? next : null;
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
    SAVE_KEY: SAVE_KEY, createEmptySave: createEmptySave, load: load, store: store, recordClear: recordClear, isStageUnlocked: isStageUnlocked, getUnlockHint: getUnlockHint, getNextStage: getNextStage,
    canEarnExperience: canEarnExperience, markExperienceEarned: markExperienceEarned,
    rememberRosterBefore: rememberRosterBefore, canRewindTo: canRewindTo, rewindTo: rewindTo, resetAll: resetAll,
    saveBattle: saveBattle, clearBattle: clearBattle, restoreBattle: restoreBattle
  };
})(typeof window !== 'undefined' ? window : globalThis);
