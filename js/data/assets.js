// 画像の一覧表。どの地形・どのユニットにどの画像を使うかをここで決める。
// 画像を差し替えるときは、このファイルのパスを書き換えるだけでよい。
// いまは assets64/（64×64 の素材）を使っている。assets/（32×32 の旧素材）は保管用。
// 書かれていない・読み込めない画像は、プログラムで描いた図形（代替表示）になる。
(function (root) {
  var SC = (root.SC = root.SC || {});

  // 素材1枚の1辺のドット数。表示サイズをこの整数倍に近づけて、ドットの太さをそろえるために使う。
  SC.ASSET_PIXEL_SIZE = 64;

  SC.ASSETS = {
    // 地形：複数書くと、マスごとに違う絵を使って単調さを減らす
    terrain: {
      plain: [
        'assets64/terrain/terrain_grass_1.png',
        'assets64/terrain/terrain_grass_2.png',
        'assets64/terrain/terrain_grass_3.png'
      ],
      forest: ['assets64/terrain/terrain_forest.png'],
      lake: ['assets64/terrain/terrain_water.png'],
      castle: ['assets64/buildings/building_castle.png'],
      town: ['assets64/buildings/building_town.png'],
      fort: ['assets64/buildings/building_fort.png']   // 砦（tools/make-fort.py で描いた）
    },
    // ユニット：クラスごとに、自軍用と敵軍用
    units: {
      king: { player: 'assets64/units/unit_king_player.png', enemy: 'assets64/units/unit_king_enemy.png' },
      infantry: { player: 'assets64/units/unit_infantry_player.png', enemy: 'assets64/units/unit_infantry_enemy.png' },
      archer: { player: 'assets64/units/unit_archer_player.png', enemy: 'assets64/units/unit_archer_enemy.png' },
      cleric: { player: 'assets64/units/unit_cleric_player.png', enemy: 'assets64/units/unit_cleric_enemy.png' },
      cavalry: { player: 'assets64/units/unit_cavalry_player.png', enemy: 'assets64/units/unit_cavalry_enemy.png' },   // 騎士（馬に乗る）
      harpy: { player: 'assets64/units/unit_harpy_player.png', enemy: 'assets64/units/unit_harpy_enemy.png' },   // ハーピー（空を飛ぶ）
      griffin: { player: 'assets64/units/unit_griffin_player.png', enemy: 'assets64/units/unit_griffin_enemy.png' },   // グリフォン（空を飛ぶ重装隊）
      knight: { player: 'assets64/units/unit_knight_player.png', enemy: 'assets64/units/unit_knight_enemy.png' },   // ナイト（最初に作った騎士の絵）
      priest: { player: 'assets64/units/unit_priest_player.png', enemy: 'assets64/units/unit_priest_enemy.png' },   // プリースト
      mage: { player: 'assets64/units/unit_mage_player.png', enemy: 'assets64/units/unit_mage_enemy.png' },   // 魔法使い
      skeleton: { player: 'assets64/units/unit_skeleton_player.png', enemy: 'assets64/units/unit_skeleton_enemy.png' }   // スケルトン
    },
    // タイトル画面の背景。video が再生できないとき（省電力モードなど）は poster の1枚絵を出す
    title: {
      video: 'assets64/title/title_loop.mp4',
      poster: 'assets64/title/title_poster.jpg'
    },
    // 音。書かれていない・読み込めない音は鳴らないだけで、ゲームは進む
    // 曲の名前（title など）は、main.js（タイトル）と stages.js（ステージごとの曲）から指定する。効果音はファイルを使わない（js/ui/sound.js で作る）
    sound: {
      music: {
        title: 'assets64/sound/title_bgm.mp3',
        map: 'assets64/sound/map_bgm.mp3',
        // 通常の戦闘曲（assets64/sound/battle_bgm.mp3）は、いまは使っていない。使うときは battle: として足し、stages.js の battleMusic に書く
        boss: 'assets64/sound/boss_bgm.mp3'
      }
    },
    // 雇う画面（城の広間）。aide：王の側近（128×128、右向き）、aide2：側近の2枚目の絵（あれば交互に切り替えて動かす）、background：広間の背景。
    // 元の絵は assets64/_source/hire/、変換は tools/convert-units.py
    hire: {
      aide: 'assets64/hire/hire_aide.png',
      aide2: 'assets64/hire/hire_aide2.png',
      background: 'assets64/hire/hire_bg.png'
    },
    // 正規部隊の隊長の顔の絵（128×128。tools/convert-units.py の convert_portraits）。無ければクラスの絵を出す
    portraits: {
      aldo: 'assets64/portraits/portrait_aldo.png',
      fina: 'assets64/portraits/portrait_fina.png',
      sera: 'assets64/portraits/portrait_sera.png',
      noel: 'assets64/portraits/portrait_noel.png',
      gail: 'assets64/portraits/portrait_gail.png',
      bran: 'assets64/portraits/portrait_bran.png'
    },
    // 町を占領した場面（688×384）。旗の無い絵→旗が上がった絵（旗は消してある）に切り替え、切り抜いた旗を別に動かす
    // flagBox は、688×384 の中での旗の位置 [左, 上, 幅, 高さ]（tools/convert-units.py が表示する値）
    capture: {
      before: 'assets64/capture/capture_before.png',
      after: 'assets64/capture/capture_after.png',
      flag: 'assets64/capture/capture_flag.png',
      flagBox: [185, 27, 165, 132]
    },
    // 戦闘シーン用（128×128。自軍は画面の右に立って左向き、敵軍は左に立って右向き）。無いユニットはマップ用の絵を拡大して使う
    battle: {
      // 背景：左半分は敵軍、右半分は自軍が立っている地形で選ぶ。その地形の背景が無ければ fallback を使う
      // 「castle_enemy」のように「地形_軍」と書くと、その軍の城で戦うときだけ使う（旗の色を変えた版）
      backgrounds: {
        plain: 'assets64/battle/bg_plain.png',
        forest: 'assets64/battle/bg_forest.png',
        castle: 'assets64/battle/bg_castle.png',
        castle_enemy: 'assets64/battle/bg_castle_enemy.png',
        town: 'assets64/battle/bg_town.png',
        fort: 'assets64/battle/bg_castle.png',              // 砦：城の背景を使う
        fort_enemy: 'assets64/battle/bg_castle_enemy.png',
        fallback: 'assets64/battle/bg_plain.png'
      },
      units: {
        king: { player: 'assets64/battle/battle_king_player.png', enemy: 'assets64/battle/battle_king_enemy.png' },
        guard: { player: 'assets64/battle/battle_guard_player.png', enemy: 'assets64/battle/battle_guard_enemy.png' },   // 近衛兵（キングの部隊の2人目・3人目）
        infantry: { player: 'assets64/battle/battle_infantry_player.png', enemy: 'assets64/battle/battle_infantry_enemy.png' },
        archer: { player: 'assets64/battle/battle_archer_player.png', enemy: 'assets64/battle/battle_archer_enemy.png' },
        cleric: { player: 'assets64/battle/battle_cleric_player.png', enemy: 'assets64/battle/battle_cleric_enemy.png' },
        cavalry: { player: 'assets64/battle/battle_cavalry_player.png', enemy: 'assets64/battle/battle_cavalry_enemy.png' },
        harpy: { player: 'assets64/battle/battle_harpy_player.png', enemy: 'assets64/battle/battle_harpy_enemy.png' },
        griffin: { player: 'assets64/battle/battle_griffin_player.png', enemy: 'assets64/battle/battle_griffin_enemy.png' },
        knight: { player: 'assets64/battle/battle_knight_player.png', enemy: 'assets64/battle/battle_knight_enemy.png' },
        priest: { player: 'assets64/battle/battle_priest_player.png', enemy: 'assets64/battle/battle_priest_enemy.png' },
        mage: { player: 'assets64/battle/battle_mage_player.png', enemy: 'assets64/battle/battle_mage_enemy.png' },
        skeleton: { player: 'assets64/battle/battle_skeleton_player.png', enemy: 'assets64/battle/battle_skeleton_enemy.png' }
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
