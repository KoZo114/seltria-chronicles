// キャラの会話（2026-10-21 合意）：ステージをはじめて遊ぶとき、戦いの前に隊長たちが話す。
// speaker：話す隊長（js/data/regulars.js の id。顔の絵と名前に使う）。voice：声のファイル（無ければ文字だけ）
// くわしくは docs/キャラの会話の案.md
(function (root) {
  var SC = (root.SC = root.SC || {});
  var VOICE = 'assets64/voice/';

  // 正規部隊でない話し手（名前と、顔の絵が無いときに使うマップ用の絵）
  SC.TALK_SPEAKERS = {
    valgas: { name: '覇王ヴァルガス', portrait: 'assets64/portraits/portrait_valgas.png', art: 'assets64/units/unit_kingBoss_enemy.png' }   // 顔の絵が無ければマップ用の絵
  };

  // ifDeployed：その隊長が出撃しているときだけ話す
  SC.TALKS = {
    11: [
      { speaker: 'aldo', text: '王様から部隊を任されるなんて……。でも、迷ってる暇はない。この槍で、仲間を一人も死なせない！', voice: VOICE + 'talk_11_1_aldo.mp3' },
      { speaker: 'fina', text: '森の奥ね。風の流れで、敵がどこにいるか分かるの。わたしの矢から、逃げられると思わないで！', voice: VOICE + 'talk_11_2_fina.mp3' },
      { speaker: 'sera', text: 'みなさんが傷ついても、わたしが必ず立て直します。だから、前だけを見て進んでください。', voice: VOICE + 'talk_11_3_sera.mp3' }
    ],
    12: [
      { speaker: 'noel', text: '死者を呼ぶ魔法なんて、ちょっとこわいけど……。わたしの魔法で、みんなの道を照らしてみせます！', voice: VOICE + 'talk_12_1_noel.mp3' }
    ],
    13: [
      { speaker: 'gail', text: '老いぼれと笑われようと、この盾はまだ折れておらん。若い者たちの前に立つのは、わしの役目だ。', voice: VOICE + 'talk_13_1_gail.mp3' }
    ],
    15: [
      { speaker: 'bran', text: 'へへっ、遅くなってすみません！ でも、ここからはオレの出番っす。平原なら、誰より速く駆けてみせますよ！', voice: VOICE + 'talk_15_1_bran.mp3' }
    ],
    // ステージ20：覇王ヴァルガスは、ガイルの双子の兄（2026-10-21 裏設定）。ガイル隊が出撃しているときだけ、ガイルが話す
    20: [
      { speaker: 'aldo', text: 'ここまで来たんだ。みんなで、必ず帰ろう！', voice: VOICE + 'talk_20_1_aldo.mp3' },
      { speaker: 'valgas', text: 'よくぞここまで来た、若き王よ。だが、剣だけで国は守れぬ。それを、この身で教えてやろう。', voice: VOICE + 'talk_20_2_valgas.mp3' },
      { speaker: 'gail', ifDeployed: 'gail', text: '兄上……。やはり、あなたでしたか。ならば、この盾で止めるのは、弟のわしの役目だ。', voice: VOICE + 'talk_20_3_gail.mp3' },
      { speaker: 'valgas', ifDeployed: 'gail', text: '……ガイルか。その盾、まだ折れておらぬようだな。来い。', voice: VOICE + 'talk_20_4_valgas.mp3' }
    ]
  };
  // 勝ったあとの会話（2026-10-22 合意）。勝つたびに出す（スキップできる）。声は 2026-10-22 に組み込み
  SC.ENDING_TALKS = {
    20: [
      { speaker: 'valgas', text: '……見事だ、若き王よ。剣ではなく、仲間の力で勝ったか。', voice: VOICE + 'talk_20_end_1_valgas.mp3' },
      { speaker: 'gail', ifDeployed: 'gail', text: '兄上……。', voice: VOICE + 'talk_20_end_2_gail.mp3' },
      { speaker: 'valgas', ifDeployed: 'gail', text: 'ガイル……お前は、良い主を見つけたな。', voice: VOICE + 'talk_20_end_3_valgas.mp3' },
      { speaker: 'aldo', text: '終わったんだ……。みんな、帰ろう！', voice: VOICE + 'talk_20_end_4_aldo.mp3' }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
