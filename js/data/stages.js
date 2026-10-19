// ステージのデータ。map の記号：「.」平地　「F」森　「C」城　「W」湖（通れない）　「T」町
(function (root) {
  var SC = (root.SC = root.SC || {});

  SC.TERRAIN_SYMBOLS = { '.': 'plain', F: 'forest', C: 'castle', W: 'lake', T: 'town', S: 'fort' };

  SC.STAGES = {
    1: {
      id: 1,
      title: 'ステージ1　はじまりの戦い',
      intro: '五つに分かれた王国セルトリア。小さな領邦に、隣の領邦の軍が攻め寄せた。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '歩兵を森に入れて敵を待ち、近づいてきた敵を全員で1人ずつ攻撃しよう。王は城から出さないのが安全です。',
      // 曲（js/data/assets.js の sound.music の名前）。null は無音
      music: 'map',             // マップの曲
      battleMusic: null,        // 戦闘シーンの曲。null はマップの曲のまま
      bossMusic: 'boss',        // 敵の王と戦う戦闘シーンの曲
      map: [
        '....C...',
        '........',
        '........',
        '........',
        '..F..FF.',
        '.FF.....',
        '........',
        '........',
        '........',
        '...C....'
      ],
      units: [
        { type: 'king', side: 'player', x: 3, y: 9 },
        { type: 'infantry', side: 'player', x: 2, y: 7 },
        { type: 'infantry', side: 'player', x: 4, y: 7 },
        { type: 'archer', side: 'player', x: 3, y: 8 },
        { type: 'infantry', side: 'player', x: 4, y: 8 },
        { type: 'king', side: 'enemy', x: 4, y: 0 },
        { type: 'archer', side: 'enemy', x: 3, y: 1 },
        { type: 'infantry', side: 'enemy', x: 1, y: 3 },
        { type: 'infantry', side: 'enemy', x: 6, y: 3 }
      ]
    },
    2: {
      id: 2,
      title: 'ステージ2　湖のほとりの戦い',
      intro: '隣の領邦の軍を退けた若き王のもとに、湖のほとりの修道院から僧侶たちが加わった。敗れた敵は兵を集め直し、湖の向こうから再び攻め寄せる。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '湖の間の道を歩兵でふさぎ、すぐ後ろに僧侶を置こう。僧侶は動かずに祈ると多く兵士を戻せます。僧侶は打たれ弱いので、敵の前に出さないこと。',
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '....C...',
        '........',
        '..F..F..',
        '.WW..WW.',
        '.WW..WW.',
        '...FF...',
        '........',
        '.F....F.',
        '........',
        '...C....'
      ],
      units: [
        { type: 'king', side: 'player', x: 3, y: 9 },
        { type: 'infantry', side: 'player', x: 2, y: 7 },
        { type: 'infantry', side: 'player', x: 4, y: 7 },
        { type: 'infantry', side: 'player', x: 5, y: 8 },
        { type: 'archer', side: 'player', x: 3, y: 8 },
        { type: 'cleric', side: 'player', x: 2, y: 8 },
        { type: 'king', side: 'enemy', x: 4, y: 0 },
        { type: 'infantry', side: 'enemy', x: 3, y: 2 },
        { type: 'infantry', side: 'enemy', x: 0, y: 2 },
        { type: 'infantry', side: 'enemy', x: 7, y: 2 },
        { type: 'archer', side: 'enemy', x: 4, y: 1 }
      ]
    },
    3: {
      id: 3,
      title: 'ステージ3　平原の戦い',
      intro: '湖を越えた王の軍は、敵の領邦との境に広がる平原に出た。敵もまた修道院の僧侶を味方につけ、平原の向こうで陣を固めている。',
      ruleNote: '新しい決まり：なわばり\n敵の部隊の上下左右の隣のマスに入ると、そこで移動が終わります。歩兵を横に並べると、敵は後ろの弓兵や僧侶に近づけません。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '歩兵を横一列に並べて、なわばりの壁を作ろう。敵は壁を素通りできません。壁の後ろから弓兵で撃ち、僧侶で歩兵を回復しよう。',
      rules: { zoneOfControl: true, zoneHints: true },   // zoneHints：なわばりの印（赤い点・点線）を出す。覚えるためのステージだけ
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '...C....',
        '........',
        '.F....F.',
        '........',
        '...F....',
        '....F...',
        '........',
        '.F....F.',
        '........',
        '....C...'
      ],
      units: [
        { type: 'king', side: 'player', x: 4, y: 9 },
        { type: 'infantry', side: 'player', x: 3, y: 7 },
        { type: 'infantry', side: 'player', x: 4, y: 7 },
        { type: 'infantry', side: 'player', x: 5, y: 7 },
        { type: 'archer', side: 'player', x: 3, y: 8 },
        { type: 'archer', side: 'player', x: 5, y: 8 },
        { type: 'cleric', side: 'player', x: 4, y: 8 },
        { type: 'king', side: 'enemy', x: 3, y: 0 },
        { type: 'infantry', side: 'enemy', x: 1, y: 2 },
        { type: 'infantry', side: 'enemy', x: 6, y: 2 },
        { type: 'infantry', side: 'enemy', x: 2, y: 1 },
        { type: 'infantry', side: 'enemy', x: 4, y: 1 },
        { type: 'archer', side: 'enemy', x: 3, y: 1 },
        { type: 'cleric', side: 'enemy', x: 5, y: 1 }
      ]
    },
    4: {
      id: 4,
      title: 'ステージ4　城門の戦い',
      intro: '平原を制した王の軍は、ついに敵の城を望む丘にたどり着いた。城門の前では、槍を構えた守備兵が待ち受けている。',
      newRule: 'brace',   // このステージで初めて出る決まり（ヒントを出すため）
      ruleNote: '新しい決まり：構え\n歩兵は、動かずに「構え」を選べます。構えている部隊を隣から攻めると、構えている側が先に攻撃してきます。弓兵の2マス先からの攻撃には効きません。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '城門の前で構えている守備兵に、歩兵で正面から攻めると先に攻撃されます。まず弓兵で2マス先から撃って減らし、それから歩兵で攻めよう。',
      rules: { zoneOfControl: true },
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        'F..C...F',
        '........',
        '.F....F.',
        '..W..W..',
        '..W..W..',
        '........',
        '.F....F.',
        '........',
        '........',
        '....C...'
      ],
      units: [
        { type: 'king', side: 'player', x: 4, y: 9 },
        { type: 'infantry', side: 'player', x: 3, y: 7 },
        { type: 'infantry', side: 'player', x: 4, y: 7 },
        { type: 'infantry', side: 'player', x: 5, y: 7 },
        { type: 'archer', side: 'player', x: 3, y: 8 },
        { type: 'archer', side: 'player', x: 5, y: 8 },
        { type: 'cleric', side: 'player', x: 4, y: 8 },
        { type: 'king', side: 'enemy', x: 3, y: 0 },
        { type: 'infantry', side: 'enemy', x: 2, y: 1, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 4, y: 1, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 1, y: 2 },
        { type: 'infantry', side: 'enemy', x: 6, y: 2 },
        { type: 'archer', side: 'enemy', x: 3, y: 1 },
        { type: 'cleric', side: 'enemy', x: 5, y: 1 }
      ]
    },
    5: {
      id: 5,
      title: 'ステージ5　町を治める戦い',
      intro: '城門を破られた敵は、領邦の奥へ退いた。王の軍は、敵の領地に点在する町を一つずつ味方につけながら、本城を目指す。町を治めれば、軍を養う資金が入る。',
      newRule: 'economy',
      ruleNote: '新しい決まり：町と軍資金\n歩兵が町の上で行動を終えると、その町を占領します。ターンの始めに、城と町の数に応じてお金（G）が入ります。王が城にいるとき、王のコマンド「雇う」で部隊を雇えます。自分の城や町の上にいる部隊は、ターンの始めに兵士が戻ります（1人5G）。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: 'まず左右の端の町を歩兵で取って、収入を増やそう。お金がたまったら、王を城に置いたまま「雇う」で部隊を増やせます。減った部隊は自分の町の上で休ませると、兵士が戻ります。',
      rules: { zoneOfControl: true, economy: true, maxUnits: 8 },   // maxUnits：1つの軍が持てる部隊の数（雇いすぎて動けなくなるのを防ぐ）
      gold: { player: 40, enemy: 40 },   // 初期G
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '...C....',
        '.T....T.',
        '...F....',
        '.....F..',
        'T......T',
        '..F.....',
        '....F...',
        '........',
        '.T....T.',
        '....C...'
      ],
      towns: [
        { x: 1, y: 1, owner: 'enemy' },
        { x: 6, y: 1, owner: 'enemy' },
        { x: 0, y: 4, owner: null },
        { x: 7, y: 4, owner: null },
        { x: 1, y: 8, owner: 'player' },
        { x: 6, y: 8, owner: 'player' }
      ],
      units: [
        { type: 'king', side: 'player', x: 4, y: 9 },
        { type: 'infantry', side: 'player', x: 3, y: 8 },
        { type: 'infantry', side: 'player', x: 5, y: 8 },
        { type: 'archer', side: 'player', x: 4, y: 8 },
        { type: 'cleric', side: 'player', x: 4, y: 7 },
        { type: 'king', side: 'enemy', x: 3, y: 0 },
        { type: 'infantry', side: 'enemy', x: 2, y: 1 },
        { type: 'infantry', side: 'enemy', x: 4, y: 1 },
        { type: 'archer', side: 'enemy', x: 3, y: 1 }
      ]
    },
    6: {
      id: 6,
      title: 'ステージ6　湖の国の戦い',
      intro: '王の軍は、湖の国へ入った。大きな湖が国を南北に分け、渡れるのは東と西の浅瀬だけ。湖の北には敵の本城と、敵が治める町々が並ぶ。町を味方につけながら、浅瀬を越えて本城を目指せ。',
      newRule: 'bigMap',
      ruleNote: '新しい決まり：広いマップ\nマップが画面より広くなりました。指でなぞると、マップが動きます。上の「全体」を押すと、マップ全体の様子が見られます。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: 'まず湖の南の町を取って、収入を増やそう。浅瀬の北では、敵の守備兵が構えて待っています。片方の浅瀬だけに集まらず、弓兵で守備兵を減らしてから渡ろう。',
      rules: { zoneOfControl: true, economy: true, maxUnits: 10 },
      gold: { player: 40, enemy: 20 },   // 初期G（敵は20G。自動対戦で調整）
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '...FC..F..',
        '.T......T.',
        '...F..F...',
        'F........F',
        '..T..F..T.',
        '..........',
        'WW..WW..WW',   // 浅瀬は2マス幅（1マスだと両軍が詰まって決着がつかなかった）
        '..........',
        '.F...T..F.',
        'T...F....T',
        '......F...',
        '..F.......',
        '....T..F..',
        '.....C....'
      ],
      towns: [
        { x: 1, y: 1, owner: 'enemy' },
        { x: 8, y: 1, owner: 'enemy' },
        { x: 2, y: 4, owner: null },
        { x: 8, y: 4, owner: null },
        { x: 5, y: 8, owner: null },
        { x: 0, y: 9, owner: null },
        { x: 9, y: 9, owner: null },
        { x: 4, y: 12, owner: 'player' }
      ],
      units: [
        { type: 'king', side: 'player', x: 5, y: 13 },
        { type: 'infantry', side: 'player', x: 4, y: 12 },
        { type: 'infantry', side: 'player', x: 6, y: 12 },
        { type: 'archer', side: 'player', x: 5, y: 12 },
        { type: 'cleric', side: 'player', x: 5, y: 11 },
        { type: 'king', side: 'enemy', x: 4, y: 0 },
        { type: 'infantry', side: 'enemy', x: 3, y: 5, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 7, y: 5, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 3, y: 1 },
        { type: 'infantry', side: 'enemy', x: 5, y: 1 },
        { type: 'archer', side: 'enemy', x: 4, y: 1 }
      ]
    },
    7: {
      id: 7,
      title: 'ステージ7　大平原の戦い',
      intro: '湖の国を抜けた王の軍の前に、果てしない大平原が広がっていた。この地の領主は、馬を駆る騎士たちで知られている。こちらも騎士を雇い、平原を制せ。',
      newRule: 'cavalry',
      ruleNote: '新しい決まり：騎士と攻撃の向き\n騎士は足が速く、斜めの相手にも攻撃できます。歩兵などは斜めから攻められると反撃できません。騎士は止まったマスで向きを選び、向いている側の斜めにだけ反撃できます（斜め後ろが弱点）。王のコマンド「雇う」で騎士も雇えます。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '敵の騎士に斜めを取られないよう、歩兵は横に並べて隙間を作らないようにしよう。こちらの騎士は、敵の弓兵や僧侶の斜めを狙うと、反撃を受けずに攻撃できます。',
      rules: { zoneOfControl: true, economy: true, maxUnits: 10, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry'] },
      gold: { player: 60, enemy: 10 },   // 初期G（自動対戦で調整。騎士を強くしたあと、敵の騎士1・弓兵2、自軍60G・敵10Gで釣り合った）
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '.....C......',
        '.T..F..F..T.',
        '............',
        '.FF......FF.',
        '.....T......',
        'T..........T',
        '...F....F...',
        '...F....F...',
        'T..........T',
        '......T.....',
        '.FF......FF.',
        '............',
        '.T..F..F..T.',
        '......C.....'
      ],
      towns: [
        { x: 1, y: 1, owner: 'enemy' },
        { x: 10, y: 1, owner: 'enemy' },
        { x: 5, y: 4, owner: null },
        { x: 0, y: 5, owner: null },
        { x: 11, y: 5, owner: null },
        { x: 0, y: 8, owner: null },
        { x: 11, y: 8, owner: null },
        { x: 6, y: 9, owner: null },
        { x: 1, y: 12, owner: 'player' },
        { x: 10, y: 12, owner: 'player' }
      ],
      units: [
        { type: 'king', side: 'player', x: 6, y: 13 },
        { type: 'infantry', side: 'player', x: 5, y: 12 },
        { type: 'infantry', side: 'player', x: 7, y: 12 },
        { type: 'archer', side: 'player', x: 6, y: 12 },
        { type: 'cleric', side: 'player', x: 6, y: 11 },
        { type: 'cavalry', side: 'player', x: 8, y: 12 },
        { type: 'king', side: 'enemy', x: 5, y: 0 },
        { type: 'infantry', side: 'enemy', x: 4, y: 1 },
        { type: 'infantry', side: 'enemy', x: 6, y: 1 },
        { type: 'archer', side: 'enemy', x: 5, y: 1 },
        { type: 'cavalry', side: 'enemy', x: 3, y: 1 },
        { type: 'archer', side: 'enemy', x: 7, y: 1 }
      ]
    },
    8: {
      id: 8,
      title: 'ステージ8　騎士団との戦い',
      intro: '大平原の先に、名高い騎士団が待ち構えていた。馬上の槍で幾多の軍を打ち破ってきた精鋭である。だが、どれほどの騎士も、並んだ長槍の前では足が止まる。槍で騎士を止め、王の道を切り開け。',
      newRule: 'affinity',
      ruleNote: '新しい決まり：相性と身のこなし\n部隊には得意な相手と苦手な相手があります。得意な相手を攻めると、兵士1人の打撃が2増えます。歩兵（槍）は騎士に、騎士は弓兵・僧侶に強い。また、素早い弓兵には攻撃が外れやすく（5％）、大柄な騎士には当たりやすく（1％）なります。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '騎士には歩兵をぶつけよう。歩兵が先に攻めるか、構えて待てば、騎士に勝てます。弓兵と僧侶は騎士に狙われやすいので、歩兵の後ろに隠そう。',
      rules: { zoneOfControl: true, economy: true, affinity: true, maxUnits: 10, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry'] },
      gold: { player: 60, enemy: 10 },   // 初期G
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '..F..C...F..',
        '.T........T.',
        '....F..F....',
        'F..........F',
        '...T....T...',
        '............',
        '.FF..WW..FF.',
        '.FF..WW..FF.',
        '............',
        '...T....T...',
        'F..........F',
        '....F..F....',
        '.T........T.',
        '......C.....'
      ],
      towns: [
        { x: 1, y: 1, owner: 'enemy' },
        { x: 10, y: 1, owner: 'enemy' },
        { x: 3, y: 4, owner: null },
        { x: 8, y: 4, owner: null },
        { x: 3, y: 9, owner: null },
        { x: 8, y: 9, owner: null },
        { x: 1, y: 12, owner: 'player' },
        { x: 10, y: 12, owner: 'player' }
      ],
      units: [
        { type: 'king', side: 'player', x: 6, y: 13 },
        { type: 'infantry', side: 'player', x: 5, y: 12 },
        { type: 'infantry', side: 'player', x: 7, y: 12 },
        { type: 'infantry', side: 'player', x: 6, y: 11 },
        { type: 'archer', side: 'player', x: 6, y: 12 },
        { type: 'cleric', side: 'player', x: 5, y: 11 },
        { type: 'king', side: 'enemy', x: 5, y: 0 },
        { type: 'cavalry', side: 'enemy', x: 3, y: 1 },
        { type: 'cavalry', side: 'enemy', x: 5, y: 1 },
        { type: 'cavalry', side: 'enemy', x: 7, y: 1 },
        { type: 'infantry', side: 'enemy', x: 4, y: 1 },
        { type: 'archer', side: 'enemy', x: 6, y: 1 }
      ]
    },
    9: {
      id: 9,
      title: 'ステージ9　国境の城を守れ',
      intro: '騎士団を破った王の軍に、ついに敵国の本軍が動いた。数で勝る敵は、北と東西から国境の城へ押し寄せてくる。空を舞う魔物ハーピーの群れも、敵に加わったという。援軍が着くまで、あと12日。王よ、城を守り抜け。',
      newRule: 'defense',
      ruleNote: '新しい決まり：守りの戦いと増援\n12ターン目の敵の番が終わるまで自軍の王が生き残れば勝ちです（敵の王を倒しても勝ち）。敵は決まったターンに、マップの端から増援として現れます。次の増援は「勝利条件」で確かめられます。空を飛ぶハーピーは湖も越えてきます。弓兵に弱く、歩兵に強い魔物です。',
      goalText: '勝利：12ターン目の敵の番が終わるまで守りきる（または敵の王を倒す）\n敗北：自軍の王が倒される',
      defeatHint: '城のまわりを歩兵で固め、弓兵はハーピーに備えて後ろに置こう。町の収入で早めに部隊を雇い、増援が来る方向に先回りしよう。',
      rules: { zoneOfControl: true, economy: true, affinity: true, surviveTurns: 12, incomeSides: ['player'], maxUnits: 10, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry'] },
      gold: { player: 40, enemy: 0 },   // 初期G（敵は雇わない。増援で増える）
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '.....C......',
        '..F......F..',
        '............',
        '.T...FF...T.',
        '............',
        'F..WW..WW..F',
        '...WW..WW...',
        '............',
        '.T..F..F..T.',
        '............',
        '..F..TT..F..',
        '....F..F....',
        '............',
        '.....C......'
      ],
      towns: [
        { x: 1, y: 3, owner: null },
        { x: 10, y: 3, owner: null },
        { x: 1, y: 8, owner: 'player' },
        { x: 10, y: 8, owner: 'player' },
        { x: 5, y: 10, owner: 'player' },
        { x: 6, y: 10, owner: 'player' }
      ],
      units: [
        { type: 'king', side: 'player', x: 5, y: 13 },
        { type: 'infantry', side: 'player', x: 4, y: 12 },
        { type: 'infantry', side: 'player', x: 6, y: 12 },
        { type: 'archer', side: 'player', x: 5, y: 12 },
        { type: 'cleric', side: 'player', x: 5, y: 11 },
        { type: 'cavalry', side: 'player', x: 7, y: 12 },
        { type: 'king', side: 'enemy', x: 5, y: 0 },
        { type: 'infantry', side: 'enemy', x: 4, y: 1 },
        { type: 'infantry', side: 'enemy', x: 6, y: 1 },
        { type: 'archer', side: 'enemy', x: 5, y: 1 },
        { type: 'cavalry', side: 'enemy', x: 7, y: 1 },
        { type: 'infantry', side: 'enemy', x: 4, y: 0, role: 'guard' },   // 王の守り（攻めに出る味方がいるあいだは動かない）
        { type: 'infantry', side: 'enemy', x: 6, y: 0, role: 'guard' }
      ],
      // 敵の増援：turn ターン目の敵の番の始めに、units のマス（ふさがっていれば近くの空いたマス）に現れる。from は画面に出す方角
      reinforcements: [
        { turn: 3, from: '北', units: [{ type: 'infantry', x: 3, y: 0 }, { type: 'infantry', x: 8, y: 0 }, { type: 'archer', x: 6, y: 0 }, { type: 'infantry', x: 2, y: 0 }] },
        { turn: 5, from: '西', units: [{ type: 'harpy', x: 0, y: 6 }, { type: 'harpy', x: 0, y: 7 }, { type: 'harpy', x: 0, y: 8 }, { type: 'infantry', x: 0, y: 4 }] },
        { turn: 7, from: '東', units: [{ type: 'infantry', x: 11, y: 6 }, { type: 'infantry', x: 11, y: 7 }, { type: 'cavalry', x: 11, y: 8 }, { type: 'infantry', x: 11, y: 4 }] },
        { turn: 9, from: '北', units: [{ type: 'infantry', x: 3, y: 0 }, { type: 'infantry', x: 8, y: 0 }, { type: 'archer', x: 6, y: 0 }, { type: 'harpy', x: 4, y: 0 }, { type: 'infantry', x: 2, y: 0 }] },
        { turn: 11, from: '西と東', units: [{ type: 'cavalry', x: 0, y: 7 }, { type: 'harpy', x: 11, y: 7 }, { type: 'infantry', x: 0, y: 6 }, { type: 'infantry', x: 0, y: 5 }] }
      ]
    },
    10: {
      id: 10,
      title: 'ステージ10　堀の城を攻めよ',
      intro: '国境を守り抜いた王のもとに、ついに援軍が着いた。いよいよ反撃のときである。敵国の本城は深い堀に囲まれ、行く手には二つの砦が立ちはだかる。砦を奪って足場を築き、本城を落とせ。空の魔物たちも、王の旗のもとに集い始めた。',
      newRule: 'siege',
      ruleNote: '新しい決まり：砦と攻城戦\n砦は、歩兵か王が行動を終えると占領できます。毎ターン20Gが入り、王が自軍の砦にいれば、そこで部隊を雇えます。中にいる部隊は受ける打撃が2減ります。敵の本城は堀に囲まれ、歩いて入れるのは正面の橋だけ。空を飛ぶハーピーとグリフォンは堀を越えられます。今回から、どちらも雇えます。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: 'まず左右の砦を取ろう。王が砦に入れば、前線で部隊を雇えます。橋は守りが固いので、ハーピーやグリフォンで堀を越えて、城の横から攻めよう。敵の弓兵には空の部隊が狙われやすいので注意。',
      // incomeScale：敵の収入は4分の1（籠城している敵。全部入ると、失った部隊をすぐ雇い直して、城が落ちなかった）
      rules: { zoneOfControl: true, economy: true, affinity: true, maxUnits: 10, incomeScale: { enemy: 0.25 }, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry', 'harpy', 'griffin'] },
      gold: { player: 60, enemy: 20 },   // 初期G
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '............',
        '..WWWWWWWW..',
        '..W..C...W..',
        '..W......W..',
        '..WWW..WWW..',
        '.T........T.',
        '...F....F...',
        '..S......S..',
        '.....FF.....',
        'F..........F',
        '.T........T.',
        '...F....F...',
        '............',
        '..F..TT..F..',
        '............',
        '.....C......'
      ],
      towns: [
        { x: 1, y: 5, owner: 'enemy' },
        { x: 10, y: 5, owner: 'enemy' },
        { x: 2, y: 7, owner: 'enemy' },    // 砦
        { x: 9, y: 7, owner: 'enemy' },    // 砦
        { x: 1, y: 10, owner: null },
        { x: 10, y: 10, owner: null },
        { x: 5, y: 13, owner: 'player' },
        { x: 6, y: 13, owner: 'player' }
      ],
      units: [
        { type: 'king', side: 'player', x: 5, y: 15 },
        { type: 'infantry', side: 'player', x: 4, y: 14 },
        { type: 'infantry', side: 'player', x: 6, y: 14 },
        { type: 'archer', side: 'player', x: 5, y: 14 },
        { type: 'cleric', side: 'player', x: 4, y: 15 },
        { type: 'cavalry', side: 'player', x: 6, y: 15 },
        { type: 'king', side: 'enemy', x: 5, y: 2 },
        { type: 'infantry', side: 'enemy', x: 2, y: 7, role: 'guard' },   // 砦の守り
        { type: 'infantry', side: 'enemy', x: 9, y: 7, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 5, y: 4, role: 'guard' },   // 橋の守り
        { type: 'infantry', side: 'enemy', x: 6, y: 4, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 4, y: 3 },
        { type: 'archer', side: 'enemy', x: 6, y: 3 },
        { type: 'cavalry', side: 'enemy', x: 7, y: 3 },
        { type: 'griffin', side: 'enemy', x: 5, y: 3 },
        { type: 'archer', side: 'enemy', x: 3, y: 2 }   // 堀の中の弓兵（空から来る部隊に備える）
      ]
    },
    11: {
      id: 11,
      title: 'ステージ11　隊長たちの初陣',
      intro: '堀の城を落とした王のもとに、名のある若き隊長たちが集った。槍のアルド、弓のフィーナ、祈りのセラ。王は三人に部隊を任せ、敵国の奥の森へ進む。戦いを重ねた部隊は、やがてより強い兵へと育っていく。',
      newRule: 'regulars',
      ruleNote: '新しい決まり：正規部隊と経験値\n名前の付いた部隊は「正規部隊」です。敵の兵士を倒すと経験値がたまり、満タンになると、その場で上のクラスにランクアップします（歩兵→ナイト、僧侶→プリースト）。経験値は次のステージへ引き継がれます。全滅しても次のステージには戻りますが、経験値が半分になります。お金で雇う部隊は「傭兵」で、育ちません。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '正規部隊を前に出しすぎず、傭兵と組ませて戦おう。弱った敵にとどめを刺すと、経験値が多く入ります（全滅させると＋3）。',
      rules: { zoneOfControl: true, economy: true, affinity: true, experience: true, maxUnits: 10, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry', 'harpy', 'griffin'] },
      gold: { player: 100, enemy: 20 },   // 初期G（自動対戦で調整。60Gだと勝率約4割）
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '.....C......',
        '..F......F..',
        '.T..FF..F.T.',
        '...F....FF..',
        'F.....F.....',
        '..FF.....F..',
        '.T....F...T.',
        '....F....F..',
        '..F...FF....',
        'F.....F...F.',
        '.T..F.....T.',
        '...F...FF...',
        '..F.....F...',
        '......C.....'
      ],
      towns: [
        { x: 1, y: 2, owner: 'enemy' },
        { x: 10, y: 2, owner: 'enemy' },
        { x: 1, y: 6, owner: null },
        { x: 10, y: 6, owner: null },
        { x: 1, y: 10, owner: 'player' },
        { x: 10, y: 10, owner: 'player' }
      ],
      // 正規部隊を置くマス（出撃を選んだ順に置く。4つまで）
      regularSlots: [{ x: 5, y: 12 }, { x: 6, y: 11 }, { x: 7, y: 12 }, { x: 5, y: 13 }],
      units: [
        { type: 'king', side: 'player', x: 6, y: 13 },
        { type: 'cavalry', side: 'player', x: 7, y: 13 },   // 傭兵
        { type: 'king', side: 'enemy', x: 5, y: 0 },
        { type: 'infantry', side: 'enemy', x: 4, y: 1, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 6, y: 1, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 3, y: 3 },
        { type: 'infantry', side: 'enemy', x: 7, y: 3 },
        { type: 'archer', side: 'enemy', x: 5, y: 2 },
        { type: 'archer', side: 'enemy', x: 6, y: 4 },
        { type: 'harpy', side: 'enemy', x: 2, y: 4 },
        { type: 'harpy', side: 'enemy', x: 9, y: 4 }
      ]
    },
    12: {
      id: 12,
      title: 'ステージ12　静寂の谷',
      intro: '王の軍は、霧に包まれた「静寂の谷」に入った。この谷では、敵の魔術師たちが死者の兵を呼び起こすという。谷の入り口で、旅の魔法使いノエルが王の前に進み出た。「わたしの魔法も、お役に立てるはずです」',
      newRule: 'summon',
      ruleNote: '新しい決まり：魔法使いと召喚\n魔法使いの魔法は、隣にも2マス先にも届きます。動く前なら、コマンド「召喚」で、隣のマスにスケルトンの部隊を呼べます（1人ずつ半分の確率で、最大3人）。呼んだスケルトンは、すぐ動けます。スケルトンは補充や祈りでは戻らず、僧侶などの回復系に弱い不死の兵です。正規部隊にノエル隊（魔法使い）が加わりました。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '敵の魔法使いは、毎ターンのようにスケルトンを呼んできます。魔法使いは打たれ弱いので、騎士やハーピーで早めに狙おう。スケルトンには、セラ隊（僧侶）の攻撃がよく効きます。',
      rules: { zoneOfControl: true, economy: true, affinity: true, experience: true, maxUnits: 10, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry', 'harpy', 'griffin', 'mage'] },
      gold: { player: 60, enemy: 20 },   // 初期G（自動対戦で調整。100Gだと勝率100％）
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '...F.C.F....',
        '.T.F...F..T.',
        '...F...F....',
        'WW.........W',
        '...FF..FF...',
        '.T........T.',
        'FF.W....W.FF',
        '...W.FF.W...',
        '............',
        'WW..F..F..WW',
        '.T........T.',
        '...F....F...',
        '..F......F..',
        '......C.....'
      ],
      towns: [
        { x: 1, y: 1, owner: 'enemy' },
        { x: 10, y: 1, owner: 'enemy' },
        { x: 1, y: 5, owner: null },
        { x: 10, y: 5, owner: null },
        { x: 1, y: 10, owner: 'player' },
        { x: 10, y: 10, owner: 'player' }
      ],
      regularSlots: [{ x: 5, y: 12 }, { x: 6, y: 12 }, { x: 7, y: 12 }, { x: 5, y: 13 }],
      units: [
        { type: 'king', side: 'player', x: 6, y: 13 },
        { type: 'cavalry', side: 'player', x: 7, y: 13 },   // 傭兵
        { type: 'king', side: 'enemy', x: 5, y: 0 },
        { type: 'infantry', side: 'enemy', x: 4, y: 0, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 6, y: 0, role: 'guard' },
        { type: 'mage', side: 'enemy', x: 4, y: 2 },
        { type: 'mage', side: 'enemy', x: 8, y: 2 },
        { type: 'archer', side: 'enemy', x: 6, y: 1 },
        { type: 'infantry', side: 'enemy', x: 5, y: 3 },
        { type: 'skeleton', side: 'enemy', x: 3, y: 4 },
        { type: 'skeleton', side: 'enemy', x: 6, y: 4 },
        { type: 'skeleton', side: 'enemy', x: 9, y: 4 }
      ]
    },
    13: {
      id: 13,
      title: 'ステージ13　竜の峰',
      intro: '静寂の谷を抜けた王の軍の前に、険しい「竜の峰」がそびえていた。空を舞うワイバーンの群れが、敵の旗のもとで翼を広げている。地上から空を射抜けるのは、弓の名手だけだ。峰のふもとで、歴戦の騎士ガイルが王に剣を捧げた。',
      newRule: 'skyArmy',
      ruleNote: '新しい決まり：空の軍団と、出撃する部隊を選ぶ\n敵は空を飛ぶワイバーン・グリフォン・ハーピーが中心です。空の部隊は谷も越えてきますが、弓に弱い（相性+2）。弓兵のフィーナ隊は、経験値が満タンになるとエルフにランクアップし、飛行にさらに強くなります。正規部隊にガイル隊（騎士）が加わりました。出撃できるのは4部隊までです。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: '弓兵と魔法使いを前に出しすぎず、空の敵が近づいたところを撃とう。ワイバーンは足が速いので、弓兵の前に歩兵やナイトを置いて守ろう。弓の傭兵を雇うのも手です。',
      rules: { zoneOfControl: true, economy: true, affinity: true, experience: true, maxUnits: 10, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry', 'harpy', 'griffin', 'mage'] },
      gold: { player: 60, enemy: 20 },   // 初期G（2026-10-19 ユーザー決定：60G。召喚でスケルトンを呼べば補える）
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '..F...C..F..',
        '.T.F.....F.T',
        'WW..F..F..WW',
        '.W.......W..',
        '...FF..FF...',
        'F..W....W..F',
        '.T.WW..WW.T.',
        '...F....F...',
        'WW...FF...WW',
        '.F..W..W..F.',
        '.T........T.',
        '..FF....FF..',
        '............',
        '.....C......'
      ],
      towns: [
        { x: 1, y: 1, owner: 'enemy' },
        { x: 11, y: 1, owner: 'enemy' },
        { x: 1, y: 6, owner: null },
        { x: 10, y: 6, owner: null },
        { x: 1, y: 10, owner: 'player' },
        { x: 10, y: 10, owner: 'player' }
      ],
      regularSlots: [{ x: 4, y: 12 }, { x: 5, y: 12 }, { x: 6, y: 12 }, { x: 4, y: 13 }],
      units: [
        { type: 'king', side: 'player', x: 5, y: 13 },
        { type: 'archer', side: 'player', x: 6, y: 13 },   // 傭兵
        { type: 'king', side: 'enemy', x: 6, y: 0 },
        { type: 'infantry', side: 'enemy', x: 5, y: 0, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 7, y: 0, role: 'guard' },
        { type: 'archer', side: 'enemy', x: 6, y: 1 },
        { type: 'wyvern', side: 'enemy', x: 3, y: 2 },
        { type: 'wyvern', side: 'enemy', x: 8, y: 2 },
        { type: 'harpy', side: 'enemy', x: 2, y: 3 },
        { type: 'harpy', side: 'enemy', x: 10, y: 3 }
      ]
    },
    // ステージ14（2026-10-19 合意）：ゴーレムの壁。敵のウィザードが、水路を渡る細い道をゴーレムで塞ぐ。
    // 崩し方は、魔法（ゴーレムは魔法に弱い）・空から越える（ワイバーンを雇える）・騎士でウィザードを突く
    14: {
      id: 14,
      title: 'ステージ14　魔導の都',
      intro: '竜の峰を越えた王の軍は、水路の巡る古い魔導の都の跡にたどり着いた。水路を渡る細い道を、岩でできた巨人が塞いでいる。「あれは、ゴーレム……魔導士たちが岩に命を吹き込んだものです」ノエルが杖を握りしめた。',
      newRule: 'golem',
      ruleNote: '新しい決まり：ゴーレムとウィザード\n敵のウィザードは、硬い岩の巨人「ゴーレム」を呼んで道を塞ぎます。ゴーレムは魔法に弱く（相性+2）、足が遅い。空を飛ぶ部隊なら水路を越えられます。このステージから、ワイバーン（120G）を雇えます。魔法使いのノエル隊は、経験値が満タンになるとウィザードにランクアップし、ゴーレムを呼べるようになります。',
      goalText: '勝利：敵の王を倒す\n敗北：自軍の王が倒される',
      defeatHint: 'ゴーレムを正面から殴ると時間がかかります。魔法使いで崩すか、ワイバーンやハーピーで水路を越えて、奥のウィザードを先に倒そう。騎士は魔法使いに強いです。',
      rules: { zoneOfControl: true, economy: true, affinity: true, experience: true, maxUnits: 10, incomeScale: { enemy: 0.5 }, hireTypes: ['infantry', 'archer', 'cleric', 'cavalry', 'harpy', 'griffin', 'wyvern', 'mage'] },
      gold: { player: 60, enemy: 80 },
      music: 'map',
      battleMusic: null,
      bossMusic: 'boss',
      map: [
        '..F..C....F.',
        '.T..F..F..T.',
        '............',
        'F..F....F..F',
        '...T....T...',
        'W..WW.WWW..W',
        'W..WW.WWW..W',
        '............',
        '.F..F..F..F.',
        '.T........T.',
        '...F....F...',
        'F..........F',
        '............',
        '.....C......'
      ],
      towns: [
        { x: 1, y: 1, owner: 'enemy' },
        { x: 10, y: 1, owner: 'enemy' },
        { x: 3, y: 4, owner: null },
        { x: 8, y: 4, owner: null },
        { x: 1, y: 9, owner: 'player' },
        { x: 10, y: 9, owner: 'player' }
      ],
      regularSlots: [{ x: 4, y: 12 }, { x: 5, y: 12 }, { x: 6, y: 12 }, { x: 4, y: 13 }],
      units: [
        { type: 'king', side: 'player', x: 5, y: 13 },
        { type: 'mage', side: 'player', x: 6, y: 13 },   // 傭兵（ノエル隊を休ませても、ゴーレムを崩せるように）
        { type: 'king', side: 'enemy', x: 5, y: 0 },
        { type: 'infantry', side: 'enemy', x: 4, y: 0, role: 'guard' },
        { type: 'infantry', side: 'enemy', x: 6, y: 0, role: 'guard' },
        { type: 'priest', side: 'enemy', x: 5, y: 1, role: 'guard' },
        { type: 'archer', side: 'enemy', x: 6, y: 2 },
        { type: 'wizard', side: 'enemy', x: 3, y: 2 },
        { type: 'wizard', side: 'enemy', x: 8, y: 2 },
        { type: 'golem', side: 'enemy', x: 5, y: 5 },   // 真ん中の道を塞ぐ
        { type: 'golem', side: 'enemy', x: 10, y: 5 }   // 右の道を塞ぐ
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
