// 正規部隊（ステージ11から）：隊長の名前が付いた部隊。経験値がたまり、ランクアップ・転職ができ、次のステージへ引き継ぐ。
// お金で雇う部隊は傭兵（育たない・そのステージ限り）。くわしくは docs/ステージ11設計案.md
(function (root) {
  var SC = (root.SC = root.SC || {});

  // 隊長の6人（2026-10-18 決定。男女3人ずつ）。joinStage：そのステージから出撃できる。
  // path：育つ道（クラスの順）。pathExp：その段から次の段へ上がるのに要る経験値（path より1つ短い）。
  // 2026-10-19 ユーザー決定：正規部隊は3段階で育つ。アルドは歩兵→騎士→ドラゴンナイト、ガイルはナイトで加わりジェネラルへ、ブランは騎士で加わる
  // rankUpLine：ランクアップしたときのひと言
  SC.REGULARS = [
    { id: 'aldo', name: 'アルド', gender: 'male', joinStage: 11, path: ['infantry', 'cavalry', 'dragonKnight'], pathExp: [20, 40], rankUpLine: 'この力で、みんなを守り抜く！' },
    { id: 'fina', name: 'フィーナ', gender: 'female', joinStage: 11, path: ['archer', 'elf', 'highElf'], pathExp: [20, 30], rankUpLine: '風の声が、前よりよく聞こえる…！' },
    { id: 'sera', name: 'セラ', gender: 'female', joinStage: 11, path: ['cleric', 'priest', 'highPriest'], pathExp: [20, 30], rankUpLine: '祈りが、もっと遠くまで届きそうです。' },
    { id: 'noel', name: 'ノエル', gender: 'female', joinStage: 12, path: ['mage', 'wizard', 'saga'], pathExp: [20, 30], rankUpLine: 'ふふっ、新しい魔法、試してみたい！' },
    { id: 'gail', name: 'ガイル', gender: 'male', joinStage: 13, path: ['knight', 'general'], pathExp: [30], rankUpLine: '老いた盾にも、まだ守れるものがある。' },
    { id: 'bran', name: 'ブラン', gender: 'male', joinStage: 15, path: ['cavalry', 'dragonKnight'], pathExp: [40], rankUpLine: 'へへっ、オレ、強くなったぜ！' }
  ];

  // 記録の形の版。育ち方を大きく変えたときに上げる（古い版の記録は、正規部隊だけ作り直す）
  SC.ROSTER_VERSION = 2;

  SC.MAX_DEPLOY = 4;   // 1つのステージに出撃できる正規部隊の数

  // 経験値のもらい方：敵の兵士を1人倒すと perSoldier（3人隊の兵士と王は perHeavySoldier）、部隊を全滅させると wipeBonus を足す
  // 回復役は、祈りで兵士を1人戻すと perPrayedSoldier（敵をほとんど倒さない回復役も育つように。2026-10-18 追加）
  // 魔法使いは、召喚に1回成功すると perSummon
  SC.EXPERIENCE = { perSoldier: 1, perHeavySoldier: 2, wipeBonus: 3, perPrayedSoldier: 1, perSummon: 1 };
})(typeof window !== 'undefined' ? window : globalThis);
