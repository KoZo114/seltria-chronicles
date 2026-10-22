// タイトル画面、確認の窓、お知らせ（ヒント）、遊び方の表示。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var toastTimer = null;

  function byId(id) { return document.getElementById(id); }

  function showScreen(screenId) {
    ['title-screen', 'game-screen'].forEach(function (id) {
      byId(id).classList.toggle('hidden', id !== screenId);
    });
  }

  // options: { title, text, html, kind, stacked, buttons: [{ label, style, onTap, disabled }] }
  function showModal(options) {
    var modal = byId('modal');
    modal.className = options.kind || '';
    byId('modal-effects').innerHTML = '';
    byId('modal-title').textContent = options.title || '';
    var body = byId('modal-body');
    if (options.html) body.innerHTML = options.html;
    else body.textContent = options.text || '';
    body.scrollTop = 0;
    var buttons = byId('modal-buttons');
    buttons.innerHTML = '';
    buttons.className = options.stacked ? 'stacked' : '';
    options.buttons.forEach(function (definition) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'button ' + (definition.style || '');
      button.textContent = definition.label;
      button.disabled = !!definition.disabled;
      button.onclick = function () {
        hideModal();
        if (definition.onTap) definition.onTap();
      };
      buttons.appendChild(button);
    });
    if (options.kind === 'victory') addConfetti();
  }

  function hideModal() { byId('modal').className = 'hidden'; }

  function isModalOpen() { return !byId('modal').classList.contains('hidden'); }

  function addConfetti() {
    var colors = ['#f2c94c', '#ffffff', '#6c9cf0', '#f29c4c', '#8fe0a0'];
    var layer = byId('modal-effects');
    for (var i = 0; i < 36; i++) {
      var piece = document.createElement('div');
      piece.className = 'confetti';
      piece.style.left = Math.round(Math.random() * 100) + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = (1.8 + Math.random() * 1.8).toFixed(2) + 's';
      piece.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's';
      layer.appendChild(piece);
    }
  }

  // stay：自動では消さない（案内のように、操作が終わるまで出しておくとき）
  function showToast(text, stay) {
    var toast = byId('toast');
    toast.textContent = text;
    toast.classList.remove('hidden');
    root.clearTimeout(toastTimer);
    if (!stay) toastTimer = root.setTimeout(hideToast, 6000);
  }

  function hideToast() {
    root.clearTimeout(toastTimer);
    byId('toast').classList.add('hidden');
  }

  function showHelp(onClose) {
    var missPercent = SC.COMBAT.missPercent;
    showModal({
      title: '遊び方',
      html:
        '<h3>勝ち負け</h3><p>敵の王の部隊を全滅させれば勝ち。自軍の王の部隊が全滅したら負けです。</p>' +
        '<h3>動かし方</h3><p>① 自軍ユニットをタップ\n② 青いマスをタップして移動（同じユニットをもう一度タップすると、その場にとどまる）\n③ 下にコマンドが出るので「攻撃」「祈る」「待機」から選ぶ\n④ 攻撃なら赤い枠の敵、祈りなら緑の枠の味方をタップすると見込みが出る →「攻撃する」「祈る」で決定\n⑤ 全員動かしたら「ターン終了」</p>' +
        '<p>行動を決める前なら「やり直す」で元に戻せます。</p>' +
        '<h3>見分け方</h3><p>自軍は青い丸、敵軍は赤い四角です。敵や地形をタップすると、能力や効果を確認できます。</p>' +
        '<h3>部隊</h3><p>1つのユニットは、複数の兵士からなる部隊です。ユニットの数字は残りの人数です。\n人数が減ると、攻撃する人数も減ります。人数が0になると全滅です。</p>' +
        '<h3>戦闘</h3><p>生き残っている兵士の全員が、1回ずつ攻撃します。\n攻撃された側は、全滅しておらず、相手が射程内にいれば、残った兵士で反撃します。\n先に攻撃した側が有利です。\nまれに兵士が攻撃を外します（1人あたり' + missPercent + '％）。</p>' +
        '<h3>戦闘シーン</h3><p>攻撃すると戦闘シーンに切り替わります。タップで飛ばせます。メニュー（≡）でオフにもできます。</p>' +
        '<h3>なわばり（ステージ3から）</h3><p>敵の部隊の上下左右の隣のマスは、その敵の「なわばり」です。入ると、そこで移動が終わります。\nステージ3では、移動できるマスのうち、なわばりのマスに赤い点が付きます（ステージ4からは印なし）。歩兵を横に並べると、敵は後ろの味方に近づけません。</p>' +
        '<h3>構え（ステージ4から）</h3><p>歩兵は、移動せずにコマンドの「構え」を選べます。構えると、次の自分のターンまで、隣から攻めてきた敵より先に攻撃します。何度攻められても、そのたびに先に攻撃します。\n弓兵の2マス先からの攻撃には効きません。構えている部隊には金の盾の印が付きます。</p>' +
        '<h3>町と軍資金（ステージ5から）</h3><p>歩兵が町の上で行動を終えると、その町を占領します。\n自分のターンの始めに、城1つにつき' + SC.ECONOMY.castleIncome + 'G、町1つにつき' + SC.ECONOMY.townIncome + 'Gが入ります。\n王が自軍の城にいるとき、王を選んでその場にとどまると「雇う」が出ます。雇った部隊は城から出てきて、その部隊の移動力のぶんだけ動けます（動いたあと、攻撃もできます）。\n自分の城や町の上にいる6人隊は、ターンの始めに兵士が2人まで戻ります（1人' + SC.ECONOMY.resupplyCostPerSoldier + 'G）。</p>' +
        '<h3>途中保存</h3><p>行動するたびに自動で保存されます。タイトルの「続きから」で、遊びかけの戦いに戻れます。</p>' +
        '<h3>地形</h3><p>森：移動しにくいが、兵士1人の打撃のダメージが2減る。\n城：王がいると、受けるダメージが30％減る。\n湖：通れない。</p>' +
        '<h3>ユニット</h3><p>歩兵（6人）：打たれ強い。前に立って壁になる。\n弓兵（6人）：2マス先だけを撃てる。隣の敵は撃てない。打たれ弱い。\n僧侶（6人）：祈りで味方を回復する。攻撃はとても弱く、打たれ弱い。\nキング（3人）：倒されたら負け。人数は少ないが1人が強い。</p>' +
        '<h3>祈り（僧侶）</h3><p>僧侶を動かしたあと、コマンドの「祈る」を選び、緑の枠の味方をタップして「祈る」。\n隣の味方の6人隊（歩兵・弓兵・僧侶）の、倒れた兵士を戻します。キングは戻せません。\n戻せる人数は、動かずに祈ると「僧侶の人数 ÷ 2」、移動してから祈ると「÷ 3」（切り上げ）。</p>',
      buttons: [{ label: 'とじる', style: 'primary', onTap: onClose }]
    });
  }

  SC.Screens = {
    showScreen: showScreen,
    showModal: showModal,
    hideModal: hideModal,
    isModalOpen: isModalOpen,
    showToast: showToast,
    hideToast: hideToast,
    showHelp: showHelp
  };
})(typeof window !== 'undefined' ? window : globalThis);
