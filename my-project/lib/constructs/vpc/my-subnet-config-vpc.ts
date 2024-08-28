import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {
  cheapVpc: boolean;
};

export class MySubnetConfigVpc extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // natGatewayProvider を指定する場合
    const natInstance = ec2.NatProvider.instanceV2({
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      defaultAllowedTraffic: ec2.NatTrafficDirection.OUTBOUND_ONLY,
    });

    const vpc = new ec2.Vpc(this, "MyVpc", {
      // 以下のような設定にすると、各Azごとに3つのサブネットが作成されるが、
      // NATは3つの"application"サブネットで共有される!
      // ただし、NATは1つのAzにしか作成されないので、AWSとしては冗長化を推奨している
      // Ref: https://dev.classmethod.jp/articles/tsnote-nat-gateway-notification-redundancy/
      // どのAzのどのサブネットにNATが作成されたかはコンソールを見れば確認できる
      maxAzs: 3,
      // NAT Gatewayの代わりに安いEC2インスタンスでNATを立てる場合は natGatewayProvider を指定する
      natGatewayProvider: natInstance,
      natGateways: 1,
      // default: The VPC CIDR will be evenly divided between 1 public and 1 private subnet per AZ
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ingress",
          // internet gatewayがアタッチされたサブネット
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "application",
          // NAT gatewayがroutingされたサブネット
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: "rds",
          // 何もアタッチされていないサブネット。
          // 例えば route tableの中身が [送信先: 10.0.0.0/16, ターゲット: local ]のみのサブネット
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // natGatewayProvider を指定する場合
    // NATインスタンスはVPC内からのみアクセス許可
    natInstance.securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTraffic()
    );
  }
}
