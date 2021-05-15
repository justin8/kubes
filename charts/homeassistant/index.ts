import { Chart } from "cdk8s";
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

export class HomeAutomation extends Chart {
  constructor(scope: Construct, id: string, props: CommonProps) {
    super(scope, id, props);

    new HomeAssistant(this, "homeassistant", { ...props });
    new NodeRed(this, "nodered", { ...props });
    new Mosquitto(this, "mosquitto", { ...props });
    new Zigbee2MQTT(this, "zigbee2mqtt", { ...props });

    const secrets = require("./secrets.json");
    new kplus.Secret(this, "config", {
      metadata: { name: "homeautomation" },
      stringData: secrets,
    });
  }
}

class HomeAssistant extends Construct {
  constructor(scope: Construct, id: string, props: CommonProps) {
    super(scope, id);

    // Needs host networking
    // How does this play with services? what happens?
    // Needs it's mysql database.
    //     This is somewhat ephemeral, we can use a mounted volume for it
    //     We were setting a password with environment variable
    //     We can pass through the password to hass with an env var in the config file
    //     Can we generate the secret in here? like what kustomize can do?

    const appName = "home-assistant";
    const labels = { app: appName };
    const metadata: k.ObjectMeta = { name: appName, labels };
    const image = "homeassistant/home-assistant:2020.12.2";
    const port = 8123;

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: props.hostConfigPath },
    };

    const timezoneVolume: k.Volume = {
      name: "timezone",
      hostPath: { path: "/etc/localtime" },
    };

    const databasePasswordSecret: k.EnvVar = {
      name: "MYSQL_ROOT_PASSWORD",
      valueFrom: {
        secretKeyRef: { key: "MYSQL_ROOT_PASSWORD", name: "homeautomation" },
      },
    };

    const homeAssistantContainerDefinition: k.Container = {
      name: appName,
      image: image,
      livenessProbe: { tcpSocket: { port } },
      env: [databasePasswordSecret],
      volumeMounts: [
        {
          mountPath: "/etc/localtime",
          name: timezoneVolume.name,
        },
        {
          mountPath: "/config",
          name: configVolume.name,
          subPath: appName,
        },
      ],
    };

    new BasicIngress(this, "ingress", {
      metadata: metadata,
      port: port,
      parentDomainName: props.parentDomainName,
      selector: labels,
      serviceName: appName,
    });

    new k.Deployment(this, "homeassistant-deployment", {
      metadata,
      spec: {
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata,
          spec: {
            hostNetwork: true,
            volumes: [configVolume, timezoneVolume],
            containers: [homeAssistantContainerDefinition],
          },
        },
      },
    });

    const databaseLabels = { app: `${appName}-database` };
    const databaseMetadata: k.ObjectMeta = {
      name: databaseLabels.app,
      labels: databaseLabels,
    };
    const databasePort = 3306;

    const databaseContainerDefinition: k.Container = {
      name: "database",
      image: "mysql:8",
      env: [databasePasswordSecret],
      livenessProbe: { tcpSocket: { port: 3306 } },
      volumeMounts: [
        {
          mountPath: "/var/lib/mysql",
          name: "config",
          subPath: `${appName}-database`,
        },
      ],
    };

    new k.Service(this, "database-service", {
      metadata: databaseMetadata,
      spec: {
        ports: [{ port: databasePort, targetPort: databasePort }],
        selector: databaseLabels,
      },
    });

    new k.Deployment(this, "database-deployment", {
      metadata: databaseMetadata,
      spec: {
        selector: {
          matchLabels: databaseLabels,
        },
        template: {
          metadata: databaseMetadata,
          spec: {
            volumes: [configVolume, timezoneVolume],
            containers: [databaseContainerDefinition],
          },
        },
      },
    });
  }
}

