// ユニット（部隊）の能力値と、戦闘の運に関する数値。調整はこのファイルだけで行う。
// 1ユニットは複数の兵士からなる部隊。size は最大人数、soldierHp は兵士1人あたりの体力、
// attack と defense は兵士1人あたりの攻撃力と防御力。
(function (root) {
  var SC = (root.SC = root.SC || {});

  SC.UNIT_TYPES = {
    king: {
      name: 'キング', size: 3, soldierHp: 12, attack: 5, defense: 0, move: 2,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: true, family: 'king',
      escortType: 'guard',   // 戦闘シーンでは、1人目がキング本人、残りは近衛兵の絵で見せる（見た目だけ。能力は全員同じ）
      description: '倒されたら負け。人数は少ないが1人が強い。城にいると硬い。'
    },
    infantry: {
      name: '歩兵', size: 6, soldierHp: 6, attack: 3, defense: 0, move: 3,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'spear',
      canBrace: true,   // 構えられる（槍を持つ歩兵系だけ）
      capturesTowns: true,   // 町を占領できる
      cost: 60,              // 雇う値段（G）
      description: '打たれ強い。前に立って壁になる。'
    },
    archer: {
      name: '弓兵', size: 6, soldierHp: 4, attack: 2, defense: 0, move: 3,
      rangeMin: 2, rangeMax: 2, moveType: 'ground', isKing: false, family: 'bow',
      cost: 60,
      description: '2マス先だけを撃てる。隣の敵は撃てない。打たれ弱い。'
    },
    cleric: {
      name: '僧侶', size: 6, soldierHp: 4, attack: 1, defense: 0, move: 3,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'healer',
      // 祈り：隣の味方の部隊のうち、最大人数が targetSizes のどれかの部隊の、倒れた兵士を戻す（僧侶は6人隊だけ。王は祈りで戻らない）。
      // 戻す人数 ＝ 僧侶の残り人数 ÷ stillDivisor（動かずに祈る）または ÷ movedDivisor（移動してから祈る）。端数は切り上げ
      prayer: { stillDivisor: 2, movedDivisor: 3, targetSizes: [6] },
      cost: 70,
      description: '隣の味方（6人隊）に祈り、倒れた兵士を戻せる。動かずに祈ると多く戻せる。打たれ弱い。'
    },
    // ナイト（ステージ11から。歩兵のランクアップ。正規部隊だけがなれる）：足は遅いが、守りが最強の壁役
    knight: {
      name: 'ナイト', size: 6, soldierHp: 7, attack: 3, defense: 2, move: 2,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'spear',
      canBrace: true, capturesTowns: true,
      description: '歩兵のランクアップ。足は遅いが、守りが最強の壁役。構えられ、町と砦を占領できる。'
    },
    // プリースト（ステージ11から。僧侶のランクアップ。正規部隊だけがなれる）：祈りで戻せる人数が増える
    priest: {
      name: 'プリースト', size: 6, soldierHp: 5, attack: 1, defense: 0, move: 3,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'healer',
      // 6人隊に戻す人数は僧侶と同じ。3人隊（騎士・グリフォンなど。王は除く）にも祈れて、1人戻す（2026-10-19 ユーザーの希望）
      // heavyAmount：3人隊に祈ったときに戻す人数（動いても同じ）
      prayer: { stillDivisor: 2, movedDivisor: 3, targetSizes: [6, 3], heavyAmount: 1 },
      description: '僧侶のランクアップ。6人隊に加えて、3人隊（騎士・グリフォンなど）にも祈って1人戻せる。'
    },
    // 騎士（ステージ7から）：馬に乗った重装隊。足が速く、斜め前からも攻撃できる。森は苦手
    cavalry: {
      name: '騎士', size: 3, soldierHp: 12, attack: 6, defense: 1, move: 5,   // 歩兵の約1.5倍の強さ（2026-10-16 ユーザーの希望。最初は体力10・攻撃5で、歩兵とほぼ同じだった）
      rangeMin: 1, rangeMax: 1, moveType: 'mounted', isKing: false, family: 'cavalry',
      diagonalFront: true,   // 上下左右に加えて、向いている側の斜め2マスにも届く（攻めるときは相手のほうを向く）
      cost: 100,
      description: '足が速く、斜めからも攻撃できる。斜め後ろからの攻撃には反撃できない。森は苦手。'
    },
    // ハーピー（ステージ9の敵の増援から。あとで自軍も雇えるようにする）：空を飛ぶ小隊。湖も越え、地形の守りは受けない。
    // 歩兵（槍）が得意、弓兵に弱い（相性の輪 槍→騎兵→弓→飛行→槍 の「飛行」）
    harpy: {
      name: 'ハーピー', size: 6, soldierHp: 5, attack: 2, defense: 0, move: 5,
      rangeMin: 1, rangeMax: 1, moveType: 'flying', isKing: false, family: 'flying',
      cost: 60,
      description: '空を飛び、湖も越える。歩兵に強く、弓兵に弱い。打たれ弱い。'
    },
    // 魔法使い（ステージ12から）：隣と2マス先に魔法が届く。動く前なら、隣にスケルトンを召喚できる
    // summon：呼べるもの、最大人数、1人ずつの成功率（％）。6人分を1人ずつ試して、成功した数（最大 maxSoldiers）
    mage: {
      name: '魔法使い', size: 6, soldierHp: 4, attack: 3, defense: 0, move: 3,
      rangeMin: 1, rangeMax: 2, moveType: 'ground', isKing: false, family: 'magic',
      summon: { types: ['skeleton'], maxSoldiers: 3, chancePercent: 50 },
      cost: 80,
      description: '隣にも2マス先にも魔法が届く。動く前なら、隣にスケルトンを召喚できる。打たれ弱い。'
    },
    // ウィザード（ステージ14から。魔法使いのランクアップ。正規部隊だけがなれる）：攻撃が上がり、召喚が成功しやすく、ゴーレムも呼べる
    // summon.byType：呼ぶものごとに、最大人数と成功率を変えるとき（書いていないものは maxSoldiers・chancePercent）
    wizard: {
      name: 'ウィザード', size: 6, soldierHp: 5, attack: 4, defense: 0, move: 3,
      rangeMin: 1, rangeMax: 2, moveType: 'ground', isKing: false, family: 'magic',
      summon: { types: ['skeleton', 'golem'], maxSoldiers: 4, chancePercent: 70, byType: { golem: { maxSoldiers: 2, chancePercent: 50 } } },
      description: '魔法使いのランクアップ。魔法が強く、スケルトンを呼びやすい。岩の巨人ゴーレムも呼べる。'
    },
    // ゴーレム（ステージ14から）：召喚で現れる岩の巨人。硬くて遅い壁。魔法に弱い。補充や祈りでは戻らず、町も占領できない
    golem: {
      name: 'ゴーレム', size: 3, soldierHp: 12, attack: 4, defense: 2, move: 2,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'large',
      noRestore: true,
      description: '召喚で現れる岩の巨人。とても硬いが足が遅い。魔法に弱い。補充や祈りでは戻らない。'
    },
    // ハイプリースト（ステージ17から。プリーストの上。正規部隊だけ）：動かずに祈ると6人隊を全員戻し、3人隊には2人。祈った味方の守り+1（2026-10-20 合意）
    // stillAll：動かずに祈ると全員戻す。defenseBuff：祈った味方の防御に足す値（次の自分の番が始まるまで）
    highPriest: {
      name: 'ハイプリースト', size: 6, soldierHp: 6, attack: 2, defense: 1, move: 3,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'healer',
      prayer: { stillAll: true, stillDivisor: 1, movedDivisor: 2, targetSizes: [6, 3], heavyAmount: 2, defenseBuff: 1 },
      description: 'プリーストの上。動かずに祈ると6人隊を全員戻し、3人隊には2人戻す。祈った味方の守りを1上げる。'
    },
    // サーガ（ステージ17から。ウィザードの上。正規部隊だけ）：強さはウィザードと同じ。召喚が必ず成功して、全員そろう
    saga: {
      name: 'サーガ', size: 6, soldierHp: 5, attack: 4, defense: 0, move: 3,
      rangeMin: 1, rangeMax: 2, moveType: 'ground', isKing: false, family: 'magic',
      summon: { types: ['skeleton', 'golem'], maxSoldiers: 6, chancePercent: 100, byType: { golem: { maxSoldiers: 3, chancePercent: 100 } } },
      description: 'ウィザードの上。召喚が必ず成功し、スケルトン6人・ゴーレム3人がそろう。'
    },
    // ドラゴン（ステージ16から。まずは敵の強敵）：地上の竜で最強。地形無視（湖・沼・藪もふつうに進み、沼・藪のダメージも受けない）。
    // allDirections：隣の8マス（斜めも）に攻撃・反撃が届く。向きは無い。大型なので魔法に弱く、ドラゴンナイトはさらに+3
    dragon: {
      name: 'ドラゴン', size: 3, soldierHp: 18, attack: 8, defense: 2, move: 3,   // 自動対戦で調整（最初の案は体力20・攻撃9・防御3。2体だと勝率1〜2割だった）
      rangeMin: 1, rangeMax: 1, moveType: 'ignoreTerrain', isKing: false, family: 'large',
      allDirections: true,
      description: '地上の竜で最強。地形を気にせず進み、斜めも含めた隣の8マスに攻撃できる。魔法とドラゴンナイトに弱い。'
    },
    // スケルトン（ステージ12から）：召喚で現れる不死の兵。補充や祈りでは戻らず、町も占領できない。回復系に弱い
    skeleton: {
      name: 'スケルトン', size: 6, soldierHp: 4, attack: 2, defense: 0, move: 3,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'undead',
      noRestore: true,
      description: '召喚で現れる不死の兵。補充や祈りでは戻らない。僧侶に弱い。'
    },
    // エルフ（ステージ13から。弓兵のランクアップ。正規部隊だけがなれる）：森を自在に動き、森では守りが固い。飛行にとても強い
    // bonusAgainst：その系統を攻めるとき、相性に加えて打撃に足す値。terrainDefenseBonus：その地形にいるとき、地形の守りに足す値
    elf: {
      name: 'エルフ', size: 6, soldierHp: 5, attack: 3, defense: 0, move: 4,
      rangeMin: 2, rangeMax: 2, moveType: 'woodland', isKing: false, family: 'bow',
      bonusAgainst: { flying: 1 },
      terrainDefenseBonus: { forest: 1 },
      description: '弓兵のランクアップ。森を自在に動き、森では守りが固い。飛行にとても強い。'
    },
    // ---- 正規部隊だけがなれる、3段目のクラス（2026-10-19 ユーザー決定） ----
    // ジェネラル（ナイトの上）：最強の壁。地上からの攻撃はほとんど効かないが、空からの攻撃には守りが2下がる。移動4
    // defenseVsFlying：飛行の系統から攻められたときに、防御から引く値
    general: {
      name: 'ジェネラル', size: 6, soldierHp: 8, attack: 4, defense: 4, move: 4,
      rangeMin: 1, rangeMax: 1, moveType: 'ground', isKing: false, family: 'spear',
      canBrace: true, capturesTowns: true,
      defenseVsFlying: 2,
      description: 'ナイトのランクアップ。地上からの攻撃はほとんど効かない最強の壁。空からの攻撃には少し弱い。'
    },
    // ドラゴンナイト（騎士の上。40点で上がる）：竜に乗る。地形無視で、湖も越える。弓には弱いが、ほかにはほぼ勝てる。ドラゴンに特に強い
    dragonKnight: {
      name: 'ドラゴンナイト', size: 3, soldierHp: 14, attack: 8, defense: 2, move: 5,
      rangeMin: 1, rangeMax: 1, moveType: 'ignoreTerrain', isKing: false, family: 'flying',
      bonusAgainst: { large: 3 },
      description: '騎士のランクアップ。竜に乗り、地形を気にせず進む。弓には弱いが、ほかにはほぼ勝てる。ドラゴンに特に強い。'
    },
    // ハイエルフ（エルフの上）：森と湖も進み、隣にも2マス先にも撃てる。飛行にさらに強い
    highElf: {
      name: 'ハイエルフ', size: 6, soldierHp: 6, attack: 4, defense: 1, move: 5,
      rangeMin: 1, rangeMax: 2, moveType: 'elven', isKing: false, family: 'bow',
      bonusAgainst: { flying: 2 },
      terrainDefenseBonus: { forest: 1 },
      description: 'エルフのランクアップ。森も湖も進み、隣にも2マス先にも撃てる。飛行にとても強い。'
    },
    // ワイバーン（ステージ13から）：いちばん速く飛ぶ竜。グリフォンより少し強い
    wyvern: {
      name: 'ワイバーン', size: 3, soldierHp: 13, attack: 7, defense: 1, move: 6,
      rangeMin: 1, rangeMax: 1, moveType: 'flying', isKing: false, family: 'flying',
      cost: 120,
      description: 'いちばん速く飛ぶ竜。グリフォンより強い。弓に弱い。'
    },
    // グリフォン（ステージ10から）：空を飛ぶ重装隊。ハーピーより遅いが強い（docs/キャラクター計画.md）
    griffin: {
      name: 'グリフォン', size: 3, soldierHp: 12, attack: 6, defense: 1, move: 4,
      rangeMin: 1, rangeMax: 1, moveType: 'flying', isKing: false, family: 'flying',
      cost: 100,
      description: '空を飛ぶ重装隊。ハーピーより遅いが強い。弓兵に弱い。'
    }
  };

  SC.COMBAT = {
    missPercent: 2,   // 兵士1人ごとのミスの確率（身のこなしが「ふつう」の相手。相性のあるステージでは、下の身のこなしで変わる）
    affinityBonus: 2  // 相性：得意な相手を攻めるときに、兵士1人の打撃に足す値
  };

  // 系統（相性と身のこなしを決める名札）。キャラは units の family でどれかの系統に入る。
  // strongAgainst：得意な相手の系統（攻めるとき打撃+affinityBonus）。agility：身のこなし（攻撃される側のミスの確率が変わる）。
  // まだ登場していない系統も、先に決めておく（docs/相性の設計案.md。2026-10-17 合意）。
  // 相性の輪：槍 → 騎兵 → 弓 → 飛行 → 槍。騎兵は弓だけでなく魔法・回復の後衛にも強い。ほかに 魔法 → 大型、回復 → 不死
  SC.FAMILIES = {
    spear: { name: '槍', strongAgainst: ['cavalry'], agility: 'normal' },
    cavalry: { name: '騎兵', strongAgainst: ['bow', 'magic', 'healer'], agility: 'large' },
    bow: { name: '弓', strongAgainst: ['flying'], agility: 'quick' },
    magic: { name: '魔法', strongAgainst: ['large'], agility: 'normal' },
    healer: { name: '回復', strongAgainst: ['undead'], agility: 'normal' },
    flying: { name: '飛行', strongAgainst: ['spear'], agility: 'quick' },
    large: { name: '大型', strongAgainst: [], agility: 'large' },
    undead: { name: '不死', strongAgainst: [], agility: 'normal' },
    king: { name: '王', strongAgainst: [], agility: 'normal' }
  };

  // 身のこなし → 攻撃される側の、兵士1人ごとのミスの確率（％）
  SC.AGILITY = {
    quick: { name: '素早い', missPercent: 5 },
    normal: { name: 'ふつう', missPercent: 2 },
    large: { name: '大柄', missPercent: 1 }
  };

  // 領地と軍資金（ステージ5から）。収入は自分のターンの始めに入る
  SC.ECONOMY = {
    castleIncome: 20,              // 城1つあたりの収入（G）
    fortIncome: 20,                // 砦1つあたりの収入（G。ステージ10から）
    townIncome: 10,                // 町1つあたりの収入（G）
    resupplyCostPerSoldier: 5,     // 補充で兵士1人を戻す値段（G）
    // 1ターンに戻る人数（部隊の最大人数 → 人数）。王（3人隊）は戻らない：城の王が毎ターン戻ると、倒しきれずに戦いが長引くため（自動対戦で確認）
    resupplyPerTurn: { 6: 2, 3: 0 }
  };

  SC.SIDE_NAMES = { player: '自軍', enemy: '敵軍' };
})(typeof window !== 'undefined' ? window : globalThis);
