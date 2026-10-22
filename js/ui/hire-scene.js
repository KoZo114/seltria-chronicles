// 雇う画面：王のコマンド「雇う」で、城の広間の画面に切り替える。王の側近が「どの兵を雇いますか？」と尋ね、部隊の札から選ぶ。
// ルールの判断（雇えるか・値段）は js/rules/economy.js に任せ、ここでは見せて選んでもらうだけ。
(function (root) {
  var SC = (root.SC = root.SC || {});

  // 札に出す、部隊のひとこと説明
  var DESCRIPTIONS = {
    infantry: '打たれ強い前衛。町を占領できる。構えられる',
    archer: '2マス先から撃つ。近づかれると弱い',
    cleric: '祈りで味方の兵士を戻す。打たれ弱い',
    cavalry: '足が速く、斜めからも攻撃できる。森は苦手'
  };

  function getHireAssets() { return (SC.ASSETS && SC.ASSETS.hire) || {}; }

  function loadedPath(path) { return path && SC.Render.isImageLoaded(path) ? path : null; }

  var AIDE_FRAME_MS = [2200, 260];   // 側近の2枚の絵を出す長さ（1枚目を長く、2枚目は一瞬。まばたきなどの小さな動きに合う）
  var aideTimer = null;

  // 側近の絵を交互に切り替える（2枚目の絵があるときだけ）。「視差効果を減らす」設定のときは動かさない
  function startAideAnimation(image, frames) {
    stopAideAnimation();
    var reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!image || frames.length < 2 || reduceMotion) return;
    var index = 0;
    function next() {
      index = (index + 1) % frames.length;
      image.src = frames[index];
      aideTimer = root.setTimeout(next, AIDE_FRAME_MS[index] || AIDE_FRAME_MS[0]);
    }
    aideTimer = root.setTimeout(next, AIDE_FRAME_MS[0]);
  }

  function stopAideAnimation() {
    if (aideTimer) root.clearTimeout(aideTimer);
    aideTimer = null;
  }

  // 部隊の絵：戦闘用の絵（自軍は左向き）があればそれを、無ければマップ用の絵を使う
  function getUnitArt(typeId) {
    var battle = (SC.ASSETS.battle && SC.ASSETS.battle.units[typeId]) || {};
    return loadedPath(battle.player) || SC.Render.getUnitImagePath(typeId, 'player');
  }

  // 側近のせりふ：雇えないわけがあれば、それを伝える（部隊の上限・お金が足りない）
  function getAideLine(options) {
    if (options.reason === 'full') {
      return '陛下、我が軍はすでに' + options.limit + '部隊。これ以上は兵を率いきれません。<em>部隊が減れば、また雇えます</em>';
    }
    if (options.choices.every(function (choice) { return !choice.enabled; })) {
      return '陛下、ただいまの軍資金では、どの兵も雇えません。<em>町を治めれば、資金が増えます</em>';
    }
    return '陛下、どの兵を雇いますか？';
  }

  // choices: [{ typeId, enabled, note }]、gold：所持金、reason：'full'（部隊の上限）など、limit：部隊の上限。
  // onChoose(typeId)、onCancel() を呼ぶ
  function open(options) {
    var scene = document.getElementById('hire-scene');
    var assets = getHireAssets();
    var background = loadedPath(assets.background);
    var aide = loadedPath(assets.aide);
    var aideFrames = [aide, loadedPath(assets.aide2)].filter(Boolean);   // aide2：2枚目の絵（あれば交互に切り替える）
    var cards = options.choices.map(function (choice) {
      var type = SC.UNIT_TYPES[choice.typeId];
      var art = getUnitArt(choice.typeId);
      return '<button type="button" class="hire-card" data-type="' + choice.typeId + '"' + (choice.enabled ? '' : ' disabled') + '>' +
        '<span class="hire-art">' + (art ? '<img src="' + art + '" alt="" draggable="false">' : '') + '</span>' +
        '<span class="hire-text"><span class="hire-name">' + type.name + '<small>' + type.size + '人</small></span>' +
        '<span class="hire-desc">' + (DESCRIPTIONS[choice.typeId] || type.description) + '</span>' +
        (choice.enabled ? '' : '<span class="hire-note">' + choice.note + '</span>') + '</span>' +
        SC.Render.attackShapeHtml(choice.typeId) +   // 攻撃の届く形（2026-10-22）
        '<span class="hire-cost">' + type.cost + '<small>G</small></span></button>';
    }).join('');
    scene.innerHTML =
      // 雇える部隊が多いときは、札を詰める（5つから compact、9つから dense）。それでも入りきらないときは、札の一覧を指で動かせる
      '<div id="hire-box"' + (options.choices.length > 8 ? ' class="compact dense"' : options.choices.length > 4 ? ' class="compact"' : '') + '>' +
        '<div id="hire-stage"' + (background ? ' style="background-image:url(&quot;' + background + '&quot;)"' : '') + '>' +
          '<div class="hire-aide">' + (aide ? '<img src="' + aide + '" alt="側近" draggable="false">' : '<div class="hire-aide-placeholder">側近</div>') + '</div>' +
          '<div class="hire-speech">' + getAideLine(options) + '<small>所持金 <b>' + options.gold + 'G</b></small></div>' +
        '</div>' +
        '<div id="hire-list">' + cards + '</div>' +
        '<button type="button" class="hire-cancel">やめる</button>' +
      '</div>';
    scene.classList.remove('hidden');
    if (aide) startAideAnimation(scene.querySelector('.hire-aide img'), aideFrames);

    function close() {
      stopAideAnimation();
      scene.classList.add('hidden');
      scene.innerHTML = '';
    }
    Array.prototype.forEach.call(scene.querySelectorAll('.hire-card'), function (card) {
      card.onclick = function () { close(); options.onChoose(card.dataset.type); };
    });
    scene.querySelector('.hire-cancel').onclick = function () { close(); options.onCancel(); };
  }

  SC.HireScene = { open: open };
})(typeof window !== 'undefined' ? window : globalThis);
