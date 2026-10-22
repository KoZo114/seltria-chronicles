// キャラの会話の場面：下に会話の枠、上に話す隊長たちの顔。セリフは1文字ずつ出る。
// タップ：セリフを最後まで出す → もう一度で次の人。右上の「スキップ」で全部飛ばす。声のファイルがあれば、セリフに合わせて流す
(function (root) {
  var SC = (root.SC = root.SC || {});
  var CHAR_MS = 45;   // 1文字を出す間隔
  var voice = null;   // 声を流す audio（使い回す。iPhone でタップのたびに作ると流れないことがあるため）

  function getVoice() {
    if (!voice && typeof Audio !== 'undefined') voice = new Audio();
    return voice;
  }

  function stopVoice() {
    if (!voice) return;
    try { voice.pause(); } catch (error) { /* 止められなくても進める */ }
  }

  function playVoice(path) {
    stopVoice();
    if (!path || !SC.Sound.isEnabled()) return;
    var audio = getVoice();
    if (!audio) return;
    audio.src = path;
    audio.currentTime = 0;
    var attempt = audio.play();
    if (attempt && attempt.catch) attempt.catch(function () { /* 声のファイルが無いときは文字だけ */ });
  }

  function regularName(id) {
    var regular = SC.REGULARS.filter(function (r) { return r.id === id; })[0];
    if (regular) return regular.name;
    return ((SC.TALK_SPEAKERS || {})[id] || {}).name || '';
  }

  // 顔の絵：隊長の顔の絵。無ければ、話し手のマップ用の絵（ヴァルガスなど）
  function facePath(id) {
    var path = SC.Render.getPortraitPath(id);
    if (path) return path;
    var speaker = (SC.TALK_SPEAKERS || {})[id];
    if (!speaker) return null;
    if (speaker.portrait && SC.Render.isImageLoaded(speaker.portrait)) return speaker.portrait;
    return speaker.art || null;
  }

  // lines：SC.TALKS のひとつ。deployed：出撃している隊長の id（ifDeployed の行を選ぶ）。終わったら（スキップしても）解決する Promise を返す
  function play(lines, deployed) {
    lines = lines.filter(function (line) { return !line.ifDeployed || (deployed || []).indexOf(line.ifDeployed) >= 0; });
    var scene = document.createElement('div');
    scene.id = 'talk-scene';
    var speakers = [];
    lines.forEach(function (line) { if (speakers.indexOf(line.speaker) < 0) speakers.push(line.speaker); });
    scene.innerHTML =
      '<div class="talk-faces">' + speakers.map(function (id) {
        var path = facePath(id);
        return '<div class="talk-face' + ((SC.TALK_SPEAKERS || {})[id] ? ' enemy' : '') + '" data-speaker="' + id + '">' + (path ? '<img src="' + path + '" alt="" draggable="false">' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="talk-box"><div class="talk-name"></div><p class="talk-text"></p><span class="talk-next">▼</span></div>' +
      '<button type="button" class="talk-skip">スキップ ▶▶</button>';
    var app = document.getElementById('app');
    app.appendChild(scene);
    app.classList.add('talking');   // 会話の間は、上の帯などを隠す（css）

    return new Promise(function (resolve) {
      var index = -1;
      var timer = null;
      var shown = 0;
      var done = false;
      var textElement = scene.querySelector('.talk-text');

      function finish() {
        if (done) return;
        done = true;
        root.clearInterval(timer);
        stopVoice();
        scene.remove();
        app.classList.remove('talking');
        resolve();
      }

      function showAll() {
        root.clearInterval(timer);
        timer = null;
        textElement.textContent = lines[index].text;
        scene.classList.add('line-done');
      }

      function next() {
        index += 1;
        if (index >= lines.length) { finish(); return; }
        var line = lines[index];
        scene.classList.remove('line-done');
        scene.querySelector('.talk-name').textContent = regularName(line.speaker);
        Array.prototype.forEach.call(scene.querySelectorAll('.talk-face'), function (face) {
          face.classList.toggle('speaking', face.dataset.speaker === line.speaker);
        });
        shown = 0;
        textElement.textContent = '';
        playVoice(line.voice);
        root.clearInterval(timer);
        timer = root.setInterval(function () {
          shown += 1;
          textElement.textContent = line.text.slice(0, shown);
          if (shown >= line.text.length) showAll();
        }, CHAR_MS);
      }

      scene.onclick = function () {
        if (timer) showAll();
        else next();
      };
      scene.querySelector('.talk-skip').onclick = function (event) {
        event.stopPropagation();
        finish();
      };
      next();
    });
  }

  SC.TalkScene = { play: play };
})(typeof window !== 'undefined' ? window : globalThis);
