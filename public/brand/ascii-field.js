/* Altana ASCII field, animated.
   The living form of the brand element. The still fields in this folder
   (el-ascii-*.svg) are snapshots of the same wash; this paints it procedurally
   on a canvas: transparent ground, density falls off to nothing, one hot core
   that wanders the surface, leans toward the cursor and blooms on click.

   This is the reference build of the motion. altana.network paints its hero
   with it (lib/asciiField.ts) and the desktop app paints every screen with it
   (src/renderer/lib/asciiField.ts). The three copies are kept in step by hand,
   so if this file changes, port the change to both.

   Measured from the brand export, so the look is the element and not an
   approximation:
     ramp (sparse to dense)  . : - = + * o c z s Z # % @
     outer   #7090dd  drifting to  #4973e2   (Altana Blue family)
     inner   #f2cb45  (Signal Yellow)
     core    #e2622e  (Ember Orange)
   Cell counts across those bands land near the kit's 6 : 1.4 : 1 weighting.

   Glyphs sit on a lattice we position ourselves, one character centred per
   cell, so no monospace font is needed and the type is Inter Tight like
   everything else.

   Usage
     <div class="host" style="position:relative"><canvas></canvas></div>
     <script src="brand-elements/ascii-field.js"></script>
     <script>
       const field = AltanaAsciiField.start(canvas, { variant: 'cover' })
       field.setVariant('ambient')   // re-weights the same field, no restart
       field.destroy()
     </script>
   The canvas fills its parent box. Honors prefers-reduced-motion (one held
   frame), pauses when the tab is hidden, and never draws over the parent. */

