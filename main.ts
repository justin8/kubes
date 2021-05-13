import { App } from "cdk8s";
import { MediaServer } from "./charts/mediaServer";
import { Netdata } from "./charts/netdata";
import { Plex } from "./charts/plex";
import { Syncthing } from "./charts/syncthing";
import { UnifiController } from "./charts/unifiController";

import * as config from "./config.json";

const app = new App();

new Netdata(app, "Netdata", { labels: { app: "netdata" }, ...config });
new Plex(app, "Plex", { labels: { app: "plex" }, ...config });
new Syncthing(app, "Syncthing", {
  labels: { app: "syncthing" },
  ...config,
});
new UnifiController(app, "UnifiController", {
  labels: { app: "unifi-controller" },
  ...config,
});
new MediaServer(app, "MediaServer", {
  labels: { app: "mediaserver" },
  ...config,
});

app.synth();
