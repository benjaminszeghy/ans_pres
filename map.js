(function () {
  "use strict";

  // ── Per-slide configuration ────────────────────────────────────────
  //
  //  center  → "longitude,latitude" string (matches arcgis-embedded-map attribute)
  //  scale   → numeric map scale denominator (smaller = more zoomed in)
  //  layers  → exact layer titles from console log — populate after first load
  //  legend  → items rendered in the strip below the map
  //
  var configs = {
    fig2: {
      center: "3.979,53.333",
      scale: 147914381,
      layers: { show: [], hide: [] },
      legend: {
        title: "Liability Conventions, Reciprocity & Reactor Locations",
        items: [
          { color: "#6baed6", label: "Paris Convention (PC)" },
          { color: "#78c679", label: "Vienna Convention (VC)" },
          { color: "#b5cf6b", label: "Joint Protocol (JP)" },
          { color: "#fd8d3c", label: "Brussels Supplementary (BSC)" },
          { color: "#9467bd", label: "Convention on Supplementary Compensation (CSC)" },
          { color: "#636363", label: "No Convention (Has Nuclear Power)" },
          { color: "#969696", label: "No Convention (Research Reactors)" }
        ]
      }
    },

    fig3: {
      center: "20.0,35.0",
      scale: 80000000,
      layers: { show: [], hide: [] },
      legend: {
        title: "Transboundary Reciprocity, Reactor Locations & Population Density",
        items: [
          { color: "#2166ac", label: "High Population Density" },
          { color: "#9ecae1", label: "Low Population Density" },
          { color: "#f0a500", label: "Reactor 50-mile Radius" },
          { color: "#222222", label: "No Reciprocity (solid border)" },
          { color: "#888888", label: "Reciprocity (dashed border)" }
        ]
      }
    }
  };

  // ── Inject the map panel (lives outside .slides, persists across slides) ──
  var panel = document.createElement("div");
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
    "  <p id=\"legend-title\"></p>" +
    "  <ul id=\"legend-items\"></ul>" +
    "</div>";
  document.body.appendChild(panel);

  var mapEl = null;
  var pendingKey = null;

  // ── Legend renderer ────────────────────────────────────────────────
  function renderLegend(leg) {
    document.getElementById("legend-title").textContent = leg.title;
    document.getElementById("legend-items").innerHTML = leg.items
      .map(function (item) {
        return (
          "<li>" +
          "<span class=\"legend-swatch\" style=\"background:" + item.color + "\"></span>" +
          "<span class=\"legend-label\">" + item.label + "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  // ── Navigate the embedded map to the config's center/scale ────────
  function navigateTo(cfg) {
    if (!mapEl) return;
    var view = mapEl.view;
    if (view && view.goTo) {
      var parts = cfg.center.split(",");
      view.goTo(
        { center: [parseFloat(parts[0]), parseFloat(parts[1])], scale: cfg.scale },
        { duration: 1200, easing: "ease-in-out" }
      );
      // Layer visibility — populate cfg.layers.show / hide after inspecting console
      var layers = view.map && view.map.layers;
      if (layers) {
        layers.forEach(function (layer) {
          if (cfg.layers.show.indexOf(layer.title) !== -1) layer.visible = true;
          if (cfg.layers.hide.indexOf(layer.title) !== -1) layer.visible = false;
        });
      }
    } else {
      // Component not fully ready yet — set attributes as fallback
      mapEl.setAttribute("center", cfg.center);
      mapEl.setAttribute("scale", String(cfg.scale));
    }
  }

  // ── Apply a slide's full configuration ────────────────────────────
  function applyConfig(key) {
    var cfg = configs[key];
    if (!cfg) return;
    renderLegend(cfg.legend);
    var view = mapEl && mapEl.view;
    if (view && view.goTo) {
      navigateTo(cfg);
    } else {
      // Store key; arcgisViewReadyChange handler will pick it up
      pendingKey = key;
      if (mapEl) {
        mapEl.setAttribute("center", cfg.center);
        mapEl.setAttribute("scale", String(cfg.scale));
      }
    }
  }

  // ── Handle slide transitions ───────────────────────────────────────
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

  // ── Wire up Reveal events ──────────────────────────────────────────
  function initReveal() {
    if (typeof Reveal === "undefined") {
      setTimeout(initReveal, 50);
      return;
    }

    mapEl = document.getElementById("arcgis-map");

    // Log layers to console once the component is interactive
    if (mapEl) {
      mapEl.addEventListener("arcgisViewReadyChange", function (e) {
        if (!e.detail) return; // fired with false when view is destroyed

        var view = mapEl.view;
        if (view && view.map && view.map.layers) {
          console.log("[map.js] Webmap layers — use titles in show/hide arrays:");
          view.map.layers.forEach(function (layer, i) {
            console.log("  [" + i + "] \"" + layer.title + "\"  visible=" + layer.visible);
          });
        }

        // Apply any config that was requested before the view was ready
        if (pendingKey) {
          navigateTo(configs[pendingKey]);
          pendingKey = null;
        }
      });
    }

    Reveal.on("slidechanged", function (e) { onSlide(e.currentSlide); });
    Reveal.on("ready",        function (e) { onSlide(e.currentSlide); });

    if (Reveal.isReady()) {
      onSlide(Reveal.getCurrentSlide());
    }
  }

  initReveal();
})();
