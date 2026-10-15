import { cachedFetch } from "./cache";

const BASE_URL = "https://ll.thespacedevs.com/2.3.0";

export class SpaceX {
  async launches({ bypass = false } = {}) {
    const url = `${BASE_URL}/launches/previous/?lsp__name=SpaceX&limit=100`;
    const data = await cachedFetch(url, { bypass });
    return data.results;
  }

  async launchpads({ bypass = false } = {}) {
    const launches = await this.launches({ bypass });

    const padIds = new Set();
    launches.forEach((launch) => {
      if (launch.pad && launch.pad.id != null) {
        padIds.add(launch.pad.id);
      }
    });

    const padPromises = Array.from(padIds).map((id) =>
      cachedFetch(`${BASE_URL}/pads/${id}/`, { bypass }),
    );
    const pads = await Promise.all(padPromises);

    return pads.map((pad) => ({
      id: pad.id,
      name: pad.name,
      latitude: Number(pad.latitude),
      longitude: Number(pad.longitude),
    }));
  }

  async launch(id, { bypass = false } = {}) {
    return cachedFetch(`${BASE_URL}/launches/${id}/`, { bypass });
  }

  async launchpad(id, { bypass = false } = {}) {
    return cachedFetch(`${BASE_URL}/pads/${id}/`, { bypass });
  }
}