(function (global) {
  'use strict'

  var RAMP = ['.', ':', '-', '=', '+', '*', 'o', 'c', 'z', 's', 'Z', '#', '%', '@']

  var BLUE_FAR = [0x70, 0x90, 0xdd]
  var BLUE_NEAR = [0x49, 0x73, 0xe2]
  var YELLOW = '#f2cb45'
  var ORANGE = '#e2622e'

  /* Index 0-8 blue, 9-10 yellow, 11-13 orange. */
  var COLORS = RAMP.map(function (_, i) {
    if (i >= 11) return ORANGE
    if (i >= 9) return YELLOW
    var k = i / 8
    var mix = function (from, to) { return Math.round(from + (to - from) * k) }
    return 'rgb(' + mix(BLUE_FAR[0], BLUE_NEAR[0]) + ',' + mix(BLUE_FAR[1], BLUE_NEAR[1]) + ',' + mix(BLUE_FAR[2], BLUE_NEAR[2]) + ')'
  })

  /* Cell metrics at scale 1, matching the export's 11 x 18 grid at 16px. */
  var CELL_W = 11
  var CELL_H = 18
  var FONT_PX = 16

  /* scale     grid scale; smaller cells read as finer texture
     opacity   layer alpha
     reach     bloom reach, relative to the surface diagonal
     falloff   steepness; higher keeps the hot core small and the edge quiet
     roam      how far the core wanders from centre, fraction of the surface
     ground    strength of the sparse texture over the rest of the surface
     drift     how far the wash drifts, and how often a cell steps a level
     flicker   share of cells one level off per step
     pointer   how completely the core commits to the cursor */
  var VARIANTS = {
    /* Cover: the bloom is a full partner to the lockup. Hero surfaces. */
    cover: { scale: 1, opacity: 0.5, reach: 0.23, falloff: 1.45, roam: 0.34, ground: 0.34, drift: 1, flicker: 0.02, pointer: 1 },
    /* Onboard: present, but forms stay the subject. */
    onboard: { scale: 1, opacity: 0.3, reach: 0.21, falloff: 1.55, roam: 0.32, ground: 0.28, drift: 0.8, flicker: 0.015, pointer: 0.9 },
    /* Ambient: texture in the ground behind a working app. The core only leans
       toward the cursor here, it does not chase it. */
    ambient: { scale: 0.85, opacity: 0.18, reach: 0.18, falloff: 1.65, roam: 0.3, ground: 0.2, drift: 0.6, flicker: 0.01, pointer: 0.45 }
  }

  /* Cheap deterministic hash. Stable per cell, so the field never boils. */
  function hash2(x, y) {
    var h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }

  function valueNoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y)
    var xf = x - xi, yf = y - yi
    var u = xf * xf * (3 - 2 * xf)
    var v = yf * yf * (3 - 2 * yf)
    var a = hash2(xi, yi), b = hash2(xi + 1, yi)
    var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
  }

  function fbm(x, y) {
    return valueNoise(x, y) * 0.6 + valueNoise(x * 2.1 + 19, y * 2.1 - 7) * 0.3 + valueNoise(x * 4.3 - 5, y * 4.3 + 11) * 0.1
  }

  var PULSE_LIFE = 3.4
  var MAX_PULSES = 5
  /* Glyphs on a lattice read better stepping like a terminal than sliding at
     display rate, and at ~18fps this costs a third of the work. */
  var FRAME_MS = 55

  /* Pure: resolve one frame of the field to glyph positions bucketed by ramp
     level. `state` carries the moving parts (core, pointer, pulses) and is
     advanced in place. Kept separate from painting so it can be tested and
     so the same composition can drive any renderer. */
  function compose(state, cfg, width, height, timeMs, buckets) {
    var t = timeMs / 1000
    var cw = CELL_W * cfg.scale
    var chh = CELL_H * cfg.scale
    var cols = Math.ceil(width / cw) + 1
    var rows = Math.ceil(height / chh) + 1
    var reach = Math.hypot(width, height) * cfg.reach

    /* The core wanders the whole surface on two slow, incommensurate pairs, so
       the path never repeats and never settles into a corner. Full circuit is
       on the order of minutes: it should read as drift, not motion. */
    var wanderX = width * (0.5 + cfg.roam * (0.76 * Math.sin(t * 0.041) + 0.3 * Math.sin(t * 0.0117 + 2.1)))
    var wanderY = height * (0.5 + cfg.roam * (0.72 * Math.cos(t * 0.031) + 0.3 * Math.sin(t * 0.0173 + 0.7)))

    state.pointerPull += (state.pointerWanted * cfg.pointer - state.pointerPull) * 0.04
    var targetX = wanderX + (state.pointerX - wanderX) * state.pointerPull
    var targetY = wanderY + (state.pointerY - wanderY) * state.pointerPull

    if (state.coreX < 0) {
      state.coreX = targetX
      state.coreY = targetY
    } else {
      /* Trails the target by about a second. Following exactly would read as
         a cursor effect; lagging reads as something choosing to come over. */
      state.coreX += (targetX - state.coreX) * 0.06
      state.coreY += (targetY - state.coreY) * 0.06
    }

    /* Retire spent click blooms, then resolve live ones for this frame. */
    var live = []
    for (var i = state.pulses.length - 1; i >= 0; i--) {
      var p = state.pulses[i]
      var age = (t - p.born) / PULSE_LIFE
      if (age < 0 || age >= 1) { state.pulses.splice(i, 1); continue }
      live.push({ x: p.x, y: p.y, r: reach * (0.3 + 0.95 * (1 - Math.pow(1 - age, 2.4))), amp: Math.pow(1 - age, 1.5) })
    }

    var breath = 1 + Math.sin(t * 0.42) * 0.045 + Math.sin(t * 0.271 + 1.7) * 0.03
    var sweepPhase = t * 0.22 * cfg.drift
    var driftX = t * 0.035 * cfg.drift
    var driftY = -t * 0.022 * cfg.drift
    var step = Math.floor(t * 11)

    for (var b = 0; b < buckets.length; b++) buckets[b].length = 0

    for (var row = 0; row < rows; row++) {
      var y = row * chh + chh * 0.5
      var dy = (y - state.coreY) / reach
      for (var col = 0; col < cols; col++) {
        var x = col * cw + cw * 0.5
        var dx = (x - state.coreX) / reach
        var d = Math.sqrt(dx * dx + dy * dy) * breath

        /* The ground: a drifting sparse texture, noise-gated so it clusters
           and thins instead of tiling as an even screen of dots. */
        var cloud = fbm(col * 0.055 + driftX, row * 0.055 + driftY)
        var v = Math.max(0, cloud - 0.46) * cfg.ground

        /* The bloom. Noise only shapes the edge, scaled by distance, so the
           core always reaches the top of the ramp. */
        if (d < 1) v += Math.pow(1 - d, cfg.falloff) * (1 - d * (1 - cloud) * 0.85)

        for (var k = 0; k < live.length; k++) {
          var q = live[k]
          var px = (x - q.x) / q.r, py = (y - q.y) / q.r
          var pd2 = px * px + py * py
          if (pd2 >= 1) continue
          var pd = Math.sqrt(pd2)
          v += Math.pow(1 - pd, cfg.falloff) * (1 - pd * (1 - cloud) * 0.85) * q.amp
        }
        /* A slow diagonal pass: something moving through the field. */
        v += Math.sin(col * 0.05 + row * 0.03 - sweepPhase * Math.PI) * 0.04

        if (v <= 0) continue

        var idx = Math.floor(v * RAMP.length)
        if (hash2(col * 7 + step, row * 13 - step) < cfg.flicker) idx += 1
        if (idx < 0) idx = 0
        if (idx >= RAMP.length) idx = RAMP.length - 1
        buckets[idx].push(x, y)
      }
    }
    return { cols: cols, rows: rows, cellW: cw, cellH: chh }
  }

  function newState() {
    return { coreX: -1, coreY: -1, pointerX: 0, pointerY: 0, pointerPull: 0, pointerWanted: 0, pulses: [] }
  }

  function start(canvas, opts) {
    opts = opts || {}
    var variant = VARIANTS[opts.variant] ? opts.variant : 'cover'
    var noop = { setVariant: function () {}, drawAt: function () {}, destroy: function () {} }
    var ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return noop

    var width = 0, height = 0, raf = 0, stopped = false, running = false, lastT = 0
    var state = newState()
    var buckets = RAMP.map(function () { return [] })

    var motionQuery = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null
    var reduced = motionQuery ? motionQuery.matches : false

    function resize() {
      var parent = canvas.parentElement
      var rect = parent ? parent.getBoundingClientRect() : { width: 0, height: 0 }
      var dpr = Math.min(global.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw(timeMs) {
      lastT = timeMs
      var cfg = VARIANTS[variant]
      compose(state, cfg, width, height, timeMs, buckets)

      ctx.clearRect(0, 0, width, height)
      ctx.globalAlpha = cfg.opacity
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = Math.round(FONT_PX * cfg.scale) + 'px "Inter Tight", system-ui, sans-serif'
      for (var i = 0; i < buckets.length; i++) {
        var cells = buckets[i]
        if (!cells.length) continue
        ctx.fillStyle = COLORS[i]
        for (var k = 0; k < cells.length; k += 2) ctx.fillText(RAMP[i], cells[k], cells[k + 1])
      }
      ctx.globalAlpha = 1
    }

    var last = -Infinity
    function frame(now) {
      if (stopped) return
      raf = global.requestAnimationFrame(frame)
      if (now - last < FRAME_MS) return
      last = now
      draw(Math.round(now / FRAME_MS) * FRAME_MS)
    }

    function begin() {
      global.cancelAnimationFrame(raf)
      if (reduced || (global.document && global.document.hidden)) {
        running = false
        draw(lastT)
        return
      }
      running = true
      last = -Infinity
      raf = global.requestAnimationFrame(frame)
    }

    /* Pointer is read off the window and scoped to the canvas's own box, so
       the core answers the cursor while it is over the field and returns to
       wandering once it leaves. The box is cached; pointermove fires at
       pointer rate and getBoundingClientRect forces layout. */
    var box = null
    function boxNow() { return box || (box = canvas.getBoundingClientRect()) }
    function invalidateBox() { box = null }
    function localFromEvent(e) {
      var b = boxNow()
      if (b.width === 0 || b.height === 0) return null
      var x = e.clientX - b.left, y = e.clientY - b.top
      if (x < 0 || y < 0 || x > b.width || y > b.height) return null
      return { x: x, y: y }
    }
    function onPointerMove(e) {
      var p = localFromEvent(e)
      if (!p) { state.pointerWanted = 0; return }
      state.pointerX = p.x
      state.pointerY = p.y
      state.pointerWanted = 1
    }
    function onPointerGone() { state.pointerWanted = 0 }
    /* Strike a bloom where the field is clicked. Skipped under reduced motion:
       a pulse that cannot animate would just be a blot on the page. */
    function onPointerDown(e) {
      if (reduced) return
      var p = localFromEvent(e)
      if (!p) return
      state.pointerX = p.x
      state.pointerY = p.y
      state.pointerWanted = 1
      state.pulses.push({ x: p.x, y: p.y, born: lastT / 1000 })
      if (state.pulses.length > MAX_PULSES) state.pulses.shift()
    }
    function onResize() {
      invalidateBox()
      resize()
      if (!running) draw(lastT)
    }
    function onMotionChange(e) { reduced = e.matches; begin() }
    function onVisibility() { begin() }

    var observer = global.ResizeObserver ? new global.ResizeObserver(onResize) : null
    if (observer && canvas.parentElement) observer.observe(canvas.parentElement)
    if (motionQuery) motionQuery.addEventListener('change', onMotionChange)
    global.document.addEventListener('visibilitychange', onVisibility)
    global.addEventListener('pointermove', onPointerMove, { passive: true })
    global.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true })
    global.document.addEventListener('pointerleave', onPointerGone)
    global.addEventListener('blur', onPointerGone)
    global.addEventListener('scroll', invalidateBox, { passive: true })

    resize()
    begin()

    return {
      setVariant: function (next) {
        if (!VARIANTS[next] || next === variant) return
        variant = next
        if (!running) draw(lastT)
      },
      /* Paint one frame at an explicit phase, in ms. Repeated calls at the same
         phase settle the core there. For inspecting a composition. */
      drawAt: draw,
      destroy: function () {
        stopped = true
        running = false
        global.cancelAnimationFrame(raf)
        if (observer) observer.disconnect()
        if (motionQuery) motionQuery.removeEventListener('change', onMotionChange)
        global.document.removeEventListener('visibilitychange', onVisibility)
        global.removeEventListener('pointermove', onPointerMove)
        global.removeEventListener('pointerdown', onPointerDown, { capture: true })
        global.document.removeEventListener('pointerleave', onPointerGone)
        global.removeEventListener('blur', onPointerGone)
        global.removeEventListener('scroll', invalidateBox)
      }
    }
  }

  var api = {
    start: start,
    compose: compose,
    newState: newState,
    hash2: hash2,
    RAMP: RAMP,
    COLORS: COLORS,
    VARIANTS: VARIANTS,
    CELL_W: CELL_W,
    CELL_H: CELL_H,
    FONT_PX: FONT_PX,
    FRAME_MS: FRAME_MS
  }

  global.AltanaAsciiField = api
  if (typeof module !== 'undefined' && module.exports) module.exports = api
})(typeof window !== 'undefined' ? window : globalThis)
