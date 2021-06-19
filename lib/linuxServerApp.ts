import { Chart, ChartProps } from "cdk8s";
import { Construct } from "constructs";

import * as k from "../imports/k8s";
import { BasicIngress } from "./ingress";

export interface LinuxServerAppProps extends ChartProps {
  /**
   * The name of the application, used for configuration file path and source image name
   */
  appName: string;

  /**
   * The port this application listens on, used for the service
   */
  port: number;

  /**
   * The parent domain, app will be available at `${appName}.${parentDomainName}`
   */
  parentDomainName: string;

  /**
   * The path to the storage volume on the host
   * It is mapped 1:1 directly in to the container
   */
  hostStoragePath: string;

  /**
   * The path to the parent config folder on the host
   * Configuration for this app will be saved in `${hostConfigPath}/${appName}`
   */
  hostConfigPath: string;

  /**
   * The path to mount the configuration volume inside of the container
   *
   * @default /config
   */
  containerConfigPath?: string;

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

  /**
   * The timezone to use within the container, if supported
   * @example Australia/Brisbane
   */
  TZ: string;

  /**
   * Enable liveness probes. These will try to look for a 200 response from `/` on the provided port
   *
   * @default true
   */
  enableLivenessProbe?: boolean;

  /**
   * Create a service and ingress for this app
   *
   * @default true
   */
  enableIngress?: boolean;

  /**
   * Enable host networking mode
   *
   * @default false
   */
  enableHostNetworking?: boolean;

  /**
   * The path to run Liveness probes against
   *
   * @default
   *  {
   *   httpGet: {
   *     port: props.port,
   *   },
   *   initialDelaySeconds: 30,
   * }
   */
  livenessProbe?: k.Probe;

  /**
   * Set the image to use for the container
   *
   * @default ghcr.io/linuxserver/${appName}
   */
  image?: string;

  /**
   * Environment variables to pass through to the container
   */
  env?: k.EnvVar[];
}

export class LinuxServerApp extends Chart {
  public deployment: k.Deployment;
  public service: k.Service | undefined;
  public ingress: k.IngressV1Beta1 | undefined;

  constructor(scope: Construct, id: string, props: LinuxServerAppProps) {
    super(scope, id);
    props.containerConfigPath = props.containerConfigPath ?? "/config";
    props.enableLivenessProbe = props.enableLivenessProbe ?? true;
    props.enableIngress = props.enableIngress ?? true;
    props.enableHostNetworking = props.enableHostNetworking || false;
    props.env = props.env || [];
    props.image = props.image ?? `ghcr.io/linuxserver/${props.appName}`;
    const labels = { app: props.appName, ...this.labels };
    const metadata = { labels };

    const storageVolume: k.Volume = {
      name: "storage",
      hostPath: { path: props.hostStoragePath },
    };

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: props.hostConfigPath },
    };

    let livenessProbe: k.Probe | undefined = undefined;
    if (props.enableLivenessProbe) {
      if (props.livenessProbe == undefined) {
        props.livenessProbe = {
          httpGet: {
            port: props.port,
          },
          initialDelaySeconds: 30,
        };
      }
    }

    const containerDefinition: k.Container = {
      name: props.appName,
      image: props.image,
      livenessProbe,
      env: [
        { name: "PGID", value: props.groupID },
        { name: "PUID", value: props.userID },
        ...props.env,
      ],
      ports: [{ containerPort: props.port }],
      volumeMounts: [
        {
          mountPath: props.hostStoragePath,
          name: storageVolume.name,
        },
        {
          mountPath: props.containerConfigPath,
          name: configVolume.name,
          subPath: props.appName,
        },
      ],
    };

    if (props.enableIngress) {
      const basicIngress = new BasicIngress(this, "ingress", {
        metadata,
        port: props.port,
        parentDomainName: props.parentDomainName,
        selector: labels,
        serviceName: props.appName,
      });

      this.ingress = basicIngress.ingress;
      this.service = basicIngress.service;
    }

    this.deployment = new k.Deployment(this, "deployment", {
      metadata,
      spec: {
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata,
          spec: {
            hostNetwork: props.enableHostNetworking,
            volumes: [configVolume, storageVolume],
            containers: [containerDefinition],
          },
        },
      },
    });
  }
}
