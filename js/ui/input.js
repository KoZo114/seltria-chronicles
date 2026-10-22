// タップの受け付けと、1ステージ分の進行（選択 → 移動 → 攻撃／待機 → ターン終了 → 敵の番）。
// ルールの判定はすべて js/rules に任せ、ここでは「いま何を選んでいるか」だけを管理する。
(function (root) {
  var SC = (root.SC = root.SC || {});

  var state = null;
  var stage = null;
  var options = null;
  // mode：'idle'（何も選んでいない）→ 'selected'（移動先を選ぶ）→ 'moved'（コマンドを選ぶ）
  //       → 'aim'（攻撃する敵・祈る味方を選ぶ。aim は 'attack' か 'prayer'）→ 'forecast'（攻撃の見込み）／'prayer'（祈りの見込み）
  var selection = null;      // { mode, aim, unitId, reach, pending, targetId, inspect }
  var INPUT_LOCK_MS = 350;   // 画面が切り替わった直後のタップは受け付けない（連打で、出てきたばかりのボタンを押してしまわないように）
  var lastModeChange = 0;
  var lastMode = null;
  var busy = false;          // 演出中や敵の番は操作を受け付けない
  var session = 0;           // やり直し・中断のときに、途中の演出を打ち切るための番号
  var unitTypeById = {};
  var pendingArrivals = {};   // 増援で現れたが、まだ画面に出していない部隊（番号 → true）

  var FACING_NAMES = { up: '上', down: '下', left: '左', right: '右' };
  var FACING_ASSIST_STAGES = [7, 11];   // 騎士の向きの案内を出すステージ
  // 増援の組の名前（ステージ19から）
  var GROUP_NAMES = { north: '北', south: '南', east: '東', west: '西' };


  // 祈りと召喚の案内（2026-10-21 ユーザーの希望）：その部隊がはじめて出るステージ（ステージ1〜3は好きな順で遊べるので、2と3はまとめて1回）と、ステージ11。
  // コマンドのボタンを光らせて説明を出し、相手やマスを選ぶところでも説明を出す。実際に祈る・呼ぶと、見たことにする
  var ACTION_ASSISTS = {
    prayer: {
      keys: { 2: 'prayerAssist_early', 3: 'prayerAssist_early', 11: 'prayerAssist_11' },
      menu: '僧侶は、隣のけがをした味方（6人隊）に「祈る」と、倒れた兵士を戻せます。光っている「祈る」を押してみよう。動かずに祈ると、多く戻せます。',
      choose: '戻せる人数を見て、「祈る」で決めよう。相手が何人かいるときは、緑に光る味方から選べます。'
    },
    // 歩兵の構え（ステージ4ではじめて出る。ステージ11はアルド隊が歩兵で出るので）
    brace: {
      keys: { 4: 'braceAssist_4', 11: 'braceAssist_11' },
      menu: '歩兵は、動かずにその場で「構え」ができます。構えると、次の自分の番まで、隣から攻めてきた敵より先に突けます（弓兵の攻撃には効きません）。敵が近くにいるときは、光っている「構え」を押してみよう。'
    },
    summon: {
      keys: { 12: 'summonAssist_12' },
      menu: '魔法使いは、動く前なら「召喚」で、隣のマスにスケルトンを呼べます（1人ずつ半分の確率で、最大3人）。光っている「召喚」を押してみよう。',
      choose: '緑に光るマスをタップすると、そこにスケルトンを呼べます。呼んだスケルトンは、すぐに動けます。'
    }
  };

  function actionAssistKey(kind) {
    var key = ACTION_ASSISTS[kind].keys[stage.id];
    return key && !options.save.seenTips[key] ? key : null;
  }

  function finishActionAssist(kind) {
    var key = actionAssistKey(kind);
    if (!key) return;
    options.save.seenTips[key] = true;
    SC.Save.store(options.save);
    SC.Screens.hideToast();
  }

  var TIPS = {
    highPriest: 'ハイプリーストは、動かずに祈ると6人隊の倒れた兵士を全員戻せます。3人隊には2人戻せます。祈った味方は、次の自分の番が始まるまで守りが1上がります（右に白い盾の印）。',
    saga: 'サーガの召喚は必ず成功します。スケルトンは6人、ゴーレムは3人そろって現れます。',
    wizard: 'ウィザードは、動く前なら「スケルトン」か「ゴーレム」を選んで、隣に呼べます。スケルトンは最大4人（1人ずつ70％）、ゴーレムは最大2人（1人ずつ50％）。ゴーレムは硬い壁ですが、魔法に弱く、足が遅いです。',
    priest: 'プリーストは、6人隊に加えて、3人隊（騎士・グリフォン・ワイバーンなど）にも祈れます。3人隊に祈ると、1人戻せます（王と、召喚で出た部隊は戻せません）。',
    summon: '魔法使いは、動く前ならコマンド「召喚」で、隣にスケルトンを呼べます（1人ずつ半分の確率で、最大3人）。呼んだスケルトンは、すぐ動けます。',
    fort: '砦は、歩兵か王が行動を終えると占領できます。毎ターン20Gが入り、王が自軍の砦にいれば、そこで部隊を雇えます。中にいる部隊は、受ける打撃が2減ります。',
    cavalry: '騎士は足が速く、斜めの相手にも攻撃できます。斜めから攻められた歩兵などは反撃できません。待機するときは向きを選びます。向いている側の斜めには反撃できますが、斜め後ろは弱点です。',
    brace: '歩兵は、その場から動かずに「構え」を選べます。構えると、次のターンまで、隣から攻めてきた敵より先に攻撃できます。弓兵の攻撃には効きません。',
    hire: '王が自軍の城にいるとき、王を選んでその場にとどまると、コマンドに「雇う」が出ます。雇った部隊は城から出てきて、その部隊の移動力のぶんだけ動けます。',
    town: '歩兵が町の上で行動を終えると、その町を占領します。持っている町が多いほど、ターンの始めに入るお金が増えます。',
    king: '王の部隊が全滅したら負けです。城にいると受けるダメージが30％減るので、城から出さないのが安全です。',
    archer: '弓兵は2マス先だけを攻撃できます。隣の敵は撃てないので、歩兵の後ろに置きましょう。',
    cleric: '僧侶は、隣の味方（6人隊）に祈って、倒れた兵士を戻せます。動かずに祈るほうが多く戻せるので、前線のすぐ後ろに置いておきましょう。打たれ弱いので、敵の前には出さないこと。',
    // 攻撃の形（2026-10-22）
    lance: 'ナイトは槍の部隊です。動かずにその場で突くと、まっすぐ2マス先にも届きます（うすい赤のマス）。味方の後ろからでも突けます。まっすぐ2マス先から撃ってきた弓兵には反撃できます。',
    around: 'この部隊は、斜めも含めたまわり8マスに攻撃でき、どこから攻められても反撃します。囲んで斜めから攻めても反撃を受けるので、弓や魔法で離れて攻めるのが安全です。',
    longbow: 'エルフ・ハイエルフは長弓です。動かずにその場で撃つと、1マス遠くまで届きます（うすい赤のマス）。反撃も遠くまで届きます。',
    forest: '森は移動しにくい代わりに、そこにいると相手の兵士1人の打撃が2減ります。守りにとても向いた地形です。'
  };

  function byId(id) { return document.getElementById(id); }
  function tileKey(x, y) { return x + ',' + y; }
  function unitType(unit) { return SC.UNIT_TYPES[unit.type]; }

  function clearSelection() {
    selection = { mode: 'idle', aim: null, unitId: null, reach: [], pending: null, targetId: null, inspect: null };
  }

  function selectedUnit() {
    return selection.unitId ? SC.Board.getUnitById(state, selection.unitId) : null;
  }

  // 選択中のユニットが「いま立っている扱い」のマス（仮移動中は移動先）
  function selectedPosition() {
    var unit = selectedUnit();
    return selection.pending || { x: unit.x, y: unit.y };
  }

  function isPlayerInputOpen() {
    return !busy && !state.winner && state.side === 'player';
  }

  // ---- ステージの開始 ----

  // 遊びかけの戦いを保存する（自軍の番のときだけ。勝敗が決まったら消す）
  function saveProgress() {
    if (!state || !options) return;
    if (state.winner) SC.Save.clearBattle(options.save);
    else SC.Save.saveBattle(options.save, stage.id, state);
    SC.Save.store(options.save);
  }

  // 保存した戦いの続きから始める
  function resume(startOptions) {
    var restored = SC.Save.restoreBattle(startOptions.save, SC.STAGES);
    if (!restored) return false;
    session += 1;
    stage = SC.STAGES[restored.stageId];
    options = startOptions;
    state = restored.state;
    prepareBoard();
    showTurnBanner('続きから　ターン ' + state.turn, 'player');
    return true;
  }

  function prepareBoard() {
    if (!state.blockOf) state.blockOf = SC.Board.findBlocks(state.terrain);   // 2×2の建物（前の版の続きから遊ぶとき）
    SC.Board.useState(state);
    unitTypeById = {};
    pendingArrivals = {};
    state.units.forEach(function (unit) { unitTypeById[unit.id] = unit.type; });
    busy = false;
    SC.Sound.playMusic(stage.music, true);
    clearSelection();
    SC.Screens.hideToast();
    SC.Render.buildBoard(state, onTileTap);
    refresh();
    // 画面より大きいマップでは「全体」ボタンを出し、最初は自軍の王が見えるところから始める
    byId('overview-button').classList.toggle('hidden', !SC.Render.isScrollable());
    focusKing(true);
  }

  // ---- 見えている範囲（大きいマップ） ----

  function focusKing(instant) {
    var king = SC.Game.getUnits(state, 'player').filter(function (unit) { return unitType(unit).isKing; })[0];
    return king ? SC.Render.focusTiles([king], { instant: instant, margin: 1.5 }) : Promise.resolve();
  }

  function showOverview() {
    if (!state || !SC.Render.isScrollable()) return;
    SC.Overview.open({
      state: state,
      viewRect: SC.Render.getViewRect(),
      onPick: function (x, y) { SC.Render.centerOn(x, y); }
    });
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // ステージの始めの説明：お話・新しい決まり（色の違う枠）・勝ち負けの条件を分けて見せる（2026-10-22）
  function buildBriefingHtml(stage) {
    var html = '<p class="briefing-story">' + escapeHtml(stage.intro) + '</p>';
    if (stage.ruleNote) {
      var lines = stage.ruleNote.split('\n');
      html += '<div class="briefing-rule"><h3>' + escapeHtml(lines[0]) + '</h3><p>' + escapeHtml(lines.slice(1).join('\n')) + '</p></div>';
    }
    html += '<div class="briefing-goal">' + stage.goalText.split('\n').map(function (line) {
      var parts = line.split('：');
      var bad = parts[0] === '敗北';
      return '<div class="' + (bad ? 'lose' : 'win') + '"><b>' + escapeHtml(parts[0]) + '</b><span>' + escapeHtml(parts.slice(1).join('：')) + '</span></div>';
    }).join('') + '</div>';
    return html;
  }

  function start(stageId, startOptions) {
    session += 1;
    stage = SC.STAGES[stageId];
    options = startOptions;
    state = SC.Game.createGame(stage, undefined, { regulars: startOptions.regulars || [], noExperience: startOptions.noExperience });
    prepareBoard();
    busy = true;   // 「出陣する」を押すまでは、盤面を押せない
    SC.Screens.showModal({
      title: stage.title,
      kind: 'briefing',
      html: buildBriefingHtml(stage),
      buttons: [
        // 間違えて選んだときは、ステージを選ぶ画面へ戻れる。まだ保存していないので、前の遊びかけも消えない
        { label: 'もどる', onTap: function () { busy = false; exitToTitle(startOptions.onBack); } },
        { label: '出陣する', style: 'primary', onTap: function () {
          busy = false;
          saveProgress();   // 出陣したら、前の遊びかけは消えて、この戦いが保存される
          // キャラの会話（そのステージをはじめて遊ぶときだけ。2026-10-21）。見たことは、ヒントと同じ記録に残す
          var talk = (SC.TALKS || {})[stage.id];
          var talkKey = 'talk_' + stage.id;
          if (talk && SC.TalkScene && !options.save.seenTips[talkKey]) {
            options.save.seenTips[talkKey] = true;
            SC.Save.store(options.save);
            busy = true;
            var mySession = session;
            SC.TalkScene.play(talk, state.deployed).then(function () {
              if (mySession !== session) return;
              busy = false;
              showTurnBanner('ターン 1　自軍の番', 'player');
            });
            return;
          }
          showTurnBanner('ターン 1　自軍の番', 'player');
        } }
      ]
    });
  }

  // ---- タップ ----

  function onTileTap(x, y) {
    if (!isPlayerInputOpen()) return;
    SC.Board.useState(state);
    var anchor = SC.Board.canonical(state, x, y);   // 2×2の建物のどのマスを押しても、建物を押したことにする
    x = anchor.x; y = anchor.y;
    SC.Screens.hideToast();
    var tapped = SC.Board.getUnitAt(state, x, y);

    if (selection.mode !== 'idle') {
      var unit = selectedUnit();
      var position = selectedPosition();
      var isCurrentTile = position.x === x && position.y === y;
      if (tapped && tapped.id === unit.id && !isCurrentTile) tapped = null;
      if (!tapped && isCurrentTile) tapped = unit;

      if (tapped && SC.Prayer.isPrayerTarget(state, unit, position, tapped)) {
        if (selection.mode === 'prayer' && selection.targetId === tapped.id) { if (!isInputLocked()) commitPrayer(tapped.id); return; }
        selection.pending = position;
        selection.mode = 'prayer';
        selection.targetId = tapped.id;
        refresh();
        return;
      }
      if (tapped && tapped.side !== unit.side && SC.Movement.canAttackFrom(unit, position, tapped)) {
        if (selection.mode === 'forecast' && selection.targetId === tapped.id) { if (!isInputLocked()) commitAction(tapped.id); return; }
        selection.pending = position;
        selection.mode = 'forecast';
        selection.targetId = tapped.id;
        refresh();
        return;
      }
      // 城門（ステージ18から）：届く城門を押すと、城門を攻める見込みを出す。もう一度押すか「攻撃する」で決める
      var gateHere = !tapped && getGateTargets().filter(function (g) { return g.x === x && g.y === y; })[0];
      if (gateHere && selection.mode !== 'selected') {
        if (selection.mode === 'gateForecast' && selection.gateKey === tileKey(x, y)) { if (!isInputLocked()) commitGate(gateHere); return; }
        selection.mode = 'gateForecast';
        selection.gateKey = tileKey(x, y);
        refresh();
        return;
      }
      if (selection.mode === 'facing') {
        // 向きを選んでいるときに、矢印でないマスを押したら、コマンドを選ぶところへ戻る
        selection.mode = 'moved';
        refresh();
        return;
      }
      if (selection.mode === 'relocate') {
        // 雇った部隊の出るマスを選び直す。選べないマスを押したら、コマンドに戻る
        var canRelocate = SC.Economy.getRelocateTiles(state, unit).some(function (tile) { return tile.x === x && tile.y === y; });
        if (canRelocate) {
          if (x === unit.x && y === unit.y) { selection.mode = 'moved'; refresh(); }
          else commitRelocate({ x: x, y: y });
          return;
        }
        selection.mode = 'moved';
        refresh();
        return;
      }
      if (selection.mode === 'summonPlace') {
        // 召喚する隣のマスを選ぶ。選べないマスを押したら、コマンドに戻る
        var canSummon = SC.Game.getSummonTiles(state, unit, selection.summonType).some(function (tile) { return tile.x === x && tile.y === y; });
        if (canSummon) { commitSummon({ x: x, y: y }); return; }
        selection.mode = 'moved';
        refresh();
        return;
      }
      if (selection.mode === 'hirePlace') {
        // 雇った部隊が城から出て行くマスを選ぶ。行けないマスを押したら、雇う部隊を選ぶところへ戻る
        var canPlace = SC.Economy.getHireDestinations(state, unit, selection.hireType).some(function (tile) { return tile.x === x && tile.y === y; });
        if (canPlace) { commitHire({ x: x, y: y }); return; }
        selection.mode = 'moved';
        refresh();
        return;
      }
      if (selection.mode === 'aim') {
        // 攻撃・祈りの相手を選んでいるときに、相手でないマスを押したら、コマンドを選ぶところへ戻る
        selection.mode = 'moved';
        selection.aim = null;
        refresh();
        return;
      }
      var canMoveThere = selection.reach.some(function (tile) { return tile.x === x && tile.y === y; });
      if (canMoveThere) {
        selection.pending = { x: x, y: y };
        selection.mode = 'moved';
        selection.targetId = null;
        refresh();
        return;
      }
      clearSelection();
    }

    if (tapped && tapped.side === 'player' && !tapped.acted) {
      selectUnit(tapped);
    } else {
      selection.inspect = tapped ? { unitId: tapped.id } : { x: x, y: y };
    }
    refresh();
  }

  function selectUnit(unit) {
    clearSelection();
    SC.Sound.play('select');
    selection.mode = 'selected';
    selection.unitId = unit.id;
    selection.reach = SC.Movement.getReachableTiles(state, unit);
    SC.Render.focusTiles(selection.reach, { center: unit, margin: 0.2 });   // 動けるマスが画面からはみ出すなら、入るように動かす
    var canReachForest = selection.reach.some(function (tile) {
      return state.terrain[tile.y][tile.x] === 'forest' && !(tile.x === unit.x && tile.y === unit.y);
    });
    if (unitType(unit).summon && unitType(unit).summon.chancePercent >= 100) showTipOnce('saga');
    else if (unitType(unit).prayer && unitType(unit).prayer.stillAll) showTipOnce('highPriest');
    else if (unitType(unit).summon && unitType(unit).summon.types.length > 1) showTipOnce('wizard');
    else if (unitType(unit).summon) showTipOnce('summon');
    else if (unitType(unit).prayer && unitType(unit).prayer.heavyAmount) showTipOnce('priest');
    else if (unitType(unit).lance) showTipOnce('lance');
    else if (unitType(unit).allDirections && unitType(unit).family !== 'large') showTipOnce('around');
    else if (unitType(unit).stillRangeBonus) showTipOnce('longbow');
    else if (stage.newRule === 'siege' && (unitType(unit).isKing || SC.Economy.capturesTowns(unit))) showTipOnce('fort');
    else if (unitType(unit).isKing && SC.Economy.isEnabled(state)) showTipOnce('hire');
    else if (SC.Economy.capturesTowns(unit) && SC.Economy.isEnabled(state)) showTipOnce('town');
    else if (unitType(unit).diagonalFront) showTipOnce('cavalry');
    else if (unitType(unit).isKing) showTipOnce('king');
    else if (SC.Prayer.canPray(unit)) showTipOnce('cleric');
    else if (unitType(unit).canBrace && stage.newRule === 'brace') showTipOnce('brace');
    else if (unit.type === 'archer') showTipOnce('archer');
    else if (canReachForest) showTipOnce('forest');
  }

  function showTipOnce(tipId) {
    var save = options.save;
    if (save.seenTips[tipId]) return;
    save.seenTips[tipId] = true;
    SC.Save.store(save);
    SC.Screens.showToast('ヒント：' + TIPS[tipId]);
  }

  // ---- ボタン ----

  function onUndo() {
    if (!isPlayerInputOpen()) return;
    if (isInputLocked()) return;
    // 雇ったばかりの部隊のコマンドで「もどる」：城から出て行くマスを選び直す（雇うことは取り消せない）
    var current = selectedUnit();
    if (selection.mode === 'moved' && current && current.justHired) { selection.mode = 'relocate'; refresh(); return; }
    if (selection.mode === 'relocate' || selection.mode === 'facing') { selection.mode = 'moved'; refresh(); return; }
    if (selection.mode === 'forecast' || selection.mode === 'gateForecast' || selection.mode === 'prayer' || selection.mode === 'aim' || selection.mode === 'hirePlace' || selection.mode === 'summonPlace') {
      selection.mode = 'moved'; selection.aim = null; selection.targetId = null; selection.gateKey = null;
    }
    else if (selection.mode === 'moved') { selection.mode = 'selected'; selection.pending = null; }
    else clearSelection();
    refresh();
  }

  function onConfirm() {
    if (!isPlayerInputOpen() || isInputLocked()) return;
    if (selection.mode === 'prayer') commitPrayer(selection.targetId);
    else if (selection.mode === 'forecast') commitAction(selection.targetId);
    else if (selection.mode === 'gateForecast') commitGate(selectedGate());
  }

  // ---- 城門（ステージ18から） ----
  function getGateTargets() {
    var unit = selectedUnit();
    return unit ? SC.Game.getGateTargets(state, unit, selectedPosition()) : [];
  }

  function selectedGate() {
    return getGateTargets().filter(function (g) { return tileKey(g.x, g.y) === selection.gateKey; })[0] || null;
  }

  function commitGate(gate) {
    if (!gate) return;
    var unit = selectedUnit();
    var result = SC.Game.attackGate(state, unit.id, selectedPosition(), gate);
    if (!result.ok) { SC.Screens.showToast(result.error); return; }
    runAnimation(result.events, null);
  }

  function isInputLocked() { return Date.now() - lastModeChange < INPUT_LOCK_MS; }

  // コマンド（攻撃・祈る・待機）。攻撃と祈りは相手を選ぶ段階へ進む。相手が1人だけなら、そのまま見込みを出す
  function onCommand(command, summonChoice) {
    if (!isPlayerInputOpen() || selection.mode !== 'moved' || isInputLocked()) return;
    // 構えの案内は、歩兵が多くて何度も出るとじゃまなので、案内を見てほかのコマンドを選んだときも、見たことにする
    var braceShown = selection.pending && selection.pending.x === selectedUnit().x && selection.pending.y === selectedUnit().y && !selectedUnit().moved;   // 構えのボタンが光っていたか
    if (command !== 'brace' && unitType(selectedUnit()).canBrace && braceShown && actionAssistKey('brace')) finishActionAssist('brace');
    if (command === 'wait') {
      // 向きを持つ部隊（騎士）は、待機する前に向きを選ぶ（上下左右の矢印）
      if (unitType(selectedUnit()).diagonalFront) {
        selection.mode = 'facing';
        // 騎士の向きの案内（騎士がはじめて出るステージ7と、ステージ11から始める人のために11。それぞれ最初の1回だけ。2026-10-21 ユーザーの希望）
        var assistKey = 'facingAssist_' + stage.id;
        selection.facingAssist = FACING_ASSIST_STAGES.indexOf(stage.id) >= 0 && !options.save.seenTips[assistKey];
        if (selection.facingAssist) {
          SC.Screens.showToast('騎士は、止まるときに向きを選びます。光っている矢印のどれかをタップすると、その向きを向いて止まります。向いている側の斜めの敵には反撃できますが、斜め後ろからは反撃できません。敵のほうを向けて止めよう。', true);
        }
        var at = selectedPosition();
        SC.Render.focusTiles([{ x: at.x - 1, y: at.y - 1 }, { x: at.x + 1, y: at.y + 1 }], { center: at, margin: 0.2 });   // 矢印が全部見えるように
        refresh();
        return;
      }
      commitAction(null);
      return;
    }
    if (command === 'brace') { commitBrace(); return; }
    if (command === 'hire') { openHireScene(); return; }
    if (command === 'summon') {
      // 召喚：隣の空いたマスを選ぶ（1つだけなら、すぐ呼ぶ）
      var summoner = selectedUnit();
      var summonType = summonChoice || unitType(summoner).summon.types[0];
      var summonTiles = SC.Game.getSummonTiles(state, summoner, summonType);
      selection.summonType = summonType;
      if (summonTiles.length === 1) { commitSummon(summonTiles[0]); return; }
      if (actionAssistKey('summon')) SC.Screens.showToast(ACTION_ASSISTS.summon.choose, true);
      selection.mode = 'summonPlace';
      refresh();
      return;
    }
    var targets = command === 'attack' ? getAttackTargets() : getPrayerTargets();
    if (command === 'attack') {
      // 城門も攻撃の相手になる。相手が城門1つだけなら、そのまま見込みを出す
      var gates = getGateTargets();
      if (targets.length === 0 && gates.length === 1) { selection.mode = 'gateForecast'; selection.gateKey = tileKey(gates[0].x, gates[0].y); refresh(); return; }
      if (gates.length > 0 && targets.length + gates.length > 1) { selection.mode = 'aim'; selection.aim = 'attack'; refresh(); return; }
    }
    if (targets.length === 0) return;
    if (command === 'prayer' && actionAssistKey('prayer')) SC.Screens.showToast(ACTION_ASSISTS.prayer.choose, true);
    if (targets.length === 1) {
      selection.mode = command === 'attack' ? 'forecast' : 'prayer';
      selection.targetId = targets[0].id;
    } else {
      selection.mode = 'aim';
      selection.aim = command;
    }
    refresh();
  }

  function getAttackTargets() {
    var unit = selectedUnit();
    var position = selectedPosition();
    return SC.Game.getUnits(state, SC.Game.otherSide(unit.side)).filter(function (enemy) {
      return SC.Movement.canAttackFrom(unit, position, enemy);
    });
  }

  function getPrayerTargets() {
    return SC.Prayer.getPrayerTargets(state, selectedUnit(), selectedPosition());
  }

  function onEndTurn() {
    if (!isPlayerInputOpen()) return;
    clearSelection();
    refresh();
    var remaining = SC.Game.getUnits(state, 'player').filter(function (unit) { return !unit.acted; }).length;
    if (remaining === 0) { runEnemyTurn(); return; }
    SC.Screens.showModal({
      title: 'ターン終了',
      text: 'まだ行動していないユニットが ' + remaining + ' 人います。\nターンを終了しますか？',
      buttons: [
        { label: 'もどる' },
        { label: '終了する', style: 'primary', onTap: runEnemyTurn }
      ]
    });
  }

  // ---- 行動の実行と演出 ----

  // 戦闘シーン用に、攻撃の前の状態（体力など）を控えておく。攻撃しない行動なら null
  // attackPosition は、攻撃する側が攻撃のときに立つマス（移動してから攻撃するので、いまの位置とは限らない）
  function captureBattle(attacker, attackPosition, targetId) {
    var target = targetId ? SC.Board.getUnitById(state, targetId) : null;
    if (!target) return null;
    // それぞれが立っている地形も控える（戦闘シーンの背景を、左右で別々の地形にするため）
    function snapshot(unit, position) {
      return {
        id: unit.id, type: unit.type, side: unit.side, hp: unit.hp, maxHp: SC.Combat.getMaxHp(unit.type), regularId: unit.regularId || null,
        terrainId: state.terrain[position.y][position.x], terrainOwner: getCastleOwner(position.x, position.y)
      };
    }
    return { attacker: snapshot(attacker, attackPosition), defender: snapshot(target, target) };
  }

  // そのマスの城がどちらの軍のものか（戦闘シーンの旗の色に使う）。最初に王が立っていた城を、その軍の城とする。
  // 城門・城壁は、守る軍（state.gateSide）のもの
  function getCastleOwner(x, y) {
    var terrainId = state.terrain[y][x];
    if (terrainId === 'gate' || terrainId === 'gateBroken') return state.gateSide || 'enemy';
    // 城壁：2マス以内にある城の持ち主（2×2の城の左右の奥の城壁。要塞の石垣のように近くに城が無ければ、城門を守る軍）
    if (terrainId === 'wall') {
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          var cx = x + dx, cy = y + dy;
          if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width || state.terrain[cy][cx] !== 'castle') continue;
          var anchor = SC.Board.canonical(state, cx, cy);
          var owner = state.owners && (state.owners[anchor.x + ',' + anchor.y] || state.owners[cx + ',' + cy]);
          if (owner) return owner;
        }
      }
      return Object.keys(state.gates || {}).length ? (state.gateSide || 'enemy') : null;
    }
    var king = stage.units.filter(function (placement) {
      return SC.UNIT_TYPES[placement.type].isKing && placement.x === x && placement.y === y;
    })[0];
    return king ? king.side : null;
  }

  // 雇う画面（城の広間）を開く。選んだら、城から出て行くマスを選んでもらう。「やめる」ならコマンドに戻る
  function openHireScene() {
    var king = selectedUnit();
    var limit = state.rules.maxUnits;
    var isFull = !!limit && SC.Game.getUnits(state, king.side).length >= limit;
    var choices = SC.Economy.getHireTypes(state).map(function (typeId) {
      var error = SC.Economy.checkHire(state, king, typeId, null);
      var note = isFull ? '部隊がいっぱい' : error === 'お金が足りません' ? 'お金が足りない' : (error || '');
      return { typeId: typeId, enabled: !error, note: note };
    });
    busy = true;   // 雇う画面を開いているあいだは、盤面を押せないようにする
    SC.HireScene.open({
      gold: state.gold.player,
      choices: choices,
      reason: isFull ? 'full' : null,
      limit: limit,
      onChoose: function (typeId) { busy = false; selection.mode = 'hire'; onHireChoice(typeId, true); },
      onCancel: function () { busy = false; selection.mode = 'moved'; refresh(); }
    });
  }

  // 雇う部隊を選んだ：出すマスが1つだけなら、すぐに雇う。いくつかあれば、マスを選んでもらう
  function onHireChoice(typeId, fromScene) {
    if (!isPlayerInputOpen() || selection.mode !== 'hire' || (!fromScene && isInputLocked())) return;
    var king = selectedUnit();
    var error = SC.Economy.checkHire(state, king, typeId, null);
    if (error) { SC.Screens.showToast(error); return; }
    selection.hireType = typeId;
    var tiles = SC.Economy.getHireDestinations(state, king, typeId);
    if (tiles.length === 1) { commitHire(tiles[0]); return; }
    selection.mode = 'hirePlace';
    SC.Render.focusTiles([{ x: king.x, y: king.y }].concat(tiles), { center: king, margin: 0.2 });   // 城と出られるマスを見せる
    refresh();
  }

  // 雇った部隊の出るマスを選び直す
  function commitRelocate(tile) {
    var unit = selectedUnit();
    var result = SC.Economy.relocateHire(state, unit.id, tile);
    if (!result.ok) { SC.Screens.showToast(result.error); return; }
    var unitId = unit.id;
    runAnimation(result.events, null, function () {
      var moved = SC.Board.getUnitById(state, unitId);
      if (!moved || !isPlayerInputOpen()) return;
      selectUnit(moved);
      selection.mode = 'moved';
      selection.pending = { x: moved.x, y: moved.y };
      refresh();
    });
  }

  function commitHire(tile) {
    var king = selectedUnit();
    var result = SC.Game.perform(state, { kind: 'hire', unitId: king.id, unitType: selection.hireType, x: tile.x, y: tile.y });
    if (!result.ok) { SC.Screens.showToast(result.error); return; }
    // 雇った部隊は、城から出て移動した扱い。演出のあと、その部隊のコマンド（攻撃・待機など）を出す。雇っても王の行動は終わらない
    var hiredId = result.events[0].unitId;
    runAnimation(result.events, null, function () {
      var hired = SC.Board.getUnitById(state, hiredId);
      if (!hired || !isPlayerInputOpen()) return;
      selectUnit(hired);
      selection.mode = 'moved';
      selection.pending = { x: hired.x, y: hired.y };
      refresh();
    });
  }

  function commitSummon(tile) {
    var unit = selectedUnit();
    var result = SC.Game.summonUnit(state, unit.id, selection.summonType, tile);
    if (!result.ok) { SC.Screens.showToast(result.error); return; }
    finishActionAssist('summon');
    runAnimation(result.events, null);
  }

  function commitBrace() {
    var unit = selectedUnit();
    var result = SC.Game.brace(state, unit.id);
    if (!result.ok) { SC.Screens.showToast(result.error); return; }
    finishActionAssist('brace');
    runAnimation(result.events, null);   // 構えの音は playEvents が鳴らす
  }

  function commitPrayer(allyId) {
    var unit = selectedUnit();
    var result = SC.Game.pray(state, unit.id, selectedPosition(), allyId);
    if (!result.ok) { SC.Screens.showToast(result.error); return; }
    finishActionAssist('prayer');
    runAnimation(result.events, null);
  }

  function commitAction(targetId, facing) {
    var unit = selectedUnit();
    var battle = targetId ? captureBattle(unit, selectedPosition(), targetId) : null;
    var result = SC.Game.act(state, unit.id, selectedPosition(), targetId, facing);
    if (!result.ok) { SC.Screens.showToast(result.error); return; }
    runAnimation(result.events, battle);
  }

  // 正規部隊の経験値（「＋3」）とランクアップ（マップで光って姿が変わり、ランクアップの場面を出す）を見せる
  function showGrowth(growth) {
    if (growth.length === 0) return Promise.resolve();
    growth.filter(function (event) { return event.type === 'exp'; }).forEach(function (event) {
      var unit = SC.Board.getUnitById(state, event.unitId);
      if (unit) SC.Render.popupAt(unit.x, unit.y, '<small>経験</small><span>＋' + event.amount + '</span>', 'gold exp');
    });
    var rankUps = growth.filter(function (event) { return event.type === 'rankUp'; });
    var wait = SC.Render.sleep(rankUps.length ? 500 : 700);
    return rankUps.reduce(function (previous, event) {
      return previous.then(function () {
        unitTypeById[event.unitId] = event.to;
        refresh();   // 新しいクラスの絵にする
        SC.Render.animateRankUp(event.unitId);
        return SC.RankUpScene.play(event);
      });
    }, wait);
  }

  // 自軍の行動の演出を流し、終わったら操作できる状態に戻す
  // onDone：演出のあと、操作できる状態に戻ってから呼ぶ（雇った部隊を選んだ状態にするときに使う）
  function runAnimation(events, battle, onDone) {
    var mySession = session;
    busy = true;
    clearSelection();   // 攻撃相手が倒れていることがあるので、演出の前に選択を外す
    SC.Screens.hideToast();
    SC.Render.drawHighlights({});
    renderControls();
    function afterAnimation() {
      if (mySession !== session) return;
      busy = false;
      refresh();
      saveProgress();
      if (state.winner) finishStage();
      else if (onDone) onDone();
    }
    // 演出で問題が起きても、ルール上の結果は確定済みなので、表示を合わせ直して続行する
    playEvents(events, battle).then(afterAnimation, afterAnimation);
  }

  // 増援で現れた部隊は、演出で見せるまで隠しておく
  function markArrivals() {
    (state.turnEvents || []).forEach(function (event) {
      if (event.type !== 'reinforce') return;
      event.unitIds.forEach(function (unitId) {
        pendingArrivals[unitId] = true;
        var unit = SC.Board.getUnitById(state, unitId);
        if (unit) unitTypeById[unitId] = unit.type;
      });
    });
  }

  // 増援の演出：カメラをそこへ動かし、「敵の増援！」の帯を出して、部隊を現す
  function showArrivals() {
    var waves = (state.turnEvents || []).filter(function (event) { return event.type === 'reinforce'; });
    return waves.reduce(function (previous, wave) {
      return previous.then(function () {
        var units = wave.unitIds.map(function (unitId) { return SC.Board.getUnitById(state, unitId); }).filter(Boolean);
        if (units.length === 0) return null;
        return SC.Render.focusTiles(units, { center: units[0] }).then(function () {
          wave.unitIds.forEach(function (unitId) { delete pendingArrivals[unitId]; });
          refresh();
          SC.Render.animateArrivals(wave.unitIds);
          SC.Sound.play('turn');
          return SC.Render.showBanner('敵の増援！' + (wave.from ? '（' + wave.from + 'から）' : ''), 'enemy');
        });
      });
    }, Promise.resolve());
  }

  // ターンの始めに起きたこと（増援・収入・補充）を見せる
  function showTurnStart() {
    var events = state.turnEvents || [];
    if (events.length === 0) return Promise.resolve();
    return showArrivals().then(function () {
      return SC.Render.animateTurnStart(state, events, unitTypeById);
    }).then(function () { refresh(); });
  }

  function showTurnBanner(text, side) {
    SC.Sound.play('turn');
    return SC.Render.showBanner(text, side);
  }

  // 戦闘シーンの曲。敵の王と戦うときはボス戦の曲。戦闘シーン用の曲が無ければ、マップの曲のまま。前に止めたところの続きから流す
  function getBattleMusic(battle) {
    var isEnemyKing = [battle.attacker, battle.defender].some(function (fighter) {
      return fighter.side === 'enemy' && SC.UNIT_TYPES[fighter.type].isKing;
    });
    return (isEnemyKing && stage.bossMusic) || stage.battleMusic || stage.music;
  }

  // 起きたことを順番に見せる。移動はマップ上で、攻撃は戦闘シーン（設定でオフならマップ上の簡単な演出）で。
  function playEvents(events, battle) {
    var moves = events.filter(function (event) { return event.type === 'move'; });
    var strikes = events.filter(function (event) { return event.type === 'strike'; });
    var prayers = events.filter(function (event) { return event.type === 'pray'; });
    var hires = events.filter(function (event) { return event.type === 'hire'; });
    var captures = events.filter(function (event) { return event.type === 'capture'; });
    var growth = events.filter(function (event) { return event.type === 'exp' || event.type === 'rankUp'; });   // 正規部隊の経験値とランクアップ
    var summons = events.filter(function (event) { return event.type === 'summon'; });
    summons.forEach(function (event) { if (event.summonedId) unitTypeById[event.summonedId] = event.unitType; });
    hires.forEach(function (event) { unitTypeById[event.unitId] = event.unitType; });
    if (events.some(function (event) { return event.type === 'brace'; })) SC.Sound.play('brace');
    var chain = moves.reduce(function (previous, event) {
      return previous.then(function () { SC.Sound.play('move'); return SC.Render.animateMove(event.unitId, event.to); });
    }, Promise.resolve());
    chain = prayers.reduce(function (previous, event) {
      return previous.then(function () { return SC.Render.animatePrayer(event, unitTypeById[event.targetId]); });
    }, chain);
    chain = summons.reduce(function (previous, event) {
      return previous.then(function () {
        // 召喚の場面（戦闘シーンをオフにしていれば出さない）→ マップで魔法陣が光って部隊が現れる
        var scene = options.save.settings.battleScene && event.rolls ? SC.SummonScene.play(event) : Promise.resolve();
        return scene.then(function () { return SC.Render.animateSummon(state, event); });
      });
    }, chain);
    chain = hires.reduce(function (previous, event) {
      return previous.then(function () { return SC.Render.animateHire(state, event); });
    }, chain);
    // 城門への攻撃（ステージ18から）：城門がゆれて「城門 −12」。壊れたら、壊れた城門の絵にする
    chain = events.filter(function (event) { return event.type === 'gate'; }).reduce(function (previous, event) {
      return previous.then(function () { return SC.Render.animateGate(state, event); });
    }, chain);
    var commanders = events.filter(function (event) { return event.type === 'commander'; });   // 指揮官が倒れた（ステージ19から）
    var afterStrikes = function () {
      return showGrowth(growth).then(function () {
        return commanders.reduce(function (previous, event) {
          return previous.then(function () { SC.Sound.play('victory', 0.3); return SC.Render.showBanner((GROUP_NAMES[event.group] || '') + 'の指揮官を倒した！　' + (GROUP_NAMES[event.group] || '') + 'の増援が止まった', 'player'); });
        }, Promise.resolve());
      }).then(function () { return captures.reduce(function (previous, event) {
        return previous.then(function () {
          // そのステージで自軍が最初に町を取ったときだけ、町の通りの場面を見せる（戦闘シーンをオフにしていれば出さない）
          var isTown = state.terrain[event.y][event.x] === 'town';   // 砦を取ったときは、町の場面は出さない
          if (isTown && event.side === 'player' && !state.firstCaptureShown && options.save.settings.battleScene) {
            state.firstCaptureShown = true;
            return SC.Render.animateCapture(state, event).then(function () {
              return SC.CaptureScene.play({ unitType: unitTypeById[event.unitId], income: SC.ECONOMY.townIncome });
            });
          }
          return SC.Render.animateCapture(state, event);
        });
      }, Promise.resolve()); });
    };
    if (strikes.length === 0) return chain.then(afterStrikes);

    if (battle && options.save.settings.battleScene) {
      return chain.then(function () { return SC.Render.sleep(120); }).then(function () {
        var sides = {};
        sides[battle.attacker.side] = battle.attacker;
        sides[battle.defender.side] = battle.defender;
        var mySession = session;
        SC.Sound.playMusic(getBattleMusic(battle), false);
        return SC.BattleScene.play({
          player: sides.player,
          enemy: sides.enemy,
          strikes: strikes.map(function (event) {
            return {
              attackerSide: event.attackerId === battle.attacker.id ? battle.attacker.side : battle.defender.side,
              result: event.result,
              soldiers: event.soldiers,
              hits: event.hits,
              missIndexes: event.missIndexes,
              lost: event.lost,
              misses: event.misses,
              damage: event.damage,
              defenderHp: event.defenderHp,
              killed: event.killed,
              isCounter: event.isCounter,
              isBraced: !!event.isBraced
            };
          })
        }).then(function () {
          // マップに戻ったら、マップの曲に戻す（やり直し・中断で別の場面に移っていたら何もしない）
          if (mySession === session) SC.Sound.playMusic(stage.music, false);
        });
      }).then(afterStrikes);
    }
    return strikes.reduce(function (previous, event) {
      return previous.then(function () {
        return SC.Render.animateStrike(event, unitTypeById[event.defenderId]);
      });
    }, chain).then(afterStrikes);
  }

  function runEnemyTurn() {
    if (!isPlayerInputOpen()) return;
    var mySession = session;
    busy = true;
    clearSelection();
    SC.Game.endTurn(state);
    markArrivals();
    refresh();

    function isCurrent() { return mySession === session; }

    function nextAction() {
      if (!isCurrent()) return;
      if (state.winner) { busy = false; refresh(); saveProgress(); finishStage(); return; }
      var action = SC.AI.chooseAction(state, 'enemy');
      if (!action) { finishEnemyTurn(); return; }
      var actor = SC.Board.getUnitById(state, action.unitId);
      var from = { x: actor.x, y: actor.y };
      // 攻撃のときだけ、戦闘シーン用に攻撃前の状態を控える（祈り・構えのときは使わない）
      var isAttack = !action.kind && action.targetId;
      var battle = isAttack ? captureBattle(actor, { x: action.x, y: action.y }, action.targetId) : null;
      var target = action.targetId ? SC.Board.getUnitById(state, action.targetId) : null;
      var focusTilesBefore = [from, { x: action.x, y: action.y }].concat(target ? [{ x: target.x, y: target.y }] : []);
      // 祈り・構えも含めて、CPUが選んだ行動の種類どおりに実行する（自動対戦と同じ SC.Game.perform を使う）
      var result = SC.Game.perform(state, action);
      if (!result.ok) { actor.acted = true; nextAction(); return; }   // 念のため：不正な行動は待機として扱う
      if (result.events.length === 0) { nextAction(); return; }
      SC.Render.drawHighlights({ cursorKey: tileKey(from.x, from.y) });
      function afterAnimation() {
        if (!isCurrent()) return;
        refresh();
        nextAction();
      }
      // 大きいマップでは、動く敵（と、攻撃・祈りの相手）が見えるところへ動かしてから見せる
      SC.Render.focusTiles(focusTilesBefore, { center: { x: action.x, y: action.y } })
        .then(function () { return SC.Render.sleep(220); })
        .then(function () { if (isCurrent()) return playEvents(result.events, battle); })
        .then(function () { return SC.Render.sleep(140); })
        .then(afterAnimation, afterAnimation);
    }

    function finishEnemyTurn() {
      SC.Game.endTurn(state);
      clearSelection();
      refresh();
      if (state.winner) { busy = false; refresh(); saveProgress(); finishStage(); return; }   // 守りきった
      showTurnBanner('ターン ' + state.turn + '　自軍の番', 'player')
        .then(function () { return focusKing(false); })
        .then(function () { return showTurnStart(); })
        .then(function () {
          if (!isCurrent()) return;
          busy = false;
          refresh();
          saveProgress();
        });
    }

    showTurnBanner('敵軍のターン', 'enemy').then(showTurnStart).then(nextAction);
  }

  // ---- 勝敗 ----

  function finishStage() {
    var mySession = session;
    var won = state.winner === 'player';
    var turns = state.survived ? SC.Game.getSurviveTurns(state) : state.turn;   // 守りきったときは、守ったターン数
    SC.Sound.stopMusic();
    SC.Sound.play(won ? 'victory' : 'defeat', 0.45);
    SC.Save.clearBattle(options.save);   // 勝敗が決まったら、遊びかけの保存は消す
    var previousBest = options.save.stages[stage.id] && options.save.stages[stage.id].bestTurns;
    // 正規部隊：勝ったら、経験値とクラスを記録に書き戻す（遊び直しでは書き戻さない）
    var regularSummary = won && state.experience ? buildRegularSummary() : '';
    if (won && state.experience && (state.deployed || []).length > 0) {
      SC.Regulars.writeBack(options.save.roster, state);
      // 「もう一度」で遊び直すときは、育った今の記録で始め、経験値は入らない（同じステージで育てすぎないように）
      options.noExperience = true;
      options.regulars = (options.regulars || []).map(function (member) {
        var saved = options.save.roster.filter(function (m) { return m.id === member.id; })[0] || member;
        return { id: saved.id, name: saved.name, type: saved.type, exp: saved.exp };
      });
    }
    if (won) SC.Save.recordClear(options.save, stage.id, turns);
    if (won && state.experience && (state.deployed || []).length > 0) SC.Save.markExperienceEarned(options.save, stage.id);   // このステージの経験値は、もうもらった
    SC.Save.store(options.save);
    // 勝ったあとの会話（ステージ20。ヴァルガスの最後のひと言）があれば、勝利の窓の前に出す
    var endingTalk = won && (SC.ENDING_TALKS || {})[stage.id];
    SC.Render.sleep(450).then(function () {
      if (mySession !== session || !endingTalk || !SC.TalkScene) return;
      return SC.TalkScene.play(endingTalk, state.deployed);
    }).then(function () {
      if (mySession !== session) return;
      var best = options.save.stages[stage.id];
      var nextId = won ? SC.Save.getNextStage(options.save, stage.id, Object.keys(SC.STAGES).map(Number)) : null;   // 勝ったあとは、記録してから次を決める
      var nextStage = nextId ? SC.STAGES[nextId] : null;
      var newRecord = won && (!previousBest || turns < previousBest);
      SC.Screens.showModal({
        kind: won ? 'victory' : 'defeat',
        title: won ? '勝 利' : '敗 北',
        html: won
          ? '<div class="result"><p class="result-lead">' + (state.survived ? turns + 'ターン、城を守りきった！' : (stage.victoryLead || '敵の王を討ち取った！')) + '</p>' +
            '<div class="result-stats">' +
              '<div><span>' + (state.survived ? '守りきったターン' : 'かかったターン') + '</span><b>' + turns + '</b><small>ターン</small></div>' +
              '<div><span>最少記録</span><b>' + best.bestTurns + '</b><small>ターン</small>' + (newRecord ? '<em>記録更新</em>' : '') + '</div>' +
            '</div>' + regularSummary + '</div>'
          : '<div class="result"><p class="result-lead">自軍の王が倒されてしまった…</p>' +
            '<div class="result-stats">' +
              '<div><span>持ちこたえたターン</span><b>' + turns + '</b><small>ターン</small></div>' +
              '<div><span>倒した敵の部隊</span><b>' + ((state.fallenCount && state.fallenCount.enemy) || 0) + '</b><small>部隊</small></div>' +
            '</div>' +
            '<div class="result-hint"><span>次への助言</span>' + stage.defeatHint + '</div></div>',
        stacked: won && (!!nextStage || !!stage.endingStory),
        buttons: won && stage.endingStory
          ? [
            // 最後のステージ：エンディングを見てから、タイトルへ
            { label: 'エンディングへ', style: 'primary', onTap: function () { SC.EndingScene.play({ story: stage.endingStory }).then(function () { exitToTitle(); }); } },
            { label: 'もう一度', onTap: restart },
            { label: 'タイトルへ', onTap: exitToTitle }
          ]
          : won && nextStage
          ? [
            { label: '次のステージへ', style: 'primary', onTap: function () { if (options.onNext) options.onNext(nextStage.id); else start(nextStage.id, options); } },
            { label: 'もう一度', onTap: restart },
            { label: 'タイトルへ', onTap: exitToTitle }
          ]
          : [
            { label: 'タイトルへ', onTap: exitToTitle },
            { label: 'もう一度', style: 'primary', onTap: restart }
          ]
      });
    });
  }

  function restart() { start(stage.id, options); }

  // 勝ったときの、正規部隊のまとめ（経験値・ランクアップ・撤退）
  function buildRegularSummary() {
    var rows = (state.deployed || []).map(function (regularId) {
      var before = (options.regulars || []).filter(function (m) { return m.id === regularId; })[0];
      if (!before) return '';
      var unit = state.units.filter(function (u) { return u.regularId === regularId; })[0];
      var fallen = (state.fallenRegulars || {})[regularId];
      var type = unit ? unit.type : fallen ? fallen.type : before.type;
      var exp = unit ? (unit.exp || 0) : fallen ? Math.floor((fallen.exp || 0) / 2) : before.exp;
      var threshold = SC.Regulars.getThreshold(regularId, type);
      var note = !unit ? '<em class="bad">撤退（経験値が半分）</em>' : type !== before.type ? '<em>' + SC.UNIT_TYPES[type].name + 'にランクアップ！</em>' : '';
      return '<div><b>' + before.name + '隊</b><span>' + SC.UNIT_TYPES[type].name + '　経験 ' + exp + (threshold ? '／' + threshold : '') + '</span>' + note + '</div>';
    }).join('');
    return rows ? '<div class="result-regulars"><span>正規部隊</span>' + rows + '</div>' : '';
  }

  // onLeave を渡すと、タイトルへ戻る代わりにそれを呼ぶ（ステージを選ぶ画面へ戻るときに使う）
  function exitToTitle(onLeave) {
    session += 1;
    SC.Sound.stopMusic();
    SC.Screens.hideToast();
    (onLeave || options.onExit)();
  }

  // ---- メニュー ----

  function showGoal() {
    var text = stage.goalText;
    var survive = SC.Game.getSurviveTurns(state);
    if (survive) text += '\n\nあと ' + Math.max(0, survive - state.turn + 1) + ' ターン守れば勝ち（ターン' + survive + 'の敵の番まで）';
    if (survive || state.rules.waveNotice) {
      var next = SC.Game.getNextReinforcement(state);
      text += next ? '\n次の増援：ターン' + next.turn + '・' + next.from + 'から（' + describeWave(next) + '）' : '\nもう増援は来ません';
    }
    SC.Screens.showModal({ title: stage.title, text: text, buttons: [{ label: 'とじる', style: 'primary' }] });
  }

  // 増援の中身（「歩兵2・騎士1」のように）
  function describeWave(wave) {
    var counts = {};
    var order = [];
    wave.units.forEach(function (placement) {
      if (!counts[placement.type]) { counts[placement.type] = 0; order.push(placement.type); }
      counts[placement.type] += 1;
    });
    return order.map(function (typeId) { return SC.UNIT_TYPES[typeId].name + counts[typeId]; }).join('・');
  }

  function showMenu() {
    SC.Screens.showModal({
      title: 'メニュー',
      stacked: true,
      buttons: [
        { label: '遊び方', onTap: function () { SC.Screens.showHelp(); } },
        { label: '戦闘シーン：' + (options.save.settings.battleScene ? 'オン（押すとオフ）' : 'オフ（押すとオン）'), onTap: toggleBattleScene },
        { label: '音：' + (options.save.settings.sound ? 'オン（押すとオフ）' : 'オフ（押すとオン）'), onTap: toggleSound },
        { label: '最初からやり直す', onTap: function () { confirmLeave('最初からやり直しますか？', restart); } },
        { label: '中断してタイトルへ', onTap: exitToTitle },   // 途中保存されるので、タイトルの「続きから」で戻れる
        { label: 'とじる', style: 'primary' }
      ]
    });
  }

  function toggleBattleScene() {
    options.save.settings.battleScene = !options.save.settings.battleScene;
    SC.Save.store(options.save);
    showMenu();
  }

  function toggleSound() {
    options.save.settings.sound = !options.save.settings.sound;
    SC.Save.store(options.save);
    SC.Sound.setEnabled(options.save.settings.sound);
    showMenu();
  }

  function confirmLeave(question, onYes) {
    SC.Screens.showModal({
      title: '確認',
      text: question + '\nこの戦いの途中経過は消えます。',
      buttons: [{ label: 'もどる' }, { label: 'はい', style: 'primary', onTap: onYes }]
    });
  }

  // ---- 表示 ----

  function buildView() {
    var view = { moveTiles: {}, zoneTiles: {}, rangeTiles: {}, targetTiles: {}, allyTiles: {}, dangerTiles: {}, enemyZoneTiles: {}, cursorKey: null, selectedId: null, pending: null };
    view.hiddenIds = pendingArrivals;   // まだ見せていない増援（「敵の増援！」の演出で出す）
    view.showReady = isPlayerInputOpen();
    if (state.winner || busy) return view;

    if (selection.mode !== 'idle') {
      var unit = selectedUnit();
      var position = selectedPosition();
      view.selectedId = unit.id;
      view.pending = selection.pending;
      if (selection.mode === 'facing') {
        // 騎士の向きを選ぶ：まわりに矢印を出し、反撃できる範囲（その向きの前と斜め前）を赤い斜線で見せる
        view.facingChoice = { x: position.x, y: position.y, current: SC.Movement.getFacing(unit), assist: !!selection.facingAssist };
        view.cursorKey = tileKey(position.x, position.y);
        return view;
      }
      if (selection.mode === 'relocate') {
        SC.Economy.getRelocateTiles(state, unit).forEach(function (tile) { view.moveTiles[tileKey(tile.x, tile.y)] = true; });
        view.cursorKey = tileKey(unit.x, unit.y);
        return view;
      }
      if (selection.mode === 'summonPlace') {
        SC.Game.getSummonTiles(state, unit, selection.summonType).forEach(function (tile) { view.allyTiles[tileKey(tile.x, tile.y)] = true; });
        view.cursorKey = tileKey(unit.x, unit.y);
        return view;
      }
      if (selection.mode === 'hire' || selection.mode === 'hirePlace') {
        if (selection.mode === 'hirePlace') {
          SC.Economy.getHireDestinations(state, unit, selection.hireType).forEach(function (tile) { view.moveTiles[tileKey(tile.x, tile.y)] = true; });
        }
        view.cursorKey = tileKey(unit.x, unit.y);
        return view;
      }
      if (selection.mode === 'aim') {
        (selection.aim === 'attack' ? getAttackTargets() : []).forEach(function (enemy) { view.targetTiles[tileKey(enemy.x, enemy.y)] = true; });
        (selection.aim === 'attack' ? getGateTargets() : []).forEach(function (gate) { view.targetTiles[tileKey(gate.x, gate.y)] = true; });
        (selection.aim === 'prayer' ? getPrayerTargets() : []).forEach(function (ally) { view.allyTiles[tileKey(ally.x, ally.y)] = true; });
        return view;
      }
      selection.reach.forEach(function (tile) {
        view.moveTiles[tileKey(tile.x, tile.y)] = true;
        if (tile.zone && state.rules.zoneHints) view.zoneTiles[tileKey(tile.x, tile.y)] = true;   // なわばりで止まるマス（印はなわばりを覚えるステージだけ）
      });
      var attackOrigins = selection.mode === 'selected' ? selection.reach : [position];
      attackOrigins.forEach(function (origin) {
        SC.Movement.getAttackTiles(state, unit.type, origin, undefined, SC.Movement.isSamePlace(unit, origin)).forEach(function (tile) {
          var key = tileKey(tile.x, tile.y);
          if (!view.moveTiles[key]) view.rangeTiles[key] = true;
        });
      });
      SC.Game.getUnits(state, SC.Game.otherSide(unit.side)).forEach(function (enemy) {
        if (SC.Movement.canAttackFrom(unit, position, enemy)) view.targetTiles[tileKey(enemy.x, enemy.y)] = true;
      });
      SC.Prayer.getPrayerTargets(state, unit, position).forEach(function (ally) { view.allyTiles[tileKey(ally.x, ally.y)] = true; });
      if (selection.mode !== 'selected') getGateTargets().forEach(function (gate) { view.targetTiles[tileKey(gate.x, gate.y)] = true; });
      if (selection.mode === 'gateForecast') view.cursorKey = selection.gateKey;
      if (selection.mode === 'prayer') {
        var prayerTarget = SC.Board.getUnitById(state, selection.targetId);
        view.cursorKey = tileKey(prayerTarget.x, prayerTarget.y);
      }
      if (selection.mode === 'forecast') {
        var target = SC.Board.getUnitById(state, selection.targetId);
        view.cursorKey = tileKey(target.x, target.y);
        // 倒れる兵士の印の赤い縁取りは、結果が分かってしまうので出さない（2026-10-15 ユーザー決定。仕組みは render.js の setHp に残してある）
      }
      return view;
    }

    if (selection.inspect) {
      var inspected = selection.inspect.unitId ? SC.Board.getUnitById(state, selection.inspect.unitId) : null;
      if (inspected) {
        view.cursorKey = tileKey(inspected.x, inspected.y);
        if (inspected.side === 'enemy') {
          // なわばりの決まりがあるステージでは、その敵のなわばり（上下左右の4マス）も見せる
          if (state.rules.zoneHints) {
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
              var zx = inspected.x + d[0], zy = inspected.y + d[1];
              if (SC.Board.inBounds(state, zx, zy)) view.enemyZoneTiles[tileKey(zx, zy)] = true;
            });
          }
          var reach = SC.Movement.getReachableTiles(state, inspected);
          reach.forEach(function (tile) { view.dangerTiles[tileKey(tile.x, tile.y)] = true; });
          reach.forEach(function (origin) {
            SC.Movement.getAttackTiles(state, inspected.type, origin, undefined, SC.Movement.isSamePlace(inspected, origin)).forEach(function (tile) {
              var key = tileKey(tile.x, tile.y);
              if (!view.dangerTiles[key]) view.rangeTiles[key] = true;
            });
          });
        }
      } else if (selection.inspect.x !== undefined) {
        view.cursorKey = tileKey(selection.inspect.x, selection.inspect.y);
      }
    }
    return view;
  }

  function refresh() {
    var modeKey = selection.mode + ':' + selection.aim + ':' + selection.targetId;
    if (modeKey !== lastMode) { lastMode = modeKey; lastModeChange = Date.now(); }
    var view = buildView();
    SC.Render.syncUnits(state, view);
    SC.Render.drawHighlights(view);
    SC.Render.drawFacingChoice(view.facingChoice, onFacingChosen);
    renderControls();
  }

  // 騎士の向きを選んだ：その向きで待機する
  function onFacingChosen(facing) {
    if (!isPlayerInputOpen() || selection.mode !== 'facing' || isInputLocked()) return;
    if (selection.facingAssist) {
      // 向きを選んだら、案内は見たことにする（選ぶ前にやめたときは、次にもう一度出す）
      options.save.seenTips['facingAssist_' + stage.id] = true;
      SC.Save.store(options.save);
      SC.Screens.hideToast();
    }
    selection.facingAssist = false;
    commitAction(null, facing);
  }

  function renderControls() {
    var surviveTurns = SC.Game.getSurviveTurns(state);
    // 増援の予告（ステージ18から。rules.waveNotice）：次の増援まで、あと何ターンか
    // 上の帯はせまいので、マップの左上に出す
    // 組のある増援（ステージ19：北と南）は、組ごとに「北の増援 あと2／南 あと1」
    var waveNotice = byId('wave-notice');
    if (waveNotice) {
      var lines = [];
      if (state.rules.waveNotice) {
        var groups = [];
        (state.reinforcements || []).forEach(function (wave) { if (wave.group && groups.indexOf(wave.group) < 0) groups.push(wave.group); });
        var describeWait = function (wave) { var wait = Math.max(0, wave.turn - state.turn); return wait === 0 ? 'この敵の番' : 'あと' + wait; };
        if (groups.length) {
          groups.forEach(function (group) {
            var next = SC.Game.getNextReinforcement(state, group);
            if (next) lines.push((GROUP_NAMES[group] || group) + 'の増援 ' + describeWait(next));
          });
        } else {
          var nextWave = SC.Game.getNextReinforcement(state);
          if (nextWave) lines.push(Math.max(0, nextWave.turn - state.turn) === 0 ? '敵の増援：この敵の番' : '敵の増援まで あと' + Math.max(0, nextWave.turn - state.turn) + 'ターン');
        }
      }
      waveNotice.classList.toggle('hidden', lines.length === 0);
      waveNotice.textContent = lines.join('／');
    }
    byId('turn-label').innerHTML = '<span class="turn-text">ターン ' + state.turn + (surviveTurns ? '<small class="turn-limit">／' + surviveTurns + '</small>' : '') + '</span>' +
      ' <span class="side-chip ' + state.side + '">' + SC.SIDE_NAMES[state.side] + 'の番</span>' +
      (SC.Economy.isEnabled(state)
        ? '<span class="gold-chip" id="gold-chip">' + state.gold.player + 'G<small>（+' + SC.Economy.getIncome(state, 'player') + '）</small></span>'
        : '');
    byId('info-panel').innerHTML = buildInfoHtml();
    byId('guide-line').textContent = buildGuideText();

    var open = isPlayerInputOpen();
    var mode = selection.mode;
    var undoButton = byId('undo-button');
    var confirmButton = byId('confirm-button');
    undoButton.disabled = !open || mode === 'idle';
    undoButton.textContent = mode === 'idle' || mode === 'selected' ? 'やり直す' : 'もどる';
    // 決定ボタンは、攻撃・祈りの見込みを出しているときだけ出す（「待機」はコマンドの枠の中にある）
    var deciding = open && (mode === 'forecast' || mode === 'gateForecast' || mode === 'prayer');
    confirmButton.disabled = !deciding;
    confirmButton.classList.toggle('invisible', !deciding);
    confirmButton.textContent = mode === 'prayer' ? '祈る' : '攻撃する';
    confirmButton.className = 'button ' + (mode === 'prayer' ? 'heal' : 'danger') + (deciding ? '' : ' invisible');
    byId('end-turn-button').disabled = !open;
    renderCommandMenu(open && mode === 'moved' ? mode : null);
  }

  // コマンドの枠（移動先を決めたあとに出す）。押せないコマンドは理由を添えて暗くする
  // コマンドの枠（移動先を決めたあと、情報欄のかわりに出す）。押せないコマンドは理由を添えて暗くする
  function renderCommandMenu(mode) {
    var menu = byId('command-menu');
    var visible = !!mode;
    menu.classList.toggle('hidden', !visible);
    byId('info-panel').classList.toggle('hidden', visible);
    if (!visible) return;
    var unit = selectedUnit();
    var title = unitType(unit).name + 'の行動';
    var commands = [{ id: 'attack', label: '攻撃', note: '届く敵なし', enabled: getAttackTargets().length > 0 || getGateTargets().length > 0 }];
      var stayed = selection.pending && selection.pending.x === unit.x && selection.pending.y === unit.y;
      if (unitType(unit).isKing && SC.Economy.isKingInOwnCastle(state, unit) && SC.Economy.getHireDestinations(state, unit, 'infantry').length > 0) {
        commands.push({ id: 'hire', label: '雇う', note: '動くと雇えない', enabled: stayed });
      }
      if (SC.Prayer.canPray(unit)) {
        var canPrayNow = getPrayerTargets().length > 0;
        commands.push({ id: 'prayer', label: '祈る', note: '祈れる味方なし', enabled: canPrayNow, assist: canPrayNow && !!actionAssistKey('prayer') });
      }
      if (unitType(unit).canBrace) {
        var canBraceNow = stayed && !unit.moved;
        commands.push({ id: 'brace', label: '構え', note: '動くと構えられない', enabled: canBraceNow, assist: canBraceNow && !!actionAssistKey('brace') });
      }
      if (unitType(unit).summon) {
        // 呼べるものが2つ以上（ウィザード）なら、「召喚：スケルトン」「召喚：ゴーレム」のように、ものごとにボタンを出す
        var summonTypes = unitType(unit).summon.types;
        summonTypes.forEach(function (typeId) {
          var summonError = stayed ? SC.Game.checkSummon(state, unit, typeId, null) : '動くと召喚できない';
          var choice = summonTypes.length > 1;
          commands.push({ id: 'summon', summonType: typeId, choice: choice, label: choice ? '召喚<i>' + SC.UNIT_TYPES[typeId].name + '</i>' : '召喚', note: summonError || '', enabled: !summonError,
            assist: !summonError && !!actionAssistKey('summon') });
        });
      }
      commands.push({ id: 'wait', label: '待機', note: '', enabled: true });
      // 祈り・召喚の案内：光らせるボタンがあれば、説明を出す（ボタンを押すまで消えない）
      var assisted = commands.filter(function (command) { return command.assist; })[0];
      if (assisted) SC.Screens.showToast(ACTION_ASSISTS[assisted.id].menu, true);
    menu.innerHTML = '<div class="command-title">' + title + '</div><div class="command-list">' +
      commands.map(function (command) {
        return '<button type="button" class="command ' + command.id + (command.choice ? ' choice' : '') + (command.assist ? ' assist' : '') + '" data-command="' + command.id + '"' +
          (command.typeId ? ' data-type="' + command.typeId + '"' : '') + (command.summonType ? ' data-summon="' + command.summonType + '"' : '') +
          (command.enabled ? '' : ' disabled') + '>' +
          '<span class="command-icon"></span><span class="command-label">' + command.label + '</span>' +
          (command.enabled || !command.note ? '' : '<small>' + command.note + '</small>') + '</button>';
      }).join('') + '</div>';
    Array.prototype.forEach.call(menu.querySelectorAll('.command'), function (button) {
      button.onclick = function () {
        if (button.dataset.type) onHireChoice(button.dataset.type);
        else onCommand(button.dataset.command, button.dataset.summon);
      };
    });
  }

  function describeTerrainEffect(terrain) {
    var parts = [];
    if (terrain.defense > 0) parts.push('相手の1人の打撃−' + terrain.defense);
    if (terrain.kingDamageReductionPercent > 0) parts.push('王は受けるダメージ' + terrain.kingDamageReductionPercent + '％減');
    return parts.length > 0 ? parts.join('、') : '効果なし';
  }

  // 情報欄の射程の短い説明（形は右の小さな図で見せる。2026-10-22）
  function describeRange(type) {
    if (type.allDirections) return '8方向';
    if (type.diagonalFront) return '斜め前も';
    if (type.lance) return '槍';
    if (type.stillRangeBonus) return '長弓';
    if (type.rangeMin > 1) return '射程' + type.rangeMax;
    if (type.rangeMax > 1) return '射程' + type.rangeMin + '〜' + type.rangeMax;
    return '';
  }

  function unitNameHtml(unit) {
    if (unit.regularId) return '<span class="name ' + unit.side + '-text">' + unit.name + '隊 ' + unitType(unit).name + '</span>';   // 正規部隊
    return '<span class="name ' + unit.side + '-text">' + SC.SIDE_NAMES[unit.side] + ' ' + unitType(unit).name + '</span>';
  }

  // 正規部隊の経験値（情報欄の最後の行に出す）
  function describeExperience(unit) {
    var threshold = SC.Regulars.getThreshold(unit.regularId, unit.type);
    if (!state.experience) return '経験 ' + (unit.exp || 0) + '（このステージの経験値はもらい済み）';
    if (!threshold) return '経験 ' + (unit.exp || 0);
    // 次のクラスがまだゲームに無いとき（サーガ・ハイプリーストはステージ17から）は、経験値はためておき、登場したらランクアップする
    var nextReady = !!SC.UNIT_TYPES[SC.Regulars.getNextRank(unit.regularId, unit.type).next];
    if (!nextReady && (unit.exp || 0) >= threshold) return '経験 ' + unit.exp + '／' + threshold + '（満タン。次のクラスは、これから登場）';
    return '経験 ' + (unit.exp || 0) + '／' + threshold + (nextReady ? '（満タンでランクアップ）' : '（次のクラスは、これから登場）');
  }

  function buildUnitInfoHtml(unit, position) {
    var type = unitType(unit);
    var terrain = SC.Board.getTerrain(state, position.x, position.y);
    var lastLine = '地形：' + terrain.name + '（' + describeTerrainEffect(terrain) + '）';
    if (type.diagonalFront) lastLine = '向き：' + FACING_NAMES[SC.Movement.getFacing(unit)] + '（斜め後ろには反撃できない）';
    if (unit.regularId) lastLine = describeExperience(unit) + (type.diagonalFront ? '　向き：' + FACING_NAMES[SC.Movement.getFacing(unit)] : '');
    if (unit.side === 'enemy' && selection.mode === 'idle') {
      lastLine = '橙：移動範囲　赤い斜線：攻撃範囲' + (state.rules.zoneHints ? '　点線：なわばり' : '');
    }
    if (unit.commander) lastLine = '指揮官：倒すと' + (GROUP_NAMES[unit.commander] || '') + 'の増援が止まる';
    var imagePath = (unit.regularId && (SC.Render.getPortraitPath(unit.regularId) || SC.Render.getRegularArtPath(unit.regularId, unit.type, 'map'))) || SC.Render.getUnitImagePath(unit.type, unit.side);   // 正規部隊は隊長の顔
    var portrait = imagePath ? '<img class="portrait ' + unit.side + '" src="' + imagePath + '" alt="">' : '';
    var affinityLine = state.rules.affinity ? describeAffinity(type) : '';
    return '<div class="info-row">' + portrait + '<div class="info-text">' +
      unitNameHtml(unit) + '　<b>' + SC.Combat.getSoldierCount(unit) + '</b>人／' + type.size + '人' +
      (unit.braced ? '　<span class="strong">構え中</span>' : '') + (unit.blessing ? '　<span class="strong">守り+' + unit.blessing + '</span>' : '') + (unit.acted && !unit.braced ? '　<span class="dim">行動済み</span>' : '') +
      (affinityLine ? ' ' + affinityLine : '') + '<br>' +
      '1人あたり 攻撃' + type.attack + ' 体力' + type.soldierHp + '　移動' + type.move + ' ' + describeRange(type) + '<br>' +
      '<span class="dim">' + lastLine + '</span></div>' + SC.Render.attackShapeHtml(unit.type) + '</div>';
  }

  // 相性：得意な系統と、苦手な系統（その系統を得意とする系統）。いまのステージに出てくる系統だけを書く
  function describeAffinity(type) {
    var present = {};
    Object.keys(SC.UNIT_TYPES).forEach(function (id) {
      if (stage.units.some(function (p) { return p.type === id; }) || SC.Economy.getHireTypes(state).indexOf(id) >= 0) present[SC.UNIT_TYPES[id].family] = true;
    });
    var family = SC.FAMILIES[type.family];
    if (!family) return '';
    var strong = family.strongAgainst.filter(function (id) { return present[id]; }).map(function (id) { return SC.FAMILIES[id].name; });
    var weak = Object.keys(SC.FAMILIES).filter(function (id) {
      return present[id] && SC.FAMILIES[id].strongAgainst.indexOf(type.family) >= 0;
    }).map(function (id) { return SC.FAMILIES[id].name; });
    if (strong.length === 0 && weak.length === 0) return '';
    return '<span class="affinity-line">' + (strong.length ? '<span class="good">得意 ' + strong.join('・') + '</span>' : '') +
      (weak.length ? '<span class="bad">苦手 ' + weak.join('・') + '</span>' : '') + '</span>';
  }

  // 攻撃前の見込み：有利・互角・不利と、与える攻撃・反撃それぞれの内訳（攻撃・防御・合計）。
  // 何人倒せるか（結果）は、あえて出さない（ミスで結果が変わると嫌な気分になるため。2026-10-15 ユーザー決定）。
  // 防御は「相手の防御力 ＋ 地形の守り（＋ 相性）」をまとめた値。合計は兵士1人の打撃。城の王は、さらに合計ダメージが減る
  function buildForecastHtml(unit, position, target) {
    var forecast = SC.Combat.getForecast(state, unit, position, target);
    var outlookHtml = {
      advantage: '<span class="outlook advantage">有利</span>',
      even: '<span class="outlook even">互角</span>',
      disadvantage: '<span class="outlook disadvantage">不利</span>'
    }[forecast.outlook];
    function cells(breakdown) {
      return '<td>' + breakdown.attack + (breakdown.affinity ? '<small class="affinity">相性+' + breakdown.affinity + '</small>' : '') + '</td><td>−' + breakdown.defense + (breakdown.castlePercent ? '<small>城' + breakdown.castlePercent + '％</small>' : '') +
        '</td><td class="total">' + breakdown.hit + '</td>';
    }
    var head = '<table class="forecast-table"><tr class="head"><th>' + outlookHtml + '</th><td>攻撃</td><td>防御</td><td>合計</td></tr>';
    // 相手が構えていると、相手が先に攻撃してくる。先に攻撃する側を上の行にする
    if (forecast.defenderStrikesFirst) {
      return head + '<tr class="braced"><th>相手の構え</th>' + cells(forecast.counterBreakdown) + '</tr>' +
        '<tr><th>与える</th>' + cells(forecast.breakdown) + '</tr></table>';
    }
    var counterRow = forecast.counterBreakdown
      ? '<th>反撃</th>' + cells(forecast.counterBreakdown)
      : '<th>反撃</th><td colspan="3" class="none">なし（相手の攻撃が届かない）</td>';
    return head + '<tr><th>与える</th>' + cells(forecast.breakdown) + '</tr>' +
      '<tr>' + counterRow + '</tr></table>';
  }

  // 祈りの見込み：戻る人数と、動かずに祈った場合との違い
  function buildPrayerHtml(unit, position, ally) {
    var forecast = SC.Prayer.getPrayerForecast(state, unit, position, ally);
    var note;
    if (forecast.moved) {
      var still = SC.Prayer.getPrayerAmount(unit, unit, ally);
      note = still > forecast.amount ? '移動してから祈ると、戻せる人数が減ります（動かなければ' + still + '人）' : '移動してから祈っています';
    } else {
      note = '動かずに祈ると、多く戻せます';
    }
    if (unitType(unit).prayer.defenseBuff) note += '。祈った味方は守り+' + unitType(unit).prayer.defenseBuff + '（次の自分の番まで）';
    return '<span class="name">' + unitType(unit).name + ' → ' + unitType(ally).name + '</span>　<span class="outlook heal">祈り</span><br>' +
      unitType(ally).name + ' ' + forecast.soldiersBefore + '人 → <b>' + forecast.soldiersAfter + '人</b>' +
      '<span class="strong">（＋' + forecast.restored + '人）</span><br>' +
      '<span class="dim">' + note + '</span>';
  }

  function buildInfoHtml() {
    if (selection.mode === 'prayer') {
      return buildPrayerHtml(selectedUnit(), selectedPosition(), SC.Board.getUnitById(state, selection.targetId));
    }
    if (selection.mode === 'forecast') {
      return buildForecastHtml(selectedUnit(), selectedPosition(), SC.Board.getUnitById(state, selection.targetId));
    }
    if (selection.mode === 'gateForecast') {
      var gate = selectedGate();
      if (gate) {
        var damage = Math.min(gate.hp, SC.Game.getGateDamage(selectedUnit()));
        return '<span class="name">' + unitType(selectedUnit()).name + ' → 城門</span>　<span class="outlook">城門を攻める</span><br>' +
          '城門の体力 ' + gate.hp + ' → <b>' + (gate.hp - damage) + '</b><span class="strong">（−' + damage + '）</span>' + (damage >= gate.hp ? '　<b>壊せる！</b>' : '') + '<br>' +
          '<span class="dim">城門は反撃しません。大型（ゴーレム・ドラゴン）は2倍削れます</span>';
      }
    }
    if (selection.mode !== 'idle') return buildUnitInfoHtml(selectedUnit(), selectedPosition());
    if (selection.inspect && selection.inspect.unitId) {
      var unit = SC.Board.getUnitById(state, selection.inspect.unitId);
      if (unit) return buildUnitInfoHtml(unit, unit);
    }
    if (selection.inspect && selection.inspect.x !== undefined) {
      var terrain = SC.Board.getTerrain(state, selection.inspect.x, selection.inspect.y);
      var ownerText = '';
      var terrainId = state.terrain[selection.inspect.y][selection.inspect.x];
      if (SC.Economy.isEnabled(state) && SC.Economy.isBase(terrainId)) {
        var owner = SC.Economy.getOwner(state, selection.inspect.x, selection.inspect.y);
        ownerText = '（' + (owner ? SC.SIDE_NAMES[owner] + 'の' + terrain.name : '中立') + '）';
      }
      return '<span class="name">' + terrain.name + ownerText + '</span><br>' + terrain.description;
    }
    return '<span class="dim">ユニットや地形をタップすると、ここに情報が出ます。</span>';
  }

  function buildGuideText() {
    if (state.winner) return '';
    if (state.side !== 'player') return '敵軍の行動中…';
    if (busy) return '';
    if (selection.mode === 'selected') {
      var hasZone = state.rules.zoneHints && selection.reach.some(function (tile) { return tile.zone; });
      return hasZone ? '青いマスへ移動（赤い点：敵のなわばり。入ると止まる）' : '青いマスへ移動（もう一度タップでとどまる）';
    }
    if (selection.mode === 'moved') {
      var chosen = selectedUnit();
      if (chosen.justHired) return 'コマンドを選ぶ／「もどる」で城から出るマスを選び直す';
      return chosen.moved ? 'コマンドを選ぶ（雇った部隊は、このターンはもう動けません）' : 'コマンドを選ぶ／別の青いマスで移動し直す';
    }
    if (selection.mode === 'hirePlace') return '城から出て行くマス（青いマス）をタップ／「もどる」でやめる';
    if (selection.mode === 'relocate') return '出るマスを選び直す（青いマス）。雇うのは取り消せません';
    if (selection.mode === 'facing') return '矢印をタップして、騎士の向きを決める';
    if (selection.mode === 'summonPlace') return '召喚するマス（緑の枠）をタップ／「もどる」でやめる';
    if (selection.mode === 'aim') return selection.aim === 'attack' ? '攻撃する敵（赤い枠）をタップ' : '祈る味方（緑の枠）をタップ';
    if (selection.mode === 'gateForecast') return '「攻撃する」で城門を攻める／「もどる」で戻る';
    if (selection.mode === 'forecast') {
      var braced = SC.Board.getUnitById(state, selection.targetId).braced;
      return braced ? '相手は構えている：先に攻撃されます' : '「攻撃する」で確定／「もどる」で戻る';
    }
    if (selection.mode === 'prayer') return '「祈る」で確定／「やり直す」で戻る';
    return SC.Game.hasUnactedUnits(state, 'player')
      ? '光っている自軍ユニットをタップしよう'
      : '全員行動しました。「ターン終了」を押そう';
  }

  function bindButtons() {
    byId('undo-button').onclick = onUndo;
    byId('confirm-button').onclick = onConfirm;
    byId('end-turn-button').onclick = onEndTurn;
    byId('goal-button').onclick = showGoal;
    byId('overview-button').onclick = showOverview;
    byId('menu-button').onclick = showMenu;
  }

  // getState は画面の自動確認（テスト）用。ゲームの進行には使わない。
  SC.Controller = { start: start, resume: resume, bindButtons: bindButtons, getState: function () { return state; } };
})(typeof window !== 'undefined' ? window : globalThis);
