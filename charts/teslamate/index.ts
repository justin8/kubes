import { Chart, JsonPatch } from "cdk8s";
import { Construct } from "constructs";
import { CommonProps } from "../../lib/commonProps";
import * as k from "../../imports/k8s";
import * as kplus from "cdk8s-plus";
import * as path from "path";
import { BasicIngress } from "../../lib/ingress";

/**
 * Before using this, you do need to set a few secrets.
 * Copy secrets.json.example to secrets.json and fill in the required pieces
 */

const databaseUser = "teslamate";
const databaseName = "teslamate";

export class TeslaMate extends Chart {
  constructor(scope: Construct, id: string, props: CommonProps) {
    super(scope, id, props);

    const appName = "teslamate";
    const labels = { app: appName };
    const metadata: k.ObjectMeta = { name: appName, labels };
    const domain = `teslamate.${props.parentDomainName}`;
    const grafanaDomain = `teslamate-grafana.${props.parentDomainName}`;

    const secret = new kplus.Secret(this, "config", {
      metadata: { name: "teslamate" },
      stringData: require("./secrets.json"),
    });

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: props.hostConfigPath },
    };

    const teslaIngress = new BasicIngress(this, "teslamateIngress", {
      parentDomainName: props.parentDomainName,
      port: 4000,
      serviceName: "teslamate",
      selector: labels,
      ingressAnnotations: {
        "nginx.ingress.kubernetes.io/auth-type": "basic",
        "nginx.ingress.kubernetes.io/auth-secret": secret.name,
        "nginx.ingress.kubernetes.io/auth-realm": "Authentication Required",
      },
    });

    new BasicIngress(this, "grafanaIngress", {
      parentDomainName: props.parentDomainName,
      port: 3000,
      serviceName: "teslamate-grafana",
      selector: labels,
    });

    const d = new k.Deployment(this, "deployment", {
      metadata,
      spec: {
        selector: { matchLabels: labels },
        template: {
          metadata,
          spec: {
            volumes: [configVolume],
            containers: [
              TeslaMateContainer(domain, props.TZ),
              DatabaseContainer(),
              GrafanaContainer(grafanaDomain),
              // MosquittoContainer(),
            ],
          },
        },
      },
    });
  }
}

function TeslaMateContainer(domain: string, tz: string): k.Container {
  const livenessProbe: k.Probe = {};
  return {
    name: "teslamate",
    image: "teslamate/teslamate",
    livenessProbe: { httpGet: { port: 4000 } },
    env: [
      { name: "DATABASE_PASS", valueFrom: getSecret("DATABASE_PASSWORD") },
      { name: "DATABASE_USER", value: databaseUser },
      { name: "DATABASE_NAME", value: databaseName },
      { name: "DATABASE_HOST", value: "localhost" },
      { name: "MQTT_HOST", value: "mqtt.dray.id.au" },
      { name: "MQTT_USERNAME", valueFrom: getSecret("MQTT_USERNAME") },
      { name: "MQTT_PASSWORD", valueFrom: getSecret("MQTT_PASSWORD") },
      { name: "VIRTUAL_HOST", value: domain },
      { name: "CHECK_ORIGIN", value: "true" },
      { name: "TZ", value: tz },
    ],
    ports: [{ containerPort: 4000 }],
  };
}

function DatabaseContainer(): k.Container {
  return {
    name: "database",
    image: "postgres:13",
    livenessProbe: { tcpSocket: { port: 5432 } },
    env: [
      { name: "POSTGRES_PASSWORD", valueFrom: getSecret("DATABASE_PASSWORD") },
      { name: "POSTGRES_USER", value: databaseUser },
      { name: "POSTGRES_DB", value: databaseName },
    ],
    volumeMounts: [
      {
        mountPath: "/var/lib/postgresql/data",
        name: "config",
        subPath: "teslamate/database",
      },
    ],
  };
}

function GrafanaContainer(grafanaDomain: string): k.Container {
  return {
    name: "grafana",
    image: "teslamate/grafana",
    ports: [{ containerPort: 3000 }],
    livenessProbe: { httpGet: { port: 3000, path: "/login" } },
    env: [
      { name: "DATABASE_PASS", valueFrom: getSecret("DATABASE_PASSWORD") },
      { name: "DATABASE_USER", value: databaseUser },
      { name: "DATABASE_NAME", value: databaseName },
      { name: "DATABASE_HOST", value: "localhost" },
      { name: "GRAFANA_PASSWD", valueFrom: getSecret("PASSWORD") },
      { name: "GF_SECURITY_ADMIN_USER", valueFrom: getSecret("USER") },
      { name: "GF_SECURITY_ADMIN_PASSWORD", valueFrom: getSecret("PASSWORD") },
      { name: "GF_AUTH_ANONYMOUS_ENABLED", value: "false" },
      {
        name: "GF_SERVER_DOMAIN",
        value: `teslamate-grafana.${grafanaDomain}`,
      },
    ],
    volumeMounts: [
      {
        mountPath: "/var/lib/grafana",
        name: "config",
        subPath: "teslamate/grafana",
      },
    ],
  };
}

function getSecret(secret: string): k.EnvVarSource {
  return {
    secretKeyRef: { name: "teslamate", key: secret },
  };
}

// Could run another mqtt server,
// but I have one for home automation that is going to be reused instead

// function MosquittoContainer(): k.Container {
//   return {
//     name: "mosquitto",
//     image: "eclipse-mosquitto:2",
//     command: ["mosquitto", "-c", "/mosquitto-no-auth.conf"],
//     ports: [{ containerPort: 1883 }],
//     env: [],
//     volumeMounts: [
//       {
//         mountPath: "/mosquitto",
//         name: "config",
//         subPath: "teslamate/mosquitto",
//       },
//     ],
//   };
// }
