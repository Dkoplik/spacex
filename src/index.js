import { SpaceX } from "./api/spacex";
import { clearCache } from "./api/cache";
import * as d3 from "d3";
import * as Geo from "./geo.json";

const BASE_R = 4; // dot radius in screen px
const HL_R = 8; // highlighted dot radius

document.addEventListener("DOMContentLoaded", setup);

function setup() {
  const spaceX = new SpaceX();
  const listContainer = document.getElementById("listContainer");
  const padInfo = document.getElementById("padInfo");

  const map = initMap(padInfo);

  document.getElementById("refreshBtn").addEventListener("click", () => {
    clearCache();
    load({ bypass: true });
  });
  document
    .getElementById("zoomIn")
    .addEventListener("click", () => map.zoomBy(1.6));
  document
    .getElementById("zoomOut")
    .addEventListener("click", () => map.zoomBy(1 / 1.6));
  document
    .getElementById("zoomReset")
    .addEventListener("click", () => map.reset());

  listContainer.addEventListener("mouseover", (e) => {
    const li = e.target.closest("li");
    if (!li || li.dataset.launchpadId == null) return;
    li.classList.add("hovered");
    map.highlight(li.dataset.launchpadId, true);
    map.showPadInfo(li.dataset.launchpadId);
  });

  listContainer.addEventListener("mouseout", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    if (e.relatedTarget && li.contains(e.relatedTarget)) return;
    li.classList.remove("hovered");
    if (li.dataset.launchpadId != null) {
      map.highlight(li.dataset.launchpadId, false);
    }
    map.clearPadInfo();
  });

  load({ bypass: false });

  async function load({ bypass }) {
    const [launchesRes, padsRes] = await Promise.allSettled([
      spaceX.launches({ bypass }),
      spaceX.launchpads({ bypass }),
    ]);

    if (launchesRes.status === "fulfilled") {
      renderLaunches(launchesRes.value, listContainer);
    } else {
      console.error("Launches fetch failed:", launchesRes.reason);
      renderError(listContainer, "Launch data unavailable");
    }

    if (padsRes.status === "fulfilled") {
      map.setPads(padsRes.value);
    } else {
      console.error("Launchpads fetch failed:", padsRes.reason);
      map.setPads([]);
    }
  }
}

function renderLaunches(launches, container) {
  const list = document.createElement("ul");
  launches.forEach((launch) => {
    const item = document.createElement("li");
    item.textContent = launch.name;
    if (launch.pad && launch.pad.id != null) {
      item.dataset.launchpadId = String(launch.pad.id);
    }
    list.appendChild(item);
  });
  container.replaceChildren(list);
}

function renderError(container, message) {
  const div = document.createElement("div");
  div.className = "list-error";
  div.textContent = message;
  container.replaceChildren(div);
}

/**
 * Builds the SVG, the world map, and the d3.zoom behaviour once.
 * Returns an API for pushing pad data in later and for the zoom buttons.
 */
function initMap(padInfo) {
  d3.select("#map").selectAll("*").remove();

  const width = 800;
  const height = 520;

  const svg = d3
    .select("#map")
    .append("svg")
    .attr("class", "map-svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "map-clip")
    .append("rect")
    .attr("width", width)
    .attr("height", height);

  const viewport = svg.append("g").attr("clip-path", "url(#map-clip)");
  const mapLayer = viewport.append("g");

  const projection = d3
    .geoMercator()
    .scale(90)
    .center([0, 20])
    .translate([width / 2, height / 2]);

  mapLayer
    .append("g")
    .selectAll("path")
    .data(Geo.features)
    .enter()
    .append("path")
    .attr("class", "topo")
    .attr("d", d3.geoPath().projection(projection));

  const dotsLayer = mapLayer.append("g").attr("class", "dots");

  let currentK = 1;
  let hoveredId = null;
  let padById = new Map();
  let circleSel = dotsLayer.selectAll("circle.launchpad");

  function updateRadii() {
    circleSel
      .attr("r", (d) =>
        String(d.id) === hoveredId ? HL_R / currentK : BASE_R / currentK,
      )
      .attr("stroke-width", 0.8 / currentK);
  }

  const zoom = d3
    .zoom()
    .scaleExtent([1, 25])
    .extent([
      [0, 0],
      [width, height],
    ])
    .translateExtent([
      [0, 0],
      [width, height],
    ])
    .on("zoom", (event) => {
      currentK = event.transform.k;
      mapLayer.attr("transform", event.transform);
      updateRadii();
    });

  svg.call(zoom);

  const IDLE_TEXT = "Hover a launch to see pad details";

  return {
    setPads(pads) {
      padById = new Map(pads.map((p) => [String(p.id), p]));

      const valid = pads.filter(
        (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
      );

      circleSel = dotsLayer
        .selectAll("circle.launchpad")
        .data(valid, (d) => d.id);

      circleSel.exit().remove();

      const entered = circleSel
        .enter()
        .append("circle")
        .attr("class", "launchpad")
        .attr("cx", (d) => projection([d.longitude, d.latitude])[0])
        .attr("cy", (d) => projection([d.longitude, d.latitude])[1]);

      entered
        .append("title")
        .text(
          (d) =>
            `${d.name}\n${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}`,
        );

      circleSel = entered.merge(circleSel);

      // Reset hover state on every data refresh.
      hoveredId = null;
      circleSel.classed("highlight", false);
      updateRadii();
    },

    highlight(padId, on) {
      hoveredId = on ? padId : null;
      circleSel.classed("highlight", (d) => on && String(d.id) === padId);
      updateRadii();
    },

    showPadInfo(padId) {
      const pad = padById.get(padId);
      padInfo.textContent = pad
        ? `ID: ${pad.id}  |  Name: ${pad.name}  |  ` +
          `Lat: ${pad.latitude.toFixed(4)}  |  Lon: ${pad.longitude.toFixed(4)}`
        : "No launchpad info available";
    },

    clearPadInfo() {
      padInfo.textContent = IDLE_TEXT;
    },

    zoomBy: (factor) =>
      svg.transition().duration(250).call(zoom.scaleBy, factor),
    reset: () =>
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity),
  };
}
