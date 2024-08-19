import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {};

export class MyBasicEc2 extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const vpc = new ec2.Vpc(this, "VPC", {
      cidr: "10.0.0.0/16",
      natGateways: 0,
      maxAzs: 3,
      subnetConfiguration: [
        {
          name: "public-subnet-1",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // 3つあるAzのうち、どれか１つのみにインスタンスが作成される！
    // どれに作成されたかはコンソールで確認できる
    const instance = new ec2.Instance(this, "Instance", {
      vpc,
      vpcSubnets: { subnetGroupName: "public-subnet-1" },
      // これでもいけそう
      //   vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.NANO
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
    });
  }
}
