import { Construct } from "constructs";
import * as k from "../imports/k8s";

export interface IngressProps {
  /**
   * Any additional metdata you wish to add
   */
  metadata?: k.ObjectMeta;

  /**
   * The port your container is listening on
   */
  port: number;

  /**
   * Labels on your pods to use for the service selector
   */
  selector: { [key: string]: string };

  /**
   * The parent domain name, service will be exposed at `${serviceName}.${parentDomainName}`
   */
  parentDomainName: string;

  /**
   * The name to give this service
   */
  serviceName: string;
}

export class BasicIngress extends Construct {
  public service: k.Service;
  public ingress: k.IngressV1Beta1;

  constructor(scope: Construct, id: string, props: IngressProps) {
    super(scope, id);

    this.service = new k.Service(this, "service", {
      metadata: { name: props.serviceName, ...props.metadata },
      spec: {
        ports: [
          {
            port: props.port,
            targetPort: props.port,
          },
        ],
        selector: props.selector,
      },
    });

    this.ingress = new k.IngressV1Beta1(this, "ingresss", {
      metadata: { name: props.serviceName, ...props.metadata },
      spec: {
        rules: [
          {
            host: `${props.serviceName}.${props.parentDomainName}`,
            http: {
              paths: [
                {
                  backend: {
                    serviceName: this.service.name,
                    servicePort: props.port,
                  },
                },
              ],
            },
          },
        ],
      },
    });
  }
}
