import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {};

export class SbcntrVpc extends Construct {
  readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

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

    const vpc = new ec2.Vpc(this, "sbcntrVpc", {
      cidr: "172.16.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGatewayProvider: natInstance,
      natGateways: 1,
      availabilityZones: ["ap-northeast-1a", "ap-northeast-1c"],
      // 本ではIPを8ずつずらして割り振っていたが、CDKの以下の書き方にすると適当にバラける。
      subnetConfiguration: [
        // container (アプリケーション)
        {
          cidrMask: 24,
          name: "sbcntr-subnet-private-container",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        // db
        {
          cidrMask: 24,
          name: "sbcntr-subnet-private-db",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        // ingress (FEのALB)
        {
          cidrMask: 24,
          name: "sbcntr-subnet-public-ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        // management
        {
          cidrMask: 24,
          name: "sbcntr-subnet-public-management",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        // egress (VPC Endpoint用)
        {
          cidrMask: 24,
          name: "sbcntr-subnet-private-egress",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // NATインスタンスはVPC内からのみアクセス許可
    natInstance.securityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTraffic()
    );

    this.vpc = vpc;
  }
}
