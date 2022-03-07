import { Chart, ChartProps } from "cdk8s";
import { Construct } from "constructs";
import { CommonProps } from "../../lib/commonProps";
import * as k from "../../imports/k8s";
import * as kplus from "cdk8s-plus";
import * as path from "path";
import { BasicIngress } from "../../lib/ingress";

export interface GameServerProps extends ChartProps {
  hostConfigPath: string;
  hostStoragePath: string;
  image: string;

  /**
   * The path to mount the configuration volume inside of the container
   * @default /config
   */
  containerConfigPath?: string;

  /**
   * The path to mount the configuration volume inside of the container
   * @default /data
   */
  containerDataPath?: string;

  /**
   * Environment variables to pass through to the container
   */
  env?: k.EnvVar[];

  /**
   * Enable host networking mode
   *
   * @default true
   */
  enableHostNetworking?: boolean;

  /**
   * The group ID to use within the container
   * Relevant for apps that share ownership of items via the storage volume
   */
  groupID: string;

  /**
   * The user ID to use within the container
   * Relevant for apps that share ownership of items via the storage volume
   */
  userID: string;
}

export class GameServer extends Chart {
  constructor(scope: Construct, id: string, props: GameServerProps) {
    super(scope, id, props);
    props.enableHostNetworking = props.enableHostNetworking || true;
    props.containerConfigPath = props.containerConfigPath || "/config";
    props.containerDataPath = props.containerDataPath || "/data";
    props.env = props.env || [];

    const labels = { app: id.toLowerCase(), ...this.labels };
    const metadata = { labels };

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: `${props.hostConfigPath}/games/${id.toLowerCase()}` },
    };

    const dataVolume: k.Volume = {
      name: "data",
      hostPath: {
        path: `${props.hostConfigPath}/games/${id.toLowerCase()}-data`,
      },
    };

    const container: k.Container = {
      name: id.toLowerCase(),
      image: props.image,
      env: [
        { name: "PGID", value: props.groupID },
        { name: "PUID", value: props.userID },
        ...props.env,
      ],
      volumeMounts: [
        { mountPath: props.containerConfigPath, name: configVolume.name },
        { mountPath: props.containerDataPath, name: dataVolume.name },
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
            hostNetwork: props.enableHostNetworking,
            volumes: [configVolume, dataVolume],
            containers: [container],
          },
        },
      },
    });
  }
}
