// 正規部隊（ステージ11から）：隊長の名前が付いた部隊。経験値がたまり、ランクアップ・転職ができ、次のステージへ引き継ぐ。
// お金で雇う部隊は傭兵（育たない・そのステージ限り）。くわしくは docs/ステージ11設計案.md
(function (root) {
  var SC = (root.SC = root.SC || {});

  // 隊長の6人（2026-10-18 決定。男女3人ずつ）。joinStage：そのステージから出撃できる
  SC.REGULARS = [
    // rankUpLine：ランクアップしたときのひと言
    { id: 'aldo', name: 'アルド', gender: 'male', type: 'infantry', joinStage: 11, rankUpLine: 'この力で、みんなを守り抜く！' },
    { id: 'fina', name: 'フィーナ', gender: 'female', type: 'archer', joinStage: 11, rankUpLine: '風の声が、前よりよく聞こえる…！' },
    { id: 'sera', name: 'セラ', gender: 'female', type: 'cleric', joinStage: 11, rankUpLine: '祈りが、もっと遠くまで届きそうです。' },
    { id: 'noel', name: 'ノエル', gender: 'female', type: 'mage', joinStage: 12, rankUpLine: 'ふふっ、新しい魔法、試してみたい！' },
    { id: 'gail', name: 'ガイル', gender: 'male', type: 'cavalry', joinStage: 13, rankUpLine: '老いた馬にも、まだ走る力があるらしい。' },
    { id: 'bran', name: 'ブラン', gender: 'male', type: 'infantry', joinStage: 15, rankUpLine: 'へへっ、オレ、強くなったぜ！' }
  ];

  SC.MAX_DEPLOY = 4;   // 1つのステージに出撃できる正規部隊の数

  // ランクアップ：クラス → 次のクラスと、満タンまでの経験値。次のクラスがまだゲームに無ければ、満タンのまま待つ
  SC.RANKS = {
    infantry: { next: 'knight', exp: 20 },
    cleric: { next: 'priest', exp: 20 },
    archer: { next: 'elf', exp: 20 },       // エルフはステージ13で入れる
    priest: { next: 'highPriest', exp: 30 },
    mage: { next: 'wizard', exp: 20 },
    wizard: { next: 'saga', exp: 30 }
  };

  // 経験値のもらい方：敵の兵士を1人倒すと perSoldier（3人隊の兵士と王は perHeavySoldier）、部隊を全滅させると wipeBonus を足す
  // 回復役は、祈りで兵士を1人戻すと perPrayedSoldier（敵をほとんど倒さない回復役も育つように。2026-10-18 追加）
  // 魔法使いは、召喚に1回成功すると perSummon
  SC.EXPERIENCE = { perSoldier: 1, perHeavySoldier: 2, wipeBonus: 3, perPrayedSoldier: 1, perSummon: 1 };
})(typeof window !== 'undefined' ? window : globalThis);
