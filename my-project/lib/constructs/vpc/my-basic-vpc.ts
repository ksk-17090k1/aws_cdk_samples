import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {};

export class MyBasicVpc extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const vpc = new ec2.Vpc(this, "MyVpc", {
      vpcName: "MyVpc",
      // 192.168.0.0/16, 172.16.0.0/16 でもOK
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      // it defaults to DEFAULT
      defaultInstanceTenancy: ec2.DefaultInstanceTenancy.DEFAULT,
      // 以下2つの詳細はメモ参照。defaultは両者ともtrue
      enableDnsHostnames: true,
      enableDnsSupport: true,
      // it defaults to 3
      maxAzs: 3,
    });
  }
}
