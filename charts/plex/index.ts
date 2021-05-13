import { Construct } from "constructs";
import { Chart, ChartProps } from "cdk8s";

import * as k from "../../imports/k8s";

export interface PlexProps extends ChartProps {
  storagePath: string;
  configPath: string;
  groupID: string;
  userID: string;
}

export class Plex extends Chart {
  constructor(scope: Construct, id: string, props: PlexProps) {
    super(scope, id, props);

    const labels = this.labels;
    const metadata = { labels };
    const image = "ghcr.io/linuxserver/plex";

    const storageVolume: k.Volume = {
      name: "storage",
      hostPath: { path: props.storagePath },
    };

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: `${props.configPath}/plex` },
    };

    const livenessProbe: k.Probe = {
      httpGet: { path: "/web", port: 32400 },
      initialDelaySeconds: 30,
    };

    const container: k.Container = {
      name: "plex",
      image,
      env: [
        {
          name: "PGID",
          value: props.groupID,
        },
        { name: "PUID", value: props.userID },
      ],
      volumeMounts: [
        {
          mountPath: props.storagePath,
          name: storageVolume.name,
        },
        { mountPath: "/config", name: configVolume.name },
      ],
      livenessProbe,
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
            volumes: [storageVolume, configVolume],
            containers: [container],
          },
        },
      },
    });
  }
}
