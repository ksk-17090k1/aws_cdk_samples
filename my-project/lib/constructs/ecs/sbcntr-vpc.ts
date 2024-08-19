import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {};

export class SbcntrVpc extends Construct {
  readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const vpc = new ec2.Vpc(this, "sbcntrVpc", {
      //   cidr: "10.0.0.0/16",
      cidr: "172.16.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      natGateways: 0,
      availabilityZones: ["ap-northeast-1a", "ap-northeast-1c"],
      // 本ではIPを8ずつずらして割り振っていたが、CDKの以下の書き方にすると適当にバラける。
      subnetConfiguration: [
        // container (アプリケーション)
        {
          cidrMask: 24,
          name: "sbcntr-subnet-private-container",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        // db
        {
          cidrMask: 24,
          name: "sbcntr-subnet-private-db",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
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
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
    this.vpc = vpc;
  }
}
