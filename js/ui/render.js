// マップとユニットを画面に描く。ルールの計算はしない。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var MAX_TILE_SIZE = 64;
  var MIN_TILE_SIZE = 24;
  var PORTRAIT_MAX_SIZE = 52;
  // ドットをそろえるためにマスを小さくしてよい限度（収まる最大サイズに対する割合）
  var SNAP_MIN_RATIO = 0.8;
  // 1マスの大きさは、このマス数が画面に入る大きさで決める（ステージ1〜5のマップの大きさ）。
  // これより大きいマップでも1マスは小さくせず、入りきらない分は指でなぞって動かす
  var VIEW_COLUMNS = 8;
  var VIEW_ROWS = 10;
  var CAMERA_MS = 300;   // カメラ（見えている範囲）が自動で動く時間
  var elements = {};
  var unitElements = {};
  var tileElements = [];
  var boardSize = { width: 0, height: 0 };
  var loadedImages = {};   // 読み込みに成功した画像（パス → 画像）
  var cameraAnimation = null;

  // ---- 画像（ドット絵） ----

  function getAssets() { return SC.ASSETS || { terrain: {}, units: {} }; }

  // 一覧表の画像をまとめて先に読み込む。失敗した画像は使わず、代替表示にする。
  function preloadImages() {
    var assets = getAssets();
    var paths = [];
    Object.keys(assets.terrain).forEach(function (id) { paths = paths.concat(assets.terrain[id]); });
    Object.keys(assets.units).forEach(function (id) {
      Object.keys(assets.units[id]).forEach(function (side) { paths.push(assets.units[id][side]); });
    });
    var battle = assets.battle || { backgrounds: {}, units: {} };
    Object.keys(battle.backgrounds).forEach(function (id) { paths.push(battle.backgrounds[id]); });
    Object.keys(battle.units).forEach(function (id) {
      Object.keys(battle.units[id]).forEach(function (side) { paths.push(battle.units[id][side]); });
    });
    var hire = assets.hire || {};   // 雇う画面（側近と広間）
    Object.keys(hire).forEach(function (id) { paths.push(hire[id]); });
    var regularArt = assets.regularArt || {};   // 隊長ごとの絵
    Object.keys(regularArt).forEach(function (id) {
      Object.keys(regularArt[id]).forEach(function (typeId) { paths.push(regularArt[id][typeId].map, regularArt[id][typeId].battle); });
    });
    var big = assets.bigBuildings || {};   // 大きく見せる建物
    Object.keys(big).forEach(function (id) { paths.push(big[id]); });
    var portraits = assets.portraits || {};   // 隊長の顔の絵
    Object.keys(portraits).forEach(function (id) { paths.push(portraits[id]); });
    var speakers = SC.TALK_SPEAKERS || {};   // 会話で話す敵の顔の絵
    Object.keys(speakers).forEach(function (id) { if (speakers[id].portrait) paths.push(speakers[id].portrait); });
    var capture = assets.capture || {};   // 町を占領した場面
    ['before', 'after', 'flag'].forEach(function (id) { if (capture[id]) paths.push(capture[id]); });
    return Promise.all(paths.map(function (path) {
      return new Promise(function (resolve) {
        var image = new Image();
        image.onload = function () { loadedImages[path] = image; resolve(); };
        image.onerror = function () { resolve(); };
        image.src = path;
      });
    }));
  }

  function isImageLoaded(path) { return !!loadedImages[path]; }

  // 全体の図に地形の絵を描くときに使う（読み込めていなければ null）
  function getTerrainImage(terrainId, x, y) {
    var path = getTerrainImagePath(terrainId, x, y);
    return path ? loadedImages[path] : null;
  }

  // 2×2の建物の大きな絵（全体の図で使う）。(x, y) が建物のマスでなければ、または絵が無ければ null。
  // block は建物の左上のマス。持ち主のいる建物は「地形_軍」の絵があればそれ
  function getBigBuilding(state, x, y) {
    var block = state.blockOf && state.blockOf[x + ',' + y];
    if (!block) return null;
    var bigBuildings = getAssets().bigBuildings || {};
    var terrainId = state.terrain[y][x];
    var owner = state.owners ? state.owners[block.x + ',' + block.y] : null;
    var path = owner && loadedImages[bigBuildings[terrainId + '_' + owner]] ? bigBuildings[terrainId + '_' + owner] : bigBuildings[terrainId];
    var image = path && loadedImages[path];
    return image ? { block: block, image: image } : null;
  }

  function getTerrainImagePath(terrainId, x, y) {
    var candidates = (getAssets().terrain[terrainId] || []).filter(function (path) { return loadedImages[path]; });
    return candidates.length > 0 ? candidates[(x * 7 + y * 13) % candidates.length] : null;
  }

  // 隊長ごとの絵（そのクラスで、その隊長だけの姿があれば）。kind は 'map' か 'battle'。無ければ null
  function getRegularArtPath(regularId, typeId, kind) {
    var art = (((getAssets().regularArt || {})[regularId] || {})[typeId] || {})[kind];
    return art && loadedImages[art] ? art : null;
  }

  // 隊長の顔の絵（読み込めていなければ null）
  function getPortraitPath(regularId) {
    var path = (getAssets().portraits || {})[regularId];
    return path && loadedImages[path] ? path : null;
  }

  function getUnitImagePath(unitTypeId, side) {
    var path = (getAssets().units[unitTypeId] || {})[side];
    return path && loadedImages[path] ? path : null;
  }

  var TERRAIN_ART = {
    plain: '',
    forest:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M13 10 L22 28 L4 28 Z M34 8 L44 27 L24 27 Z M24 22 L35 42 L13 42 Z" fill="#2f6b34" stroke="#1d4722" stroke-width="1.5" stroke-linejoin="round"/>' +
      '</svg>',
    // 沼と藪：絵が届くまでの仮の絵
    swamp:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<ellipse cx="17" cy="20" rx="12" ry="6" fill="#4f5f3a" stroke="#2f3a22" stroke-width="1.5"/>' +
      '<ellipse cx="32" cy="34" rx="12" ry="6" fill="#4f5f3a" stroke="#2f3a22" stroke-width="1.5"/>' +
      '<path d="M10 12 V4 M14 13 V6 M38 27 V19 M42 28 V22" stroke="#3d5a2a" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>',
    bramble:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M6 40 C10 26 18 30 22 18 C26 30 34 24 42 40 Z" fill="#5c7a2e" stroke="#33461a" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M12 34 l-3 -3 M20 26 l-3 -4 M28 28 l3 -4 M36 34 l3 -3" stroke="#e9e2c0" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>',
    // 城門と壊れた城門：絵が届くまでの仮の絵
    gate:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M2 46 V10 H46 V46 Z" fill="#9b968a" stroke="#4f4a3c" stroke-width="1.5"/>' +
      '<path d="M12 46 V24 a12 12 0 0 1 24 0 V46 Z" fill="#7a4b26" stroke="#3a2412" stroke-width="1.5"/>' +
      '<path d="M18 46 V22 M24 46 V18 M30 46 V22 M12 32 H36" stroke="#3a2412" stroke-width="1.4"/>' +
      '</svg>',
    gateBroken:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M2 46 V10 H46 V46 Z" fill="#9b968a" stroke="#4f4a3c" stroke-width="1.5"/>' +
      '<path d="M12 46 V24 a12 12 0 0 1 24 0 V46 Z" fill="#a9cf86" stroke="#4f4a3c" stroke-width="1.5"/>' +
      '<path d="M14 44 l6 -4 M28 40 l6 5 M20 30 l3 3" stroke="#7a4b26" stroke-width="2.4" stroke-linecap="round"/>' +
      '</svg>',
    // 城壁（2×2の城の左右に置く、通れないマス）：絵が届くまでの仮の絵
    wall:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M2 46 V14 H10 V8 H18 V14 H30 V8 H38 V14 H46 V46 Z" fill="#9b968a" stroke="#4f4a3c" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M2 26 H46 M2 36 H46 M14 26 V36 M30 26 V36 M22 36 V46 M38 36 V46 M8 14 V26 M24 14 V26 M40 14 V26" stroke="#6f6a5c" stroke-width="1.2"/>' +
      '</svg>',
    // 墓地と大聖堂：絵が届くまでの仮の絵
    graveyard:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M8 38 V22 a6 6 0 0 1 12 0 V38 Z M28 40 V26 a5 5 0 0 1 10 0 V40 Z" fill="#9aa0a8" stroke="#4a4f57" stroke-width="1.5"/>' +
      '<path d="M14 12 V20 M10 15 H18 M33 14 V22 M29 17 H37" stroke="#6b6f78" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>',
    cathedral:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M8 44 V22 L24 8 L40 22 V44 Z" fill="#d6d1e0" stroke="#5a5568" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<circle cx="24" cy="24" r="5" fill="#6f8fd8" stroke="#5a5568" stroke-width="1.2"/>' +
      '<path d="M19 44 V36 a5 5 0 0 1 10 0 V44 Z" fill="#5a5568"/>' +
      '</svg>',
    castle:
      '<svg viewBox="0 0 48 48" aria-hidden="true">' +
      '<path d="M5 44 V12 H11 V17 H16 V12 H22 V17 H26 V12 H32 V17 H37 V12 H43 V44 Z" fill="#8d8674" stroke="#4f4a3c" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M19 44 V32 a5 5 0 0 1 10 0 V44 Z" fill="#4f4a3c"/>' +
      '</svg>'
  };

  var UNIT_GLYPHS = {
    king: '<path class="crown" d="M-11 8 L-12 -6 L-6 1 L0 -9 L6 1 L12 -6 L11 8 Z"/>',
    infantry: '<path d="M0 -12 L3 -8 L3 3 L-3 3 L-3 -8 Z"/><rect x="-7" y="3" width="14" height="3" rx="1"/><rect x="-1.8" y="6" width="3.6" height="6" rx="1"/>',
    archer: '<path class="line" d="M-3 -11 Q11 0 -3 11"/><path class="line" d="M-3 -11 L-3 11" stroke-width="1.4"/><path class="line" d="M-9 0 L9 0 M9 0 L5 -3.5 M9 0 L5 3.5"/>'
  };

  // 自軍：丸い台座で上向きの印。敵軍：四角い台座で下向きの印。色が分からなくても形で見分けられる。
  function createUnitSvg(unitTypeId, side) {
    var base = side === 'player'
      ? '<path class="pointer" d="M24 1 L31 11 L17 11 Z"/><circle class="base" cx="24" cy="26" r="18"/>'
      : '<path class="pointer" d="M24 47 L31 37 L17 37 Z"/><rect class="base" x="6" y="4" width="36" height="34" rx="4"/>';
    var glyphY = side === 'player' ? 26 : 21;
    return '<svg viewBox="0 0 48 48" aria-hidden="true">' + base +
      '<g class="glyph" transform="translate(24 ' + glyphY + ')">' + (UNIT_GLYPHS[unitTypeId] || '') + '</g></svg>';
  }

  function sleep(milliseconds) {
    return new Promise(function (resolve) { root.setTimeout(resolve, milliseconds); });
  }

  function init(domElements) {
    elements = domElements;
    elements.wrap.addEventListener('scroll', updateShades, { passive: true });
  }

  // 2×2の建物（城・大聖堂）の中にいる部隊は、建物の真ん中に描く（ルールの上の位置は、建物の左上のマス）
  var boardBlocks = null;
  function displayPos(x, y) {
    var block = boardBlocks && boardBlocks[x + ',' + y];
    return block ? { x: block.x + 0.5, y: block.y + 0.5 } : { x: x, y: y };
  }

  function setPosition(element, x, y) {
    var shown = displayPos(x, y);
    element.style.setProperty('--ux', shown.x);
    element.style.setProperty('--uy', shown.y);
    element.dataset.x = shown.x;
    element.dataset.y = shown.y;
  }

  function buildBoard(state, onTileTap) {
    boardSize = { width: state.width, height: state.height };
    elements.tiles.innerHTML = '';
    elements.units.innerHTML = '';
    elements.effects.innerHTML = '';
    var decor = document.getElementById('decor');
    if (decor) decor.innerHTML = '';
    var bigBuildings = getAssets().bigBuildings || {};
    boardBlocks = state.blockOf && Object.keys(state.blockOf).length ? state.blockOf : null;
    unitElements = {};
    tileElements = [];
    elements.tiles.style.gridTemplateColumns = 'repeat(' + state.width + ', var(--tile))';
    for (var y = 0; y < state.height; y++) {
      for (var x = 0; x < state.width; x++) {
        var terrainId = state.terrain[y][x];
        var tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'tile t-' + terrainId + ((x + y) % 2 ? ' alt' : '');
        tile.dataset.x = x;
        tile.dataset.y = y;
        tile.setAttribute('aria-label', SC.TERRAIN[terrainId].name);
        // 2×2の建物（城・大聖堂）：4マスとも草原の絵にして、建物の大きな絵を4マスぴったりに重ねる（絵が無ければ、今までどおり1マスずつの絵）
        var block = boardBlocks && boardBlocks[x + ',' + y];
        // 持ち主のいる建物は「地形_軍」の絵があればそれ（敵の城は赤い屋根）
        var owner = block && state.owners ? state.owners[block.x + ',' + block.y] : null;
        var bigKey = owner && bigBuildings[terrainId + '_' + owner] && loadedImages[bigBuildings[terrainId + '_' + owner]] ? terrainId + '_' + owner : terrainId;
        var bigPath = block && bigBuildings[bigKey] && loadedImages[bigBuildings[bigKey]] ? bigBuildings[bigKey] : null;
        var imagePath = bigPath ? getTerrainImagePath('plain', x, y) : getTerrainImagePath(terrainId, x, y);
        if (bigPath && decor && block.x === x && block.y === y) {
          var big = document.createElement('img');
          big.className = 'big-building';
          big.src = bigPath;
          big.alt = '';
          big.style.setProperty('--bx', x);
          big.style.setProperty('--by', y);
          decor.appendChild(big);
        }
        if (block) tile.classList.add('in-block', 'bk-' + (y === block.y ? 't' : 'b') + (x === block.x ? 'l' : 'r'));   // 建物の4マスのどこか（線を消し、枠を建物の外側だけに描くため）
        if (imagePath) {
          tile.classList.add('has-image');
          tile.style.backgroundImage = 'url("' + imagePath + '")';
        } else {
          tile.innerHTML = TERRAIN_ART[terrainId] || '';
        }
        if (terrainId === 'gate') tile.insertAdjacentHTML('beforeend', '<span class="gate-hp"><i></i></span>');   // 城門の体力のゲージ
        if (SC.TERRAIN[terrainId].hazardPercent) tile.insertAdjacentHTML('beforeend', '<span class="hazard-mark" aria-hidden="true"></span>');   // 止まると体力が減る地形（沼・藪・墓地）の印
        if (SC.terrainKind(terrainId) === 'town' || SC.terrainKind(terrainId) === 'fort') tile.insertAdjacentHTML('beforeend', '<span class="owner-flag"></span>');   // 町と砦の持ち主の旗
        elements.tiles.appendChild(tile);
        tileElements.push(tile);
      }
    }
    elements.tiles.onclick = function (event) {
      var tile = event.target.closest('.tile');
      if (tile) onTileTap(Number(tile.dataset.x), Number(tile.dataset.y));
    };
    layout();
  }

  // ドット絵がきれいに見える表示サイズを選ぶ。
  // 画面の実際の画素数（表示サイズ × devicePixelRatio）が素材のドット数の整数倍だと、ドットの太さがそろう。
  // 整数倍が小さすぎるときは 0.5 倍きざみ、それも合わなければ収まる最大サイズをそのまま使う。
  function snapToPixelGrid(maxSize, minRatio) {
    var pixelRatio = root.devicePixelRatio || 1;
    var assetSize = SC.ASSET_PIXEL_SIZE || 64;
    var steps = [assetSize, assetSize / 2];
    for (var i = 0; i < steps.length; i++) {
      var snapped = Math.floor((maxSize * pixelRatio) / steps[i]) * steps[i] / pixelRatio;
      if (snapped > 0 && snapped >= maxSize * minRatio) return snapped;
    }
    return maxSize;
  }

  // 画面の空きに合わせて、1マスの大きさを決める
  function layout() {
    if (!boardSize.width) return;
    var wrap = elements.wrap;
    var fitSize = Math.floor(Math.min((wrap.clientWidth - 4) / Math.min(boardSize.width, VIEW_COLUMNS),
      (wrap.clientHeight - 4) / Math.min(boardSize.height, VIEW_ROWS)));
    fitSize = Math.max(MIN_TILE_SIZE, Math.min(MAX_TILE_SIZE, fitSize));
    var tileSize = snapToPixelGrid(fitSize, SNAP_MIN_RATIO);
    var style = document.documentElement.style;
    style.setProperty('--tile', tileSize + 'px');
    style.setProperty('--portrait', snapToPixelGrid(PORTRAIT_MAX_SIZE, SNAP_MIN_RATIO) + 'px');
    wrap.classList.toggle('scrollable', isScrollable());
    updateShades();
    return tileSize;
  }

  // ---- 見えている範囲（カメラ） ----

  // マップが画面に入りきらず、指で動かせるか
  function isScrollable() {
    var wrap = elements.wrap;
    return !!wrap && (wrap.scrollWidth > wrap.clientWidth + 1 || wrap.scrollHeight > wrap.clientHeight + 1);
  }

  // まだ続きがある側の端に、うっすら影を付ける
  function updateShades() {
    var wrap = elements.wrap;
    var area = elements.area;
    if (!wrap || !area) return;
    area.classList.toggle('more-left', wrap.scrollLeft > 1);
    area.classList.toggle('more-top', wrap.scrollTop > 1);
    area.classList.toggle('more-right', wrap.scrollLeft < wrap.scrollWidth - wrap.clientWidth - 1);
    area.classList.toggle('more-bottom', wrap.scrollTop < wrap.scrollHeight - wrap.clientHeight - 1);
  }

  function getTileSize() { return elements.tiles.firstChild ? elements.tiles.firstChild.offsetWidth : 0; }

  // マップの左上のマスが、動かせる範囲の中のどこにあるか（画素）
  function getBoardOrigin() {
    var board = elements.tiles.parentNode;
    return { x: board.offsetLeft + board.clientLeft, y: board.offsetTop + board.clientTop };
  }

  // いま見えている範囲（マス単位）。全体の図に枠を描くのに使う
  function getViewRect() {
    var wrap = elements.wrap;
    var size = getTileSize() || 1;
    var origin = getBoardOrigin();
    return {
      x: (wrap.scrollLeft - origin.x) / size,
      y: (wrap.scrollTop - origin.y) / size,
      width: wrap.clientWidth / size,
      height: wrap.clientHeight / size
    };
  }

  function scrollTo(left, top, instant) {
    var wrap = elements.wrap;
    left = Math.max(0, Math.min(wrap.scrollWidth - wrap.clientWidth, Math.round(left)));
    top = Math.max(0, Math.min(wrap.scrollHeight - wrap.clientHeight, Math.round(top)));
    if (cameraAnimation) { cameraAnimation.cancel(); cameraAnimation = null; }
    var fromLeft = wrap.scrollLeft, fromTop = wrap.scrollTop;
    if (Math.abs(left - fromLeft) < 2 && Math.abs(top - fromTop) < 2) return Promise.resolve();
    if (instant) { wrap.scrollLeft = left; wrap.scrollTop = top; return Promise.resolve(); }
    return new Promise(function (resolve) {
      var startTime = null;
      var finished = false;
      function finish(cancelled) {
        if (finished) return;
        finished = true;
        if (!cancelled) { wrap.scrollLeft = left; wrap.scrollTop = top; }
        if (cameraAnimation === animation) cameraAnimation = null;
        resolve();
      }
      var animation = { cancel: function () { finish(true); } };
      cameraAnimation = animation;
      function step(now) {
        if (finished) return;
        if (startTime === null) startTime = now;
        var t = Math.min(1, (now - startTime) / CAMERA_MS);
        var eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        wrap.scrollLeft = fromLeft + (left - fromLeft) * eased;
        wrap.scrollTop = fromTop + (top - fromTop) * eased;
        if (t < 1) root.requestAnimationFrame(step);
        else finish(false);
      }
      root.requestAnimationFrame(step);
      // 画面が隠れていて動きの描画が止まっていても、決まった時間で必ず終える（敵の番が止まらないように）
      root.setTimeout(function () { finish(false); }, CAMERA_MS + 120);
    });
  }

  // tiles（マスの一覧）が全部見えるように、見えている範囲を動かす。見えていれば動かさない。
  // 全部が入りきらないときは、center（無ければ一覧の最初のマス）を真ん中にする。
  // options: { center: {x, y}, instant: true（すぐに動かす）, margin: 端から空けるマス数 }
  function focusTiles(tiles, options) {
    options = options || {};
    if (!isScrollable() || !tiles || tiles.length === 0) return Promise.resolve();
    var wrap = elements.wrap;
    var size = getTileSize();
    if (!size) return Promise.resolve();
    var origin = getBoardOrigin();
    var margin = (options.margin === undefined ? 0.5 : options.margin) * size;
    var xs = tiles.map(function (tile) { return tile.x; });
    var ys = tiles.map(function (tile) { return tile.y; });
    var box = {
      left: origin.x + Math.min.apply(null, xs) * size - margin,
      top: origin.y + Math.min.apply(null, ys) * size - margin,
      right: origin.x + (Math.max.apply(null, xs) + 1) * size + margin,
      bottom: origin.y + (Math.max.apply(null, ys) + 1) * size + margin
    };
    var center = options.center || tiles[0];
    function axis(start, end, scroll, view, centerPixel) {
      if (end - start > view) return centerPixel - view / 2;   // 入りきらない：中心のマスを真ん中に
      if (start < scroll) return start;
      if (end > scroll + view) return end - view;
      return scroll;
    }
    var left = axis(box.left, box.right, wrap.scrollLeft, wrap.clientWidth, origin.x + (center.x + 0.5) * size);
    var top = axis(box.top, box.bottom, wrap.scrollTop, wrap.clientHeight, origin.y + (center.y + 0.5) * size);
    return scrollTo(left, top, options.instant);
  }

  // (x, y) のマスを真ん中に見せる（全体の図で押した場所へ動くときに使う）
  function centerOn(x, y, instant) {
    if (!isScrollable()) return Promise.resolve();
    var wrap = elements.wrap;
    var size = getTileSize();
    var origin = getBoardOrigin();
    return scrollTo(origin.x + (x + 0.5) * size - wrap.clientWidth / 2, origin.y + (y + 0.5) * size - wrap.clientHeight / 2, instant);
  }

  function createUnitElement(unit) {
    var element = document.createElement('div');
    element.className = 'unit ' + unit.side + (unit.regularId ? ' regular' : '');
    element.dataset.type = unit.type;
    var imagePath = (unit.regularId && getRegularArtPath(unit.regularId, unit.type, 'map')) || getUnitImagePath(unit.type, unit.side);
    var body = imagePath
      ? '<div class="unit-plate"></div><img class="sprite" src="' + imagePath + '" alt="" draggable="false">'
      : createUnitSvg(unit.type, unit.side);
    element.innerHTML = '<div class="unit-body">' + body + '</div>' +
      '<div class="done-mark">済</div><div class="brace-mark" title="構え中"></div><div class="bless-mark" title="守り+1（ハイプリーストの祈り）"></div><div class="pips"></div><div class="hp"></div>' +
      (SC.UNIT_TYPES[unit.type].diagonalFront ? '<div class="facing-mark"></div>' : '') +   // 騎士の向き（金の矢印）
      (unit.regularId ? '<div class="regular-mark" title="正規部隊"></div><div class="exp-bar"><i></i></div>' : '') +   // 正規部隊の印と経験値
      (unit.commander ? '<div class="commander-mark" title="指揮官"></div>' : '');   // 指揮官の旗（ステージ19から）
    elements.units.appendChild(element);
    unitElements[unit.id] = element;
    return element;
  }

  // 盤面の数字と兵士の印（●）は、部隊の残り人数（数字の色は、体力の合計の減り具合で変える）。
  // 印は最大人数ぶん並べ、倒れた兵士は暗く、けがをしている兵士は薄くする。
  // soldiersAfter を渡すと、これから倒れる兵士の印に赤い縁取りを付ける（攻撃前の予想用）
  function setHp(element, typeId, hp, soldiersAfter) {
    var type = SC.UNIT_TYPES[typeId];
    var maxHp = SC.Combat.getMaxHp(typeId);
    var soldiers = SC.Combat.countSoldiers(typeId, hp);
    var label = element.querySelector('.hp');
    label.textContent = soldiers;
    label.className = 'hp' + (hp * 3 <= maxHp ? ' low' : hp * 3 <= maxHp * 2 ? ' mid' : '');

    var isWounded = hp % type.soldierHp !== 0;
    var html = '';
    for (var i = 0; i < type.size; i++) {
      var state = i >= soldiers ? 'down' : (isWounded && i === soldiers - 1 ? 'wounded' : '');
      var doomed = soldiersAfter !== undefined && i < soldiers && i >= soldiersAfter ? ' doomed' : '';
      html += '<i class="' + state + doomed + '"></i>';
    }
    var pips = element.querySelector('.pips');
    pips.className = 'pips ' + (type.size > 3 ? 'small-squad' : 'heavy-squad');
    if (pips.innerHTML !== html) pips.innerHTML = html;
  }

  // ルール側の状態に、画面のユニットを合わせる。view.pending があれば、選択中のユニットを仮の位置に表示する。
  // view.soldiersAfter（ユニットの番号 → 攻撃後に残る人数）があれば、これから倒れる兵士の印に赤い縁取りを付ける。
  function syncUnits(state, view) {
    view = view || {};
    syncOwners(state);
    syncGates(state);
    var alive = {};
    state.units.forEach(function (unit) {
      alive[unit.id] = true;
      // ランクアップでクラスが変わったら、新しいクラスの絵で作り直す
      if (unitElements[unit.id] && unitElements[unit.id].dataset.type !== unit.type) {
        unitElements[unit.id].remove();
        delete unitElements[unit.id];
      }
      var element = unitElements[unit.id] || createUnitElement(unit);
      var position = view.selectedId === unit.id && view.pending ? view.pending : unit;
      setPosition(element, position.x, position.y);
      setHp(element, unit.type, unit.hp, (view.soldiersAfter || {})[unit.id]);
      element.classList.toggle('acted', unit.acted);
      element.classList.toggle('braced', !!unit.braced);
      element.classList.toggle('blessed-guard', !!unit.blessing);   // ハイプリーストの祈りで守り+1
      if (unit.regularId) {
        var threshold = SC.Regulars.getThreshold(unit.regularId, unit.type);
        var bar = element.querySelector('.exp-bar i');
        if (bar) bar.style.width = (threshold ? Math.min(100, Math.round((unit.exp || 0) / threshold * 100)) : 100) + '%';
      }
      element.classList.toggle('arriving', !!(view.hiddenIds && view.hiddenIds[unit.id]));   // 増援：演出で見せるまで隠す
      if (SC.UNIT_TYPES[unit.type].diagonalFront) element.dataset.facing = SC.Movement.getFacing(unit);
      element.classList.toggle('selected', view.selectedId === unit.id);
      element.classList.toggle('ready', !!view.showReady && unit.side === 'player' && !unit.acted && view.selectedId !== unit.id);
    });
    Object.keys(unitElements).forEach(function (unitId) {
      if (!alive[unitId]) removeUnitElement(unitId);
    });
  }

  function removeUnitElement(unitId) {
    var element = unitElements[unitId];
    if (!element) return;
    delete unitElements[unitId];
    element.classList.add('fallen');
    root.setTimeout(function () { element.remove(); }, 320);
  }

  function drawHighlights(view) {
    tileElements.forEach(function (tile) {
      var block = boardBlocks && boardBlocks[tile.dataset.x + ',' + tile.dataset.y];
      var key = block ? block.x + ',' + block.y : tile.dataset.x + ',' + tile.dataset.y;   // 2×2の建物は、4マスとも同じ色にする
      tile.classList.toggle('move', !!(view.moveTiles && view.moveTiles[key]));
      tile.classList.toggle('range', !!(view.rangeTiles && view.rangeTiles[key]));
      tile.classList.toggle('target', !!(view.targetTiles && view.targetTiles[key]));
      tile.classList.toggle('ally', !!(view.allyTiles && view.allyTiles[key]));
      tile.classList.toggle('zone', !!(view.zoneTiles && view.zoneTiles[key]));
      tile.classList.toggle('enemy-zone', !!(view.enemyZoneTiles && view.enemyZoneTiles[key]));
      tile.classList.toggle('danger', !!(view.dangerTiles && view.dangerTiles[key]));
      tile.classList.toggle('cursor', view.cursorKey === key);
    });
  }

  // 騎士の向きを選ぶ矢印：選んでいる部隊の上下左右の隣のマスに出す（マップの外の向きは出さない）。
  // choice が無ければ消す。choice: { x, y, current }
  var FACING_STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function drawFacingChoice(choice, onPick) {
    var old = elements.effects.querySelector('.facing-choice');
    if (old) old.remove();
    if (!choice) return;
    var layer = document.createElement('div');
    layer.className = 'facing-choice' + (choice.assist ? ' assist' : '');   // 案内のときは、矢印を大きく光らせる
    Object.keys(FACING_STEPS).forEach(function (facing) {
      var x = choice.x + FACING_STEPS[facing][0], y = choice.y + FACING_STEPS[facing][1];
      if (x < 0 || y < 0 || x >= boardSize.width || y >= boardSize.height) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'facing-arrow ' + facing + (facing === choice.current ? ' current' : '');
      button.setAttribute('aria-label', { up: '上', down: '下', left: '左', right: '右' }[facing] + 'を向く');
      button.style.setProperty('--ux', x);
      button.style.setProperty('--uy', y);
      button.onclick = function (event) { event.stopPropagation(); onPick(facing); };
      layer.appendChild(button);
    });
    elements.effects.appendChild(layer);
  }

  // 召喚：魔法陣が光り、呼んだ部隊が現れる（人数を出す。0人なら「召喚に失敗」）
  function animateSummon(state, event) {
    var circle = document.createElement('div');
    circle.className = 'summon-circle';
    circle.style.setProperty('--ux', event.x);
    circle.style.setProperty('--uy', event.y);
    elements.effects.appendChild(circle);
    SC.Sound.play('pray');
    return sleep(450).then(function () {
      if (event.soldiers > 0) {
        syncUnits(state, {});
        var element = unitElements[event.summonedId];
        if (element) restartAnimation(element, 'appear', 500);
        popupAt(event.x, event.y, '<span>' + SC.UNIT_TYPES[event.unitType].name + ' ' + event.soldiers + '人</span>', 'heal');
      } else {
        popupAt(event.x, event.y, '<span>召喚に失敗</span>', 'miss');
      }
      return sleep(650);
    }).then(function () { circle.remove(); });
  }

  // ランクアップ：部隊が光って現れる
  function animateRankUp(unitId) {
    var element = unitElements[unitId];
    if (element) { restartAnimation(element, 'appear', 500); restartAnimation(element, 'blessed', 900); }
  }

  // 増援で現れた部隊が、ふわっと現れる
  function animateArrivals(unitIds) {
    unitIds.forEach(function (unitId) {
      var element = unitElements[unitId];
      if (element) restartAnimation(element, 'appear', 500);
    });
  }

  // 城門の体力のゲージと、壊れた城門の絵を、今の盤面に合わせる
  function syncGates(state) {
    tileElements.forEach(function (tile) {
      var x = Number(tile.dataset.x), y = Number(tile.dataset.y);
      var terrainId = state.terrain[y][x];
      if (!tile.classList.contains('t-' + terrainId)) {
        // 地形が変わった（城門が壊れた）：マスの絵を入れかえる
        tile.className = tile.className.replace(/\bt-[a-zA-Z]+\b/, 't-' + terrainId);
        var gauge = tile.querySelector('.gate-hp');
        if (gauge) gauge.remove();
        var imagePath = getTerrainImagePath(terrainId, x, y);
        if (imagePath) { tile.classList.add('has-image'); tile.style.backgroundImage = 'url("' + imagePath + '")'; tile.innerHTML = ''; }
        else { tile.classList.remove('has-image'); tile.style.backgroundImage = ''; tile.innerHTML = TERRAIN_ART[terrainId] || ''; }
        tile.setAttribute('aria-label', SC.TERRAIN[terrainId].name);
      }
      var bar = tile.querySelector('.gate-hp i');
      var hp = state.gates && state.gates[x + ',' + y];
      if (bar && hp !== undefined) bar.style.width = Math.max(0, Math.round(hp / (state.gateHp || SC.GATE.hp) * 100)) + '%';
    });
  }

  function animateGate(state, event) {
    var tile = tileElements.filter(function (t) { return Number(t.dataset.x) === event.x && Number(t.dataset.y) === event.y; })[0];
    SC.Sound.play(event.broken ? 'crit' : 'hit');
    if (tile) restartAnimation(tile, 'gate-shake', 360);
    popupAt(event.x, event.y, '<small>城門</small><span>−' + event.damage + '</span>', event.broken ? 'crit' : 'enemy');
    return sleep(420).then(function () {
      syncGates(state);
      if (event.broken) popupAt(event.x, event.y, '<span>城門が壊れた！</span>', 'gold');
      return sleep(event.broken ? 700 : 250);
    });
  }

  function animateMove(unitId, to) {
    var element = unitElements[unitId];
    if (!element) return Promise.resolve();
    var shown = displayPos(to.x, to.y);
    if (Number(element.dataset.x) === shown.x && Number(element.dataset.y) === shown.y) return Promise.resolve();
    setPosition(element, to.x, to.y);
    return sleep(300);
  }

  function restartAnimation(element, className, duration) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    root.setTimeout(function () { element.classList.remove(className); }, duration);
  }

  // 攻撃の結果の文字。strike: { result, lost, misses }。倒れた人数を出し、誰も倒れなければ「けが」、外した兵士がいれば小さく添える
  function buildStrikePopupHtml(strike) {
    if (strike.result === 'miss') return '<span>ミス！</span>';
    return (strike.misses > 0 ? '<small>' + strike.misses + '人ミス</small>' : '') +
      '<span>' + (strike.lost > 0 ? '−' + strike.lost + '人' : 'けが') + '</span>';
  }

  function showPopup(x, y, event) {
    var popup = document.createElement('div');
    popup.className = 'popup' + (event.result === 'miss' ? ' miss' : '');
    popup.style.setProperty('--ux', x);
    popup.style.setProperty('--uy', y);
    popup.innerHTML = buildStrikePopupHtml(event);
    elements.effects.appendChild(popup);
    root.setTimeout(function () { popup.remove(); }, 800);
  }

  // 町の旗を、持ち主に合わせる（自軍は青、敵軍は赤、中立は旗なし）
  function syncOwners(state) {
    if (!state.owners) return;
    tileElements.forEach(function (tile) {
      var flag = tile.querySelector('.owner-flag');
      if (!flag) return;
      var owner = state.owners[tile.dataset.x + ',' + tile.dataset.y] || 'none';
      flag.className = 'owner-flag ' + owner;
    });
  }

  // マスの上に短い文字を出す（「占領！」「＋40G」など）
  function popupAt(x, y, html, className) {
    var popup = document.createElement('div');
    popup.className = 'popup ' + (className || '');
    popup.style.setProperty('--ux', x);
    popup.style.setProperty('--uy', y);
    popup.innerHTML = html;
    elements.effects.appendChild(popup);
    root.setTimeout(function () { popup.remove(); }, 900);
  }

  // 雇った部隊の演出：城に現れて、出て行くマスまで歩く
  function animateHire(state, event) {
    syncUnits(state, { selectedId: event.unitId, pending: event.from });   // まず城の上に出す
    var element = unitElements[event.unitId];
    if (element) restartAnimation(element, 'appear', 500);
    SC.Sound.play('hire');
    popupAt(event.from.x, event.from.y, '<span>' + SC.UNIT_TYPES[event.unitType].name + '</span>', 'heal');
    return sleep(450).then(function () {
      SC.Sound.play('move');
      return animateMove(event.unitId, { x: event.x, y: event.y });
    });
  }

  // 町を占領した演出：旗が変わり、「占領！」と出る
  // 町を占領した演出：町のマスで旗竿が伸びて、取った軍の旗が上がり、光が広がる。旗の色は、旗が上がりきってから変える
  function animateCapture(state, event) {
    var raise = document.createElement('div');
    raise.className = 'capture-raise ' + event.side;
    raise.style.setProperty('--ux', event.x);
    raise.style.setProperty('--uy', event.y);
    raise.innerHTML = '<i class="burst"></i><i class="pole"></i><i class="flag"></i>';
    elements.effects.appendChild(raise);
    SC.Sound.play('capture');
    return sleep(450).then(function () {
      syncOwners(state);
      popupAt(event.x, event.y, '<span>占領！</span>', 'capture ' + (event.side === 'player' ? 'heal' : 'enemy'));
      return sleep(450);
    }).then(function () { raise.remove(); });
  }

  // ターンの始めの演出：収入（王の上に「＋40G」）と、補充された部隊（「＋2人」）
  function animateTurnStart(state, events, unitTypeById) {
    var shown = false;
    var hazard = false;
    events.forEach(function (event) {
      if (event.type === 'income' && event.amount > 0) {
        var king = state.units.filter(function (u) { return u.side === event.side && SC.UNIT_TYPES[u.type].isKing; })[0];
        if (king) popupAt(king.x, king.y, '<span>＋' + event.amount + 'G</span>', 'gold');
        shown = true;
      }
      if (event.type === 'hazard') {   // 沼・藪のダメージ
        var hurt = unitElements[event.unitId];
        if (!hurt) return;
        setHp(hurt, unitTypeById[event.unitId], event.targetHp);
        restartAnimation(hurt, 'shake', 320);
        popupAt(Number(hurt.dataset.x), Number(hurt.dataset.y), '<small>' + SC.TERRAIN[event.terrainId].name + '</small><span>−' + event.damage + '</span>', 'hazard');
        hazard = true;
        shown = true;
      }
      if (event.type === 'resupply') {
        var element = unitElements[event.unitId];
        if (!element) return;
        setHp(element, unitTypeById[event.unitId], event.targetHp);
        popupAt(Number(element.dataset.x), Number(element.dataset.y), '<span>＋' + event.restored + '人</span>', 'heal');
        shown = true;
      }
    });
    if (!shown) return Promise.resolve();
    SC.Sound.play(hazard ? 'hit' : 'coin');
    return sleep(800);
  }

  // 祈りの演出：祈りを受けた部隊が光り、「＋3人」と出て、兵士の印が戻る
  function animatePrayer(event, targetTypeId) {
    var target = unitElements[event.targetId];
    if (!target) return Promise.resolve();
    SC.Sound.play('pray');
    restartAnimation(target, 'blessed', 700);
    var popup = document.createElement('div');
    popup.className = 'popup heal';
    popup.style.setProperty('--ux', Number(target.dataset.x));
    popup.style.setProperty('--uy', Number(target.dataset.y));
    popup.innerHTML = '<span>＋' + event.restored + '人</span>';
    elements.effects.appendChild(popup);
    root.setTimeout(function () { popup.remove(); }, 900);
    return sleep(250).then(function () {
      setHp(target, targetTypeId, event.targetHp);
      return sleep(650);
    });
  }

  // 1回の攻撃（または反撃）の演出
  function animateStrike(event, defenderTypeId) {
    var attacker = unitElements[event.attackerId];
    var defender = unitElements[event.defenderId];
    if (!attacker || !defender) return Promise.resolve();
    var dx = Number(defender.dataset.x) - Number(attacker.dataset.x);
    var dy = Number(defender.dataset.y) - Number(attacker.dataset.y);
    attacker.style.setProperty('--lx', Math.sign(dx) * 9 + 'px');
    attacker.style.setProperty('--ly', Math.sign(dy) * 9 + 'px');
    restartAnimation(attacker, 'lunge', 240);
    SC.Sound.play('swing');
    return sleep(130).then(function () {
      SC.Sound.playImpact(event.result, event.killed);
      showPopup(Number(defender.dataset.x), Number(defender.dataset.y), event);
      if (event.result !== 'miss') {
        restartAnimation(defender, 'shake', 320);
        setHp(defender, defenderTypeId, event.defenderHp);
      }
      if (event.killed) removeUnitElement(event.defenderId);
      return sleep(event.killed ? 620 : 520);
    });
  }

  function showBanner(text, side) {
    var banner = elements.banner;
    banner.className = side || '';
    banner.textContent = text;
    void banner.offsetWidth;
    return sleep(900).then(function () { banner.className = 'hidden'; });
  }

  SC.Render = {
    animateGate: animateGate,
    syncGates: syncGates,
    init: init,
    buildBoard: buildBoard,
    layout: layout,
    isScrollable: isScrollable,
    focusTiles: focusTiles,
    centerOn: centerOn,
    getViewRect: getViewRect,
    getTerrainImage: getTerrainImage,
    getBigBuilding: getBigBuilding,
    syncUnits: syncUnits,
    drawHighlights: drawHighlights,
    drawFacingChoice: drawFacingChoice,
    animateMove: animateMove,
    animateStrike: animateStrike,
    animatePrayer: animatePrayer,
    animateHire: animateHire,
    animateArrivals: animateArrivals,
    animateRankUp: animateRankUp,
    animateSummon: animateSummon,
    popupAt: popupAt,
    animateCapture: animateCapture,
    animateTurnStart: animateTurnStart,
    buildStrikePopupHtml: buildStrikePopupHtml,
    showBanner: showBanner,
    preloadImages: preloadImages,
    getUnitImagePath: getUnitImagePath,
    getPortraitPath: getPortraitPath,
    getRegularArtPath: getRegularArtPath,
    isImageLoaded: isImageLoaded,
    createUnitSvg: createUnitSvg,
    sleep: sleep
  };
})(typeof window !== 'undefined' ? window : globalThis);
