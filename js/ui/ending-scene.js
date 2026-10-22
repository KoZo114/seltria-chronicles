// エンディング（ステージ20に勝ったあと。2026-10-22）：タイトルの絵を暗くした背景に、お話の文を1段ずつ出し、
// 最後に題字と「おしまい」を出す。タップすると、文を早く進める。「タイトルへ」を押したら解決する Promise を返す
(function (root) {
  var SC = (root.SC = root.SC || {});
  var LINE_MS = 5500;   // お話の1段を出す間隔（読み終わるくらい）
  var FINALE_MS = 6500; // 最後の段から題字までの間

  // options: { story: [段, ...] }
  function play(options) {
    var story = options.story || [];
    var poster = (SC.ASSETS && SC.ASSETS.title && SC.ASSETS.title.poster) || '';
    var scene = document.createElement('div');
    scene.id = 'ending-scene';
    scene.innerHTML =
      '<div class="ending-bg"' + (poster ? ' style="background-image:url(&quot;' + poster + '&quot;)"' : '') + '></div>' +
      '<div class="ending-shade"></div>' +
      '<div class="ending-story">' + story.map(function (text) { return '<p>' + text + '</p>'; }).join('') + '</div>' +
      '<div class="ending-finale">' +
        '<p class="title-name">セルトリア戦記</p>' +
        '<p class="ending-end">おしまい</p>' +
        '<p class="ending-thanks">遊んでくれて、ありがとう！</p>' +
        '<button type="button" class="title-button primary" id="ending-close">タイトルへ</button>' +
      '</div>';
    document.getElementById('app').appendChild(scene);
    SC.Sound.playMusic('title', true);

    return new Promise(function (resolve) {
      var lines = Array.prototype.slice.call(scene.querySelectorAll('.ending-story p'));
      var shown = 0;
      var timer = null;

      function schedule(ms) {
        root.clearTimeout(timer);
        timer = root.setTimeout(step, ms);
      }

      function step() {
        if (shown < lines.length) {
          lines[shown].classList.add('shown');
          shown += 1;
          schedule(shown < lines.length ? LINE_MS : FINALE_MS);
          return;
        }
        root.clearTimeout(timer);
        timer = null;
        scene.classList.add('finale');
      }

      // タップで次の段へ（最後まで出ていたら何もしない）
      scene.onclick = function () { if (timer) step(); };
      scene.querySelector('#ending-close').onclick = function (event) {
        event.stopPropagation();
        root.clearTimeout(timer);
        SC.Sound.stopMusic();
        scene.remove();
        resolve();
      };
      schedule(900);
    });
  }

  SC.EndingScene = { play: play };
})(typeof window !== 'undefined' ? window : globalThis);
