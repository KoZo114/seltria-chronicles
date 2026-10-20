// 地形のデータ。数値の調整はこのファイルだけで行う。
// moveCost は、ふつうに歩く部隊の移動コスト。impassable: true の地形は通れない。
// 部隊ごとの歩きやすさの違い（森が得意、空を飛ぶなど）は、下の SC.MOVE_TYPES で決める。
(function (root) {
  var SC = (root.SC = root.SC || {});

  SC.TERRAIN = {
    plain: {
      name: '平地',
      moveCost: 1,
      defense: 0,
      kingDamageReductionPercent: 0,
      description: '移動コスト1。特別な効果はありません。'
    },
    forest: {
      name: '森',
      moveCost: 2,
      defense: 2,
      kingDamageReductionPercent: 0,
      description: '移動コスト2。ここにいる部隊は、相手の兵士1人の打撃のダメージが2減ります。'
    },
    lake: {
      name: '湖',
      moveCost: 1,
      impassable: true,   // 歩いては入れない（空を飛ぶ部隊は入れる）
      defense: 0,
      kingDamageReductionPercent: 0,
      description: '通れません。'
    },
    town: {
      name: '町',
      moveCost: 1,
      defense: 1,
      kingDamageReductionPercent: 0,
      description: '移動コスト1。受ける打撃が1減ります。歩兵が行動を終えると占領でき、毎ターン収入が入ります。'
    },
    // 砦（ステージ10から）：前線の拠点。歩兵か王が行動を終えると占領でき、王がいれば部隊を雇える
    fort: {
      name: '砦',
      moveCost: 1,
      defense: 2,
      kingDamageReductionPercent: 0,
      description: '移動コスト1。受ける打撃が2減ります。歩兵か王が占領でき、毎ターン20G。王がいれば雇えます。'
    },
    // 沼と藪（2026-10-19 ユーザーの希望）：ターンの始めにその上にいると、最大体力の hazardPercent ％（切り上げ）のダメージ。
    // 地形のダメージでは全滅しない（最後の1人は残る）。空を飛ぶ部隊と地形無視の部隊は受けない（MOVE_TYPES の ignoresHazard）
    swamp: {
      name: '沼',
      moveCost: 2,
      defense: 0,
      hazardPercent: 10,
      kingDamageReductionPercent: 0,
      description: '移動コスト2。ターンの始めにここにいると、最大体力の1割のダメージ（空を飛ぶ部隊は受けない）。'
    },
    bramble: {
      name: '藪',
      moveCost: 2,
      defense: 1,
      hazardPercent: 10,
      kingDamageReductionPercent: 0,
      description: '移動コスト2。受ける打撃が1減るが、ターンの始めにここにいると、最大体力の1割のダメージ（空を飛ぶ部隊は受けない）。'
    },
    // 墓地（ステージ17から）：死者の瘴気で、ターンの始めにここにいると最大体力の1割のダメージ。受ける打撃は1減る。
    // 不死（スケルトン）はダメージを受けない（hazardSpares）
    graveyard: {
      name: '墓地',
      moveCost: 2,
      defense: 1,
      hazardPercent: 10,
      hazardSpares: ['undead'],
      kingDamageReductionPercent: 0,
      description: '移動コスト2。受ける打撃が1減るが、ターンの始めにここにいると、最大体力の1割のダメージ（空を飛ぶ部隊と不死は受けない）。'
    },
    // 大聖堂の跡（ステージ17から）：しくみは砦と同じ（baseKind）。絵と名前だけ違う
    cathedral: {
      name: '大聖堂',
      baseKind: 'fort',
      bigBlock: true,   // マップで2×2に並べると、4マスで建物1つ（js/rules/movement.js）
      moveCost: 1,
      defense: 2,
      kingDamageReductionPercent: 0,
      description: '移動コスト1。受ける打撃が2減ります。歩兵か王が占領でき、毎ターン20G。王がいれば雇えます（砦と同じ）。'
    },
    // 城壁（2026-10-20）：2×2の城の左右の奥に置く。歩いては通れない（空を飛ぶ部隊は入れる）。城を囲める数を、1マスの城と同じ最大4部隊にするため
    wall: {
      name: '城壁',
      moveCost: 1,
      impassable: true,
      defense: 0,
      kingDamageReductionPercent: 0,
      description: '通れません（空を飛ぶ部隊は入れます）。'
    },
    castle: {
      name: '城',
      bigBlock: true,   // マップで2×2に並べると、4マスで城1つ
      moveCost: 1,
      defense: 0,
      kingDamageReductionPercent: 30,
      description: '移動コスト1。王がここにいると、受けるダメージが30％減ります。'
    }
  };

  // 移動のしかた。ユニットの moveType でどれを使うかを決める。
  //  costOverrides：地形ごとに、ふつうとは違う移動コスト（例：森を1で進める）
  //  flatCost：地形に関係なく、1マスあたりこのコストで進む（地形の影響を無視）
  //  canEnterImpassable：通れない地形（湖など）にも入れる（その上に止まることもできる）
  //  ignoresTerrainDefense：その地形にいても、地形の守り（森の防御+2など）を受けない
  //  ignoresHazard：沼や藪のダメージを受けない
  // 「地形の影響を無視」と「通れない地形に入れる」は別の設定にしている（追加仕様の決まり）
  // 2026-10-14 決定：飛ぶ部隊は湖の上に止まれる。飛ぶ部隊とドラゴン（地形無視）は地形の守りを受けない。
  // 地形のしくみの種類（大聖堂は砦と同じしくみ）。占領・収入・雇う場所などは、この種類で決める
  SC.terrainKind = function (terrainId) { return (SC.TERRAIN[terrainId] && SC.TERRAIN[terrainId].baseKind) || terrainId; };

  SC.MOVE_TYPES = {
    ground: { name: '歩き' },
    woodland: { name: '歩き（森が得意）', costOverrides: { forest: 1 } },
    mounted: { name: '馬（森が苦手）', costOverrides: { forest: 3 } },   // 騎士
    elven: { name: '森の民（森が得意・湖も渡れる）', costOverrides: { forest: 1, lake: 2 }, canEnterImpassable: true },   // ハイエルフ   // 弓兵がランクアップしたエルフ用（まだ使っていない）
    flying: { name: '飛行', flatCost: 1, canEnterImpassable: true, ignoresTerrainDefense: true, ignoresHazard: true },
    ignoreTerrain: { name: '地形無視', flatCost: 1, canEnterImpassable: true, ignoresTerrainDefense: true, ignoresHazard: true }   // ドラゴン用
  };
})(typeof window !== 'undefined' ? window : globalThis);
