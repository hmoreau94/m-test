/**
 * m.js v2 — Adagio Client-Side Measurement Script
 * 
 * Lightweight signal collector running inside won ADMs (banner, inApp + web).
 * Reports timestamped client-side signals to /sig.gif.
 * 
 * Architecture:
 *   1. Extract auction context from URL fragment
 *   2. Detect environment: OMID → MRAID → DOM
 *   3. Attach signal listeners per tier (all signals per spec)
 *   4. Fire beacons on each meaningful state change
 * 
 * Constraints:
 *   - Base script < 2KB gzipped (OMID client loaded conditionally)
 *   - No external dependencies (except conditional OMID client)
 *   - No localStorage (runs inside ad iframe)
 *   - No Prebid.js coupling (context from URL fragment)
 *   - defer, non-blocking — must not delay ad rendering
 *   - Graceful degradation: if any tier fails, fall to the next
 *   - Global try/catch — NEVER crash the ad
 * 
 * Injection: <script defer src="https://c.4dex.tech/m.js#auction_id=...&bid_id=..."></script>
 * Placement: LAST in ADM, after all ad content and after AdLoox.
 */

(function() { try { // Global safety wrapper — silent fail on any uncaught error

  // ===========================================================================
  // 1. BOOTSTRAP — Timing reference + auction context
  // ===========================================================================

  var T0 = Date.now();

  // Context via URL fragment (same pattern as AdLoox tfav_adl_518.js#id1=...&id8=...)
  // Param names match imp.gif burl exactly for trivial BQ JOIN.
  // m.js#auction_id=X&bid_id=Y&pv_id=Z&org_id=1509&bidder=pubmatic&seat_id=6
  //      &mt=ban&pltfrm=app&site=com-nomonkeys-ballblast-android&adu_code=d7937eeb...
  var ctx = {};
  try {
    var src = (document.currentScript || {}).src || '';
    var hashIdx = src.indexOf('#');
    if (hashIdx !== -1) {
      src.substring(hashIdx + 1).split('&').forEach(function(pair) {
        var kv = pair.split('=');
        ctx[kv[0]] = decodeURIComponent(kv[1] || '');
      });
    }
  } catch(e) {}

  if (!ctx.auction_id || !ctx.bid_id) return;


  // ===========================================================================
  // 2. SIGNAL BUFFER + BEACON SENDER
  // ===========================================================================

  var signals = [];
  var DEBUG = true; // TEST BUILD — set false for prod
  function sig(name, value) {
    var v = value === undefined ? '' : String(value);
    var t = Date.now() - T0;
    signals.push([name, v, t]);
    if (DEBUG) {
      try {
        console.log('[m.js] ' + t + 'ms  ' + name + (v ? ' = ' + v : ''));
        _overlay(name, v, t);
      } catch(e) {}
    }
  }

  // On-screen overlay so events are visible even without Web Inspector
  var _ovEl = null;
  function _overlay(name, v, t) {
    try {
      if (!_ovEl) {
        _ovEl = document.createElement('div');
        _ovEl.style.cssText = 'position:fixed;left:0;bottom:0;z-index:2147483647;max-height:45%;overflow:auto;width:100%;background:rgba(0,0,0,.82);color:#0f0;font:10px/1.3 monospace;padding:4px;box-sizing:border-box;';
        (document.body || document.documentElement).appendChild(_ovEl);
      }
      var line = document.createElement('div');
      line.textContent = t + 'ms  ' + name + (v ? ' = ' + v : '');
      _ovEl.appendChild(line);
      _ovEl.scrollTop = _ovEl.scrollHeight;
    } catch(e) {}
  }

  var BEACON_URL = 'https://c.4dex.tech/sig.gif';
  var seqN = 0;

  function send() {
    if (!signals.length) return;
    var evts = signals.map(function(s) { return s.join(','); }).join('|');
    var url = BEACON_URL + '?' + [
      'v='          + encodeURIComponent(ctx.v || ''),          // script schema version
      'auction_id=' + encodeURIComponent(ctx.auction_id),
      'bid_id='     + encodeURIComponent(ctx.bid_id),
      'pv_id='      + encodeURIComponent(ctx.pv_id || ''),
      'org_id='     + encodeURIComponent(ctx.org_id || ''),
      'bidder='     + encodeURIComponent(ctx.bidder || ''),
      'seat_id='    + encodeURIComponent(ctx.seat_id || ''),
      'mt='         + encodeURIComponent(ctx.mt || ''),
      'pltfrm='     + encodeURIComponent(ctx.pltfrm || ''),
      'site='       + encodeURIComponent(ctx.site || ''),
      'adu_code='   + encodeURIComponent(ctx.adu_code || ''),
      'integ='      + encodeURIComponent(ctx.integ || ''),      // integration method: ortb/ob/pbjs/pbs
      'instl='      + encodeURIComponent(ctx.instl || ''),      // bid-request interstitial flag
      'decl_omid='  + encodeURIComponent(ctx.decl_omid || ''),  // bid-request declared OMID partner (source.omidpn)
      'seq='        + seqN++,
      'evts='       + encodeURIComponent(evts)
    ].join('&');
    signals = [];
    if (DEBUG) { try { console.log('[m.js] BEACON ' + url); } catch(e) {} }
    // Delivery cascade: sendBeacon → fetch+keepalive → Image pixel
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch(e) {}
    try { if (typeof fetch !== 'undefined') { fetch(url, {method:'GET',keepalive:true}); return; } } catch(e) {}
    new Image().src = url;
  }

  sig('load');


  // ===========================================================================
  // 3. ENVIRONMENT DETECTION — OMID → MRAID → DOM
  // ===========================================================================

  var env = 'dom', hasOMID = false, hasMRAID = false, mraidVer = null;

  // OMID: check for native bridge (Android/iOS) or JS service
  try {
    if (typeof window.omid3p !== 'undefined'
        || (window.webkit && window.webkit.messageHandlers
            && window.webkit.messageHandlers.omidBridge)
        || typeof window.omidBridge !== 'undefined') {
      hasOMID = true; env = 'omid';
    }
  } catch(e) {}

  // MRAID: detected if not already OMID
  // Note: OMID and MRAID can coexist. We prefer OMID for geometry but still
  // collect MRAID static signals (placementType, MRAID_ENV) when available.
  try {
    if (typeof window.mraid !== 'undefined') {
      hasMRAID = true;
      mraidVer = typeof mraid.getVersion === 'function' ? mraid.getVersion() : '2.0';
      if (!hasOMID) env = parseFloat(mraidVer) >= 3 ? 'mraid3' : 'mraid2';
    }
  } catch(e) {}

  sig('env', env);

  // --- Static signals (always available) ---
  try { sig('screen', screen.width + 'x' + screen.height); } catch(e) {}
  try {
    var adRect = document.body ? document.body.getBoundingClientRect() : null;
    if (adRect) sig('ad_size', Math.round(adRect.width) + 'x' + Math.round(adRect.height));
  } catch(e) {}
  try { if (navigator.webdriver) sig('webdriver', '1'); } catch(e) {}

  // --- Device fingerprint (cheap, strengthens bot detection + normalization) ---
  try { if (window.devicePixelRatio) sig('dpr', window.devicePixelRatio); } catch(e) {}
  try {
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && conn.effectiveType) sig('net', conn.effectiveType); // '4g', '3g', etc.
  } catch(e) {}
  try {
    // Touch capability — dominant input mode on inApp
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    sig('touch', touch ? '1' : '0');
  } catch(e) {}
  try { if (navigator.hardwareConcurrency) sig('cores', navigator.hardwareConcurrency); } catch(e) {}
  try { if (navigator.deviceMemory) sig('devmem', navigator.deviceMemory); } catch(e) {}

  send(); // First beacon: script loaded + env + static


  // ===========================================================================
  // 4. DOM TIER — Always active
  // ===========================================================================

  // --- 4a. IntersectionObserver ---
  var lastIO = null, adSizeRemeasured = false;
  try {
    if (typeof IntersectionObserver !== 'undefined') {
      var ioTarget = document.documentElement || document.body;
      new IntersectionObserver(function(entries) {
        var e = entries[entries.length - 1];
        var r = Math.round(e.intersectionRatio * 100) / 100;
        // Re-measure ad_size on first real callback (handles async ad rendering)
        if (!adSizeRemeasured && r > 0) {
          adSizeRemeasured = true;
          try {
            var rect = document.body.getBoundingClientRect();
            var sz = Math.round(rect.width) + 'x' + Math.round(rect.height);
            sig('ad_size_r', sz);
          } catch(ex) {}
        }
        if (lastIO === null || r !== lastIO) { sig('io', r); lastIO = r; send(); }
      }, { threshold: [0, 0.01, 0.5, 1.0] }).observe(ioTarget);
    } else {
      sig('io_fallback', '1');
    }
  } catch(e) { sig('io_err', (e.message || '').substring(0, 50)); }

  // --- 4b. Page Visibility + cumulative duration ---
  var visDur = 0, visStart = null;
  try {
    var isVis = document.visibilityState === 'visible';
    sig('vis', isVis ? '1' : '0');
    if (isVis) visStart = Date.now();
    document.addEventListener('visibilitychange', function() {
      var v = document.visibilityState === 'visible';
      sig('vis', v ? '1' : '0');
      if (v) { visStart = Date.now(); }
      else if (visStart) { visDur += Date.now() - visStart; visStart = null; }
      send();
    });
  } catch(e) {}

  // --- 4c. Focus / Blur ---
  try {
    window.addEventListener('focus', function() { sig('focus', '1'); send(); });
    window.addEventListener('blur', function() { sig('focus', '0'); send(); });
  } catch(e) {}

  // --- 4d. Click detection via blur + iframe overlap (from adagio.js) ---
  try {
    window.addEventListener('blur', function() {
      try {
        if (document.activeElement instanceof HTMLIFrameElement) {
          sig('click', '1'); send();
        }
      } catch(e) {}
    });
  } catch(e) {}

  // --- 4e. Mouse hover tracking (from adagio.js) ---
  var hovered = false;
  try {
    document.addEventListener('mouseover', function() {
      if (!hovered) { hovered = true; sig('hover', '1'); send(); }
    });
    document.addEventListener('mouseout', function() {
      if (hovered) { hovered = false; sig('hover', '0'); send(); }
    });
  } catch(e) {}

  // --- 4f. Touch interaction (dominant input on inApp; distinct from mouse hover) ---
  var touched = false;
  try {
    document.addEventListener('touchstart', function() {
      if (!touched) { touched = true; sig('touch_int', '1'); send(); }
    }, { passive: true });
  } catch(e) {}


  // ===========================================================================
  // 5. MRAID TIER — Collect ALL available signals per spec version
  // ===========================================================================

  if (hasMRAID) { try {
    sig('mraid_ver', mraidVer);

    // --- Static signals (MRAID 2.0+) ---
    try { sig('mraid_plcmt', mraid.getPlacementType()); } catch(e) {}
    try { sig('mraid_state', mraid.getState()); } catch(e) {}
    try {
      var maxSz = mraid.getMaxSize();
      sig('mraid_maxsz', maxSz.width + 'x' + maxSz.height);
    } catch(e) {}
    try {
      var pos = mraid.getCurrentPosition();
      sig('mraid_pos', pos.x + ',' + pos.y + ',' + pos.width + ',' + pos.height);
    } catch(e) {}
    try {
      var scr = mraid.getScreenSize();
      sig('mraid_scr', scr.width + 'x' + scr.height);
    } catch(e) {}

    // Feature detection
    var feats = [];
    ['sms','tel','calendar','storePicture','inlineVideo','location',
     'vpaid','extendedModule'].forEach(function(f) {
      try { if (mraid.supports(f)) feats.push(f); } catch(e) {}
    });
    if (feats.length) sig('mraid_feat', feats.join(','));

    // --- MRAID 3.0+ static signals ---
    if (parseFloat(mraidVer) >= 3) {
      // MRAID_ENV object — SDK identification (MRAID 3.0 spec)
      try {
        var menv = window.MRAID_ENV;
        if (menv) {
          sig('mraid_sdk', (menv.sdk || '') + '/' + (menv.sdkVersion || ''));
          sig('mraid_appid', menv.appId || '');
          // Skip ifa/limitAdTracking — already in bid request, privacy concern
        }
      } catch(e) {}

      // Device orientation
      try {
        var orient = mraid.getCurrentAppOrientation();
        sig('mraid_orient', orient.orientation + (orient.locked ? ',locked' : ''));
      } catch(e) {}
    }

    // --- Event listeners (depend on ready state) ---
    function onMraidReady() {
      // stateChange — track expansions (MRAID 2.0+)
      try {
        mraid.addEventListener('stateChange', function(state) {
          sig('mraid_st_chg', state); send();
        });
      } catch(e) {}

      if (parseFloat(mraidVer) >= 3) {
        // MRAID 3.0: exposureChange (continuous %)
        try {
          mraid.addEventListener('exposureChange', function(pct, visRect, occRects) {
            sig('expo', Math.round(pct * 100) / 100
              + ',' + (occRects && occRects.length ? occRects.length : '0'));
            send();
          });
        } catch(e) {}

        // MRAID 3.0: audioVolumeChange
        try {
          mraid.addEventListener('audioVolumeChange', function(pct) {
            sig('mraid_vol', Math.round(pct * 100)); send();
          });
        } catch(e) {}
      } else {
        // MRAID 2.0: binary isViewable
        try {
          sig('mraid_vis', mraid.isViewable() ? '1' : '0');
          mraid.addEventListener('viewableChange', function(v) {
            sig('mraid_vis', v ? '1' : '0'); send();
          });
        } catch(e) {}
      }
    }

    // Handle ALL MRAID states — not just 'loading'
    var mState = mraid.getState();
    if (mState === 'loading') {
      mraid.addEventListener('ready', onMraidReady);
    } else {
      // 'default', 'expanded', 'resized', 'hidden' — all mean ready
      onMraidReady();
    }
  } catch(e) { sig('mraid_err', (e.message || '').substring(0, 50)); } }


  // ===========================================================================
  // 6. OMID TIER — Conditional client loading, ALL lifecycle events
  // ===========================================================================

  if (hasOMID) { try {
    var omidS = document.createElement('script');
    omidS.src = 'https://c.4dex.tech/omid-client.js';
    omidS.onload = initOMID;
    omidS.onerror = function() { sig('omid_err', 'load_failed'); send(); };
    document.head.appendChild(omidS);
  } catch(e) { sig('omid_err', (e.message || '').substring(0, 50)); send(); } }

  function initOMID() { try {
    var OVC = window.OmidVerificationClient;
    if (!OVC) { sig('omid_err', 'no_client'); send(); return; }

    var client = new OVC('adagio.io-omid');
    var lastGeoSample = 0;

    // --- Session observer: ALL lifecycle events ---
    client.registerSessionObserver(function(event) {
      var type = event.type, data = event.data || {};

      if (type === 'sessionStart') {
        var c = data.context || {};
        sig('omid_partner', (c.partnerName || '') + '/' + (c.partnerVersion || ''));
        sig('omid_env', c.environment || '');
        sig('omid_supports', JSON.stringify(c.supports || ''));
        // Session quality/type — needed to interpret the geometry signals correctly
        if (c.accessMode) sig('omid_access', c.accessMode);       // 'full' / 'limited' / 'domain'
        if (c.adSessionType) sig('omid_sess_type', c.adSessionType); // 'html' / 'native'
        send();
      }
      else if (type === 'impression') {
        // CRITICAL: this is when the OMID ecosystem considers the impression occurred
        // Direct comparison point against our imp.gif pixel timestamp
        sig('omid_imp', '1');
        send();
      }
      else if (type === 'loaded') {
        // Creative loaded — the "render" moment from OMID's perspective
        sig('omid_loaded', data.skippable ? 'skippable' : '1');
        send();
      }
      else if (type === 'sessionFinish') {
        sig('omid_finish', '1');
        send();
      }
      else if (type === 'sessionError') {
        sig('omid_sess_err', (data.message || '').substring(0, 50));
        send();
      }
    }, 'adagio.io-omid');

    // --- Geometry change: full signal extraction ---
    client.addEventListener('geometryChange', function(event) {
      var now = Date.now();
      if (now - lastGeoSample < 200) return; // Throttle 200ms
      lastGeoSample = now;

      var view = (event.data || {}).adView;
      if (!view) return;

      // percentageInView: 0-100
      if (view.percentageInView !== undefined) {
        sig('piv', Math.round(view.percentageInView));
      }

      // On-screen geometry (visible rectangle)
      var osg = view.onScreenGeometry;
      if (osg) {
        sig('piv_rect',
          Math.round(osg.x) + ',' + Math.round(osg.y) + ',' +
          Math.round(osg.width) + ',' + Math.round(osg.height));
      }

      // Container geometry
      var cg = view.containerGeometry;
      if (cg) {
        sig('container_geo',
          Math.round(cg.x) + ',' + Math.round(cg.y) + ',' +
          Math.round(cg.width) + ',' + Math.round(cg.height));
      }

      // Obstructions: count + approximate coverage
      var obs = view.friendlyObstructions || view.obstructions || [];
      if (obs.length > 0) {
        sig('obstruct', obs.length);
        // Compute approximate obstruction area as % of ad area
        // NOTE: approximate — overlapping obstruction rects can double-count
        var adArea = (osg ? osg.width * osg.height : 0) || 1;
        var obsArea = 0;
        obs.forEach(function(o) { obsArea += (o.width || 0) * (o.height || 0); });
        sig('obstruct_pct', Math.round(obsArea / adArea * 100));
      }

      // Non-viewability reason (why the ad isn't fully in view) — distinguishes
      // 'scrolled away' from 'covered by another element'
      if (view.reasons && view.reasons.length) {
        sig('geo_reasons', view.reasons.join('+'));
      }
      // Quality flag: is geometry measured against the actual ad element?
      if (view.measuringElement !== undefined) {
        sig('geo_measured', view.measuringElement ? '1' : '0');
      }

      send();
    });

    sig('omid_init', '1');
    send();
  } catch(e) { sig('omid_err', (e.message || '').substring(0, 50)); send(); } }


  // ===========================================================================
  // 7. UNLOAD — Final beacon with accumulated metrics
  // ===========================================================================

  var finalSent = false;
  function onFinal(reason) {
    if (finalSent) return;
    finalSent = true;
    // Cumulative visible duration
    var totalVisDur = visDur + (visStart ? Date.now() - visStart : 0);
    sig('vis_dur', totalVisDur);
    sig('end', reason);
    send();
  }

  try {
    window.addEventListener('pagehide', function() { onFinal('pagehide'); });
    window.addEventListener('beforeunload', function() { onFinal('unload'); });
  } catch(e) {}

} catch(e) {} })(); // Close global safety wrapper
