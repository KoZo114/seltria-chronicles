// 音：曲（BGM）と効果音。音が鳴らせない環境でも、何も起きないだけでゲームは進む。
// 曲は音声ファイル（js/data/assets.js の sound.music）を繰り返し流す。同時に流れる曲は1つだけ。
// 効果音はファイルを使わず、ここで波形を組み合わせて作っている（素材の権利を気にせず使える）。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var MUSIC_VOLUME = 0.7;    // iPhoneでは無視され、本体の音量どおりに鳴る
  var EFFECT_VOLUME = 0.7;

  var enabled = true;
  var musicElements = {};    // 曲ごとの再生用の部品（曲の名前 → 部品）
  var primed = {};           // タップの中で一度鳴らして、自動で鳴らせるようにした曲
  var wantedTrack = null;    // いま流れているべき曲（無音にしたいときは null）
  var context = null;        // 効果音を作る装置
  var output = null;

  function getTracks() { return (SC.ASSETS && SC.ASSETS.sound && SC.ASSETS.sound.music) || {}; }

  // ---- 曲 ----

  function createMusicElements() {
    if (typeof root.Audio !== 'function') return;
    var tracks = getTracks();
    Object.keys(tracks).forEach(function (trackId) {
      var audio = new root.Audio();
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = MUSIC_VOLUME;
      audio.src = tracks[trackId];
      musicElements[trackId] = audio;
    });
  }

  function ignoreFailure(attempt) {
    if (attempt && attempt.catch) attempt.catch(function () {});   // 鳴らせなくても、ゲームは進める
  }

  // 流れているべき曲だけを鳴らし、ほかの曲は必ず止める
  function syncMusic() {
    var shouldPlay = enabled && !document.hidden;
    Object.keys(musicElements).forEach(function (trackId) {
      var audio = musicElements[trackId];
      if (trackId === wantedTrack && shouldPlay) {
        audio.muted = false;
        if (audio.paused) ignoreFailure(audio.play());
      } else if (!audio.paused) {
        audio.pause();
      }
    });
  }

  // iPhoneなどでは、タップの中で一度鳴らした曲でないと、あとから自動で鳴らせない。
  // そこで画面に触れたときに、全部の曲を音を消したまま一瞬だけ再生して、すぐ止めておく。
  function primeMusic() {
    Object.keys(musicElements).forEach(function (trackId) {
      if (primed[trackId]) return;
      primed[trackId] = true;
      if (trackId === wantedTrack) return;   // いま流す曲は、syncMusic がそのまま鳴らす
      var audio = musicElements[trackId];
      audio.muted = true;
      var attempt = audio.play();
      function settle() {
        audio.muted = false;
        if (trackId !== wantedTrack) audio.pause();
      }
      if (attempt && attempt.then) attempt.then(settle, function () { audio.muted = false; });
      else settle();
    });
  }

  // 曲を流す。ほかの曲は止まる。fromStart が true なら最初から、false なら前に止めたところの続きから流す。
  // 名前が無い・その曲のファイルが無いときは、無音になる
  function playMusic(trackId, fromStart) {
    wantedTrack = musicElements[trackId] ? trackId : null;
    if (wantedTrack && fromStart) {
      try { musicElements[wantedTrack].currentTime = 0; } catch (error) { /* 読み込み前は巻き戻せないだけ */ }
    }
    syncMusic();
  }

  function stopMusic() {
    wantedTrack = null;
    syncMusic();
  }

  // ---- 効果音 ----

  function getContext() {
    if (context) return context;
    var AudioContext = root.AudioContext || root.webkitAudioContext;
    if (!AudioContext) return null;
    try {
      context = new AudioContext();
      // 音が重なっても割れないように、最後に音量をならす
      var limiter = context.createDynamicsCompressor();
      output = context.createGain();
      output.gain.value = EFFECT_VOLUME;
      output.connect(limiter);
      limiter.connect(context.destination);
    } catch (error) {
      context = null;
    }
    return context;
  }

  // 音量が「すっと立ち上がって、だんだん消える」形の入れ物を作る
  function createEnvelope(start, duration, volume, attack) {
    var gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + (attack || 0.008));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(output);
    return gain;
  }

  // 音程のある音。note: { wave, from, to, duration, volume, delay, attack }（from→to へ音の高さが変わる）
  function tone(note) {
    var start = context.currentTime + (note.delay || 0);
    var oscillator = context.createOscillator();
    oscillator.type = note.wave || 'sine';
    oscillator.frequency.setValueAtTime(note.from, start);
    if (note.to) oscillator.frequency.exponentialRampToValueAtTime(note.to, start + note.duration);
    oscillator.connect(createEnvelope(start, note.duration, note.volume, note.attack));
    oscillator.start(start);
    oscillator.stop(start + note.duration + 0.02);
  }

  var noiseBuffer = null;
  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // ザッという雑音。burst: { filter, from, to, duration, volume, delay, attack }（from→to へ音の明るさが変わる）
  function noise(burst) {
    var start = context.currentTime + (burst.delay || 0);
    var source = context.createBufferSource();
    source.buffer = getNoiseBuffer();
    var filter = context.createBiquadFilter();
    filter.type = burst.filter || 'lowpass';
    filter.frequency.setValueAtTime(burst.from, start);
    if (burst.to) filter.frequency.exponentialRampToValueAtTime(burst.to, start + burst.duration);
    source.connect(filter);
    filter.connect(createEnvelope(start, burst.duration, burst.volume, burst.attack));
    source.start(start);
    source.stop(start + burst.duration + 0.02);
  }

  // 音階を順に鳴らす（勝利・敗北の短い曲用）
  function melody(wave, volume, notes) {
    notes.forEach(function (item) {
      tone({ wave: wave, from: item[1], duration: item[2], volume: volume, delay: item[0], attack: 0.015 });
    });
  }

  var EFFECTS = {
    // ボタンを押した
    tap: function () { tone({ wave: 'triangle', from: 660, to: 880, duration: 0.06, volume: 0.18 }); },
    // ユニットを選んだ
    select: function () {
      tone({ from: 880, duration: 0.07, volume: 0.2 });
      tone({ from: 1320, duration: 0.1, volume: 0.18, delay: 0.06 });
    },
    // 歩いた（足音2歩）
    move: function () {
      noise({ from: 700, to: 300, duration: 0.07, volume: 0.35 });
      noise({ from: 700, to: 300, duration: 0.07, volume: 0.3, delay: 0.13 });
    },
    // 武器を振った
    swing: function () { noise({ filter: 'bandpass', from: 900, to: 3200, duration: 0.14, volume: 0.3, attack: 0.04 }); },
    // 矢を放った
    arrow: function () {
      tone({ wave: 'triangle', from: 520, to: 180, duration: 0.07, volume: 0.25 });
      noise({ filter: 'bandpass', from: 1800, to: 5000, duration: 0.22, volume: 0.28, attack: 0.03, delay: 0.03 });
    },
    // 当たった
    hit: function () {
      noise({ from: 2400, to: 500, duration: 0.13, volume: 0.6 });
      tone({ wave: 'square', from: 170, to: 60, duration: 0.14, volume: 0.35 });
    },
    // クリティカル
    crit: function () {
      noise({ from: 5000, to: 400, duration: 0.25, volume: 0.75 });
      tone({ wave: 'square', from: 220, to: 45, duration: 0.25, volume: 0.45 });
      tone({ wave: 'triangle', from: 1568, duration: 0.35, volume: 0.25, delay: 0.02 });
      tone({ wave: 'triangle', from: 2093, duration: 0.4, volume: 0.2, delay: 0.07 });
    },
    // 外れた
    miss: function () { noise({ filter: 'bandpass', from: 3000, to: 700, duration: 0.2, volume: 0.22, attack: 0.05 }); },
    // 倒れた
    fall: function () {
      tone({ wave: 'sawtooth', from: 280, to: 50, duration: 0.5, volume: 0.28 });
      noise({ from: 900, to: 150, duration: 0.45, volume: 0.35, delay: 0.05 });
    },
    // 構え（槍を立てる、低く短い金属音）
    brace: function () {
      noise({ from: 1800, to: 600, duration: 0.12, volume: 0.35 });
      tone({ wave: 'triangle', from: 330, duration: 0.25, volume: 0.25, delay: 0.03 });
      tone({ wave: 'triangle', from: 494, duration: 0.3, volume: 0.18, delay: 0.1 });
    },
    // お金が入った（小さな鈴の音）
    coin: function () {
      tone({ wave: 'square', from: 1319, duration: 0.08, volume: 0.12 });
      tone({ wave: 'square', from: 1976, duration: 0.18, volume: 0.12, delay: 0.07 });
    },
    // 雇った（短いラッパ）
    hire: function () {
      melody('square', 0.13, [[0, 523, 0.1], [0.1, 659, 0.1], [0.2, 784, 0.22]]);
    },
    // 町を占領した（旗を立てる音）
    capture: function () {
      noise({ filter: 'bandpass', from: 600, to: 2400, duration: 0.18, volume: 0.25, attack: 0.03 });
      melody('triangle', 0.2, [[0.05, 784, 0.15], [0.18, 1047, 0.3]]);
    },
    // 祈り（上がっていく澄んだ音）
    pray: function () {
      melody('sine', 0.18, [[0, 784, 0.35], [0.1, 988, 0.35], [0.2, 1175, 0.4], [0.3, 1568, 0.6]]);
      melody('triangle', 0.08, [[0, 1568, 0.5], [0.2, 2349, 0.6]]);
    },
    // ターンが変わった
    turn: function () {
      tone({ wave: 'triangle', from: 784, duration: 0.25, volume: 0.2 });
      tone({ wave: 'triangle', from: 1175, duration: 0.4, volume: 0.2, delay: 0.12 });
    },
    // 勝利（明るい上り調子）
    victory: function () {
      var notes = [[0, 523, 0.16], [0.15, 659, 0.16], [0.3, 784, 0.16], [0.45, 1047, 0.5], [0.95, 880, 0.18], [1.13, 988, 0.18], [1.31, 1047, 1.1]];
      melody('square', 0.16, notes);
      melody('triangle', 0.22, notes.map(function (item) { return [item[0], item[1] / 2, item[2]]; }));
      melody('triangle', 0.16, [[1.31, 659, 1.1], [1.31, 784, 1.1]]);
    },
    // 敗北（暗い下り調子）
    defeat: function () {
      var notes = [[0, 440, 0.4], [0.4, 349, 0.4], [0.8, 294, 0.4], [1.2, 220, 1.3]];
      melody('triangle', 0.26, notes);
      melody('sine', 0.2, notes.map(function (item) { return [item[0], item[1] / 2, item[2]]; }));
    }
  };

  // 効果音を鳴らす。delaySeconds を渡すと、その秒数だけ遅らせて鳴らす
  function play(effectId, delaySeconds) {
    if (!enabled || !EFFECTS[effectId] || document.hidden) return;
    if (delaySeconds) { root.setTimeout(function () { play(effectId); }, delaySeconds * 1000); return; }
    if (!getContext() || context.state !== 'running') return;
    try { EFFECTS[effectId](); } catch (error) { /* 鳴らせなくても、ゲームは進める */ }
  }

  // 攻撃の結果（ミス・命中・クリティカル、倒れたかどうか）に合った音を鳴らす
  function playImpact(result, killed) {
    play(result === 'miss' ? 'miss' : result === 'crit' ? 'crit' : 'hit');
    if (killed) play('fall', 0.3);
  }

  // ---- 全体 ----

  // 画面に触れたときに呼ぶ。ブラウザは、画面に触れるまで音を鳴らさせてくれない
  function unlock() {
    if (!enabled) return;
    if (getContext() && context.state === 'suspended') context.resume();
    primeMusic();
    syncMusic();
  }

  function setEnabled(value) {
    enabled = value;
    if (enabled) unlock(); else syncMusic();
  }

  function init(isEnabled) {
    enabled = isEnabled;
    createMusicElements();
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('click', function (event) {
      unlock();
      if (event.target.closest && event.target.closest('.button, .title-button, .stage-card, .stage-back, .command, .hire-card, .hire-cancel')) play('tap');
    }, true);
    // ほかのアプリやタブに切り替えたら曲を止め、戻ってきたら続きから流す
    document.addEventListener('visibilitychange', syncMusic);
  }

  SC.Sound = {
    init: init,
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    playMusic: playMusic,
    stopMusic: stopMusic,
    play: play,
    playImpact: playImpact
  };
})(typeof window !== 'undefined' ? window : globalThis);
