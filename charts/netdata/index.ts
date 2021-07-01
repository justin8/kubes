import { Construct } from "constructs";
import { Chart, ChartProps } from "cdk8s";

import * as k from "../../imports/k8s";
import * as kplus from "cdk8s-plus";
import * as path from "path";
import { BasicIngress } from "../../lib/ingress";

export interface NetdataProps extends ChartProps {
  hostConfigPath: string;
  parentDomainName: string;
}

export class Netdata extends Chart {
  constructor(scope: Construct, id: string, props: NetdataProps) {
    super(scope, id, props);

    const labels = this.labels;
    const metadata = { labels };
    const port = 19999;
    const image = "netdata/netdata";

    const config = new kplus.ConfigMap(this, "config", { metadata });
    config.addFile(path.join(__dirname, "./netdata.conf"));

    const configVolume: k.Volume = {
      name: "netdata-config",
      configMap: { name: config.name },
    };

    const cacheVolume: k.Volume = {
      name: "netdata-cache",
      hostPath: {path: `${props.hostConfigPath}/netdata/cache`}
    }

    const container: k.Container = {
      name: "netdata",
      image,
      ports: [{ containerPort: port }],
      volumeMounts: [
        {
          mountPath: "/etc/netdata/netdata.conf",
          subPath: "netdata.conf",
          name: configVolume.name,
        },
        {
          mountPath: "/var/cache/netdata",
          name: cacheVolume.name,
        }
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
            volumes: [configVolume],
            containers: [container],
          },
        },
      },
    });

    new BasicIngress(this, "netdata", {
      metadata,
      port,
      parentDomainName: props.parentDomainName,
      selector: labels,
      serviceName: "netdata",
    });
  }
}
