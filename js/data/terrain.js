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
    castle: {
      name: '城',
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
  // 「地形の影響を無視」と「通れない地形に入れる」は別の設定にしている（追加仕様の決まり）
  // 2026-10-14 決定：飛ぶ部隊は湖の上に止まれる。飛ぶ部隊とドラゴン（地形無視）は地形の守りを受けない。
  SC.MOVE_TYPES = {
    ground: { name: '歩き' },
    woodland: { name: '歩き（森が得意）', costOverrides: { forest: 1 } },
    mounted: { name: '馬（森が苦手）', costOverrides: { forest: 3 } },   // 騎士
    elven: { name: '森の民（森が得意・湖も渡れる）', costOverrides: { forest: 1, lake: 2 }, canEnterImpassable: true },   // ハイエルフ   // 弓兵がランクアップしたエルフ用（まだ使っていない）
    flying: { name: '飛行', flatCost: 1, canEnterImpassable: true, ignoresTerrainDefense: true },
    ignoreTerrain: { name: '地形無視', flatCost: 1, canEnterImpassable: true, ignoresTerrainDefense: true }   // ドラゴン用
  };
})(typeof window !== 'undefined' ? window : globalThis);
