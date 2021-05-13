import { Construct } from "constructs";
import { Chart, ChartProps } from "cdk8s";

import * as k from "../../imports/k8s";
import { BasicIngress } from "../../lib/ingress";

export interface MediaServerProps extends ChartProps {
  parentDomainName: string;
  storagePath: string;
  configPath: string;
  groupID: string;
  userID: string;
  TZ: string;
}

export class MediaServer extends Chart {
  constructor(scope: Construct, id: string, props: MediaServerProps) {
    super(scope, id, props);

    const labels = this.labels;
    const metadata = { labels };
    const ports: { [key: string]: number } = {
      transmission: 9091,
      jackett: 9117,
      radarr: 7878,
      sonarr: 8989,
    };

    const storageVolume: k.Volume = {
      name: "storage",
      hostPath: { path: props.storagePath },
    };

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: props.configPath },
    };

    let containers: k.Container[] = [];

    ["jackett", "sonarr", "radarr", "transmission"].forEach((service) => {
      containers.push(
        basicContainer({
          name: service,
          image: `ghcr.io/linuxserver/${service}`,
          configVolume,
          storageVolumeName: storageVolume.name,
          storageVolumePath: props.storagePath,
          port: ports[service],
          ...props,
        })
      );

      new BasicIngress(this, service, {
        metadata,
        port: ports[service],
        parentDomainName: props.parentDomainName,
        selector: labels,
        serviceName: service,
      });
    });

    new k.Deployment(this, "deployment", {
      metadata,
      spec: {
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata,
          spec: {
            volumes: [configVolume, storageVolume],
            containers,
          },
        },
      },
    });
  }
}

interface basicContainerProps {
  name: string;
  image: string;
  userID: string;
  groupID: string;
  configVolume: k.Volume;
  storageVolumeName: string;
  storageVolumePath: string;
  port: number;
  TZ: string;
  configPath?: string;
  enableLivenessProbe?: boolean;
}

function basicContainer(props: basicContainerProps): k.Container {
  props.configPath = props.configPath ?? "/config";
  props.enableLivenessProbe = props.enableLivenessProbe ?? true;

  let livenessProbe: k.Probe | undefined = undefined;
  if (props.enableLivenessProbe) {
    livenessProbe = {
      httpGet: {
        port: props.port,
      },
      initialDelaySeconds: 30,
    };
  }

  return {
    name: props.name,
    image: props.image,
    livenessProbe,
    env: [
      { name: "PGID", value: props.groupID },
      { name: "PUID", value: props.userID },
    ],
    ports: [{ containerPort: props.port }],
    volumeMounts: [
      {
        mountPath: props.storageVolumePath,
        name: props.storageVolumeName,
      },
      {
        mountPath: props.configPath,
        name: props.configVolume.name,
        subPath: props.name,
      },
    ],
  };
}
