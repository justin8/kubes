import { App } from "cdk8s";
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

app.synth();
