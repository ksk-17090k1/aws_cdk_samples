import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {};

export class MyDesignatedSubnetEc2 extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const vpc = new ec2.Vpc(this, "MyVpc", {
      cidr: "172.16.0.0/16",
      // Azは直接指定するのがミソ
      availabilityZones: ["ap-northeast-1a", "ap-northeast-1c"],
      // NaT作成する場合
      //   natGateways: 1,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: "MyPublic",
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: "MyDB",
          cidrMask: 24,
        },
        // NaT作成する場合
        // {
        //   subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        //   name: "MyPrivate",
        //   cidrMask: 24,
        // },
      ],
    });

    const instance = new ec2.Instance(this, "Instance", {
      // 作りたいVPCのAzを指定するのがポイント
      availabilityZone: "ap-northeast-1a",
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      // これでもいける？
      //   vpcSubnets: { subnetGroupName: "MyPublic" },
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