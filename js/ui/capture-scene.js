// 町を占領した場面：そのステージで自軍が最初に町を取ったときだけ、町の通りで旗を掲げる短い場面を見せる（約2.9秒、タップで飛ばせる）。
// 2つ目からは、マップの上で旗を立てる演出だけにする（毎回だとテンポが悪くなるため）。
// 絵は2枚（旗の無い絵と、歩兵が槍を掲げた絵）と、切り抜いた旗。旗が旗竿を上がりきったところで、2枚目の絵に切り替える。
// 絵が無いときは、町の背景に歩兵の絵と、プログラムで描いた旗を出す。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var SHOW_MS = 2900;
  var PICTURE_SIZE = [688, 384];
  var RAISE_START_MS = 250;   // 旗が上がり始める
  var RAISED_MS = 1050;       // 旗が上がりきって、歩兵が槍を掲げる

  function hasPictures(capture) {
    return capture && ['before', 'after', 'flag'].every(function (id) {
      return capture[id] && SC.Render.isImageLoaded(capture[id]);
    });
  }

  function percent(value, total) {
    return (value / total * 100).toFixed(3) + '%';
  }

  function pictureStage(capture) {
    var box = capture.flagBox;
    var flagStyle = 'left:' + percent(box[0], PICTURE_SIZE[0]) + ';top:' + percent(box[1], PICTURE_SIZE[1]) +
      ';width:' + percent(box[2], PICTURE_SIZE[0]) + ';height:' + percent(box[3], PICTURE_SIZE[1]);
    return '<div id="capture-stage" class="picture">' +
        '<img class="capture-picture before" src="' + capture.before + '" alt="" draggable="false">' +
        '<img class="capture-picture after" src="' + capture.after + '" alt="" draggable="false">' +
        '<div class="capture-flag-picture" style="' + flagStyle + '"><img src="' + capture.flag + '" alt="" draggable="false"></div>' +
        '<div class="capture-light"></div>' +
        '<div class="capture-sparkles"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '</div>';
  }

  function drawnStage(info) {
    var battle = (SC.ASSETS && SC.ASSETS.battle) || { backgrounds: {}, units: {} };
    var background = battle.backgrounds.town && SC.Render.isImageLoaded(battle.backgrounds.town) ? battle.backgrounds.town : null;
    var art = (battle.units[info.unitType] || {}).player;
    if (!art || !SC.Render.isImageLoaded(art)) art = SC.Render.getUnitImagePath(info.unitType, 'player');
    return '<div id="capture-stage"' + (background ? ' style="background-image:url(&quot;' + background + '&quot;)"' : '') + '>' +
        '<div class="capture-flag"><i class="pole"></i><i class="cloth">' +
          '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M5 12 L4 4 L8.5 8 L12 3 L15.5 8 L20 4 L19 12 Z" fill="#f2c94c" stroke="#5a4300" stroke-width=".8" stroke-linejoin="round"/></svg>' +
        '</i></div>' +
        (art ? '<img class="capture-unit" src="' + art + '" alt="" draggable="false">' : '') +
        '<div class="capture-light"></div>' +
      '</div>';
  }

  // 帯の左右につける金の飾り（右側は左右反転して使う）
  var FLOURISH = '<svg class="capture-flourish" viewBox="0 0 60 14" aria-hidden="true">' +
    '<path d="M0 7 H40" stroke="#d9b452" stroke-width="1.4"/>' +
    '<path d="M40 7 C44 2 48 2 50 7 C48 12 44 12 40 7 Z" fill="#f2c94c"/>' +
    '<path d="M50 7 L54 3 L58 7 L54 11 Z" fill="#ffe39a" stroke="#8a6a1a" stroke-width=".6"/></svg>';

  // info: { unitType, income }。終わったら解決する Promise を返す
  function play(info) {
    var scene = document.getElementById('capture-scene');
    var capture = SC.ASSETS && SC.ASSETS.capture;
    var usePictures = hasPictures(capture);
    scene.innerHTML =
      '<div id="capture-box">' +
        (usePictures ? pictureStage(capture) : drawnStage(info)) +
        '<div class="capture-banner">' +
          '<i class="capture-crest" aria-hidden="true"></i>' +
          '<div class="capture-title">' + FLOURISH + '<b>町を占領！</b>' + FLOURISH.replace('class="capture-flourish"', 'class="capture-flourish flip"') + '</div>' +
          '<span>この町から、毎ターン <em>+' + info.income + 'G</em> の収入が入ります</span>' +
        '</div>' +
        '<div class="capture-skip">✦ タップで進む ✦</div>' +
      '</div>';
    scene.classList.remove('hidden');
    var timers = [];
    if (usePictures) {
      timers.push(root.setTimeout(function () { SC.Sound.play('capture'); }, RAISE_START_MS));
      timers.push(root.setTimeout(function () { SC.Sound.play('victory', 0.3); }, RAISED_MS));
    } else {
      SC.Sound.play('capture');
      SC.Sound.play('victory', 0.25);
    }
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
      timers.push(root.setTimeout(finish, SHOW_MS));
    });
  }

  SC.CaptureScene = { play: play };
})(typeof window !== 'undefined' ? window : globalThis);