class NodeRed extends Construct {
  constructor(scope: Construct, id: string, props: CommonProps) {
    super(scope, id);
    const appName = "node-red";
    const labels = { app: appName };
    const metadata: k.ObjectMeta = { name: appName, labels };
    const image = "justin8/node-red";
    const port = 1880;

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: props.hostConfigPath },
    };

    const timezoneVolume: k.Volume = {
      name: "timezone",
      hostPath: { path: "/etc/localtime" },
    };

    const containerDefinition: k.Container = {
      name: appName,
      image: image,
      livenessProbe: { httpGet: { port } },
      volumeMounts: [
        {
          mountPath: "/data",
          name: "config",
          subPath: appName,
        },
        {
          mountPath: "/etc/localtime",
          name: timezoneVolume.name,
        },
      ],
    };

    new BasicIngress(this, "ingress", {
      metadata: metadata,
      port: port,
      parentDomainName: props.parentDomainName,
      selector: labels,
      serviceName: appName,
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
            volumes: [configVolume, timezoneVolume],
            containers: [containerDefinition],
          },
        },
      },
    });
  }
}

class Mosquitto extends Construct {
  constructor(scope: Construct, id: string, props: CommonProps) {
    super(scope, id);

    /**
     * Currently using host networking to enable port 1883 on a static IP on the network
     * Could re-evaluate with a different network DNS/routing setup internally
     */

    const appName = "mosquitto";
    const labels = { app: appName };
    const metadata: k.ObjectMeta = { name: appName, labels };
    const image = "eclipse-mosquitto:1.6";
    const port = 1883;

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: props.hostConfigPath },
    };

    const containerDefinition: k.Container = {
      name: appName,
      image: image,
      livenessProbe: {
        exec: {
          command: [
            "sh",
            "-c",
            "echo $FOO > /tmp/out",
            "mosquitto_pub",
            "-u",
            "$MQTT_TEST_USER_NAME",
            "-P",
            "$MQTT_TEST_USER_PASSWORD",
            "-t",
            "test_topic",
            "-m",
            "test-message",
          ],
        },
      },
      env: [
        {
          name: "MQTT_TEST_USER_PASSWORD",
          valueFrom: {
            secretKeyRef: {
              name: "homeautomation",
              key: "MQTT_TEST_USER_PASSWORD",
            },
          },
        },
        {
          name: "MQTT_TEST_USER_NAME",
          valueFrom: {
            secretKeyRef: {
              name: "homeautomation",
              key: "MQTT_TEST_USER_NAME",
            },
          },
        },
      ],
      volumeMounts: [
        {
          mountPath: "/mosquitto",
          name: "config",
          subPath: appName,
        },
      ],
    };

    new BasicIngress(this, "ingress", {
      metadata: metadata,
      port: port,
      parentDomainName: props.parentDomainName,
      selector: labels,
      serviceName: appName,
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
            hostNetwork: true,
            volumes: [configVolume],
            containers: [containerDefinition],
          },
        },
      },
    });
  }
}

class Zigbee2MQTT extends Construct {
  constructor(scope: Construct, id: string, props: CommonProps) {
    super(scope, id);

    // Read:
    // https://github.com/kubernetes/kubernetes/issues/5607#issuecomment-258195005
    // https://github.com/kubernetes/kubernetes/issues/7890#issuecomment-766088805
    // Basically: enabled privileged mode on the container in order to access devices

    const appName = "zigbee2mqtt";
    const labels = { app: appName };
    const metadata: k.ObjectMeta = { name: appName, labels };
    const image = "koenkk/zigbee2mqtt";
    const zigbeeDevicePath = "/dev/ttyACM0";

    const configVolume: k.Volume = {
      name: "config",
      hostPath: { path: props.hostConfigPath },
    };

    const zigbeeDeviceVolume: k.Volume = {
      name: "zigbee-device-volume",
      hostPath: { path: zigbeeDevicePath },
    };

    const containerDefinition: k.Container = {
      name: appName,
      image: image,
      securityContext: { privileged: true },
      volumeMounts: [
        {
          mountPath: "/app/data",
          name: "config",
          subPath: appName,
        },
        {
          mountPath: zigbeeDevicePath,
          name: "zigbee-device-volume",
        },
      ],
    };

    new k.Deployment(this, "deployment", {
      metadata,
      spec: {
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata,
          spec: {
            volumes: [configVolume, zigbeeDeviceVolume],
            containers: [containerDefinition],
          },
        },
      },
    });
  }
}
