// 全体の図：画面より大きいマップの全体を縮めて見せる。見るためだけの図で、押した場所へマップが動いて閉じる。
// 地形、町の旗（青・赤・旗なし）、部隊の位置（自軍は青の丸、敵軍は赤の四角、王は金のふち）、いま見えている範囲の枠を描く。
// 2×2の建物は大きな絵、城門はだいだいの枠、指揮官は金の旗で目立たせる（2026-10-22）。
(function (root) {
  var SC = (root.SC = root.SC || {});
  var TERRAIN_COLORS = { plain: '#6da55a', forest: '#2f6b34', lake: '#3f7fc4', town: '#b58b5a', castle: '#8d8674', fort: '#a0a0aa', swamp: '#5b6640', bramble: '#7d9a4a', graveyard: '#6b6f78', cathedral: '#c9c3d6', wall: '#7d786c' };
  var SIDE_COLORS = { player: '#3d7ef0', enemy: '#e0453a' };

  // options: { state, viewRect, onPick(x, y), onClose }
  function open(options) {
    var state = options.state;
    var panel = document.getElementById('overview');
    var maxWidth = Math.min(root.innerWidth, 420) - 52;
    var maxHeight = root.innerHeight * 0.62;
    var cell = Math.max(8, Math.floor(Math.min(maxWidth / state.width, maxHeight / state.height)));
    var hasCommander = state.units.some(function (unit) { return unit.commander; });
    var hasGate = state.terrain.some(function (row) { return row.indexOf('gate') >= 0; });
    panel.innerHTML =
      '<div id="overview-box" role="dialog" aria-label="全体の図">' +
        '<h2>全体の図</h2>' +
        '<canvas id="overview-canvas"></canvas>' +
        '<div class="overview-legend"><span><i class="player"></i>自軍</span><span><i class="enemy"></i>敵軍</span>' +
          '<span><i class="king"></i>王</span>' +
          (hasCommander ? '<span><i class="commander"></i>指揮官</span>' : '') +
          (hasGate ? '<span><i class="gate"></i>城門</span>' : '') +
          '<span><i class="view"></i>いま見えている所</span></div>' +
        '<p class="overview-note">見たい場所を押すと、そこへ移動します</p>' +
        '<button type="button" class="button" id="overview-close">閉じる</button>' +
      '</div>';
    panel.classList.remove('hidden');
    var canvas = document.getElementById('overview-canvas');
    draw(canvas, state, options.viewRect, cell);

    function close() {
      panel.classList.add('hidden');
      panel.innerHTML = '';
      panel.onclick = null;
      if (options.onClose) options.onClose();
    }
    canvas.onclick = function (event) {
      event.stopPropagation();
      var rect = canvas.getBoundingClientRect();
      var x = Math.floor((event.clientX - rect.left) / rect.width * state.width);
      var y = Math.floor((event.clientY - rect.top) / rect.height * state.height);
      close();
      options.onPick(Math.max(0, Math.min(state.width - 1, x)), Math.max(0, Math.min(state.height - 1, y)));
    };
    document.getElementById('overview-close').onclick = function (event) { event.stopPropagation(); close(); };
    // 図の外（暗いところ）を押しても閉じる
    panel.onclick = function (event) { if (event.target === panel) close(); };
  }

  function draw(canvas, state, viewRect, cell) {
    var ratio = root.devicePixelRatio || 1;
    canvas.width = state.width * cell * ratio;
    canvas.height = state.height * cell * ratio;
    canvas.style.width = state.width * cell + 'px';
    canvas.style.height = state.height * cell + 'px';
    var context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.imageSmoothingEnabled = false;

    var bigs = [];   // 2×2の建物（あとで大きな絵を重ねる）
    for (var y = 0; y < state.height; y++) {
      for (var x = 0; x < state.width; x++) {
        var terrainId = state.terrain[y][x];
        var big = SC.Render.getBigBuilding(state, x, y);
        if (big && big.block.x === x && big.block.y === y) bigs.push(big);
        var image = SC.Render.getTerrainImage(big ? 'plain' : terrainId, x, y);
        if (image) context.drawImage(image, x * cell, y * cell, cell, cell);
        else { context.fillStyle = TERRAIN_COLORS[terrainId] || '#666'; context.fillRect(x * cell, y * cell, cell, cell); }
        var owner = state.owners && state.owners[x + ',' + y];
        if ((SC.terrainKind(terrainId) === 'town' || SC.terrainKind(terrainId) === 'fort') && owner) drawFlag(context, x, y, cell, SIDE_COLORS[owner]);
      }
    }
    bigs.forEach(function (big) { context.drawImage(big.image, big.block.x * cell, big.block.y * cell, cell * 2, cell * 2); });
    // 城門：だいだいの枠
    context.strokeStyle = '#ff9d2e';
    context.lineWidth = Math.max(2, cell * 0.14);
    for (var gyy = 0; gyy < state.height; gyy++) {
      for (var gxx = 0; gxx < state.width; gxx++) {
        if (state.terrain[gyy][gxx] === 'gate') context.strokeRect(gxx * cell + 1.5, gyy * cell + 1.5, cell - 3, cell - 3);
      }
    }
    // マスの境目をうっすら
    context.strokeStyle = 'rgba(0,0,0,.18)';
    context.lineWidth = 1;
    for (var gx = 1; gx < state.width; gx++) line(context, gx * cell, 0, gx * cell, state.height * cell);
    for (var gy = 1; gy < state.height; gy++) line(context, 0, gy * cell, state.width * cell, gy * cell);

    state.units.forEach(function (unit) { drawUnit(context, state, unit, cell); });

    if (viewRect) {
      context.strokeStyle = '#fff';
      context.lineWidth = 2;
      context.shadowColor = 'rgba(0,0,0,.8)';
      context.shadowBlur = 3;
      var left = Math.max(0, viewRect.x), top = Math.max(0, viewRect.y);
      var right = Math.min(state.width, viewRect.x + viewRect.width), bottom = Math.min(state.height, viewRect.y + viewRect.height);
      context.strokeRect(left * cell + 1, top * cell + 1, (right - left) * cell - 2, (bottom - top) * cell - 2);
      context.shadowBlur = 0;
    }
  }

  function line(context, x1, y1, x2, y2) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  // 町の持ち主の小さな旗（マスの右上）
  function drawFlag(context, x, y, cell, color) {
    var left = x * cell + cell * 0.55, top = y * cell + cell * 0.08;
    context.fillStyle = '#2a1d10';
    context.fillRect(left, top, Math.max(1, cell * 0.07), cell * 0.5);
    context.fillStyle = color;
    context.fillRect(left + cell * 0.07, top, cell * 0.32, cell * 0.22);
  }

  function drawUnit(context, state, unit, cell) {
    var block = state.blockOf && state.blockOf[unit.x + ',' + unit.y];   // 2×2の建物の中の部隊は、建物のまん中に描く（マップと同じ）
    var cx = (block ? block.x + 1 : unit.x + 0.5) * cell, cy = (block ? block.y + 1 : unit.y + 0.5) * cell;
    var size = cell * 0.34;
    var isKing = SC.UNIT_TYPES[unit.type].isKing;
    context.globalAlpha = unit.acted && unit.side === 'player' ? 0.6 : 1;
    context.fillStyle = SIDE_COLORS[unit.side];
    context.beginPath();
    if (unit.side === 'player') context.arc(cx, cy, size, 0, Math.PI * 2);
    else context.rect(cx - size, cy - size, size * 2, size * 2);
    context.fill();
    context.lineWidth = isKing ? Math.max(2, cell * 0.12) : 1.5;
    context.strokeStyle = isKing ? '#ffd75a' : '#fff';
    context.stroke();
    if (unit.commander) {   // 指揮官：右上に金の旗
      var poleX = cx + size * 0.55, poleTop = cy - size * 1.55;
      context.fillStyle = '#2a1d10';
      context.fillRect(poleX, poleTop, Math.max(1.5, cell * 0.08), size * 1.4);
      context.fillStyle = '#ffd75a';
      context.beginPath();
      context.moveTo(poleX + cell * 0.08, poleTop);
      context.lineTo(poleX + cell * 0.08 + size * 1.1, poleTop + size * 0.35);
      context.lineTo(poleX + cell * 0.08, poleTop + size * 0.7);
      context.closePath();
      context.fill();
      context.strokeStyle = '#3a2a00';
      context.lineWidth = 1;
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  SC.Overview = { open: open };
})(typeof window !== 'undefined' ? window : globalThis);
