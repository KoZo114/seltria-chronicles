// 全体をつなぐ：起動、タイトル画面、画面サイズへの対応、誤操作の防止。
(function (root) {
  var SC = root.SC;
  var save = SC.Save.load();
  var imagesReady = null;

  function byId(id) { return document.getElementById(id); }

  // 五つの領邦を表す、五色の紋章
  function createCrestSvg() {
    // 紺の盾に金の王冠。下に並ぶ五つの宝石は、五つの領邦を表す
    var jewels = [['#4f8df0', 36, 82], ['#e0564e', 47, 89], ['#4fb06c', 60, 92], ['#a078e0', 73, 89], ['#eaa93c', 84, 82]];
    var shield = 'M60 5 L108 19 V60 C108 93 87 115 60 127 C33 115 12 93 12 60 V19 Z';
    var innerShield = 'M60 14 L100 25.5 V60 C100 88 82 107 60 117.5 C38 107 20 88 20 60 V25.5 Z';
    return '<svg viewBox="0 0 120 132" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="crest-gold" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#f2c94c"/><stop offset="1" stop-color="#a8761a"/>' +
        '</linearGradient>' +
        '<linearGradient id="crest-field" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#2c3f78"/><stop offset="1" stop-color="#0d142c"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="' + shield + '" fill="url(#crest-field)" stroke="url(#crest-gold)" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="' + innerShield + '" fill="none" stroke="#f2c94c" stroke-opacity=".45" stroke-width="1"/>' +
      '<path d="M38 60 L33 36 L47 48 L60 28 L73 48 L87 36 L82 60 Z" fill="url(#crest-gold)" stroke="#6b4a0c" stroke-width="1" stroke-linejoin="round"/>' +
      '<rect x="37" y="63" width="46" height="6" rx="2" fill="url(#crest-gold)" stroke="#6b4a0c" stroke-width="1"/>' +
      '<circle cx="33" cy="35" r="3" fill="#fff1b8"/><circle cx="60" cy="27" r="3.4" fill="#fff1b8"/><circle cx="87" cy="35" r="3" fill="#fff1b8"/>' +
      jewels.map(function (jewel) {
        var x = jewel[1], y = jewel[2];
        return '<path d="M' + x + ' ' + (y - 6) + ' L' + (x + 4.5) + ' ' + y + ' L' + x + ' ' + (y + 6) + ' L' + (x - 4.5) + ' ' + y + ' Z" fill="' + jewel[0] + '" stroke="#fff1b8" stroke-width=".8"/>';
      }).join('') +
      '</svg>';
  }

  // タイトルの背景：1枚絵を敷き、その上で動画を音なしで繰り返し再生する。
  // 動画が読み込めない・再生できないときは、1枚絵だけが見える。
  var titleVideo = null;

  function setUpTitleBackground() {
    var title = (SC.ASSETS && SC.ASSETS.title) || {};
    var background = byId('title-background');
    if (title.poster) background.style.backgroundImage = 'url("' + title.poster + '")';
    var reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!title.video || reduceMotion) return;
    var video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.preload = 'auto';
    if (title.poster) video.poster = title.poster;
    video.onerror = function () { video.remove(); titleVideo = null; };
    video.src = title.video;
    background.appendChild(video);
    titleVideo = video;
  }

  function playTitleVideo() {
    if (!titleVideo) return;
    var attempt = titleVideo.play();
    if (attempt && attempt.catch) attempt.catch(function () {});   // 自動再生が止められても、1枚絵が見えているので問題ない
  }

  // タイトルの曲：iPhoneなどでは、画面に一度触れるまで音を鳴らせない決まりがあるので、
  // 最初は「画面をタップ」を出し、タップされたら曲を流してボタンを出す。
  function isTitleWaiting() { return byId('title-screen').classList.contains('waiting'); }

  function renderSoundButton() {
    var button = byId('sound-button');
    button.textContent = save.settings.sound ? '♪ 音 オン' : '♪ 音 オフ';
    button.classList.toggle('off', !save.settings.sound);
    button.setAttribute('aria-pressed', String(save.settings.sound));
  }

  function toggleSound() {
    save.settings.sound = !save.settings.sound;
    SC.Save.store(save);
    renderSoundButton();
    SC.Sound.setEnabled(save.settings.sound);
  }

  // 最初のタップで「画面をタップ」を消し、ボタンを出して曲を流す
  function onTitleTap() {
    if (!isTitleWaiting()) return;
    byId('title-screen').classList.remove('waiting');
    playTitleVideo();
    SC.Sound.playMusic('title', true);
  }

  function showTitle() {
    var stageIds = getStageIds();
    var cleared = stageIds.filter(function (stageId) { return save.stages[stageId] && save.stages[stageId].cleared; }).length;
    byId('title-record').textContent = 'クリアしたステージ：' + cleared + ' ／ ' + stageIds.length + (TEST_MODE ? '　【テスト用：全ステージを遊べます】' : '');
    // 遊びかけの戦いがあれば「続きから」を出す（そのときは「はじめる」を控えめな見た目にする）
    var battle = save.battle && SC.STAGES[save.battle.stageId] ? save.battle : null;
    var resumeButton = byId('resume-button');
    resumeButton.classList.toggle('hidden', !battle);
    if (battle) resumeButton.innerHTML = '続きから<small>ステージ' + battle.stageId + '・ターン' + battle.turn + '</small>';
    byId('start-button').classList.toggle('primary', !battle);
    SC.Screens.showScreen('title-screen');
    renderSoundButton();   // ゲーム中のメニューで音を切り替えたかもしれないので、表示を合わせ直す
    playTitleVideo();
    if (!isTitleWaiting()) SC.Sound.playMusic('title', true);
    // 正規部隊の育ち方を新しくしたので、前の記録で育てていた人に知らせる（1回だけ）
    if (save.rosterWasReset) {
      delete save.rosterWasReset;
      SC.Save.store(save);
      SC.Screens.showModal({
        title: '正規部隊の育ち方が新しくなりました',
        text: '正規部隊は3段階で育つようになりました。\nアルドは歩兵 → 騎士 → ドラゴンナイト、ガイルはナイトで加わりジェネラルへ、など。\nそのため、正規部隊の記録だけを最初からにしました（クリアしたステージの記録はそのままです）。',
        buttons: [{ label: 'わかった', style: 'primary' }]
      });
    }
  }

  function getStageIds() {
    return Object.keys(SC.STAGES).map(Number).sort(function (a, b) { return a - b; });
  }

  // ステージの番号を入れた小さな盾の絵
  function createStageBadgeSvg(number) {
    return '<svg viewBox="0 0 40 46" aria-hidden="true">' +
      '<path d="M20 2 L37 7 V21 C37 33 29 40 20 44 C11 40 3 33 3 21 V7 Z" fill="url(#crest-field)" stroke="url(#crest-gold)" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<text x="20" y="29" text-anchor="middle" font-size="19" font-weight="800" fill="#fff1b8" font-family="Hiragino Mincho ProN, Yu Mincho, serif">' + number + '</text></svg>';
  }

  // テスト用：アドレスの最後に ?test=1 を付けて開くと、クリアしていなくても全部のステージを選べる（開発中の確認用。記録は変えない）
  // 使えるのは、このMacや家のネットワークの中で開いたときだけ（localhost・○○.local・192.168.…など）。公開したWebの版では使えない（2026-10-18 ユーザー決定）
  var TEST_MODE = isLocalAddress(root.location ? root.location.hostname : '') && /[?&]test=1(&|$)/.test(root.location ? root.location.search : '');

  function isLocalAddress(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || /\.local$/.test(hostname) ||
      /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(hostname);
  }

  var STAGES_PER_CHAPTER = 5;   // 1つの章のステージ数
  var CHAPTER_COLORS = 4;       // 章の色の種類（紺・紅・緑・紫。5章目からはくり返す）
  var LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor"/>' +
    '<path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

  var KANJI_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  // 章の番号を漢数字にする（1〜99）
  function toKanjiNumber(number) {
    var tens = Math.floor(number / 10), ones = number % 10;
    return (tens > 1 ? KANJI_DIGITS[tens] : '') + (tens > 0 ? '十' : '') + KANJI_DIGITS[ones];
  }

  function createStageCard(stageId, chapterColor) {
    var stage = SC.STAGES[stageId];
    var record = save.stages[stageId];
    var unlocked = TEST_MODE || SC.Save.isStageUnlocked(save, stageId);
    var cleared = !!(record && record.cleared);
    var name = stage.title.split('　').slice(1).join('　') || stage.title;
    var status;
    if (!unlocked) status = '<span class="stage-status locked">' + LOCK_SVG + SC.Save.getUnlockHint(stageId) + '</span>';
    else if (cleared) status = '<span class="stage-status cleared">制覇' + (record.bestTurns ? '<i>最短 ' + record.bestTurns + ' ターン</i>' : '') + '</span>';
    else status = '<span class="stage-status new">未踏の戦場</span>';
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'stage-card chapter-' + chapterColor + (!unlocked ? ' locked' : cleared ? ' cleared' : ' next');
    card.disabled = !unlocked;
    card.innerHTML = '<span class="stage-badge">' + createStageBadgeSvg(stageId) + '</span>' +
      '<span class="stage-text"><span class="stage-number">STAGE ' + stageId + '</span>' +
      '<span class="stage-name">' + name + '</span>' + status + '</span>' +
      (unlocked ? '<span class="stage-go">出陣</span>' : '');
    card.onclick = function (event) {
      event.stopPropagation();
      hideStageSelect();
      startStage(stageId);
    };
    return card;
  }

  // ステージを選ぶ画面。5ステージで1つの章（1ページ）にして、章ごとに札の色を変える（紺・紅・緑・紫の順）。
  // 章は指で左右になぞるか、下の矢印で切り替える。開いたときは、まだクリアしていないいちばん新しいステージの章を見せる。
  // まだ遊べないステージは押せない。まだクリアしていない、いちばん新しいステージを目立たせる
  function showStageSelect() {
    var list = byId('stage-list');
    var dots = byId('stage-dots');
    list.innerHTML = '';
    dots.innerHTML = '';
    var stageIds = getStageIds();
    var chapterCount = Math.ceil(stageIds.length / STAGES_PER_CHAPTER);
    var nextChapter = null;       // まだクリアしていない、いちばん新しいステージの章
    var unlockedChapter = 0;      // 遊べるステージがある、いちばん後ろの章（全部クリアしたとき用）
    for (var chapter = 0; chapter < chapterCount; chapter++) {
      var ids = stageIds.slice(chapter * STAGES_PER_CHAPTER, (chapter + 1) * STAGES_PER_CHAPTER);
      var chapterColor = chapter % CHAPTER_COLORS + 1;
      var page = document.createElement('div');
      page.className = 'stage-page chapter-' + chapterColor;
      page.innerHTML = '<div class="chapter-title"><b>第' + toKanjiNumber(chapter + 1) + '章</b>' +
        '<span>STAGE ' + ids[0] + (ids.length > 1 ? '〜' + ids[ids.length - 1] : '') + '</span></div>';
      ids.forEach(function (stageId) {
        var card = createStageCard(stageId, chapterColor);
        if (card.classList.contains('next') && nextChapter === null) nextChapter = chapter;
        if (!card.disabled) unlockedChapter = chapter;
        page.appendChild(card);
      });
      // まだ作っていないステージのある章には、そのことを書いておく（空いた場所が寂しく見えないように）
      if (ids.length < STAGES_PER_CHAPTER) page.insertAdjacentHTML('beforeend', '<p class="chapter-more">この章の続きの戦場は、準備中です</p>');
      list.appendChild(page);
      var dot = document.createElement('i');
      dot.className = 'chapter-' + chapterColor;
      dots.appendChild(dot);
    }
    byId('stage-pager').classList.toggle('hidden', chapterCount < 2);
    byId('stage-select').classList.remove('hidden');
    list.scrollLeft = (nextChapter === null ? unlockedChapter : nextChapter) * list.clientWidth;
    updateStagePager();
  }

  function getStageChapter() {
    var list = byId('stage-list');
    return list.clientWidth ? Math.round(list.scrollLeft / list.clientWidth) : 0;
  }

  // 章の点と矢印を、いま見えている章に合わせる
  function updateStagePager() {
    var current = getStageChapter();
    var dots = byId('stage-dots').children;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('current', i === current);
    byId('stage-prev').disabled = current <= 0;
    byId('stage-next').disabled = current >= dots.length - 1;
  }

  function moveStageChapter(step) {
    var list = byId('stage-list');
    var target = Math.max(0, Math.min(byId('stage-dots').children.length - 1, getStageChapter() + step));
    list.scrollTo({ left: target * list.clientWidth, behavior: 'smooth' });
  }

  function hideStageSelect() { byId('stage-select').classList.add('hidden'); }

  // 遊びかけの戦いの続きから始める。保存が壊れていて戻せなければ、ステージを選ぶ画面を出す
  function resumeBattle() {
    var timeout = new Promise(function (resolve) { root.setTimeout(resolve, 3000); });
    Promise.race([imagesReady, timeout]).then(function () {
      if (titleVideo) titleVideo.pause();
      SC.Sound.stopMusic();
      SC.Screens.showScreen('game-screen');
      if (!SC.Controller.resume({ save: save, onExit: showTitle })) {
        SC.Screens.showScreen('title-screen');
        save.battle = null;
        SC.Save.store(save);
        showTitle();
        showStageSelect();
      }
    });
  }

  // ステージを始める。正規部隊のあるステージ（11から）は、先に「出陣の準備」で出撃する部隊を選ぶ
  function startStage(stageId) {
    if (SC.STAGES[stageId].regularSlots) showPrepare(stageId);
    else launchStage(stageId, null);
  }

  // 画像の読み込みを待ってから始める。3秒たっても終わらなければ、読み込めた分だけで始める。
  // regulars：出撃する正規部隊の記録（無ければ null）。クリアしたステージの遊び直しでは、経験値は入らない
  function launchStage(stageId, regulars) {
    // 正規部隊のいるステージ：始める前の隊長たちを覚えておく（あとで「このステージからやり直す」で戻れるように）
    if (regulars && SC.STAGES[stageId].regularSlots) { SC.Save.rememberRosterBefore(save, stageId); SC.Save.store(save); }
    var timeout = new Promise(function (resolve) { root.setTimeout(resolve, 3000); });
    Promise.race([imagesReady, timeout]).then(function () {
      if (titleVideo) titleVideo.pause();
      SC.Sound.stopMusic();   // タイトルの曲は、ゲームが始まったら必ず止める
      SC.Screens.showScreen('game-screen');
      SC.Controller.start(stageId, {
        save: save, onExit: showTitle, onBack: function () { showTitle(); showStageSelect(); },
        onNext: startStage,   // 勝ったあとの「次のステージへ」（出陣の準備をはさむため）
        regulars: regulars ? regulars.map(function (member) { return { id: member.id, name: member.name, type: member.type, exp: member.exp }; }) : null,
        noExperience: !SC.Save.canEarnExperience(save, stageId)
      });
    });
  }

  // ---- 出陣の準備（正規部隊を選ぶ） ----

  function showPrepare(stageId) {
    var stage = SC.STAGES[stageId];
    save.roster = SC.Regulars.ensureRoster(save.roster, stageId);
    SC.Save.store(save);
    var available = SC.Regulars.getAvailable(save.roster, stageId);
    var limit = Math.min(SC.MAX_DEPLOY, stage.regularSlots.length);
    // 必ず出撃する隊長（そのステージで加わり、会話で話す隊長。2026-10-21 ユーザーの希望）。ほかの部隊は選べる
    var required = (stage.requiredRegulars || []).filter(function (id) { return available.some(function (m) { return m.id === id; }); });
    var chosen = required.concat(available.map(function (member) { return member.id; }).filter(function (id) { return required.indexOf(id) < 0; })).slice(0, limit);
    var replay = !SC.Save.canEarnExperience(save, stageId);
    byId('prep-lead').innerHTML = stage.title + '<br><small>出撃する正規部隊を選ぶ（' + limit + '部隊まで）' +
      (replay ? '　<em>このステージの経験値は、もうもらいました（遊び直しでは入りません）</em>' : '') + '</small>';

    function render() {
      var list = byId('prep-list');
      list.innerHTML = '';
      available.forEach(function (member) {
        var type = SC.UNIT_TYPES[member.type];
        var threshold = SC.Regulars.getThreshold(member.id, member.type);
        var on = chosen.indexOf(member.id) >= 0;
        var must = required.indexOf(member.id) >= 0;
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'prep-card' + (on ? ' on' : '') + (must ? ' required' : '');
        var art = SC.Render.getPortraitPath(member.id) || SC.Render.getUnitImagePath(member.type, 'player');   // 隊長の顔（無ければクラスの絵）
        var gauge = threshold ? Math.min(100, Math.round(member.exp / threshold * 100)) : 100;
        card.innerHTML = '<span class="prep-check">' + (must ? '必須' : on ? '出撃' : '待機') + '</span>' +
          '<span class="prep-art">' + (art ? '<img src="' + art + '" alt="">' : '') + '</span>' +
          '<span class="prep-text"><span class="prep-name">' + member.name + '隊<small>' + type.name + '</small></span>' +
          '<span class="prep-exp"><i style="width:' + gauge + '%"></i></span>' +
          '<span class="prep-exp-label">' + (threshold ? '経験 ' + member.exp + '／' + threshold + (SC.Regulars.canRankUp(member.id, member.type, member.exp) ? '　ランクアップできる' : member.exp >= threshold ? '　（次のクラスはまだ）' : '') : 'いちばん上のクラス（経験値は入らない）') + '</span></span>';
        card.onclick = function (event) {
          event.stopPropagation();
          if (must) return;   // 必ず出撃する隊長は、外せない
          var index = chosen.indexOf(member.id);
          if (index >= 0) chosen.splice(index, 1);
          else if (chosen.length < limit) chosen.push(member.id);
          else return;
          render();
        };
        list.appendChild(card);
      });
      byId('prep-go').disabled = chosen.length === 0;
    }
    render();
    byId('prep-go').onclick = function () {
      hidePrepare();
      hideStageSelect();
      var members = chosen.map(function (id) { return available.filter(function (m) { return m.id === id; })[0]; });
      launchStage(stageId, members);
    };
    byId('prep-back').onclick = function () {
      hidePrepare();
      if (byId('game-screen').classList.contains('hidden')) showStageSelect();
      else { SC.Sound.stopMusic(); showTitle(); showStageSelect(); }   // 勝ったあとの「次のステージへ」から来たとき
    };
    // このステージからやり直す（クリアして経験値をもらったステージ。2026-10-25）
    var rewind = byId('prep-rewind');
    rewind.classList.toggle('hidden', !SC.Save.canRewindTo(save, stageId, SC.STAGES));
    rewind.onclick = function (event) {
      event.stopPropagation();
      SC.Screens.showModal({
        title: 'このステージからやり直す',
        text: '隊長たちを、ステージ' + stageId + 'を始める前の姿と経験値に戻します。\nステージ' + stageId + 'と、それより後のステージで、経験値をもう一度もらえるようになります。\nクリアの記録と、遊べるステージは、そのまま残ります。\n\nやり直しますか？',
        stacked: true,
        buttons: [
          { label: 'やり直す', style: 'danger', onTap: function () {
            SC.Save.rewindTo(save, stageId, SC.STAGES);
            SC.Save.store(save);
            showPrepare(stageId);
            SC.Screens.showToast('ステージ' + stageId + 'を始める前の隊長たちに戻しました');
          } },
          { label: 'やめる', style: 'primary' }
        ]
      });
    };
    byId('prep-select').classList.remove('hidden');
  }

  // 記録を全部消して、はじめから（2回たずねる）
  function confirmResetAll() {
    SC.Screens.showModal({
      title: '記録を消して、はじめから',
      text: 'クリアしたステージ、隊長たちの経験値、見た会話など、すべての記録を消します。\n（音と戦闘シーンの設定は残ります）\n\n本当に消しますか？',
      stacked: true,
      buttons: [
        { label: '消す', style: 'danger', onTap: function () {
          SC.Screens.showModal({
            title: '最後の確認',
            text: '消した記録は、もとに戻せません。よろしいですか？',
            stacked: true,
            buttons: [
              { label: 'すべて消して、はじめから', style: 'danger', onTap: function () {
                save = SC.Save.resetAll(save);
                SC.Save.store(save);
                hideStageSelect();
                showTitle();
                SC.Screens.showToast('記録を消しました');
              } },
              { label: 'やめる', style: 'primary' }
            ]
          });
        } },
        { label: 'やめる', style: 'primary' }
      ]
    });
  }

  // ---- 思い出（会話とエンディングを、もう一度見る。2026-10-25） ----
  var MEMORY_TALK_STAGES = [11, 12, 13, 15, 20];

  function allRegularIds() { return SC.REGULARS.map(function (r) { return r.id; }); }   // 思い出では、ガイル隊がいるときだけの会話も出す

  function replayMemory(play) {
    if (titleVideo) titleVideo.pause();
    SC.Sound.stopMusic();
    play().then(function () {
      playTitleVideo();
      SC.Sound.playMusic('title', true);
      showMemories();
    });
  }

  function showMemories() {
    var buttons = MEMORY_TALK_STAGES.filter(function (id) { return SC.TALKS && SC.TALKS[id] && SC.STAGES[id]; }).map(function (id) {
      var seen = !!save.seenTips['talk_' + id];
      return {
        label: seen ? SC.STAGES[id].title : 'ステージ' + id + '　？？？',
        disabled: !seen,
        onTap: function () { replayMemory(function () { return SC.TalkScene.play(SC.TALKS[id], allRegularIds()); }); }
      };
    });
    var lastId = getStageIds().slice(-1)[0];
    var endingSeen = !!(save.stages[lastId] && save.stages[lastId].cleared) && !!SC.STAGES[lastId].endingStory;
    buttons.push({
      label: endingSeen ? 'エンディング' : 'エンディング　？？？',
      disabled: !endingSeen,
      onTap: function () {
        replayMemory(function () {
          return SC.TalkScene.play((SC.ENDING_TALKS || {})[lastId] || [], allRegularIds()).then(function () {
            return SC.EndingScene.play({ story: SC.STAGES[lastId].endingStory });
          });
        });
      }
    });
    buttons.push({ label: 'とじる', style: 'primary' });
    SC.Screens.showModal({ title: '思い出', text: '見た会話を、声つきでもう一度見られます。', kind: 'memories', stacked: true, buttons: buttons });
  }

  function hidePrepare() { byId('prep-select').classList.add('hidden'); }

  function preventBrowserGestures() {
    // ピンチでの拡大、ダブルタップでの拡大、長押しメニューを止める
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
      document.addEventListener(name, function (event) { event.preventDefault(); }, { passive: false });
    });
    document.addEventListener('dblclick', function (event) { event.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    // 画面全体が引っ張られて動くのを止める（窓の中の文章、情報欄、画面より大きいマップだけは指で動かせる）
    document.addEventListener('touchmove', function (event) {
      if (!event.target.closest('#modal-body, #info-panel, #stage-list, #prep-list, #hire-list, #board-wrap.scrollable')) event.preventDefault();
    }, { passive: false });
  }

  function init() {
    SC.Render.init({
      wrap: byId('board-wrap'),
      area: byId('board-area'),
      tiles: byId('tiles'),
      units: byId('units'),
      effects: byId('effects'),
      banner: byId('banner')
    });
    SC.Controller.bindButtons();
    imagesReady = SC.Render.preloadImages();
    byId('title-crest').innerHTML = createCrestSvg();
    setUpTitleBackground();
    SC.Sound.init(save.settings.sound);
    renderSoundButton();
    byId('sound-button').onclick = toggleSound;
    byId('title-screen').addEventListener('click', onTitleTap);
    byId('start-button').onclick = showStageSelect;
    byId('resume-button').onclick = resumeBattle;
    byId('stage-back-button').onclick = function (event) { event.stopPropagation(); hideStageSelect(); };
    byId('stage-list').addEventListener('scroll', updateStagePager, { passive: true });
    byId('stage-prev').onclick = function (event) { event.stopPropagation(); moveStageChapter(-1); };
    byId('stage-next').onclick = function (event) { event.stopPropagation(); moveStageChapter(1); };
    byId('stage-select').onclick = function (event) {
      if (event.target === byId('stage-select')) hideStageSelect();   // 画面の外側をタップしても閉じる
    };
    byId('title-help-button').onclick = function () { SC.Screens.showHelp(); };
    byId('memories-button').onclick = showMemories;
    byId('stage-reset-button').onclick = function (event) { event.stopPropagation(); confirmResetAll(); };
    root.addEventListener('resize', SC.Render.layout);
    root.addEventListener('orientationchange', function () { root.setTimeout(SC.Render.layout, 250); });
    preventBrowserGestures();
    showTitle();
  }

  init();
})(window);
