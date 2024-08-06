import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Tags } from "aws-cdk-lib";

type Props = {};

export class MyCustomSubnetVpc extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, "MyVpc", {
      ipAddresses: ec2.IpAddresses.cidr("192.168.0.0/16"),
      // NOTE: ここを空のリストにするとサブネットやIGW, NAT Gatewayなどが作成されない
      subnetConfiguration: [],
    });

    // --- Public Subnet ---
    const subnetPub = new ec2.Subnet(this, "SubnetPub", {
      availabilityZone: "ap-northeast-1a",
      vpcId: vpc.vpcId,
      cidrBlock: "192.168.0.0/24",
    });
    Tags.of(subnetPub).add("Name", "my-subnet-public");

    // --- Internet Gateway ---
    const igw = new ec2.CfnInternetGateway(this, "IGW", {
      tags: [
        {
          key: "Name",
          value: "my-igw",
        },
      ],
    });
    // internet gatewayとVPCを紐づけ
    const igwAttach = new ec2.CfnVPCGatewayAttachment(this, "IGWAttach", {
      vpcId: vpc.vpcId,
      internetGatewayId: igw.ref,
    });
    // subnetに route tableを設定
    // NOTE: default routeとは、送信先が 0.0.0.0/0 のこと
    subnetPub.addDefaultInternetRoute(igw.ref, igwAttach);

    // --- NAT Gateway ---
    const eipNatGW = new ec2.CfnEIP(this, "EIP", {});
    Tags.of(eipNatGW).add("Name", "my-eip");
    // NAT gatewayをElastic IPとpublic subnetに紐づけ
    const natGw = new ec2.CfnNatGateway(this, "NATGateway", {
      allocationId: eipNatGW.attrAllocationId,
      subnetId: subnetPub.subnetId,
      tags: [
        {
          key: "Name",
          value: "my-natgw",
        },
      ],
    });

    // --- Private Subnet ---
    const PriSubnet = new ec2.Subnet(this, "PrivateSubnet", {
      availabilityZone: "ap-northeast-1a",
      vpcId: vpc.vpcId,
      cidrBlock: "192.168.16.0/24",
    });
    Tags.of(PriSubnet).add("Name", "my-subnet-private");
    // private subnetとNAT gatewayを紐づけ
    PriSubnet.addDefaultNatRoute(natGw.ref);
  }
}
