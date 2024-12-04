import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {
  vpcId: string;
};

export class MyBasicVpc extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // VPCは既存のものを利用する場合もけっこうあるのでこのような分岐の書き方は有効的。
    const vpc =
      props.vpcId != null
        ? ec2.Vpc.fromLookup(this, "MyVpc", { vpcId: props.vpcId })
        : new ec2.Vpc(this, "MyVpc", {
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
