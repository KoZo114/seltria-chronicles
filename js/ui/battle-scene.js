// 戦闘シーン：攻撃のたびに別画面で、向かい合った2つの部隊の戦いを見せる。
// ルールの計算はしない。js/rules が出した結果（誰が誰に何ダメージ、誰が外したか）を順番に再生するだけ。
// 右に自軍、左に敵軍を置き、部隊の人数分の兵士を並べる。タップするといつでも最後まで飛ばせる。
(function (root) {
  var SC = (root.SC = root.SC || {});

  // 兵士の並べ方。size は絵の表示サイズ（元の絵は128）。slots は「最後まで残る兵士」から順に [列, 段]。
  // 列0が後ろ（画面の端側）、列1が前（中央側）。段0が奥、段2が手前。前の列の兵士から倒れる。
  var SMALL_SQUAD = { size: 64, columnStep: 46, rowStep: 24, rowShift: 10, slots: [[0, 1], [0, 0], [0, 2], [1, 1], [1, 0], [1, 2]] };
  var HEAVY_SQUAD = { size: 96, columnStep: 0, rowStep: 34, rowShift: 28, slots: [[0, 1], [0, 0], [0, 2]] };
  var ESCORT_FALLBACK_TYPE = 'infantry';   // 近衛兵の絵がまだ無い間は、歩兵の絵で代用する
  var SOLDIER_INTERVAL = 110;              // 兵士が1人ずつ攻撃する間隔（ミリ秒）

  function getFormation(typeId) { return SC.UNIT_TYPES[typeId].size > 3 ? SMALL_SQUAD : HEAVY_SQUAD; }

  function getBattleAssets() { return (SC.ASSETS && SC.ASSETS.battle) || { backgrounds: {}, units: {} }; }

  function getBattleArt(typeId, side) {
    var path = (getBattleAssets().units[typeId] || {})[side];
    return path && SC.Render.isImageLoaded(path) ? path : null;
  }

  function isCaptainLook(typeId) { return (getBattleAssets().captainLook || []).indexOf(typeId) >= 0; }

  // 兵士1人分の絵。戦闘用の絵が無いユニットは、マップ用の絵を拡大して使う
  function buildSoldierBodyHtml(fighter, slotIndex) {
    var escortType = SC.UNIT_TYPES[fighter.type].escortType;
    var path = null;
    if (escortType && slotIndex > 0) {
      path = getBattleArt(escortType, fighter.side) || getBattleArt(ESCORT_FALLBACK_TYPE, fighter.side);
    }
    // 正規部隊は、先頭（slotIndex 0。いちばん最後まで倒れない1人）だけ隊長の姿、残りは一般の兵の絵（2026-10-19 ユーザーの希望）。
    // ただし、一般の兵の絵がまだ隊長の顔の絵（battle.captainLook）のクラスは、全員を隊長の姿にする（別の隊長の顔が混ざらないように）
    // 一般の兵の戦闘用の絵がまだ無いクラス（サーガ・ハイプリーストなど）も、全員を隊長の姿にする（黒い仮の印にならないように）
    if (!path && fighter.regularId && (slotIndex === 0 || isCaptainLook(fighter.type) || !getBattleArt(fighter.type, fighter.side))) {
      path = SC.Render.getRegularArtPath(fighter.regularId, fighter.type, 'battle');
    }
    path = path || getBattleArt(fighter.type, fighter.side) || SC.Render.getUnitImagePath(fighter.type, fighter.side);
    return path
      ? '<img src="' + path + '" alt="" draggable="false">'
      : '<div class="fighter-fallback">' + SC.Render.createUnitSvg(fighter.type, fighter.side) + '</div>';
  }

  // 持ち主のいる地形（城）は、持ち主の軍用の背景（「地形_軍」）があればそれを使う
  function getBackgroundPath(terrainId, terrainOwner) {
    var backgrounds = getBattleAssets().backgrounds;
    var path = backgrounds[terrainId + '_' + terrainOwner] || backgrounds[terrainId] || backgrounds.fallback;
    return path && SC.Render.isImageLoaded(path) ? path : null;
  }

  // 背景：左半分は敵軍が立っている地形、右半分は自軍が立っている地形。同じ背景なら、分けずに1枚で見せる
  function buildBackgroundHtml(info) {
    var left = getBackgroundPath(info.enemy.terrainId, info.enemy.terrainOwner);
    var right = getBackgroundPath(info.player.terrainId, info.player.terrainOwner);
    function layer(className, path) {
      return path ? '<div class="battle-bg ' + className + '" style="background-image:url(&quot;' + path + '&quot;)"></div>' : '';
    }
    var html = layer('', left || right);
    if (left && right && left !== right) html += layer('right', right) + '<div class="battle-bg-divider"></div>';
    return html;
  }

  function buildTerrainTagHtml(position, fighter) {
    var terrain = SC.TERRAIN[fighter.terrainId];
    if (!terrain) return '';
    var bonus = terrain.defense > 0 ? '　防御+' + terrain.defense : '';
    return '<div class="battle-terrain ' + position + '">' + terrain.name + bonus + '</div>';
  }

  // 部隊の全員（最大人数ぶん）を並べる。すでに倒れている兵士は、後で setHp が消す
  function buildSquadHtml(position, fighter) {
    var formation = getFormation(fighter.type);
    var maxRow = formation.slots.reduce(function (max, slot) { return Math.max(max, slot[1]); }, 0);
    var html = '';
    for (var index = 0; index < SC.UNIT_TYPES[fighter.type].size; index++) {
      var slot = formation.slots[index % formation.slots.length];
      var edge = slot[0] * formation.columnStep + slot[1] * formation.rowShift;
      var bottom = (maxRow - slot[1]) * formation.rowStep;
      html += '<div class="fighter ' + position + ' ' + fighter.side + '" data-slot="' + index + '" style="' +
        (position === 'left' ? 'left' : 'right') + ':calc(3% + ' + edge + 'px);bottom:calc(6% + ' + bottom + 'px);' +
        'width:' + formation.size + 'px;height:' + formation.size + 'px;z-index:' + (slot[1] + 1) + '">' +
        buildSoldierBodyHtml(fighter, index) + '</div>';
    }
    return html;
  }

  function buildStatusHtml(position, fighter) {
    return '<div class="battle-hp ' + position + '">' +
      '<div class="who ' + fighter.side + '-text">' + SC.SIDE_NAMES[fighter.side] + ' ' + SC.UNIT_TYPES[fighter.type].name + '</div>' +
      '<div class="num"></div><div class="bar"><i></i></div></div>';
  }

  // info: { player, enemy: { type, side, hp, maxHp, terrainId, terrainOwner },
  //         strikes: [{ attackerSide, soldiers, hits, missIndexes, result, lost, misses, damage, defenderHp, killed, isCounter }] }
  // 終わったら解決する Promise を返す
  function play(info) {
    var scene = document.getElementById('battle-scene');
    var fighters = { player: info.player, enemy: info.enemy };
    var positions = { player: 'right', enemy: 'left' };
    var currentHp = { player: info.player.hp, enemy: info.enemy.hp };

    scene.innerHTML =
      '<div id="battle-box">' +
        '<div id="battle-stage">' + buildBackgroundHtml(info) +
          buildTerrainTagHtml(positions.enemy, info.enemy) + buildTerrainTagHtml(positions.player, info.player) +
          buildSquadHtml(positions.enemy, info.enemy) + buildSquadHtml(positions.player, info.player) +
          '<div id="battle-label"></div>' +
        '</div>' +
        '<div id="battle-status">' + buildStatusHtml(positions.enemy, info.enemy) + buildStatusHtml(positions.player, info.player) + '</div>' +
        '<div id="battle-skip">タップでスキップ</div>' +
      '</div>';
    scene.classList.remove('hidden');

    var stage = document.getElementById('battle-stage');
    var label = document.getElementById('battle-label');

    function soldierElements(side) {
      return Array.prototype.slice.call(stage.querySelectorAll('.fighter.' + positions[side]));
    }

    // 体力に合わせて、兵士の絵（倒れた兵士は消し、けが人は薄くする）と、下の人数・ゲージを更新する
    function setHp(side, hp) {
      var type = SC.UNIT_TYPES[fighters[side].type];
      var soldiers = SC.Combat.countSoldiers(fighters[side].type, hp);
      var isWounded = hp % type.soldierHp !== 0;
      currentHp[side] = hp;
      soldierElements(side).forEach(function (element) {
        var slot = Number(element.dataset.slot);
        element.classList.toggle('fallen', slot >= soldiers);
        element.classList.toggle('wounded', isWounded && slot === soldiers - 1);
      });
      var panel = scene.querySelector('.battle-hp.' + positions[side]);
      var ratio = Math.max(0, hp / fighters[side].maxHp);
      var bar = panel.querySelector('.bar i');
      bar.style.width = ratio * 100 + '%';
      bar.className = ratio * 3 <= 1 ? 'low' : ratio * 3 <= 2 ? 'mid' : '';
      panel.querySelector('.num').innerHTML = '<b>' + soldiers + '</b>人<span> ／ ' + type.size + '人</span>';
    }
    setHp('player', info.player.hp);
    setHp('enemy', info.enemy.hp);

    // タップされたら、残りの待ち時間をすべて0にして最後まで進める
    var skipped = false;
    var releaseSkip = null;
    var skipSignal = new Promise(function (resolve) { releaseSkip = resolve; });
    scene.onclick = function () { skipped = true; releaseSkip(); };
    function wait(milliseconds) {
      if (skipped) return Promise.resolve();
      return Promise.race([SC.Render.sleep(milliseconds), skipSignal]);
    }

    function addEffect(className, side, html) {
      var effect = document.createElement('div');
      effect.className = className + ' ' + positions[side];
      effect.innerHTML = html || '';
      stage.appendChild(effect);
      return effect;
    }

    // 兵士の頭の上に出す小さな文字（「ミス」）
    function addSoldierNote(soldier, text) {
      var note = document.createElement('div');
      note.className = 'battle-note';
      note.textContent = text;
      soldier.appendChild(note);
    }

    // 生き残っている兵士のうち、いちばん前（次に倒れる）の1人
    function frontSoldier(side) {
      var alive = soldierElements(side).filter(function (element) { return !element.classList.contains('fallen'); });
      return alive.sort(function (a, b) { return Number(b.dataset.slot) - Number(a.dataset.slot); })[0] || null;
    }

    // 部隊の一斉攻撃：生き残った兵士が前から1人ずつ攻撃し、当たるたびに相手の人数が減っていく
    function playStrike(strike) {
      var attackerSide = strike.attackerSide;
      var defenderSide = SC.Game.otherSide(attackerSide);
      var isRanged = SC.UNIT_TYPES[fighters[attackerSide].type].rangeMin > 1;
      var attackers = soldierElements(attackerSide)
        .filter(function (element) { return !element.classList.contains('fallen'); })
        .sort(function (a, b) { return Number(b.dataset.slot) - Number(a.dataset.slot); })
        .slice(0, strike.soldiers);
      var startHp = currentHp[defenderSide];
      var hitsDone = 0;
      label.textContent = strike.isBraced ? '構え！' : strike.isCounter ? '反撃！' : '';

      function playSoldier(soldier, index) {
        var missed = strike.missIndexes.indexOf(index) !== -1;
        soldier.classList.add(isRanged ? 'shoot' : 'lunge');
        var projectile = null;
        if (isRanged) {
          projectile = addEffect('battle-arrow', attackerSide);
          projectile.style.bottom = 'calc(' + soldier.style.bottom + ' + ' + Math.round(soldier.offsetHeight * 0.45) + 'px)';
        }
        if (!skipped) SC.Sound.play(isRanged ? 'arrow' : 'swing');   // スキップ中は、音が一度に重なるので鳴らさない
        return wait(SOLDIER_INTERVAL).then(function () {
          if (projectile) projectile.remove();
          if (missed) {
            addSoldierNote(soldier, 'ミス');
            if (!skipped) SC.Sound.play('miss');
          } else {
            hitsDone += 1;
            // 合計ダメージを、当たった人数で分けて少しずつ減らす（最後の1人で、ルールが出した結果とぴったり合う）
            var struck = frontSoldier(defenderSide);
            setHp(defenderSide, hitsDone === strike.hits ? strike.defenderHp : Math.max(1, startHp - Math.round((strike.damage * hitsDone) / strike.hits)));
            if (struck) {
              struck.classList.remove('hit');
              void struck.offsetWidth;
              struck.classList.add('hit');
            }
            if (!skipped) SC.Sound.play('hit');
          }
          return wait(SOLDIER_INTERVAL * 0.6);
        }).then(function () {
          soldier.classList.remove('lunge', 'shoot');
        });
      }

      return attackers.reduce(function (chain, soldier, index) {
        return chain.then(function () { return playSoldier(soldier, index); });
      }, Promise.resolve()).then(function () {
        setHp(defenderSide, strike.defenderHp);
        addEffect('battle-popup ' + strike.result, defenderSide, SC.Render.buildStrikePopupHtml(strike));
        if (strike.killed && !skipped) SC.Sound.play('fall');
        return wait(strike.killed ? 900 : 650);
      }).then(function () {
        Array.prototype.forEach.call(stage.querySelectorAll('.battle-popup, .battle-arrow, .battle-note'), function (element) { element.remove(); });
        soldierElements(defenderSide).forEach(function (element) { element.classList.remove('hit'); });
        return wait(150);
      });
    }

    function close() {
      scene.onclick = null;
      scene.classList.add('hidden');
      scene.innerHTML = '';
    }

    return info.strikes.reduce(function (chain, strike) {
      return chain.then(function () { return playStrike(strike); });
    }, wait(450)).then(function () { return wait(250); }).then(close, close);
  }

  SC.BattleScene = { play: play };
})(typeof window !== 'undefined' ? window : globalThis);
