// 召喚の場面：魔法使いが杖を掲げ、地面の6つの魔法陣を1つずつ光らせる。
// 成功した魔法陣からはスケルトンが地面からせり上がり、失敗した魔法陣はしぼんで煙が出る。最後に「スケルトン 3人 召喚！」。
// ルールの計算はしない。js/rules が決めた1人ずつの成否（event.rolls）を順番に見せるだけ。タップでいつでも飛ばせる。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var START_MS = 380;    // 魔法陣が光り始めるまで
  var STEP_MS = 190;     // 魔法陣を1つずつ試す間隔
  var RESULT_MS = 650;   // 結果の文字を見せる時間

  function getBattleArt(typeId, side) {
    var battle = (SC.ASSETS && SC.ASSETS.battle) || { units: {} };
    var path = (battle.units[typeId] || {})[side];
    if (path && SC.Render.isImageLoaded(path)) return path;
    return SC.Render.getUnitImagePath(typeId, side);
  }

  function getBackground() {
    var backgrounds = ((SC.ASSETS && SC.ASSETS.battle) || {}).backgrounds || {};
    var candidates = [backgrounds.summon, backgrounds.forest, backgrounds.fallback];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] && SC.Render.isImageLoaded(candidates[i])) return candidates[i];
    }
    return null;
  }

  // info：{ side, casterType, unitType, rolls: [true, false, …], soldiers }。終わったら解決する Promise を返す
  function play(info) {
    var scene = document.getElementById('summon-scene');
    var size = SC.UNIT_TYPES[info.unitType].size;
    var background = getBackground();
    var caster = getBattleArt(info.casterType, info.side);
    var summoned = getBattleArt(info.unitType, info.side);
    // 自軍の戦闘用の絵は左向きなので、この場面（呼び手は左、右向き）では左右を戻す
    var flip = info.side === 'player' ? ' flip' : '';
    var circles = '';
    for (var i = 0; i < size; i++) {
      // summon-pit：地面より上だけを見せる枠。中の絵を下から押し上げると、頭から地面を割って出てくるように見える
      circles += '<div class="summon-slot" data-index="' + i + '"><i class="summon-ring"></i>' +
        (summoned ? '<div class="summon-pit"><img class="summon-rise' + flip + '" src="' + summoned + '" alt="" draggable="false"></div>' : '') +
        '<i class="summon-smoke"></i></div>';
    }
    scene.innerHTML =
      '<div id="summon-box">' +
        '<div id="summon-stage"' + (background ? ' style="background-image:url(&quot;' + background + '&quot;)"' : '') + '>' +
          '<div class="summon-dark"></div>' +
          (caster ? '<img class="summon-caster' + flip + '" src="' + caster + '" alt="" draggable="false">' : '') +
          '<div class="summon-glow"></div>' +
          '<div class="summon-slots">' + circles + '</div>' +
          '<div class="summon-result"></div>' +
        '</div>' +
        '<div class="summon-caption">' + SC.SIDE_NAMES[info.side] + 'の' + SC.UNIT_TYPES[info.casterType].name + 'が、' + SC.UNIT_TYPES[info.unitType].name + 'を呼び出す…</div>' +
        '<div class="summon-skip">タップでスキップ</div>' +
      '</div>';
    scene.classList.remove('hidden');
    SC.Sound.play('pray');

    var timers = [];
    function later(ms, fn) { timers.push(root.setTimeout(fn, ms)); }
    var slots = scene.querySelectorAll('.summon-slot');
    info.rolls.forEach(function (success, index) {
      later(START_MS + index * STEP_MS, function () {
        var slot = slots[index];
        if (!slot) return;
        slot.classList.add(success ? 'success' : 'fail');
        SC.Sound.play(success ? 'select' : 'miss', success ? 0.7 : 0.5);
      });
    });
    // 最大の人数に届いて途中でやめたときは、残りの魔法陣は暗くする
    var endMs = START_MS + info.rolls.length * STEP_MS + 120;
    later(endMs, function () {
      for (var i = info.rolls.length; i < slots.length; i++) slots[i].classList.add('unused');
      var result = scene.querySelector('.summon-result');
      if (!result) return;
      result.innerHTML = info.soldiers > 0
        ? '<b>' + SC.UNIT_TYPES[info.unitType].name + ' ' + info.soldiers + '人</b><span>召喚！</span>'
        : '<b class="fail">召喚失敗…</b>';
      result.classList.add('show');
      SC.Sound.play(info.soldiers > 0 ? 'hire' : 'defeat', info.soldiers > 0 ? 0.6 : 0.25);
    });
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        timers.forEach(function (timer) { root.clearTimeout(timer); });
        scene.onclick = null;
        scene.classList.add('hidden');
        scene.innerHTML = '';
        resolve();
      }
      scene.onclick = finish;
      later(endMs + RESULT_MS, finish);
    });
  }

  SC.SummonScene = { play: play };
})(typeof window !== 'undefined' ? window : globalThis);
