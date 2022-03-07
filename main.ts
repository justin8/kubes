import { App } from "cdk8s";
import { GameServer } from "./charts/game";
import { HomeAutomation } from "./charts/homeassistant";
import { Netdata } from "./charts/netdata";
import { Syncthing } from "./charts/syncthing";

import * as config from "./config.json";
import { LinuxServerApp } from "./lib/linuxServerApp";

const app = new App();

new Syncthing(app, "Syncthing", {
  labels: { app: "syncthing" },
  ...config,
});

// Disabling this as it isn't really used any more, and generates a ton of noisy logs
// new Netdata(app, "Netdata", { labels: { app: "netdata" }, ...config });

//new LinuxServerApp(app, "UnifiController", {
//  appName: "unifi-controller",
//  port: 8080,
//  enableIngress: false,
//  enableHostNetworking: true,
//  livenessProbe: {
//    httpGet: {
//      port: 8443,
//      path: "/manage/account/login?redirect=manage",
//      scheme: "HTTPS",
//    },
//  },
//  ...config,
//});

new LinuxServerApp(app, "Plex", {
  appName: "plex",
  port: 32400,
  enableIngress: false,
  enableHostNetworking: true,
  livenessProbe: {
    httpGet: { port: 32400, path: "/web" },
    initialDelaySeconds: 30,
  },
  ...config,
});

new LinuxServerApp(app, "Sonarr", {
  appName: "sonarr",
  port: 8989,
  ...config,
});

new LinuxServerApp(app, "Radarr", {
  appName: "radarr",
  port: 7878,
  ...config,
});

new LinuxServerApp(app, "Jackett", {
  appName: "jackett",
  port: 9117,
  ...config,
});

new LinuxServerApp(app, "Transmission", {
  appName: "transmission",
  port: 9091,
  ...config,
  enableHostNetworking: true,
  env: [
    {
      name: "USER",
      value: config.user,
    },
    {
      name: "PASS",
      value: config.password,
    },
  ],
});

new HomeAutomation(app, "HomeAutomation", { ...config });

// Game servers
//   These are just configured in the top level, most are pretty straightforward and just need a few env vars to be set
//

// new GameServer(app, "Satisfactory", {
//   ...config,
//   containerConfigPath: "/config",
//   image: "wolveix/satisfactory-server:latest",
//   env: [
//     {name: "MAXPLAYERS", value: "4"},
//     {name: "STEAMBETA", value: "false"}
//   ]
// });

new GameServer(app, "Valheim", {
  ...config,
  containerConfigPath: "/config",
  containerDataPath: "/opt/valheim",
  image: "lloesche/valheim-server",
  env: [
    { name: "SERVER_NAME", value: "Justin" },
    { name: "WORLD_NAME", value: "Justin" },
    { name: "SERVER_PASS", value: "secret" },
    { name: "VALHEIM_PLUS", value: "true" },
  ],
});

app.synth();
