import { Construct } from "constructs";
import { Chart, ChartProps } from "cdk8s";

import * as k from "../../imports/k8s";

export interface SyncthingProps extends ChartProps {
  hostConfigPath: string;
  hostStoragePath: string;
  groupID: string;
  userID: string;
}

export class Syncthing extends Chart {
  constructor(scope: Construct, id: string, props: SyncthingProps) {
    super(scope, id, props);

    const labels = this.labels;
    const metadata = { labels };
    const image = "ghcr.io/linuxserver/syncthing";

    const dropboxVolume: k.Volume = {
      name: "storage",
      hostPath: { path: "/home/downloads/Dropbox" },
    };

    const syncthingVolume: k.Volume = {
      name: "syncthing",
      hostPath: { path: `${props.hostStoragePath}/syncthing`}
    }

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: `${props.hostConfigPath}/syncthing` },
    };

    const livenessProbe: k.Probe = {
      initialDelaySeconds: 60,
      periodSeconds: 30,
      timeoutSeconds: 10,
      exec: {
        command: [
          "sh",
          "-c",
          "apk add -U curl && curl -s localhost:8384|grep 'Not Authorized'",
        ],
      },
    };

    const container: k.Container = {
      name: "syncthing",
      image,
      livenessProbe,
      env: [
        {
          name: "PGID",
          value: props.groupID,
        },
        {
          name: "PUID",
          value: props.userID,
        },
      ],
      volumeMounts: [
        { mountPath: "/Dropbox", name: dropboxVolume.name },
        { mountPath: "/config", name: configVolume.name },
        { mountPath: "/syncthing", name: syncthingVolume.name },
      ],
    };

    new k.Deployment(this, "deployment", {
      metadata,
      spec: {
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: { labels },
          spec: {
            hostNetwork: true,
            volumes: [dropboxVolume, configVolume, syncthingVolume],
            containers: [container],
          },
        },
      },
    });
  }
}
