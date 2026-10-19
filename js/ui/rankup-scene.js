// ランクアップの場面：正規部隊がランクアップしたときに出す、豪華な場面（約5秒、タップで飛ばせる）。
// 背景は金色の光の動画（assets64/rankup/。無ければ1枚絵、それも無ければプログラムで描いた光の柱）。
// その上に、今のクラスの姿 → 白く光る → 光がはじけて新しいクラスの姿 → 「CLASS UP」→ 隊長の顔とひと言、を重ねる。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var SHOW_MS = 5200;
  var PARTICLES = 18;

  function getRankupAssets() { return (SC.ASSETS && SC.ASSETS.rankup) || {}; }

  // 戦闘用の大きな絵（隊長ごとの姿があれば、それを使う）
  function getArt(regularId, typeId) {
    var regular = SC.Render.getRegularArtPath(regularId, typeId, 'battle');
    if (regular) return regular;
    var battle = ((SC.ASSETS && SC.ASSETS.battle) || { units: {} }).units[typeId] || {};
    if (battle.player && SC.Render.isImageLoaded(battle.player)) return battle.player;
    return SC.Render.getRegularArtPath(regularId, typeId, 'map') || SC.Render.getUnitImagePath(typeId, 'player');
  }

  function particlesHtml() {
    var html = '';
    for (var i = 0; i < PARTICLES; i++) {
      var left = Math.round(10 + Math.random() * 80);
      var delay = (1.9 + Math.random() * 1.6).toFixed(2);
      var size = Math.round(4 + Math.random() * 6);
      html += '<i style="left:' + left + '%;width:' + size + 'px;height:' + size + 'px;animation-delay:' + delay + 's"></i>';
    }
    return html;
  }

  // event：ルールが出した rankUp の出来事（{ regularId, name, from, to }）。終わったら解決する Promise を返す
  function play(event) {
    var scene = document.createElement('div');
    scene.id = 'rankup-scene';
    var assets = getRankupAssets();
    var poster = assets.poster || null;   // 無いときは、背景は暗いまま（光の柱はプログラムで描く）
    var regular = SC.REGULARS.filter(function (r) { return r.id === event.regularId; })[0] || {};
    var portrait = SC.Render.getPortraitPath(event.regularId);
    var before = getArt(event.regularId, event.from);
    var after = getArt(event.regularId, event.to);
    var reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scene.innerHTML =
      '<div class="rankup-bg"' + (poster ? ' style="background-image:url(&quot;' + poster + '&quot;)"' : '') + '></div>' +
      '<div class="rankup-pillar"></div>' +
      '<div class="rankup-figure">' +
        (before ? '<img class="rankup-before" src="' + before + '" alt="" draggable="false">' : '') +
        (after ? '<img class="rankup-after" src="' + after + '" alt="" draggable="false">' : '') +
      '</div>' +
      '<div class="rankup-flash"></div>' +
      '<div class="rankup-particles">' + particlesHtml() + '</div>' +
      '<div class="rankup-heading"><b>CLASS UP</b><span>' + event.name + '隊</span>' +
        '<em>' + SC.UNIT_TYPES[event.from].name + '<i>▶</i><strong>' + SC.UNIT_TYPES[event.to].name + '</strong></em></div>' +
      '<div class="rankup-talk">' + (portrait ? '<img src="' + portrait + '" alt="" draggable="false">' : '') +
        (regular.rankUpLine ? '<p>「' + regular.rankUpLine + '」</p>' : '') + '</div>' +
      '<div class="rankup-skip">タップで進む</div>';
    if (assets.video && !reduceMotion) {
      var video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      if (poster) video.poster = poster;
      video.onerror = function () { video.remove(); };
      // 動画が流れ始めたら、プログラムで描いた光の柱は控えめにする（動画の光と重ならないように）
      video.onplaying = function () { scene.classList.add('has-video'); };
      video.src = assets.video;
      scene.querySelector('.rankup-bg').appendChild(video);
      var attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(function () { video.remove(); });
    }
    document.getElementById('app').appendChild(scene);
    SC.Sound.play('pray');
    SC.Sound.play('victory', 1.85);   // 光がはじけて姿が変わるところで鳴らす
    var timers = [];
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        timers.forEach(function (timer) { root.clearTimeout(timer); });
        scene.remove();
        resolve();
      }
      scene.onclick = finish;
      timers.push(root.setTimeout(finish, SHOW_MS));
    });
  }

  SC.RankUpScene = { play: play };
})(typeof window !== 'undefined' ? window : globalThis);
