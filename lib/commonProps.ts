import { ChartProps } from "cdk8s";

export interface CommonProps extends ChartProps {
  parentDomainName: string;
  hostStoragePath: string;
  hostConfigPath: string;
  groupID: string;
  userID: string;
  TZ: string;
}
