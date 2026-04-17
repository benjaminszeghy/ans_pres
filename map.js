(function () {
  "use strict";

  if (window.__ansPresMapInit) {
    console.warn("[map.js] already initialized; skipping duplicate load");
    return;
  }
  window.__ansPresMapInit = true;

  console.log("[map.js] loaded");

  // ── Per-slide configuration ────────────────────────────────────────
  var configs = {
    fig2: {
      center: "3.979,53.333",
      scale: 147914381,
      legendSrc: "conventions.svg",
      layers: {
        show: ["active_reactors_5", "reactor_buffer_updated_3_small scale", "convention_borders_3", "Conventions"],
        hide: ["update_3__web_WTL1", "buffers for population count"]
      }
    },
    fig3: {
      center: "20.0,35.0",
      scale: 80000000,
      legendSrc: "population.svg",
      layers: {
        show: ["reactor_buffer_updated_3_small scale", "update_3__web_WTL1"],
        hide: ["active_reactors_5", "convention_borders_3", "Conventions", "buffers for population count"]
      }
    }
  };

  // ── Inject map panel ───────────────────────────────────────────────
  var panel = document.getElementById("map-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "map-panel";
    panel.innerHTML =
      "<arcgis-embedded-map" +
      "  id=\"arcgis-map\"" +
      "  item-id=\"bdc3afc9d3a44e6f8839d814c9d0ab18\"" +
      "  portal-url=\"https://cal.maps.arcgis.com\"" +
      "  theme=\"light\"" +
      "  scroll-enabled" +
      "  center=\"3.979,53.333\"" +
      "  scale=\"147914381\"" +
      "></arcgis-embedded-map>" +
      "<div id=\"legend-panel\">" +
      "  <img id=\"legend-svg\" src=\"conventions.svg\" alt=\"Map legend\" />" +
      "</div>";
    document.body.appendChild(panel);
  }

  var mapEl      = null;
  var legendEl    = null;
  var webMapReady = false;
  var pendingCfg  = null;

  function setLegendSrc(src) {
    if (!legendEl || !src) return;
    legendEl.setAttribute("src", src);
  }

  function normalizeKey(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function gatherLayersFromCollection(collection, target) {
    if (!collection || typeof collection.forEach !== "function") return;
    collection.forEach(function (layer) {
      target.push(layer);
      if (layer && layer.layers) {
        gatherLayersFromCollection(layer.layers, target);
      }
    });
  }

  function getAllLayers() {
    var webMap = mapEl && mapEl.webMap;
    if (!webMap) return [];

    var layers = [];
    if (webMap.allLayers && typeof webMap.allLayers.forEach === "function") {
      webMap.allLayers.forEach(function (layer) {
        layers.push(layer);
      });
      return layers;
    }

    gatherLayersFromCollection(webMap.layers, layers);
    return layers;
  }

  function buildLayerLookup(layers) {
    var lookup = Object.create(null);
    layers.forEach(function (layer) {
      [normalizeKey(layer.title), normalizeKey(layer.id)].forEach(function (key) {
        if (!key) return;
        if (!lookup[key]) lookup[key] = [];
        lookup[key].push(layer);
      });
    });
    return lookup;
  }

  function resolveTargets(targets, lookup) {
    var matched = [];
    var unresolved = [];

    (targets || []).forEach(function (target) {
      var key = normalizeKey(target);
      var isIdTarget = key.indexOf("id:") === 0;
      var keyValue = isIdTarget ? key.slice(3).trim() : key;
      var hits = lookup[keyValue] || [];

      if (!hits.length) {
        unresolved.push(target);
        return;
      }

      hits.forEach(function (layer) {
        if (matched.indexOf(layer) === -1) matched.push(layer);
      });
    });

    return { matched: matched, unresolved: unresolved };
  }

  function ensureParentGroupsVisible(layer) {
    var parent = layer && layer.parent;
    while (parent && parent.type === "group") {
      parent.visible = true;
      parent = parent.parent;
    }
  }

  // ── Layer visibility — resolves by title or id, including grouped layers ─
  function setLayers(cfg) {
    var layers = getAllLayers();
    if (!layers) {
      console.warn("[map.js] setLayers: no layers available yet");
      return;
    }

    console.log("[map.js] setLayers: " + layers.length + " resolvable layers");

    var lookup = buildLayerLookup(layers);
    var showResult = resolveTargets(cfg.layers && cfg.layers.show, lookup);
    var hideResult = resolveTargets(cfg.layers && cfg.layers.hide, lookup);

    showResult.matched.forEach(function (layer) {
      layer.visible = true;
      ensureParentGroupsVisible(layer);
      console.log("[map.js]  show: " + JSON.stringify(layer.title || layer.id));
    });

    hideResult.matched.forEach(function (layer) {
      if (showResult.matched.indexOf(layer) !== -1) return;
      layer.visible = false;
      console.log("[map.js]  hide: " + JSON.stringify(layer.title || layer.id));
    });

    if (showResult.unresolved.length) {
      console.warn("[map.js] unresolved show targets:", showResult.unresolved);
    }
    if (hideResult.unresolved.length) {
      console.warn("[map.js] unresolved hide targets:", hideResult.unresolved);
    }
  }

  // ── Navigate via attributes ────────────────────────────────────────
  function goTo(cfg) {
    if (!mapEl) return;
    mapEl.setAttribute("center", cfg.center);
    mapEl.setAttribute("scale", String(cfg.scale));
  }

  // ── Apply full config for a slide ──────────────────────────────────
  function applyConfig(key) {
    var cfg = configs[key];
    if (!cfg) return;
    console.log("[map.js] applyConfig: " + key + " | webMapReady: " + webMapReady);
    setLegendSrc(cfg.legendSrc || "conventions.svg");
    goTo(cfg);
    if (webMapReady) {
      setLayers(cfg);
    } else {
      pendingCfg = cfg;
    }
  }

  // ── Slide transition handler ───────────────────────────────────────
  function onSlide(section) {
    if (!section) return;
    var key    = section.getAttribute("data-slide-key");
    var isMap  = section.classList.contains("has-map");
    var reveal = document.querySelector(".reveal");
    if (isMap && key && configs[key]) {
      panel.classList.add("visible");
      if (reveal) reveal.classList.add("has-map-active");
      applyConfig(key);
    } else {
      panel.classList.remove("visible");
      if (reveal) reveal.classList.remove("has-map-active");
    }
  }

  // ── Poll for webMap until it is a loaded WebMap object ────────────
  function waitForWebMap(attempts) {
    if (!mapEl) return;
    var webMap = mapEl.webMap;
    if (webMap && typeof webMap.when === "function") {
      webMap.when().then(function () {
        webMapReady = true;
        var layers = mapEl.webMap && mapEl.webMap.layers;
        console.log("[map.js] webMap ready — layers available: " + (layers ? layers.length : 0));
        if (layers) {
          layers.forEach(function (l, i) {
            console.log("  [" + i + "] " + JSON.stringify(l.title) + "  visible=" + l.visible);
          });
        }
        if (pendingCfg) {
          setLayers(pendingCfg);
          pendingCfg = null;
        }
      }).catch(function (err) {
        console.error("[map.js] webMap.when() error:", err);
      });
    } else if (attempts < 100) {
      setTimeout(function () { waitForWebMap(attempts + 1); }, 100);
    } else {
      console.warn("[map.js] webMap never became available after 10s");
    }
  }

  // ── Bootstrap ─────────────────────────────────────────────────────
  function initReveal() {
    if (typeof Reveal === "undefined") { setTimeout(initReveal, 50); return; }

    mapEl = document.getElementById("arcgis-map");
    legendEl = document.getElementById("legend-svg");

    if (mapEl) {
      if (typeof mapEl.componentOnReady === "function") {
        mapEl.componentOnReady().then(function () {
          console.log("[map.js] componentOnReady — polling for webMap");
          waitForWebMap(0);
        });
      } else {
        waitForWebMap(0);
      }
    }

    Reveal.on("slidechanged", function (e) { onSlide(e.currentSlide); });
    Reveal.on("ready",        function (e) { onSlide(e.currentSlide); });
    if (Reveal.isReady()) { onSlide(Reveal.getCurrentSlide()); }
  }

  initReveal();
})();
