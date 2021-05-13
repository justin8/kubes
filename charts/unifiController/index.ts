import { Construct } from "constructs";
import { Chart, ChartProps } from "cdk8s";

import * as k from "../../imports/k8s";

export interface UnifiControllerProps extends ChartProps {
  configPath: string;
}

export class UnifiController extends Chart {
  constructor(scope: Construct, id: string, props: UnifiControllerProps) {
    super(scope, id, props);

    const labels = this.labels;
    const metadata = { labels };
    const image = "ghcr.io/linuxserver/unifi-controller";

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: `${props.configPath}/unifi-controller` },
    };

    const container: k.Container = {
      name: "syncthing",
      image,
      volumeMounts: [{ mountPath: "/config", name: configVolume.name }],
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
            volumes: [configVolume],
            containers: [container],
          },
        },
      },
    });
  }
}
